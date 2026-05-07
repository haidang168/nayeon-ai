import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const apiKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(k => k);
const key = apiKeys[0];

const client = new GoogleGenAI({ apiKey: key });

async function test() {
  console.log("Testing gemini-3.1-flash-tts-preview...");
  try {
    const res = await client.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: "Bonjour!" }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });
    console.log("Success! Audio data size:", res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data?.length);
  } catch (e) {
    console.error("Error:", e.message || e);
  }
}

test();
