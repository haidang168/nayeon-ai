/// <reference types="vite/client" />
import { GoogleGenAI, Modality } from "@google/genai";

interface KeyStatus {
  key: string;
  cooldownUntil: number;
}

const IS_MOBILE = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const apiKeys = (process.env.GEMINI_API_KEY as string || '').split(',').map(k => k.trim()).filter(k => k);
const keys: KeyStatus[] = apiKeys.map(k => ({ key: k, cooldownUntil: 0 }));

const getHealthyKey = (): string => {
  if (keys.length === 0) return '';
  const now = Date.now();
  
  // Find a key that is not in cooldown
  const availableKeys = keys.filter(k => k.cooldownUntil < now);
  
  if (availableKeys.length > 0) {
    // Pick random available key
    const selected = availableKeys[Math.floor(Math.random() * availableKeys.length)];
    return selected.key;
  }
  
  // If all keys are in cooldown, pick the one that will be ready soonest
  const soonestKey = [...keys].sort((a, b) => a.cooldownUntil - b.cooldownUntil)[0];
  return soonestKey.key; // Force use it anyway
};

const markKeyAsFailed = (failedKeyStr: string) => {
  const keyObj = keys.find(k => k.key === failedKeyStr);
  if (keyObj) {
    // 2 minute cooldown
    keyObj.cooldownUntil = Date.now() + 2 * 60 * 1000;
    console.warn(`Key has been put on cooldown for 2 minutes.`);
  }
};

const createAiCallWrapper = (methodName: 'generateContent' | 'generateContentStream') => {
  return async (...args: any[]) => {
    let lastError;
    const maxRetries = 5;

    // We can downgrade model if it's failing
    let currentConfig = args[0] || {};
    
    for (let i = 0; i < maxRetries; i++) {
      const key = getHealthyKey();
      
      // Fallback to a lighter model on the 3rd retry
      if (i === 3 && currentConfig.model === "gemini-2.5-flash") {
        console.warn(`Retried 3 times, falling back to gemini-3.1-flash-lite-preview to improve success rate.`);
        currentConfig = { ...currentConfig, model: "gemini-3.1-flash-lite-preview" };
        args[0] = currentConfig;
      }

      try {
        const client = new GoogleGenAI({ apiKey: key });
        const targetFunc = (client.models as any)[methodName];
        const apiCall = targetFunc.apply(client.models, args);
        
        // Timeout 30s
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("API Timeout")), 30000));
        return await Promise.race([apiCall, timeoutPromise]);
        
      } catch (e: any) {
        lastError = e;
        console.warn(`API call failed (Attempt ${i + 1}/${maxRetries}):`, e);
        
        // Only mark key as failed if it's a server error (503, 429, Timeout)
        const errMsg = e?.message?.toString() || e?.toString() || "";
        if (errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('Overloaded') || errMsg.includes('Timeout') || errMsg.includes('fetch failed')) {
          markKeyAsFailed(key);
        }
        
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    throw lastError;
  };
};

export const ai = {
  models: {
    generateContent: createAiCallWrapper('generateContent'),
    generateContentStream: createAiCallWrapper('generateContentStream')
  }
} as any as GoogleGenAI;

/**
 * TTS result from any provider. Format tells the client how to decode.
 * - 'mp3': Edge TTS / ElevenLabs → decode with AudioContext.decodeAudioData()
 * - 'pcm': Gemini TTS → manual Int16 → Float32 conversion
 */
export interface TTSResult {
  audio: string;  // base64 encoded audio data
  format: 'mp3' | 'pcm';
}

/**
 * TTS via server proxy — used on mobile to bypass Safari limitations.
 * Server runs Edge TTS (fast, free) with Gemini fallback.
 */
async function generateTTSViaProxy(text: string, voiceName: string = 'Kore'): Promise<TTSResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceName }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn('[TTS Proxy] Server returned error:', res.status);
      return null;
    }

    const data = await res.json();
    if (!data.audio) return null;
    return { audio: data.audio, format: data.format || 'pcm' };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      console.warn('[TTS Proxy] Request timed out');
    } else {
      console.warn('[TTS Proxy] Request failed:', e?.message);
    }
    return null;
  }
}

/**
 * Main TTS entry point.
 * - Mobile: server proxy (Edge TTS → Gemini fallback)
 * - Desktop: direct Gemini API call with hedging
 */
export async function generateTTSHedged(
  text: string,
  voiceName: string = 'Kore'
): Promise<TTSResult | null> {
  // Mobile: use server proxy
  if (IS_MOBILE) {
    return generateTTSViaProxy(text, voiceName);
  }

  // Desktop: direct Gemini API call (unchanged behavior)

  const now = Date.now();

  const available = [...keys]
    .filter(k => k.cooldownUntil < now)
    .sort(() => Math.random() - 0.5);
  const cooldown = [...keys]
    .filter(k => k.cooldownUntil >= now)
    .sort((a, b) => a.cooldownUntil - b.cooldownUntil);

  const selected = [...available, ...cooldown].slice(0, Math.min(keys.length, 2));

  if (selected.length === 0) return null;

  const TIMEOUT_MS = 8000;

  const makeCall = (keyObj: KeyStatus) => {
    const client = new GoogleGenAI({ apiKey: keyObj.key });
    return client.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
      },
    }).then(r => {
      const data = r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return data ? { audio: data, format: 'pcm' as const } : null;
    })
      .catch((err: any) => {
        const msg = err?.message?.toString() || '';
        if (/503|429|Overloaded|TIMEOUT|fetch failed/i.test(msg)) {
          markKeyAsFailed(keyObj.key);
        }
        throw err;
      });
  };

  // Fire first request
  const first = Promise.race([
    makeCall(selected[0]),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('TTS_TIMEOUT')), TIMEOUT_MS))
  ]);

  if (selected.length < 2) {
    try { return await first; } catch { return null; }
  }

  // Desktop hedging: stagger second request after 2s if first is slow
  try {
    return await Promise.race([
      first,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('STAGGER')), 2000))
    ]);
  } catch {
    const second = Promise.race([
      makeCall(selected[1]),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('TTS_TIMEOUT')), TIMEOUT_MS))
    ]);
    try {
      return await (Promise as any).any([first, second]);
    } catch { return null; }
  }
}

