import React, { useState, useEffect, useRef, Suspense } from 'react';
import { MessageCircle, Layers, BookHeart, BookOpen, Search, Wand2, Coffee, Plane, Sparkles, PenTool, Headphones, ClipboardList, Target, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { useStorage } from './hooks/useStorage';
import { useAudio } from './hooks/useAudio';
import { useVoiceRecognition } from './hooks/useVoiceRecognition';
import { useChat } from './hooks/useChat';
import { lemmatizeFrench } from './lib/french-utils';

// Always loaded (needed on first paint for Speaking tab)
import { Header } from './components/Header';
import { ChatWindow } from './components/ChatWindow';
import { ChatInput } from './components/ChatInput';
import { DictionaryPopup } from './components/DictionaryPopup';
import { EvaluationModal } from './components/EvaluationModal';

// Lazy-loaded tabs — only fetched when user navigates to them
const DictationPractice = React.lazy(() => import('./components/DictationPractice').then(m => ({ default: m.DictationPractice })));
const QAPractice = React.lazy(() => import('./components/QAPractice').then(m => ({ default: m.QAPractice })));
const SentenceBuilder = React.lazy(() => import('./components/SentenceBuilder').then(m => ({ default: m.SentenceBuilder })));
const StatsDashboard = React.lazy(() => import('./components/StatsDashboard').then(m => ({ default: m.StatsDashboard })));
const ExamsTab = React.lazy(() => import('./components/ExamsTab').then(m => ({ default: m.ExamsTab })));
const HistoryTab = React.lazy(() => import('./components/HistoryTab').then(m => ({ default: m.HistoryTab })));
const PhrasebookTab = React.lazy(() => import('./components/PhrasebookTab').then(m => ({ default: m.PhrasebookTab })));

// Suspense fallback for lazy tabs
const TabLoader = () => (
  <div className="flex-1 flex items-center justify-center">
    <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
  </div>
);

import { Scenario, FavoriteItem, SessionData } from './types';

const SCENARIOS: Scenario[] = [
  { id: 'free', icon: <Sparkles size={20} />, label: 'Tự do', prompt: 'Tình huống giao tiếp đời sống thực tế hàng ngày. Đóng vai tự nhiên trong bối cảnh được giao. KHÔNG dùng emoji.' },
  { id: 'delf', icon: <Layers size={20} />, label: 'Thi thử DELF (Rút gọn)', prompt: 'Bạn là giám khảo thi DELF khó tính nhưng công bằng của CIEP. BỎ QUA MÀN CHÀO HỎI. Hãy đưa ra ngay một đề thi TÌNH HUỐNG/ĐÓNG VAI hoặc TRANH LUẬN thực tế và chất lượng cao.\n\nCẤU TRÚC: Phụ thuộc vào trình độ được chọn, hãy lấy đề thi thật.\nKHI KẾT THÚC: Nhận xét BẰNG TIẾNG ANH (Markdown Table: Strengths, Areas for Improvement, Suggested Vocabulary).', goal: 'Vào thẳng phần hội thoại/tình huống DELF thực tế. In bảng nhận xét khi hoàn thành.' },
];

type TabId = 'speaking' | 'dictation' | 'vocab' | 'exams' | 'stats' | 'history';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('stats');
  const [speakingMode, setSpeakingMode] = useState<'chat' | 'qa' | 'sentence-builder'>('chat');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [userInput, setUserInput] = useState('');
  const [selection, setSelection] = useState<{ text: string, x: number, y: number } | null>(null);

  const storage = useStorage();
  const audio = useAudio();
  const chat = useChat(storage.initialMessages, SCENARIOS[0]);
  const voice = useVoiceRecognition((transcript) => {
    setUserInput(prev => prev ? prev + ' ' + transcript : transcript);
  }, 'fr');

  useEffect(() => {
    let selectionTimeout: number;

    const handleSelectionChange = () => {
      clearTimeout(selectionTimeout);
      
      selectionTimeout = window.setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        
        if (sel && text && text.split(' ').length < 15) { 
          try {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              setSelection({
                text,
                x: rect.left + rect.width / 2,
                y: rect.top
              });
              return;
            }
          } catch(err) {}
        }
        
        if (!text) {
          setSelection(null);
        }
      }, 500);
    };

    const handleGlobalInteraction = (e: MouseEvent | TouchEvent) => {
      if ((e.target as HTMLElement).closest('.dict-popup-container')) return;
      
      const sel = window.getSelection();
      if (!sel || !sel.toString().trim()) {
        setSelection(null);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleGlobalInteraction);
    document.addEventListener('touchend', handleGlobalInteraction);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleGlobalInteraction);
      document.removeEventListener('touchend', handleGlobalInteraction);
      clearTimeout(selectionTimeout);
    };
  }, []);

  // Debounced save: avoids spamming Firebase during AI streaming (was 10-20 writes/sec)
  const syncTimerRef = useRef<number>(0);
  useEffect(() => {
    if (chat.messages.length > 0) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = window.setTimeout(() => {
        storage.saveMessages(chat.messages);
      }, 3000);
    }
    return () => clearTimeout(syncTimerRef.current);
  }, [chat.messages, storage]);

  const handleEndConversation = () => {
    if (chat.messages.length < 2) return;
    const newSession: SessionData = {
      id: Date.now().toString(),
      date: Date.now(),
      topic: chat.selectedScenario.label,
      messages: [...chat.messages]
    };
    storage.savePastConversations([newSession, ...storage.pastConversations]);
    storage.clearMessages();
    chat.startNewSession(chat.selectedScenario, chat.difficulty);
  };

  const startCustomSession = (topic: string) => {
    const newScenario = {
      id: 'custom-' + Date.now(),
      icon: <Wand2 size={20} />,
      label: topic.length > 20 ? topic.substring(0, 20) + '...' : topic,
      prompt: `Bạn là một giáo viên tiếng Pháp. Học viên muốn luyện tập giao tiếp với chủ đề: trọng tâm \"${topic}\". Hãy dẫn dắt cuộc trò chuyện một cách tự nhiên và thực tế nhất.`
    };
    chat.startNewSession(newScenario, chat.difficulty, audio.playAudio);
  };

  const executeSendMessage = (text?: string) => {
    const textToSend = text || userInput;
    if (!textToSend.trim() || chat.isAiTyping) return;
    audio.primeSpeech(); // Unlock Safari audio from user gesture context
    setUserInput('');
    voice.stopRecording();
    chat.handleSendMessage(textToSend, audio.playAudio, {
      start: audio.startStreamingAudio,
      queue: audio.queueSentence,
      finish: audio.finishStreamingAudio
    });
  };

  const toggleFavorite = (item: FavoriteItem) => {
    const exists = storage.favorites.find(f => f.id === item.id);
    if (exists) {
      storage.saveFavorites(storage.favorites.filter(f => f.id !== item.id));
    } else {
      // Add immediately with original text
      storage.saveFavorites([item, ...storage.favorites]);
      
      // Then lemmatize in the background and update
      lemmatizeFrench(item.textFr).then(lemma => {
        if (lemma && lemma.toLowerCase() !== item.textFr.toLowerCase()) {
          // Check if lemmatized form already exists in favorites (avoid duplicates)
          storage.saveFavorites((prev: FavoriteItem[]) => {
            const duplicateExists = prev.some(
              f => f.id !== item.id && f.textFr.toLowerCase() === lemma.toLowerCase()
            );
            if (duplicateExists) {
              // Remove the newly added one since a lemma duplicate exists
              return prev.filter(f => f.id !== item.id);
            }
            // Update textFr to the lemmatized form
            return prev.map(f => f.id === item.id ? { ...f, textFr: lemma } : f);
          });
        }
      }).catch(() => {
        // If lemmatization fails, keep the original — it's already saved
      });
    }
  };

  const updateFavoriteInfo = (id: string | number, textEnVi: string) => {
    storage.saveFavorites((prev: FavoriteItem[]) => prev.map(f => f.id === id ? { ...f, textEnVi } : f));
  };

  if (!storage.isLoaded) return null;

  return (
    <div className="h-[100dvh] overflow-hidden bg-gradient-to-br from-pink-50 to-sky-50 font-sans text-slate-900 selection:bg-brand-primary/20 flex flex-col md:flex-row p-2 md:p-6 gap-2 md:gap-6">
      <AnimatePresence>
        {chat.evaluation && (
          <EvaluationModal 
            data={chat.evaluation} 
            onClose={() => chat.setEvaluation(null)} 
          />
        )}
        {selection && (
          <DictionaryPopup
            word={selection.text}
            x={selection.x}
            y={selection.y}
            onClose={() => setSelection(null)}
            playAudio={audio.playAudio}
            favorites={storage.favorites}
            toggleFavorite={toggleFavorite}
            onAskChat={activeTab === 'speaking' ? (msg) => {
              executeSendMessage(msg);
              setSelection(null);
            } : undefined}
          />
        )}
      </AnimatePresence>

      {/* ─── DESKTOP SIDEBAR ─── */}
      <aside className="hidden md:flex flex-col w-64 bg-white/70 backdrop-blur-xl rounded-3xl border border-white shadow-xl p-5 shrink-0 z-50">
        <div className="mb-8 pl-2 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-brand-primary to-blue-400 rounded-xl shadow-lg flex items-center justify-center shrink-0">
             <Sparkles size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold font-display tracking-tight text-brand-primary truncate">Nayeon AI</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Học tiếng Pháp</p>
          </div>
        </div>
        
        <nav className="flex flex-col gap-2 flex-1">
          <SidebarButton active={activeTab === 'stats'} onClick={() => { setActiveTab('stats'); setSelection(null); }} icon={<Target size={20} />} label="Mục Tiêu & Thống Kê" />
          <SidebarButton active={activeTab === 'speaking'} onClick={() => { setActiveTab('speaking'); setSelection(null); }} icon={<MessageCircle size={20} />} label="Hội Thoại AI" />
          <SidebarButton active={activeTab === 'dictation'} onClick={() => { setActiveTab('dictation'); setSelection(null); }} icon={<Headphones size={20} />} label="Chính Tả & Nhại Âm" />
          <SidebarButton active={activeTab === 'vocab'} onClick={() => { setActiveTab('vocab'); setSelection(null); }} icon={<BookHeart size={20} />} label="Từ Vựng Của Tôi" />
          <SidebarButton active={activeTab === 'exams'} onClick={() => { setActiveTab('exams'); setSelection(null); }} icon={<ClipboardList size={20} />} label="Ngân Hàng Đề Thi" />
          <SidebarButton active={activeTab === 'history'} onClick={() => { setActiveTab('history'); setSelection(null); }} icon={<Layers size={20} />} label="Lịch Sử Học" />
        </nav>
      </aside>

      {/* ─── MAIN APP CONTAINER ─── */}
      <div className="flex-1 max-w-4xl mx-auto w-full h-full flex flex-col gap-3 md:gap-4 overflow-hidden relative">
        {activeTab === 'speaking' && (
          <Header 
            streak={storage.streak}
            hasCheckedStreakToday={true}
            isSettingsOpen={isSettingsOpen}
            setIsSettingsOpen={setIsSettingsOpen}
            handleEndConversation={handleEndConversation}
            scenarios={SCENARIOS}
            selectedScenario={chat.selectedScenario}
            difficulty={chat.difficulty}
            setDifficulty={chat.setDifficulty}
            delfPart={chat.delfPart}
            setDelfPart={chat.setDelfPart}
            startNewSession={(scenario, diff, part) => {
              chat.startNewSession(scenario, diff as any, audio.playAudio, part as any);
            }}
            customTopic={customTopic}
            setCustomTopic={setCustomTopic}
            startCustomSession={startCustomSession}
          />
        )}

        <main className="flex-1 flex overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === 'speaking' && (
              <motion.div
                key="speaking"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex-1 flex flex-col bg-white/50 backdrop-blur-xl sm:rounded-3xl border border-white shadow-xl overflow-hidden min-w-0 z-10"
              >
              <div className="flex flex-col h-full bg-white/40">
                  {speakingMode === 'qa' ? (
                    <Suspense fallback={<TabLoader />}>
                      <QAPractice
                        playAudio={audio.playAudio}
                        isSpeaking={audio.isSpeaking}
                        difficulty={chat.difficulty}
                        onBack={() => setSpeakingMode('chat')}
                        favorites={storage.favorites}
                        toggleFavorite={toggleFavorite}
                      />
                    </Suspense>
                  ) : speakingMode === 'sentence-builder' ? (
                    <Suspense fallback={<TabLoader />}>
                      <SentenceBuilder
                        playAudio={audio.playAudio}
                        isSpeaking={audio.isSpeaking}
                        difficulty={chat.difficulty}
                        onBack={() => setSpeakingMode('chat')}
                      />
                    </Suspense>
                  ) : (
                    <>
                      {/* Q&A + Sentence Builder toggle bar */}
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100/50 shrink-0">
                        <button onClick={() => setSpeakingMode('qa')}
                          className="text-xs font-bold text-slate-400 hover:text-blue-500 bg-slate-50 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors active:scale-95 flex items-center gap-1">
                          🎯 Luyện Q&A
                        </button>
                        <button onClick={() => setSpeakingMode('sentence-builder')}
                          className="text-xs font-bold text-slate-400 hover:text-purple-500 bg-slate-50 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-colors active:scale-95 flex items-center gap-1">
                          🔀 Ghép câu
                        </button>
                      </div>
                      <ChatWindow 
                        messages={chat.messages}
                        isAiTyping={chat.isAiTyping}
                        isSpeaking={audio.isSpeaking}
                        favorites={storage.favorites}
                        playAudio={audio.playAudio}
                        toggleFavorite={toggleFavorite}
                        generateHintsForMessage={chat.generateHintsForMessage}
                        setUserInput={setUserInput}
                      />
                      <ChatInput 
                        userInput={userInput}
                        setUserInput={setUserInput}
                        handleSendMessage={() => executeSendMessage()}
                        isAiTyping={chat.isAiTyping}
                        isRecording={voice.isRecording}
                        isProcessingVoice={voice.isProcessing}
                        interimTranscript={voice.interimTranscript}
                        toggleRecording={voice.toggleRecording}
                        showEvaluateButton={chat.selectedScenario.id === 'delf'}
                        onEvaluate={() => executeSendMessage("Tôi đã hoàn thành phần thi này. Hãy dừng đóng vai và in ra Bảng Markdown Table nhận xét BẰNG TIẾNG ANH (Strengths, Areas for Improvement, Suggested Vocabulary) ngay lập tức.")}
                      />
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'dictation' && (
              <motion.div key="dictation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col bg-white/50 backdrop-blur-xl sm:rounded-3xl border border-white shadow-xl overflow-hidden min-w-0 z-10">
                <Suspense fallback={<TabLoader />}>
                  <DictationPractice playAudio={audio.playAudio} playWordAudio={audio.playWordAudio} isSpeaking={audio.isSpeaking} />
                </Suspense>
              </motion.div>
            )}

            {activeTab === 'vocab' && (
              <Suspense fallback={<TabLoader />}>
                <PhrasebookTab 
                  favorites={storage.favorites}
                  toggleFavorite={toggleFavorite}
                  updateFavoriteInfo={updateFavoriteInfo}
                  playAudio={audio.playAudio}
                />
              </Suspense>
            )}

            {activeTab === 'exams' && (
              <Suspense fallback={<TabLoader />}>
                <ExamsTab playAudio={audio.playAudio} isSpeaking={audio.isSpeaking} />
              </Suspense>
            )}

            {activeTab === 'stats' && (
              <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col bg-white/50 backdrop-blur-xl sm:rounded-3xl border border-white shadow-xl overflow-hidden min-w-0 z-10">
                <Suspense fallback={<TabLoader />}>
                  <StatsDashboard
                    vocabCount={storage.favorites.length}
                    conversationCount={storage.pastConversations.length}
                    streak={storage.streak}
                  />
                </Suspense>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <Suspense fallback={<TabLoader />}>
                <HistoryTab 
                  pastConversations={storage.pastConversations}
                  setPastConversations={storage.savePastConversations}
                />
              </Suspense>
            )}
          </AnimatePresence>
        </main>

        {/* ─── MOBILE BOTTOM NAV ─── */}
        <nav className="md:hidden bg-white px-4 py-3 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-around shrink-0 z-50">
          <NavButton
            active={activeTab === 'stats'}
            onClick={() => { setActiveTab('stats'); setSelection(null); }}
            icon={<Target size={22} />}
            label="STATS"
          />
          <NavButton
            active={activeTab === 'speaking'}
            onClick={() => { setActiveTab('speaking'); setSelection(null); }}
            icon={<MessageCircle size={22} />}
            label="SPEAKING"
          />
          <NavButton
            active={activeTab === 'dictation'}
            onClick={() => { setActiveTab('dictation'); setSelection(null); }}
            icon={<Headphones size={22} />}
            label="DICTATION"
          />
          <NavButton
            active={activeTab === 'vocab'}
            onClick={() => { setActiveTab('vocab'); setSelection(null); }}
            icon={<BookHeart size={22} />}
            label="VOCAB"
          />
          <NavButton
            active={activeTab === 'exams'}
            onClick={() => { setActiveTab('exams'); setSelection(null); }}
            icon={<ClipboardList size={22} />}
            label="EXAMS"
          />
          <NavButton
            active={activeTab === 'history'}
            onClick={() => { setActiveTab('history'); setSelection(null); }}
            icon={<Layers size={22} />}
            label="HISTORY"
          />
        </nav>
      </div>
    </div>
  );
}

// Reusable nav button components
function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-brand-primary scale-110' : 'text-slate-400 hover:text-slate-600'}`}
    >
      <div className={active ? 'opacity-100' : 'opacity-70'}>{icon}</div>
      <span className="text-[9px] sm:text-[10px] font-bold tracking-wide">{label}</span>
    </button>
  );
}

function SidebarButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm ${active ? 'bg-white text-brand-primary shadow-sm border border-slate-100/50 scale-[1.02]' : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}
    >
      <div className={active ? 'opacity-100 text-brand-primary' : 'opacity-70 text-slate-400'}>{icon}</div>
      <span className="truncate">{label}</span>
    </button>
  );
}
