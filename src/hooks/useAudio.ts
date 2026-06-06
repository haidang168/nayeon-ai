import { useState, useCallback, useRef, useEffect } from 'react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { generateTTSHedged } from '../lib/gemini';

/** Audio data: Float32Array for desktop (AudioContext), string (MP3 base64) for mobile (Audio element) */
type AudioData = Float32Array | string;

const IS_MOBILE = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

/** Max wait for the FIRST chunk before falling back to browser voice.
 *  Mobile gets longer timeout (5s) because 4G is slower — prevents unnecessary
 *  fallback to browser voice which sounds completely different from Gemini TTS. */
const FIRST_CHUNK_TIMEOUT_MS = IS_MOBILE ? 5000 : 2500;

/** LRU cache size — reduced on mobile to prevent memory pressure (each entry ~100-400KB).
 *  50 entries on desktop ≈ 20MB max, 15 on mobile ≈ 6MB max. */
const CACHE_MAX_SIZE = IS_MOBILE ? 15 : 50;

/**
 * Split text into short sentence-level chunks for parallel TTS.
 */
function splitIntoChunks(text: string): string[] {
  const sentences = text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g);
  if (!sentences || sentences.length === 0) return [text];

  const merged: string[] = [];
  let buffer = '';
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    buffer += (buffer ? ' ' : '') + trimmed;
    if (buffer.length >= 20) {
      merged.push(buffer);
      buffer = '';
    }
  }
  if (buffer) {
    if (merged.length > 0 && buffer.length < 10) {
      merged[merged.length - 1] += ' ' + buffer;
    } else {
      merged.push(buffer);
    }
  }
  return merged.length > 0 ? merged : [text];
}

/**
 * Generate TTS audio for a single text chunk.
 * - Mobile: returns raw MP3 base64 string (played via <audio> element)
 * - Desktop: returns Float32Array PCM samples (played via AudioContext)
 */
async function generateTTSChunk(text: string, ctx?: AudioContext | null): Promise<AudioData | null> {
  const result = await generateTTSHedged(text);
  if (!result) return null;
  const { audio: base64Audio, format } = result;

  // MOBILE: return raw MP3 base64 — will be played via native Audio element
  // No decoding needed! Browser handles MP3 natively. This is the most reliable
  // approach for iOS Safari which has severe AudioContext limitations.
  if (IS_MOBILE && format === 'mp3') {
    return base64Audio;
  }

  // DESKTOP: decode to Float32Array for AudioContext playback
  const binaryString = atob(base64Audio);
  const numBytes = binaryString.length;
  const bytes = new Uint8Array(numBytes);
  for (let i = 0; i < numBytes; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Decode MP3 via AudioContext (desktop only)
  if (format === 'mp3') {
    if (!ctx) return null;
    try {
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
      return audioBuffer.getChannelData(0);
    } catch (e) {
      console.error('[TTS] Failed to decode MP3:', e);
      return null;
    }
  }

  // Convert Int16 PCM → Float32 (Gemini direct API, desktop only)
  const dataView = new DataView(bytes.buffer);
  const numSamples = numBytes >> 1;
  const float32 = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    float32[i] = dataView.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

export function useAudio() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Separate refs for word-level audio (non-canceling, doesn't interrupt main audio)
  const wordSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const wordAbortRef = useRef<AbortController | null>(null);

  // LRU Audio Cache
  const audioCacheRef = useRef<Map<string, AudioData>>(new Map());
  // Ref to current HTMLAudioElement for mobile playback
  const mobileAudioRef = useRef<HTMLAudioElement | null>(null);

  // Streaming audio queue
  const playQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Pre-load browser TTS voices (used as fallback only)
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Trigger voice list load so fallback is ready if needed
      window.speechSynthesis.getVoices();
      const handler = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', handler);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', handler);
    }
  }, []);

  const getAudioCtx = useCallback(async () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      // Force 24kHz sample rate to match Gemini TTS output exactly.
      // This eliminates browser-specific resampling that causes speed/pitch
      // differences across devices (especially Safari iOS vs Chrome Desktop).
      try {
        audioCtxRef.current = new AudioCtx({ sampleRate: 24000 });
      } catch {
        // Fallback for browsers that don't support sampleRate option
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    // Create gain node for volume boost
    if (!gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current = audioCtxRef.current.createGain();
      gainNodeRef.current.gain.value = 1.2;
      gainNodeRef.current.connect(audioCtxRef.current.destination);
    }
    return audioCtxRef.current;
  }, []);

  // --- Cache helpers ---
  const cacheAudio = useCallback((key: string, data: AudioData) => {
    const cache = audioCacheRef.current;
    if (cache.size >= CACHE_MAX_SIZE) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(key, data);
    // Only persist Float32Array to IDB (strings are MP3 base64, too large)
    if (data instanceof Float32Array) {
      idbSet('audio_' + key, data).catch(() => {});
    }
  }, []);

  const getCachedAudio = useCallback(async (key: string): Promise<AudioData | null> => {
    const cache = audioCacheRef.current;
    const memData = cache.get(key);
    if (memData) {
      cache.delete(key);
      cache.set(key, memData);
      return memData;
    }
    try {
      const idbData = await idbGet<Float32Array>('audio_' + key);
      if (idbData) {
        cache.set(key, idbData);
        return idbData;
      }
    } catch (e) {}
    return null;
  }, []);

  // --- Core playback ---
  const playBuffer = useCallback(async (data: AudioData, rate: number, signal: AbortSignal): Promise<void> => {
    if (signal.aborted) { throw new DOMException('Aborted', 'AbortError'); }

    // ═══ MOBILE: Use native <audio> element (most reliable on iOS Safari) ═══
    if (typeof data === 'string') {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      return new Promise<void>((resolve, reject) => {
        const audio = new Audio(url);
        audio.playbackRate = rate;
        mobileAudioRef.current = audio;

        const cleanup = () => { URL.revokeObjectURL(url); mobileAudioRef.current = null; };
        const onAbort = () => { audio.pause(); audio.src = ''; cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
        signal.addEventListener('abort', onAbort, { once: true });

        audio.onended = () => { signal.removeEventListener('abort', onAbort); cleanup(); resolve(); };
        audio.onerror = () => { signal.removeEventListener('abort', onAbort); cleanup(); reject(new Error('Audio playback error')); };
        audio.play().catch(e => { cleanup(); reject(e); });
      });
    }

    // ═══ DESKTOP: Use AudioContext (fast, low-latency) ═══
    const ctx = await getAudioCtx();
    const audioBuffer = ctx.createBuffer(1, data.length, 24000);
    audioBuffer.getChannelData(0).set(data);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = rate;
    if (gainNodeRef.current) {
      source.connect(gainNodeRef.current);
    } else {
      source.connect(ctx.destination);
    }
    currentSourceRef.current = source;

    return new Promise<void>((resolve, reject) => {
      const onAbort = () => { try { source.stop(); } catch (e) {} reject(new DOMException('Aborted', 'AbortError')); };
      signal.addEventListener('abort', onAbort, { once: true });
      source.onended = () => { signal.removeEventListener('abort', onAbort); resolve(); };
      source.start(0);
    });
  }, [getAudioCtx]);

  const playWithBrowserVoice = useCallback((text: string, rate: number) => {
    if (!('speechSynthesis' in window)) { setIsSpeaking(false); return; }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = rate;
    // Boost browser voice volume too
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v =>
      v.lang.startsWith('fr-') &&
      (v.name.includes('Premium') || v.name.includes('Google') || v.name.includes('Thomas') || v.name.includes('Aurelie'))
    );
    if (frVoice) utterance.voice = frVoice;
    else {
      const fallback = voices.find(v => v.lang.startsWith('fr-'));
      if (fallback) utterance.voice = fallback;
    }
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  // --- Standard playAudio (used for "nghe lại", non-streaming) ---
  const playAudio = useCallback(async (text: string, rate: number = 1.0) => {
    if (!text) return;

    // Cancel previous
    if (abortRef.current) abortRef.current.abort();
    if (currentSourceRef.current) { try { currentSourceRef.current.stop(); } catch (e) {} }
    if (mobileAudioRef.current) { mobileAudioRef.current.pause(); mobileAudioRef.current.src = ''; }
    window.speechSynthesis?.cancel();

    const abort = new AbortController();
    abortRef.current = abort;
    setIsSpeaking(true);

    try {
      const ctx = await getAudioCtx();

      const chunks = splitIntoChunks(text);

      // Check cache first, then fire TTS for uncached chunks
      const ttsPromises = chunks.map(async chunk => {
        const cached = await getCachedAudio(chunk);
        if (cached) return cached;
        return generateTTSChunk(chunk, ctx);
      });

      // Race the first chunk against a timeout
      const firstChunkOrTimeout = Promise.race([
        ttsPromises[0],
        new Promise<null>(resolve => setTimeout(() => resolve(null), FIRST_CHUNK_TIMEOUT_MS))
      ]);

      const firstSamples = await firstChunkOrTimeout;

      if (abort.signal.aborted) return;

      if (!firstSamples) {
        console.log("Gemini TTS first chunk timed out, using browser voice.");
        playWithBrowserVoice(text, rate);
        return;
      }

      // Cache & play first chunk
      cacheAudio(chunks[0], firstSamples);
      await playBuffer(firstSamples, rate, abort.signal);

      // Play remaining chunks (loaded in parallel)
      for (let i = 1; i < ttsPromises.length; i++) {
        if (abort.signal.aborted) return;
        const samples = await ttsPromises[i];
        if (abort.signal.aborted) return;
        if (samples) {
          cacheAudio(chunks[i], samples);
          await playBuffer(samples, rate, abort.signal);
        }
      }

      if (!abort.signal.aborted) setIsSpeaking(false);

    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.error("Gemini TTS error, falling back:", e);
      if (!abort.signal.aborted) {
        playWithBrowserVoice(text, rate);
      }
    }
  }, [getAudioCtx, playBuffer, playWithBrowserVoice, getCachedAudio, cacheAudio]);

  // --- Lightweight word audio (does NOT cancel main playback/YouTube) ---
  const playWordAudio = useCallback(async (text: string, rate: number = 1.0) => {
    if (!text) return;

    if (wordAbortRef.current) wordAbortRef.current.abort();
    if (wordSourceRef.current) { try { wordSourceRef.current.stop(); } catch (e) {} }

    const abort = new AbortController();
    wordAbortRef.current = abort;

    try {
      const ctx = await getAudioCtx();
      const cached = await getCachedAudio(text);
      const audioData = cached || await generateTTSChunk(text, ctx);
      if (abort.signal.aborted || !audioData) return;
      cacheAudio(text, audioData);

      // Mobile: use Audio element
      if (typeof audioData === 'string') {
        const binary = atob(audioData);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = rate;
        audio.onended = () => URL.revokeObjectURL(url);
        audio.play().catch(() => URL.revokeObjectURL(url));
        return;
      }

      // Desktop: AudioContext
      const audioBuffer = ctx.createBuffer(1, audioData.length, 24000);
      audioBuffer.getChannelData(0).set(audioData);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = rate;
      if (gainNodeRef.current) { source.connect(gainNodeRef.current); }
      else { source.connect(ctx.destination); }
      wordSourceRef.current = source;
      source.start(0);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    }
  }, [getAudioCtx, getCachedAudio, cacheAudio]);

  // --- Streaming Audio API (for streaming chat responses) ---

  /** Call when streaming begins. Cancels any previous audio and prepares the queue. */
  const startStreamingAudio = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    if (currentSourceRef.current) { try { currentSourceRef.current.stop(); } catch (e) {} }
    if (mobileAudioRef.current) { mobileAudioRef.current.pause(); mobileAudioRef.current.src = ''; }
    window.speechSynthesis?.cancel();

    const abort = new AbortController();
    abortRef.current = abort;
    playQueueRef.current = Promise.resolve();
    lastQueuedRef.current = '';
    setIsSpeaking(true);
    await getAudioCtx();
  }, [getAudioCtx]);

  // Dedup guard for streaming queue
  const lastQueuedRef = useRef<string>('');

  /** Queue a sentence for TTS. Fires TTS immediately, chains playback sequentially. */
  const queueSentence = useCallback((text: string, rate: number = 1.0) => {
    if (!text.trim()) return;
    const trimmed = text.trim();

    // Skip if exact same text was just queued (prevents duplicate playback)
    if (trimmed === lastQueuedRef.current) {
      console.log('[TTS] Skipped duplicate chunk:', trimmed.slice(0, 40));
      return;
    }
    lastQueuedRef.current = trimmed;

    // Check cache first (async), but start TTS immediately if not cached
    const ttsPromise = getCachedAudio(trimmed).then(async cached => {
      if (cached) return cached;
      const ctx = await getAudioCtx();
      return generateTTSChunk(trimmed, ctx);
    });

    playQueueRef.current = playQueueRef.current.then(async () => {
      if (abortRef.current?.signal.aborted) return;
      try {
        const samples = await ttsPromise;
        if (samples && !abortRef.current?.signal.aborted) {
          cacheAudio(trimmed, samples);
          await playBuffer(samples, rate, abortRef.current!.signal);
        } else if (!abortRef.current?.signal.aborted) {
          console.log("Gemini TTS chunk returned null, falling back...");
          playWithBrowserVoice(trimmed, rate);
          // Wait a bit to let browser TTS start and finish
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (err) {
        if (!abortRef.current?.signal.aborted) {
          console.error("TTS queue error:", err);
          playWithBrowserVoice(trimmed, rate);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    });
  }, [playBuffer, getCachedAudio, cacheAudio, playWithBrowserVoice]);

  /** Call when streaming ends. Waits for the audio queue to drain, then sets isSpeaking=false. */
  const finishStreamingAudio = useCallback(() => {
    playQueueRef.current.then(() => {
      if (!abortRef.current?.signal.aborted) {
        setIsSpeaking(false);
      }
    }).catch(() => {
      setIsSpeaking(false);
    });
  }, []);

  const primeSpeech = useCallback(() => {
    // 1. Unlock browser TTS (for fallback)
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }

    // 2. MOBILE: Unlock HTML Audio element (most reliable for iOS Safari)
    //    Playing a tiny silent audio from a user gesture unlocks future .play() calls
    if (IS_MOBILE) {
      try {
        const silentMp3 = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwMHAAAAAAD/+1DEAAAFeAFf9AAAAANIM//gAABEAAAANIAAAAASMA/BAQBA4PggCAIH/6BIHBwEDg+D58H/6BIHBwEAQOf/Lg4OAgc//+UBAEDgIH///5cHBwEDn/8uDg4CBz///l/+XBwcBA5//8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7UMQfAAi4MVf9EAAAAADSAN/IAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
        const audio = new Audio(silentMp3);
        audio.volume = 0.01;
        audio.play().catch(() => {});
      } catch {}
    }
    
    // 3. Unlock Web Audio API (Both Desktop and Mobile)
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      try {
        audioCtxRef.current = new AudioCtx({ sampleRate: 24000 });
      } catch {
        audioCtxRef.current = new AudioCtx();
      }
    }
    
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (!gainNodeRef.current) {
      gainNodeRef.current = ctx.createGain();
      gainNodeRef.current.gain.value = 1.2;
      gainNodeRef.current.connect(ctx.destination);
    }
    
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  }, []);

  return {
    isSpeaking,
    playAudio,
    playWordAudio,
    primeSpeech,
    startStreamingAudio,
    queueSentence,
    finishStreamingAudio,
    initAudio: () => {}
  };
}
