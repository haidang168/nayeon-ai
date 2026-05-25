import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const keys = process.env.GEMINI_API_KEY.split(',').map(k => k.trim()).filter(k => k);
const text = "Bonjour, comment allez-vous aujourd'hui? Je suis très content de vous voir.";

// --- Single key (old approach) ---
async function singleTTS() {
  const key = keys[Math.floor(Math.random() * keys.length)];
  const client = new GoogleGenAI({ apiKey: key });
  return client.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
    },
  });
}

// --- Hedged 3 keys (new approach) ---
async function hedgedTTS() {
  const selected = [...keys].sort(() => Math.random() - 0.5).slice(0, 3);
  const promises = selected.map(key => {
    const client = new GoogleGenAI({ apiKey: key });
    return Promise.race([
      client.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      }),
      new Promise((_, r) => setTimeout(() => r(new Error('TIMEOUT')), 8000))
    ]);
  });
  return Promise.any(promises);
}

const hasAudio = (r) => !!r?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

// Run single first, then hedged
console.log('=== SINGLE KEY (cu) ===');
const singleTimes = [];
for (let i = 0; i < 2; i++) {
  const s = Date.now();
  try {
    const r = await singleTTS();
    const ms = Date.now() - s;
    singleTimes.push(ms);
    console.log(`  Run ${i}: ${ms}ms ✅`);
  } catch (e) {
    console.log(`  Run ${i}: ${Date.now() - s}ms ❌ ${e.message?.slice(0, 50)}`);
  }
}

// Small pause to not hit rate limits
await new Promise(r => setTimeout(r, 2000));

console.log('\n=== HEDGED 3 KEYS (moi) ===');
const hedgedTimes = [];
for (let i = 0; i < 2; i++) {
  const s = Date.now();
  try {
    const r = await hedgedTTS();
    const ms = Date.now() - s;
    hedgedTimes.push(ms);
    console.log(`  Run ${i}: ${ms}ms ✅`);
  } catch (e) {
    console.log(`  Run ${i}: ${Date.now() - s}ms ❌ ${e.message?.slice(0, 50)}`);
  }
}

if (singleTimes.length && hedgedTimes.length) {
  const avgS = Math.round(singleTimes.reduce((a, b) => a + b, 0) / singleTimes.length);
  const avgH = Math.round(hedgedTimes.reduce((a, b) => a + b, 0) / hedgedTimes.length);
  const pct = Math.round((1 - avgH / avgS) * 100);
  console.log(`\n📊 TB Single: ${avgS}ms | TB Hedged: ${avgH}ms | Nhanh hon: ${pct}%`);
}
