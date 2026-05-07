import { useState } from 'react';
import { groq } from '../lib/groq';

export interface WritingEvaluation {
  score: string;
  general_feedback: string;
  criteria: { name: string; feedback: string; score: string }[];
  corrections: { original: string; corrected: string; explanation: string }[];
}

export function useWriting() {
  const [isGrading, setIsGrading] = useState(false);
  const [evaluation, setEvaluation] = useState<WritingEvaluation | null>(null);

  const gradeEssay = async (prompt: string, text: string, level: string) => {
    setIsGrading(true);
    try {
      const response = await groq.chat.completions.create({
        messages: [
          { 
            role: "system", 
            content: `Bạn là giám khảo chấm thi DELF chính thức trình độ ${level}. Hãy chấm điểm bài viết tiếng Pháp của học viên.
            
            Renvoie UNIQUEMENT un objet JSON avec la structure exacte suivante (không thêm markdown \`\`\`json):
            {
              "score": "XX/25",
              "general_feedback": "Nhận xét tổng quan ngắn gọn bằng tiếng Việt",
              "criteria": [
                { "name": "Respect de la consigne (Đúng đề)", "feedback": "nhận xét...", "score": "X/5" },
                { "name": "Cohérence et cohésion (Mạch lạc)", "feedback": "nhận xét...", "score": "X/5" },
                { "name": "Compétence lexicale (Từ vựng)", "feedback": "nhận xét...", "score": "X/5" },
                { "name": "Compétence grammaticale (Ngữ pháp)", "feedback": "nhận xét...", "score": "X/5" }
              ],
              "corrections": [
                { "original": "câu/từ sai của học viên", "corrected": "câu/từ đúng", "explanation": "Giải thích lỗi sai (tiếng Việt)" }
              ]
            }`
          },
          { 
            role: "user", 
            content: `Sujet (Đề bài):\n${prompt}\n\nTexte de l'étudiant (Bài làm):\n${text}` 
          }
        ],
        model: "llama-3.1-8b-instant", // keep it fast
        temperature: 0.2,
        response_format: { type: "json_object" }
      });

      const rawContent = response.choices[0]?.message?.content || "{}";
      const cleanContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanContent);
      setEvaluation(result);
    } catch (e) {
      console.error(e);
      alert("Có lỗi xảy ra khi chấm điểm. Vui lòng thử lại!");
    } finally {
      setIsGrading(false);
    }
  };

  return { gradeEssay, isGrading, evaluation, setEvaluation };
}
