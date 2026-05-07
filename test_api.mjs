import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const apiKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(k => k);
const key = apiKeys[0];
console.log("Using key:", key ? key.substring(0, 10) + "..." : "none");

const client = new GoogleGenAI({ apiKey: key });

async function test() {
  console.log("Testing gemini-3.1-flash-lite-preview...");
  try {
    const res = await client.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [{ role: "user", parts: [{ text: "Bonjour!" }] }],
    });
    console.log("Success:", res.text);
  } catch (e) {
    console.error("Error with gemini-3.1-flash-lite-preview:", e.message || e);
  }

  console.log("\nTesting gemini-2.5-flash...");
  try {
    const res2 = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: "Bonjour!" }] }],
    });
    console.log("Success:", res2.text);
  } catch (e) {
    console.error("Error with gemini-2.5-flash:", e.message || e);
  }
}

test();
