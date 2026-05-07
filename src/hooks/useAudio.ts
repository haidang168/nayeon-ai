import { useState, useCallback, useRef, useEffect } from 'react';
import { Modality } from "@google/genai";
import { ai } from '../lib/gemini';

/** Max wait for the FIRST chunk before falling back to browser voice */
const FIRST_CHUNK_TIMEOUT_MS = 4000;
const CACHE_MAX_SIZE = 30;

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
 * Generate TTS for a single chunk via Gemini TTS.
 * Model: gemini-2.5-flash-preview-tts — supports French natively.
 */
async function generateTTSChunk(text: string): Promise<Float32Array | null> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) return null;

  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const pcm16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768;
  }
  return float32;
}

export function useAudio() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // LRU Audio Cache
  const audioCacheRef = useRef<Map<string, Float32Array>>(new Map());

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
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    // Create gain node for volume boost
    if (!gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current = audioCtxRef.current.createGain();
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      // Reduce mobile gain from 2.0 to 1.2 to prevent heavy clipping/distortion on phones
      gainNodeRef.current.gain.value = isMobile ? 1.2 : 1.2;
      gainNodeRef.current.connect(audioCtxRef.current.destination);
    }
    return audioCtxRef.current;
  }, []);

  // --- Cache helpers ---
  const cacheAudio = useCallback((key: string, data: Float32Array) => {
    const cache = audioCacheRef.current;
    if (cache.size >= CACHE_MAX_SIZE) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(key, data);
  }, []);

  const getCachedAudio = useCallback((key: string): Float32Array | null => {
    const cache = audioCacheRef.current;
    const data = cache.get(key);
    if (data) {
      cache.delete(key);
      cache.set(key, data); // Move to end (most recently used)
      return data;
    }
    return null;
  }, []);

  // --- Core playback (with GainNode) ---
  const playBuffer = useCallback(async (float32: Float32Array, rate: number, signal: AbortSignal): Promise<void> => {
    if (signal.aborted) { throw new DOMException('Aborted', 'AbortError'); }

    const ctx = await getAudioCtx();
    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = rate;
    // Route through GainNode for volume boost
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
    window.speechSynthesis?.cancel();

    const abort = new AbortController();
    abortRef.current = abort;
    setIsSpeaking(true);

    try {
      await getAudioCtx();

      const chunks = splitIntoChunks(text);

      // Check cache first, then fire TTS for uncached chunks
      const ttsPromises = chunks.map(chunk => {
        const cached = getCachedAudio(chunk);
        if (cached) return Promise.resolve(cached);
        return generateTTSChunk(chunk);
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

  // --- Streaming Audio API (for streaming chat responses) ---

  /** Call when streaming begins. Cancels any previous audio and prepares the queue. */
  const startStreamingAudio = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    if (currentSourceRef.current) { try { currentSourceRef.current.stop(); } catch (e) {} }
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

    // Check cache first
    const cached = getCachedAudio(trimmed);
    const ttsPromise = cached ? Promise.resolve(cached) : generateTTSChunk(trimmed);

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
    // 1. Unlock browser TTS
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
    
    // 2. Unlock Web Audio API synchronously
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Create gain node for volume boost
    if (!gainNodeRef.current) {
      gainNodeRef.current = ctx.createGain();
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      gainNodeRef.current.gain.value = isMobile ? 1.2 : 1.2;
      gainNodeRef.current.connect(ctx.destination);
    }
    
    // Create and play a tiny, silent buffer to force unlock
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  }, []);

  return {
    isSpeaking,
    playAudio,
    primeSpeech,
    startStreamingAudio,
    queueSentence,
    finishStreamingAudio,
    initAudio: () => {}
  };
}
