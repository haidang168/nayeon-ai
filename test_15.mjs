import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const apiKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(k => k);
const key = apiKeys[0];

const client = new GoogleGenAI({ apiKey: key });

async function test() {
  console.log("Testing gemini-1.5-flash...");
  try {
    const res = await client.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ parts: [{ text: "Bonjour!" }] }],
    });
    console.log("Success 1.5:", res.text);
  } catch (e) {
    console.error("Error 1.5:", e.message || e);
  }
}

test();
