/// <reference types="vite/client" />
import { GoogleGenAI, Modality } from "@google/genai";

interface KeyStatus {
  key: string;
  cooldownUntil: number;
}

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
 * Staggered TTS: fire 1 request immediately, if no response in 2s fire a backup.
 * Uses max 2 keys instead of 3 to save bandwidth and prevent network congestion.
 */
export async function generateTTSHedged(
  text: string,
  voiceName: string = 'Kore'
): Promise<string | null> {
  const now = Date.now();

  const available = [...keys]
    .filter(k => k.cooldownUntil < now)
    .sort(() => Math.random() - 0.5);
  const cooldown = [...keys]
    .filter(k => k.cooldownUntil >= now)
    .sort((a, b) => a.cooldownUntil - b.cooldownUntil);
  const selected = [...available, ...cooldown].slice(0, Math.min(keys.length, 2));

  if (selected.length === 0) return null;

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
    }).then(r => r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null)
      .catch((err: any) => {
        const msg = err?.message?.toString() || '';
        if (/503|429|Overloaded|TIMEOUT|fetch failed/i.test(msg)) {
          markKeyAsFailed(keyObj.key);
        }
        throw err;
      });
  };

  // Fire first request with 8s timeout
  const first = Promise.race([
    makeCall(selected[0]),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('TTS_TIMEOUT')), 8000))
  ]);

  if (selected.length < 2) {
    try { return await first; } catch { return null; }
  }

  // Stagger: if first doesn't respond in 2s, fire backup
  try {
    return await Promise.race([
      first,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('STAGGER')), 2000))
    ]);
  } catch {
    // First is slow or failed — fire backup in parallel
    const second = Promise.race([
      makeCall(selected[1]),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('TTS_TIMEOUT')), 8000))
    ]);
    try {
      return await (Promise as any).any([first, second]);
    } catch { return null; }
  }
}
