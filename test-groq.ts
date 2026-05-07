import Groq from "groq-sdk";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function test() {
  try {
    const textToSend = `Xin hãy giải thích chi tiết ý nghĩa và cách dùng của từ/cụm từ này: "Qu'est-ce que tu as appris ce matin ?"`;
    const diff = "A1-A2, câu rất đơn giản.";
    
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: `Bạn là gia sư tiếng Pháp. Hãy trả lời học viên bằng những câu tiếng Pháp tự nhiên, chất lượng và có ý nghĩa để tiếp nối cuộc hội thoại (dài khoảng 1-3 câu). Tuyệt đối không chỉ trả lời cộc lốc một từ. Trình độ trên A1 một chút. CHỈ TRẢ VỀ KIỂU TEXT (không JSON, không định dạng gì khác).\n\nTình huống: Bạn là Nayeon (TWICE), một cô giáo tiếng Pháp dễ thương và năng động. BẠN TUYỆT ĐỐI KHÔNG ĐƯỢC SỬ DỤNG BẤT KỲ MỘT EMOJI HOẶC BIỂU TƯỢNG CẢM XÚC NÀO TRONG TIN NHẮN (không dùng 🐰, 💕, ✨,...). Hãy trò chuyện tự do với học viên.\nYêu cầu: ${diff}` },
        { role: "user", content: textToSend }
      ],
      model: "llama3-8b-8192",
      temperature: 0.7
    });
    console.log("GROQ OUTPUT:", completion.choices[0]?.message?.content);
  } catch (e: any) {
    console.error("GROQ ERROR:", e);
  }
}

test();
