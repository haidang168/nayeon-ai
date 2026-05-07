import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const apiKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(k => k);
const key = apiKeys[0];

const client = new GoogleGenAI({ apiKey: key });

async function test() {
  console.log("Testing exact handleSendMessage payload...");
  try {
    const chatContext = "Teacher: Bonjour ! Que désirez-vous ?";
    const promptContext = `Tình huống: Bạn là bồi bàn tại một quán cafe ở Paris. Học viên là khách hàng. Hãy đóng vai một cách tự nhiên.. Yêu cầu: A1-A2, câu rất đơn giản.. Lịch sử:\n${chatContext}\n\nHọc viên: oui`;

    const streamConfig = {
      model: "gemini-2.5-flash",
      config: {
        temperature: 0.7,
        systemInstruction: `Bạn là gia sư tiếng Pháp. Hãy trả lời học viên bằng những câu tiếng Pháp tự nhiên, chất lượng và có ý nghĩa để tiếp nối cuộc hội thoại (dài khoảng 1-3 câu). Tuyệt đối không chỉ trả lời cộc lốc một từ. Trình độ trên A1 một chút. CHỈ TRẢ VỀ KIỂU TEXT (không JSON, không định dạng gì khác).`
      },
      contents: [{ parts: [{ text: promptContext }] }]
    };

    const res = await client.models.generateContent(streamConfig);
    console.log("Success:", res.text);
  } catch (e) {
    console.error("\nError:", e);
  }
}

test();
