import React, { useState } from 'react';
import { Settings, CheckCircle2, Loader2, Database, Wand2, PlusCircle } from 'lucide-react';
import { addExamToCloud } from '../lib/firebase';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

export const AdminTab = () => {
  const [examType, setExamType] = useState<'reading' | 'writing' | 'listening'>('reading');
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });

  const handleGenerateExam = async () => {
    if (!rawText.trim()) {
      setStatus({ type: 'error', message: 'Vui lòng nhập nội dung đề thi thô.' });
      return;
    }

    setIsProcessing(true);
    setStatus({ type: 'idle', message: 'Đang dùng AI bóc tách đề...' });

    try {
      let promptStr = '';
      if (examType === 'reading') {
        promptStr = `Bạn là trợ lý ảo giúp tạo dữ liệu JSON cho ứng dụng học tiếng Pháp.
Người dùng sẽ cung cấp một đoạn text thô chứa Bài đọc (Reading) và các Câu hỏi trắc nghiệm (hoặc bạn tự tạo câu hỏi nếu thiếu).
Hãy trả về DUY NHẤT một chuỗi JSON theo đúng định dạng sau (KHÔNG dùng markdown code block như \`\`\`json, chỉ trả ra đúng ngoặc nhọn):
{
  "level": "B1", // Xác định trình độ phù hợp (A1, A2, B1, B2)
  "title": "Tiêu đề bài đọc ngắn gọn",
  "passage": "Nội dung đoạn văn bản chính",
  "questions": [
    {
      "id": "q1",
      "text": "Câu hỏi số 1",
      "options": ["A. Lựa chọn 1", "B. Lựa chọn 2", "C. Lựa chọn 3", "D. Lựa chọn 4"],
      "correctAnswer": 0, // Chỉ số index (0-3) của đáp án đúng
      "explanation": "Giải thích ngắn gọn bằng tiếng Việt tại sao lại chọn đáp án này"
    }
  ]
}
Dưới đây là nội dung thô:
---
${rawText}`;
      } else if (examType === 'writing') {
        promptStr = `Bạn là trợ lý ảo giúp tạo dữ liệu JSON cho ứng dụng học tiếng Pháp.
Người dùng sẽ cung cấp một đoạn text thô chứa Đề thi viết (Production Écrite).
Hãy trả về DUY NHẤT một chuỗi JSON theo đúng định dạng sau (KHÔNG dùng markdown code block, chỉ trả ra đúng ngoặc nhọn):
{
  "level": "B1", // Trình độ
  "title": "Chủ đề bài viết",
  "prompt": "Nội dung đề bài chi tiết",
  "minWords": 160 // Số từ tối thiểu yêu cầu
}
Dưới đây là nội dung thô:
---
${rawText}`;
      } else if (examType === 'listening') {
        promptStr = `Bạn là trợ lý ảo giúp tạo dữ liệu JSON cho ứng dụng học tiếng Pháp.
Người dùng sẽ cung cấp một đoạn text thô chứa kịch bản (transcript) của một bài nghe và các câu hỏi.
Hãy trả về DUY NHẤT một chuỗi JSON theo đúng định dạng sau (KHÔNG dùng markdown code block, chỉ trả ra đúng ngoặc nhọn):
{
  "level": "B1", // Trình độ
  "title": "Tiêu đề bài nghe",
  "audioUrl": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", // Tạm thời để link này
  "transcript": "Toàn bộ kịch bản bài nghe",
  "questions": [
    {
      "id": "q1",
      "text": "Câu hỏi số 1",
      "options": ["Lựa chọn 1", "Lựa chọn 2", "Lựa chọn 3"],
      "correctAnswer": 0,
      "explanation": "Giải thích bằng tiếng Việt"
    }
  ]
}
Dưới đây là nội dung thô:
---
${rawText}`;
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: promptStr }],
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
        }),
      });

      if (!response.ok) throw new Error('API Groq bị lỗi');

      const data = await response.json();
      let content = data.choices[0].message.content;
      
      // Clean up markdown block if AI still outputs it
      content = content.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const examJson = JSON.parse(content);
      
      setStatus({ type: 'idle', message: 'Bóc tách thành công! Đang lưu vào Firebase...' });

      // Save to Firebase
      const isSaved = await addExamToCloud(examType, examJson);
      
      if (isSaved) {
        setStatus({ type: 'success', message: `Tuyệt vời! Đề thi "${examJson.title}" đã được lưu thành công vào Database. Hãy qua Tab L.${examType === 'reading' ? 'ĐỌC' : examType === 'writing' ? 'VIẾT' : 'NGHE'} để làm thử.` });
        setRawText(''); // Clear input
      } else {
        setStatus({ type: 'error', message: 'Lỗi khi lưu vào Firebase.' });
      }

    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Có lỗi xảy ra trong quá trình xử lý: ' + (error as Error).message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f4f7f6] overflow-y-auto w-full z-10">
      <div className="p-4 sm:p-8 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-8 border-b border-slate-200 pb-4">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center shadow-lg">
            <Settings className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 font-serif">Quản Trị Hệ Thống (Admin)</h2>
            <p className="text-sm text-slate-500">Tự động hóa việc thêm đề thi bằng Trí tuệ nhân tạo.</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <PlusCircle className="text-blue-500" /> Thêm đề thi mới
          </h3>

          {/* Type Selector */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-3">1. Chọn loại kỹ năng</label>
            <div className="flex gap-3">
              {(['reading', 'listening', 'writing'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setExamType(type)}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold transition-all ${
                    examType === type 
                      ? 'border-[#1a56db] bg-[#eef2ff] text-[#1a56db]' 
                      : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {type === 'reading' ? 'ĐỌC HIỂU' : type === 'listening' ? 'NGHE HIỂU' : 'VIẾT'}
                </button>
              ))}
            </div>
          </div>

          {/* Raw Text Input */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">2. Dán nội dung thô vào đây (Text/PDF Copy)</label>
            <p className="text-xs text-slate-500 mb-3">
              Bạn cứ copy paste lộn xộn nội dung bài đọc, câu hỏi, A B C D vào đây. AI sẽ tự động đọc hiểu và sắp xếp lại đàng hoàng.
            </p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Ex: Lisez le texte suivant... Question 1: Que pense l'auteur ? A) Il est d'accord B) Il refuse..."
              className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-[#1a56db]/50 text-sm leading-relaxed"
            />
          </div>

          {/* Status Message */}
          {status.message && (
            <div className={`p-4 rounded-xl mb-6 text-sm font-medium flex items-center gap-3 ${
              status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
              status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
              'bg-blue-50 text-[#1a56db] border border-blue-200'
            }`}>
              {status.type === 'success' && <CheckCircle2 size={18} />}
              {status.type === 'error' && <Settings size={18} />}
              {status.type === 'idle' && isProcessing && <Loader2 size={18} className="animate-spin" />}
              {status.message}
            </div>
          )}

          {/* Submit Action */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerateExam}
              disabled={isProcessing}
              className="flex items-center gap-2 px-8 py-3 bg-[#1a56db] text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
            >
              {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Wand2 size={20} />}
              Hóa phép thành Đề Thi
            </button>
          </div>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-100 p-6 rounded-2xl">
          <h4 className="font-bold text-[#1a56db] flex items-center gap-2 mb-2">
            <Database size={18} /> Lưu trữ trên Đám mây
          </h4>
          <p className="text-sm text-slate-600 leading-relaxed">
            Các đề thi được tạo ra từ công cụ này sẽ được lưu thẳng vào <strong>Firebase Database</strong> của bạn.
            Để sử dụng, bạn hãy qua các Tab kỹ năng tương ứng. Dữ liệu sẽ tự động được tải về thiết bị điện thoại.
          </p>
        </div>
      </div>
    </div>
  );
};
