import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const apiKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(k => k);
const key = apiKeys[0];

const client = new GoogleGenAI({ apiKey: key });

async function test() {
  console.log("Testing stream...");
  try {
    const stream = await client.models.generateContentStream({
      model: "gemini-3.1-flash-lite-preview",
      config: {
        temperature: 0.1,
        systemInstruction: `Bạn là gia sư tiếng Pháp. ĐÁP ỨNG SIÊU TỐC. Tập trung vào LUYỆN PHẢN XẠ. Hãy trả lời học viên bằng 1-2 câu tiếng Pháp ngắn gọn (khoảng 10-15 chữ). Trình độ trên A1 một chút. CHỈ TRẢ VỀ KIỂU TEXT (không JSON, không định dạng gì khác).`
      },
      contents: [{ parts: [{ text: "Tình huống: Quán cafe. Học viên: Bonjour" }] }]
    });

    for await (const chunk of stream) {
      process.stdout.write(chunk.text);
    }
    console.log("\nStream done!");
  } catch (e) {
    console.error("\nStream error:", e);
  }
}

test();
