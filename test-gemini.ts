import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const apiKeys = (process.env.GEMINI_API_KEY as string || '').split(',').map(k => k.trim()).filter(k => k);
const client = new GoogleGenAI({ apiKey: apiKeys[0] });

async function test() {
  try {
    const textToSend = `Xin hãy giải thích chi tiết ý nghĩa và cách dùng của từ/cụm từ này: "Qu'est-ce que tu as appris ce matin ?"`;
    const diff = "A1-A2, câu rất đơn giản.";
    const chatContext = "";
    
    const promptContext = `Tình huống: Bạn là một giáo viên tiếng Pháp... Yêu cầu: ${diff}. Lịch sử:\n${chatContext}\n\nHọc viên: ${textToSend}`;

    const streamConfig = {
      model: "gemini-2.5-flash",
      config: {
        temperature: 0.7,
        systemInstruction: `Bạn là gia sư tiếng Pháp. Hãy trả lời học viên bằng những câu tiếng Pháp tự nhiên, chất lượng và có ý nghĩa để tiếp nối cuộc hội thoại (dài khoảng 1-3 câu). Tuyệt đối không chỉ trả lời cộc lốc một từ. Trình độ trên A1 một chút. CHỈ TRẢ VỀ KIỂU TEXT (không JSON, không định dạng gì khác).`
      },
      contents: [{ parts: [{ text: promptContext }] }]
    };
    
    const result = await client.models.generateContent(streamConfig);
    console.log("GEMINI OUTPUT:", result.text);
  } catch (e: any) {
    console.error("GEMINI ERROR:", e);
  }
}

test();
