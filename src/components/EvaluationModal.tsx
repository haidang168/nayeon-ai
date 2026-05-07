import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, TrendingUp, BookOpen, X, Award } from 'lucide-react';

export interface EvaluationData {
  score?: string;
  strengths?: string[];
  weaknesses?: string[];
  vocabulary?: string[];
}

interface Props {
  data: EvaluationData;
  onClose: () => void;
}

export const EvaluationModal: React.FC<Props> = ({ data, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="bg-brand-primary p-6 text-white text-center relative shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
            <X size={20} />
          </button>
          <div className="mx-auto bg-white/20 w-16 h-16 flex items-center justify-center rounded-2xl mb-4 backdrop-blur-md">
            <Award size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-display font-bold">Tổng kết bài thi</h2>
          {data.score && <p className="mt-2 font-medium bg-white/20 inline-block px-4 py-1.5 rounded-full text-sm backdrop-blur-md">{data.score}</p>}
        </div>

        <div className="p-6 overflow-y-auto flex flex-col gap-6 bg-slate-50">
          <section>
            <h3 className="flex items-center gap-2 text-green-600 font-bold mb-3">
              <CheckCircle2 size={18} /> Điểm mạnh (Strengths)
            </h3>
            <ul className="space-y-2">
              {data.strengths?.map((item, i) => (
                <li key={i} className="bg-white p-3 rounded-xl text-sm border border-slate-100 shadow-sm flex items-start gap-2 leading-relaxed">
                  <span className="text-green-500 mt-0.5">•</span>
                  <span className="text-slate-700">{item}</span>
                </li>
              ))}
              {(!data.strengths || data.strengths.length === 0) && (
                <li className="text-slate-500 text-sm italic">Chưa có đánh giá chi tiết.</li>
              )}
            </ul>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-orange-500 font-bold mb-3">
              <TrendingUp size={18} /> Cần cải thiện (Improvements)
            </h3>
            <ul className="space-y-2">
              {data.weaknesses?.map((item, i) => (
                <li key={i} className="bg-white p-3 rounded-xl text-sm border border-slate-100 shadow-sm flex items-start gap-2 leading-relaxed">
                  <span className="text-orange-400 mt-0.5">•</span>
                  <span className="text-slate-700">{item}</span>
                </li>
              ))}
              {(!data.weaknesses || data.weaknesses.length === 0) && (
                <li className="text-slate-500 text-sm italic">Chưa có đánh giá chi tiết.</li>
              )}
            </ul>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-blue-500 font-bold mb-3">
              <BookOpen size={18} /> Từ vựng / Cấu trúc gợi ý
            </h3>
            <ul className="space-y-2">
              {data.vocabulary?.map((item, i) => (
                <li key={i} className="bg-white p-3 rounded-xl text-sm border border-slate-100 shadow-sm flex items-start gap-2 leading-relaxed">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span className="text-slate-700">{item}</span>
                </li>
              ))}
              {(!data.vocabulary || data.vocabulary.length === 0) && (
                <li className="text-slate-500 text-sm italic">Chưa có đánh giá chi tiết.</li>
              )}
            </ul>
          </section>
        </div>

        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-colors">
            Đóng & Tiếp tục
          </button>
        </div>
      </motion.div>
    </div>
  );
}
