import React, { useState } from 'react';
import { Check, Settings, BookHeart, Play, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Scenario } from '../types';

interface HeaderProps {
  streak: number;
  hasCheckedStreakToday: boolean;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  handleEndConversation: () => void;
  scenarios: Scenario[];
  selectedScenario: Scenario;
  difficulty: 'A1' | 'A2' | 'B1' | 'B2';
  setDifficulty: (diff: 'A1' | 'A2' | 'B1' | 'B2') => void;
  delfPart: '1' | '2' | '3';
  setDelfPart: (part: '1' | '2' | '3') => void;
  startNewSession: (scenario: Scenario, diff: string, part: string) => void;
  customTopic: string;
  setCustomTopic: (topic: string) => void;
  startCustomSession: (topic: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  streak,
  hasCheckedStreakToday,
  isSettingsOpen,
  setIsSettingsOpen,
  handleEndConversation,
  scenarios,
  selectedScenario,
  difficulty,
  setDifficulty,
  delfPart,
  setDelfPart,
  startNewSession,
  customTopic,
  setCustomTopic,
  startCustomSession
}) => {
  // Track whether user has selected DELF but not yet started
  const [pendingDelf, setPendingDelf] = useState(false);
  return (
    <header className="flex items-center justify-between bg-white px-4 py-3 sm:px-6 sm:py-4 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 shrink-0 relative z-50">
      <div className="flex items-center gap-3">
        <div className="md:hidden">
          <h1 className="text-xl font-bold font-display tracking-tight text-brand-primary">Nayeon AI</h1>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Học tiếng Pháp</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleEndConversation}
          className="bg-orange-100 text-orange-600 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 hover:bg-orange-200 transition"
          title="Kết thúc chủ đề này"
        >
          <Check size={16} /> Kết thúc
        </button>
        <div className="relative">
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`flex items-center justify-center p-3 rounded-2xl transition-all ${isSettingsOpen ? 'bg-pink-100 text-pink-600 shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            title="Tùy chỉnh bài học"
          >
            <Settings size={20} />
          </button>

          <AnimatePresence>
            {isSettingsOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                className="absolute right-0 top-full mt-3 w-80 max-w-[90vw] bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 max-h-[80vh] overflow-y-auto z-50 origin-top-right flex flex-col p-6"
              >
                <div className="flex flex-col gap-2">
                  {scenarios.map(scenario => (
                    <button
                      key={scenario.id}
                      onClick={() => {
                        if (scenario.id === 'delf') {
                          // For DELF: just select it, show config UI
                          setPendingDelf(true);
                        } else {
                          // For non-DELF scenarios: start immediately
                          setPendingDelf(false);
                          startNewSession(scenario, difficulty, delfPart);
                          setIsSettingsOpen(false);
                        }
                      }}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all border-2 text-left ${
                        (scenario.id === 'delf' && pendingDelf) || (scenario.id !== 'delf' && selectedScenario.id === scenario.id && !pendingDelf)
                          ? 'bg-brand-primary/5 border-brand-primary text-brand-primary'
                          : 'bg-transparent border-transparent hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="font-bold text-sm w-full text-center">{scenario.label}</span>
                    </button>
                  ))}

                  {selectedScenario.id.startsWith('custom-') && !pendingDelf && (
                    <button className="flex items-center gap-3 p-3.5 rounded-2xl transition-all border-2 text-left bg-brand-primary/5 border-brand-primary text-brand-primary">
                      <span className="font-bold text-sm line-clamp-1 w-full text-center" title={selectedScenario.label}>{selectedScenario.label}</span>
                    </button>
                  )}
                </div>

                {/* ── DELF Step-by-step selector ── */}
                {pendingDelf && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ChevronRight size={12} /> Bước 1: Chọn trình độ
                    </p>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => setDifficulty('A1')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${difficulty === 'A1' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500'}`}
                      >
                        A1
                      </button>
                      <button
                        onClick={() => setDifficulty('A2')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${difficulty === 'A2' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500'}`}
                      >
                        A2
                      </button>
                      <button
                        onClick={() => setDifficulty('B1')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${difficulty === 'B1' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500'}`}
                      >
                        B1
                      </button>
                      <button
                        onClick={() => setDifficulty('B2')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${difficulty === 'B2' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500'}`}
                      >
                        B2
                      </button>
                    </div>

                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mt-2">
                      <ChevronRight size={12} /> Bước 2: Chọn phần thi
                    </p>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => setDelfPart('1')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${delfPart === '1' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500'}`}
                      >
                        Phần 1
                      </button>
                      <button
                        onClick={() => setDelfPart('2')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${delfPart === '2' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500'}`}
                      >
                        Phần 2
                      </button>
                      {(difficulty === 'A1' || difficulty === 'A2') && (
                        <button
                          onClick={() => setDelfPart('3')}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${delfPart === '3' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500'}`}
                        >
                          Phần 3
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        const delfScenario = scenarios.find(s => s.id === 'delf')!;
                        startNewSession(delfScenario, difficulty, delfPart);
                        setPendingDelf(false);
                        setIsSettingsOpen(false);
                      }}
                      className="mt-2 w-full bg-gradient-to-r from-brand-primary to-blue-500 text-white p-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <Play size={16} fill="white" /> Bắt đầu thi DELF {difficulty} – Phần {delfPart}
                    </button>
                  </div>
                )}

                {/* ── Non-DELF: Level selector + custom topic ── */}
                {!pendingDelf && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setDifficulty('A1')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${difficulty === 'A1' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500'}`}
                    >
                      A1
                    </button>
                    <button
                      onClick={() => setDifficulty('A2')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${difficulty === 'A2' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500'}`}
                    >
                      A2
                    </button>
                    <button
                      onClick={() => setDifficulty('B1')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${difficulty === 'B1' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500'}`}
                    >
                      B1
                    </button>
                    <button
                      onClick={() => setDifficulty('B2')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${difficulty === 'B2' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500'}`}
                    >
                      B2
                    </button>
                  </div>
                </div>
                )}

                {!pendingDelf && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
                  <div className="relative">
                    <textarea
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      placeholder="Nhập chủ đề luyện giao tiếp với Nayeon..."
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:outline-none focus:border-brand-primary text-[13px] font-medium transition-all min-h-[80px] resize-y"
                    />
                  </div>

                  {customTopic && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          startCustomSession(customTopic);
                          setCustomTopic('');
                          setIsSettingsOpen(false);
                        }}
                        className="w-full bg-brand-primary text-white p-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-blue-600 transition-colors"
                      >
                        Bắt đầu giao tiếp
                      </button>
                    </div>
                  )}
                </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
