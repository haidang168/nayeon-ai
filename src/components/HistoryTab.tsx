import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { SessionData } from '../types';

interface HistoryTabProps {
  pastConversations: SessionData[];
  setPastConversations: React.Dispatch<React.SetStateAction<SessionData[]>>;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ pastConversations, setPastConversations }) => {
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      className="flex-1 flex flex-col gap-6 min-h-0 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 overflow-y-auto"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-indigo-50 rounded-2xl">
          <Layers size={24} className="text-indigo-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Lịch sử hội thoại</h2>
          <p className="text-sm font-medium text-slate-400">Tất cả các bài học đã kết thúc</p>
        </div>
      </div>

      {pastConversations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
          <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa có lịch sử nào!</h3>
          <p className="text-slate-500 text-sm max-w-sm">Hãy chat với Nayeon và bấm "Kết thúc" để lưu lại bài học nhé.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {pastConversations.map((session) => (
            <div key={session.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition-all">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpandedSessionId(expandedSessionId === session.id ? null : session.id)}
              >
                <div className="flex flex-col gap-1">
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base">{session.topic}</h3>
                  <span className="text-xs font-semibold text-slate-400">{new Date(session.date).toLocaleString()} • {session.messages.length} tin nhắn</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Bạn có chắc muốn xóa lịch sử bài học này?')) {
                        setPastConversations(prev => prev.filter(p => p.id !== session.id));
                      }
                    }}
                    className="p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                    title="Xóa bài học"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div className="p-2 text-slate-400 bg-slate-50 rounded-xl">
                    {expandedSessionId === session.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {expandedSessionId === session.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-100 bg-slate-50/50"
                  >
                    <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto p-4">
                      {session.messages.map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className={`px-4 py-3 rounded-2xl max-w-[85%] ${msg.role === 'user' ? 'bg-brand-primary/10 text-slate-800 rounded-tr-sm' : 'bg-white text-slate-800 rounded-tl-sm border border-slate-100 shadow-sm'}`}>
                            <p className="font-bold text-[15px]">{msg.textFr}</p>
                            {msg.textEn && <p className="text-xs mt-2 pt-2 border-t border-slate-200 text-slate-500">{msg.textEn}</p>}
                            {msg.feedback && <p className="text-xs mt-2 text-rose-500 font-bold bg-rose-50 p-2 rounded-lg border border-rose-100">{msg.feedback}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
