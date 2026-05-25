import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Play, Send, Mic, MicOff,
  CheckCircle2, XCircle, AlertTriangle, Youtube, Link, Trash2, Plus,
  Loader2, Volume2, Eye, ChevronRight, RotateCcw, ChevronDown, Gauge, Brain, Search
} from 'lucide-react';
import { useDictation, DiffWord } from '../hooks/useDictation';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import YouTube, { YouTubePlayer } from 'react-youtube';

interface DictationPracticeProps {
  playAudio: (text: string, rate?: number) => void;
  playWordAudio?: (text: string, rate?: number) => void;
  isSpeaking: boolean;
}

type SentenceStep = 'listen' | 'write' | 'write-result' | 'cloze' | 'cloze-result' | 'speak' | 'speak-result' | 'done';

export const DictationPractice: React.FC<DictationPracticeProps> = ({ playAudio, playWordAudio, isSpeaking }) => {
  const d = useDictation();
  const [step, setStep] = useState<SentenceStep>('listen');
  const [shadowText, setShadowText] = useState('');
  const [showHints, setShowHints] = useState(false);

  // Speed control
  const playbackRates = [0.5, 0.75, 1.0, 1.25, 1.5];
  const [speedIndex, setSpeedIndex] = useState(2); // default 1.0x
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const currentRate = playbackRates[speedIndex];

  const voice = useVoiceRecognition((transcript) => {
    setShadowText(prev => prev ? prev + ' ' + transcript : transcript);
    d.setShadowingTranscript(transcript);
  }, 'fr');

  const ytPlayerRef = useRef<YouTubePlayer | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isVideoBlocked, setIsVideoBlocked] = useState(false);
  const videoSrcId = d.currentSentence?.videoId || d.currentLesson?.videoId;

  const playSentenceVideo = () => {
    if (ytPlayerRef.current && d.currentSentence) {
      ytPlayerRef.current.setPlaybackRate(currentRate);
      ytPlayerRef.current.playVideo();
      ytPlayerRef.current.seekTo(d.currentSentence.startTime, true);
      setIsPlayingVideo(true);
      setIsVideoBlocked(false);
    }
  };

  // Auto-play on new sentence
  const lastIdx = useRef(-1);
  useEffect(() => {
    if ((d.phase === 'practice' || d.phase === 'review-srs') && d.currentSentence && d.currentIndex !== lastIdx.current) {
      lastIdx.current = d.currentIndex;
      if (d.dictationStyle === 'cloze') {
        setStep('cloze');
        d.generateClozeForCurrent();
        setShowHints(false);
      } else {
        setStep('write');
      }
      d.setUserInput('');
      setShadowText('');
      
      if (videoSrcId) {
        if (ytPlayerRef.current) {
          playSentenceVideo();
        }
        // If ytPlayerRef is not ready yet, onPlayerReady will handle it.
      } else {
        setTimeout(() => playAudio(d.currentSentence!.text, currentRate), 400);
      }
    }
  }, [d.currentIndex, d.currentSentence, d.phase, videoSrcId]);

  // Pause video at the end of sentence
  useEffect(() => {
    let interval: number;
    if (ytPlayerRef.current && d.currentSentence && isPlayingVideo) {
      interval = window.setInterval(() => {
        if (ytPlayerRef.current?.getPlayerState() === 1) { // Playing
          const time = ytPlayerRef.current.getCurrentTime();
          if (time >= d.currentSentence!.endTime) {
            ytPlayerRef.current.pauseVideo();
            setIsPlayingVideo(false);
          }
        }
      }, 50);
    }
    return () => clearInterval(interval);
  }, [d.currentSentence, isPlayingVideo]);

  const onPlayerReady = (event: { target: YouTubePlayer }) => {
    ytPlayerRef.current = event.target;
    event.target.setPlaybackRate(currentRate);
    if (step === 'write' || step === 'cloze') {
      playSentenceVideo();
      // Fallback for iOS Safari which blocks autoplay without user interaction
      setTimeout(() => {
        if (ytPlayerRef.current) {
          const state = ytPlayerRef.current.getPlayerState();
          // -1: unstarted, 2: paused, 5: cued
          if (state === -1 || state === 5 || state === 2) {
            setIsVideoBlocked(true);
            setIsPlayingVideo(false);
          }
        }
      }, 800);
    }
  };

  const onPlayerStateChange = (event: { target: YouTubePlayer, data: number }) => {
    if (event.data === 1) { // Playing
      setIsVideoBlocked(false);
      setIsPlayingVideo(true);
    } else if (event.data === 2 || event.data === 0) { // Paused or Ended
      setIsPlayingVideo(false);
    }
  };

  const handleReplay = () => {
    if (videoSrcId) {
      if (ytPlayerRef.current && d.currentSentence) {
        playSentenceVideo();
      }
    } else if (d.currentSentence) {
      playAudio(d.currentSentence.text, currentRate);
    }
  };

  const handleSpeedChange = (idx: number) => {
    setSpeedIndex(idx);
    setShowSpeedMenu(false);
    const rate = playbackRates[idx];
    if (ytPlayerRef.current) {
      ytPlayerRef.current.setPlaybackRate(rate);
    }
  };

  // Auto-loop logic (must be after handleReplay definition)
  const handleReplayRef = useRef(handleReplay);
  handleReplayRef.current = handleReplay;

  useEffect(() => {
    if (!d.autoLoop || isPlayingVideo || isSpeaking || step !== 'write') return;
    const loopTimeout = window.setTimeout(() => {
      handleReplayRef.current();
    }, 3000);
    return () => clearTimeout(loopTimeout);
  }, [isPlayingVideo, isSpeaking, d.autoLoop, step, d.currentIndex]);

  const handleCheck = () => {
    d.checkAnswer();
    setStep('write-result');
  };

  const handleClozeCheck = () => {
    d.checkClozeAnswer();
    setStep('cloze-result');
  };

  const handleRetryWrite = () => {
    d.setUserInput('');
    setStep('write');
  };

  const handleStartSpeak = () => {
    setShadowText('');
    setStep('speak');
  };

  const handleRevealSpeak = () => {
    voice.stopRecording();
    d.revealAnswer();
    setStep('speak-result');
  };

  const handleRetrySpeak = () => {
    setShadowText('');
    setStep('speak');
  };

  const handleNext = () => {
    if (!d.isLastSentence) {
      d.goNext();
      setStep('write');
      setShadowText('');
    } else {
      setStep('done');
    }
  };

  const handleWordClick = (word: string) => {
    const cleanWord = word.replace(/[.,!?;:'"()]/g, '');
    if (cleanWord) playAudio(cleanWord, currentRate);
  };

  // ─── BROWSE PHASE ───
  if (!d.isLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-brand-primary" />
      </div>
    );
  }

  if (d.phase === 'browse' || d.phase === 'import') {
    return (
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        <div className="p-4 max-w-2xl mx-auto w-full space-y-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Luyện tập Dictation</h2>
            <p className="text-xs text-slate-400 mt-0.5">Nghe → Viết lại → Nói lại</p>
          </div>

          {/* Dictation Style Toggle */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chế độ luyện</p>
            <div className="flex gap-2">
              <button onClick={() => d.setDictationStyle('full')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  d.dictationStyle === 'full' ? 'bg-[#1a56db] text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}>
                ✍️ Cả câu
              </button>
              <button onClick={() => d.setDictationStyle('cloze')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  d.dictationStyle === 'cloze' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}>
                🧩 Điền từ
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {d.dictationStyle === 'full' ? 'Nghe và gõ lại toàn bộ câu.' : 'Nghe và điền 3-4 từ khóa bị ẩn trong câu.'}
            </p>
          </div>

          {/* Difficulty Toggle */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chấm điểm</p>
            <div className="flex gap-2">
              <button onClick={() => d.setDifficultyMode('easy')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  d.difficultyMode === 'easy' ? 'bg-[#1a56db] text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}>
                🟢 Dễ
              </button>
              <button onClick={() => d.setDifficultyMode('hard')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  d.difficultyMode === 'hard' ? 'bg-red-500 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}>
                🔴 Khó (Chính xác 100%)
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {d.difficultyMode === 'easy' ? 'Bỏ qua viết hoa, dấu câu và trọng âm.' : 'Yêu cầu gõ chính xác từng dấu phẩy, viết hoa và dấu thanh (accent).'}
            </p>
          </div>

          {/* SRS Review */}
          {d.srsItems.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-xl"><Brain size={18} className="text-amber-600" /></div>
                  <div>
                    <h3 className="font-bold text-amber-900 text-sm">Câu sai cần ôn</h3>
                    <p className="text-xs text-amber-600">{d.srsItems.length} câu</p>
                  </div>
                </div>
                <button onClick={d.startSRSReview}
                  className="px-4 py-2 bg-amber-500 text-white font-bold rounded-xl text-xs active:scale-95">Ôn ngay</button>
              </div>
            </motion.div>
          )}

          {/* YouTube Import */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="font-bold text-slate-700 mb-2.5 flex items-center gap-2 text-sm">
              <Youtube size={16} className="text-red-500" /> Thêm bài từ YouTube
            </h3>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input type="text" value={d.youtubeUrl} onChange={e => d.setYoutubeUrl(e.target.value)}
                  placeholder="Dán link YouTube..." onKeyDown={e => { if (e.key === 'Enter') d.importFromYouTube(); }}
                  disabled={d.isImporting}
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100 disabled:opacity-50" />
              </div>
              <button onClick={() => d.importFromYouTube()} disabled={d.isImporting || !d.youtubeUrl.trim()}
                className="px-3 py-2.5 bg-red-500 text-white font-bold rounded-xl text-sm disabled:opacity-50 active:scale-95 flex items-center gap-1 shrink-0">
                {d.isImporting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                <span className="hidden sm:inline">Lấy bài</span>
              </button>
              <button onClick={() => d.importFromYouTube(true)} disabled={d.isImporting || !d.youtubeUrl.trim()}
                className="px-3 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm disabled:opacity-50 active:scale-95 flex items-center gap-1 shrink-0 hover:bg-slate-200"
                title="Xem trước danh sách câu trước khi luyện">
                <Search size={14} />
                <span className="hidden sm:inline">Xem trước</span>
              </button>
            </div>

            {/* Progress indicator */}
            {d.isImporting && d.importProgress && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2.5 rounded-xl text-sm font-medium">
                <Loader2 size={14} className="animate-spin shrink-0" />
                <span>{d.importProgress}</span>
              </motion.div>
            )}

            {d.importError && (
              <p className="mt-2.5 text-sm text-red-500 bg-red-50 p-2.5 rounded-xl">{d.importError}</p>
            )}

            <AnimatePresence>
              {d.importPreview && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 overflow-hidden">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex gap-3 mb-2">
                      <img src={d.importPreview.thumbnailUrl} alt="" className="w-20 h-14 object-cover rounded-lg shrink-0" />
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-800 text-sm line-clamp-2">{d.importPreview.title}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{d.importPreview.sentences.length} câu</p>
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto mb-3 pr-1 custom-scrollbar">
                      <p className="text-xs text-slate-500 mb-2 font-medium">🤖 AI đã chọn <strong>{d.selectedSentenceIds.size}</strong> câu chứa collocations/chunks quan trọng. Nhấp vào câu để chọn/bỏ chọn:</p>
                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        {d.importPreview.sentences.map((s, i) => {
                          const isSelected = d.selectedSentenceIds.has(s.id);
                          const isLast = i === d.importPreview.sentences.length - 1;
                          return (
                            <div key={s.id} 
                              onClick={() => d.toggleSentenceSelection(s.id)}
                              className={`group relative flex cursor-pointer transition-colors ${
                                isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                              } ${!isLast ? 'border-b border-dashed border-slate-100' : ''}`}>
                              {/* Accent bar */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${
                                isSelected ? 'bg-[#1a56db]' : 'bg-transparent group-hover:bg-slate-200'
                              }`} />
                              
                              <div className="py-2.5 px-4 flex-1">
                                <p className={`text-[13px] leading-relaxed ${isSelected ? 'text-[#1e3a8a] font-medium' : 'text-slate-500'}`}>
                                  <span className={`font-mono text-[10px] mr-2 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`}>{i + 1}.</span>
                                  {s.text}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={d.confirmImport} disabled={d.selectedSentenceIds.size === 0}
                        className="flex-1 py-2 bg-green-500 text-white font-bold rounded-xl text-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1">
                        ✅ Lưu {d.selectedSentenceIds.size} câu
                      </button>
                      <button onClick={() => d.setYoutubeUrl('')} className="px-3 py-2 bg-slate-200 text-slate-600 font-bold rounded-xl text-sm">Hủy</button>
                    </div>

                    {d.importPreview.vocabulary && d.importPreview.vocabulary.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2">📚 Từ vựng nổi bật (AI trích xuất)</h4>
                        <div className="flex flex-wrap gap-2">
                          {d.importPreview.vocabulary.map((v, i) => (
                            <div key={i} className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm text-xs">
                              <span className="font-bold text-[#1a56db]">{v.word}</span>
                              <span className="text-slate-400 mx-1">-</span>
                              <span className="text-slate-600">{v.meaning}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Saved Lessons */}
          <div>
            <h3 className="font-bold text-slate-600 mb-2 text-xs uppercase tracking-wider">Bài đã lưu ({d.savedLessons.length})</h3>
            {d.savedLessons.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <Youtube size={32} className="text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Chưa có bài nào.</p>
                <p className="text-slate-300 text-xs mt-0.5">Dán link YouTube ở trên để bắt đầu!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {d.savedLessons.map(lesson => (
                  <div key={lesson.id} className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm">
                    <div className="flex gap-3">
                      {lesson.thumbnailUrl && <img src={lesson.thumbnailUrl} alt="" className="w-20 h-14 object-cover rounded-xl shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 text-sm line-clamp-2 leading-snug">{lesson.title}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{lesson.sentences.length} câu</p>
                      </div>
                    </div>
                    {lesson.vocabulary && lesson.vocabulary.length > 0 && (
                      <div className="mt-3 overflow-x-auto pb-2 scrollbar-hide flex gap-2">
                        {lesson.vocabulary.map((v, i) => (
                          <div key={i} className="bg-slate-50 border border-slate-100 rounded-md px-2 py-1 text-[10px] whitespace-nowrap shrink-0">
                            <span className="font-bold text-slate-700">{v.word}</span>
                            <span className="text-slate-400 mx-1">:</span>
                            <span className="text-slate-500">{v.meaning}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <button onClick={() => d.deleteLesson(lesson.id)} className="p-1.5 text-slate-300 hover:text-red-400 rounded-lg"><Trash2 size={14} /></button>
                      <button onClick={() => d.startLesson(lesson)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#1a56db] text-white font-bold rounded-xl text-sm active:scale-95">
                        <Play size={13} /> Luyện tập
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── PRACTICE PHASE ───
  if (!d.currentSentence || !d.currentLesson) return null;

  const sessionResults = d.isLastSentence && step === 'done' ? d.getSessionResults() : null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f8f9fb]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-100 shrink-0">
        <button onClick={d.exitPractice} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ArrowLeft size={18} /></button>
        <span className="text-sm font-bold text-slate-400">{d.currentIndex + 1} / {d.totalSentences}</span>
        <div className="w-10" /> {/* spacer */}
      </div>

      {/* Progress */}
      <div className="h-1 bg-slate-100 shrink-0">
        <motion.div className="h-full bg-gradient-to-r from-[#1a56db] to-blue-400"
          animate={{ width: `${((d.currentIndex + (step === 'done' || step === 'speak-result' ? 1 : 0.5)) / d.totalSentences) * 100}%` }}
          transition={{ type: 'spring', stiffness: 100 }} />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-3 py-3 sm:p-5 space-y-4 sm:space-y-6">

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1 text-xs">
            <StepDot active={step === 'write' || step === 'write-result'} done={step === 'speak' || step === 'speak-result' || step === 'done'} label="✍️ Viết" />
            <ChevronRight size={12} className="text-slate-300 mx-1" />
            <StepDot active={step === 'speak' || step === 'speak-result'} done={step === 'done'} label="🎙️ Nói" />
          </div>

          {/* Audio controls - mobile-optimized compact bar */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <button onClick={handleReplay} disabled={isSpeaking || isPlayingVideo}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1a56db] text-white font-bold rounded-xl text-sm sm:text-base active:scale-95 shadow-md disabled:opacity-50">
              {(isSpeaking || isPlayingVideo) ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
              {(isSpeaking || isPlayingVideo) ? 'Đang phát...' : '▶ Nghe lại'}
            </button>

            {/* Speed dropdown */}
            <div className="relative">
              <button onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[13px] font-bold active:scale-95 border transition-colors ${
                  currentRate !== 1.0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-slate-500 border-slate-200'
                }`}>
                <Gauge size={13} /> {currentRate}x
              </button>
              {showSpeedMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowSpeedMenu(false)} />
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-30 overflow-hidden min-w-[100px]">
                    {playbackRates.map((rate, idx) => (
                      <button key={rate} onClick={() => handleSpeedChange(idx)}
                        className={`w-full px-4 py-2 text-left text-[13px] font-bold transition-colors ${
                          idx === speedIndex ? 'bg-[#1a56db] text-white' : 'text-slate-600 hover:bg-slate-50 active:bg-slate-100'
                        }`}>
                        {rate}x {rate === 1.0 && '(Mặc định)'}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </div>

            <button onClick={() => d.setAutoLoop(!d.autoLoop)}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[13px] font-bold active:scale-95 border transition-colors ${
                d.autoLoop ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-slate-500 border-slate-200'
              }`}>
              🔁 {d.autoLoop ? 'Bật' : 'Tắt'}
            </button>
          </div>

          {/* YouTube Video Player — tap to replay */}
          {videoSrcId && (
            <div
              className="rounded-2xl overflow-hidden shadow-sm aspect-video bg-black relative cursor-pointer group"
              onClick={() => { if (!isVideoBlocked) handleReplay(); }}
            >
              {/* Tap-to-replay overlay (visible when video is paused/idle, not when blocked) */}
              {!isVideoBlocked && !isPlayingVideo && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 opacity-0 group-active:opacity-100 transition-opacity pointer-events-none">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
                    <Play size={20} className="text-white ml-0.5" fill="currentColor" />
                  </div>
                </div>
              )}
              {/* iOS autoplay blocked overlay */}
              {isVideoBlocked && (
                <div className="absolute inset-0 bg-slate-900/70 z-10 flex flex-col items-center justify-center text-white p-4">
                  <button onClick={handleReplay} className="p-4 bg-[#1a56db] rounded-full shadow-lg mb-3 animate-pulse hover:bg-blue-600 transition-colors">
                    <Play size={24} fill="currentColor" className="ml-1" />
                  </button>
                  <p className="text-sm font-bold text-center">Bấm để phát video</p>
                  <p className="text-[10px] text-slate-300 mt-1 opacity-80">(Trình duyệt chặn tự động phát)</p>
                </div>
              )}
              <YouTube
                videoId={videoSrcId}
                opts={{
                  width: '100%',
                  height: '100%',
                  playerVars: {
                    controls: 0,
                    disablekb: 1,
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    playsinline: 1,
                    fs: 0,
                    iv_load_policy: 3,
                    origin: window.location.origin
                  },
                }}
                onReady={onPlayerReady}
                onStateChange={onPlayerStateChange}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            </div>
          )}



          {/* ─── STEP: WRITE (full sentence) ─── */}
          {step === 'write' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative">
              <div className="absolute top-2 right-3 text-[10px] font-bold text-slate-300 pointer-events-none">
                Câu này có {d.currentSentence?.text.split(/\s+/).filter(w => w.length > 0).length} từ
              </div>
              <textarea value={d.userInput} onChange={e => d.setUserInput(e.target.value)}
                onKeyDown={e => { 
                  if (e.key === 'Enter') {
                    if (!e.shiftKey && !e.ctrlKey) {
                      e.preventDefault(); 
                      if (d.userInput.trim()) handleCheck(); 
                    } else if (e.ctrlKey) {
                      e.preventDefault();
                      handleNext();
                    }
                  } else if (e.key === 'Tab') {
                    e.preventDefault();
                    handleReplay();
                  }
                }}
                placeholder="Gõ những gì bạn nghe... (Tab: Nghe lại, Enter: Nộp)"
                className="w-full p-5 pt-8 text-lg sm:text-xl leading-relaxed resize-none rounded-2xl border border-slate-200 shadow-sm focus:outline-none focus:border-[#1a56db] focus:ring-2 focus:ring-blue-100 min-h-[140px] bg-white"
                autoFocus />
            </motion.div>
          )}

          {/* ─── STEP: CLOZE (fill blanks) ─── */}
          {step === 'cloze' && d.currentCloze && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">🧩 Điền từ còn thiếu</p>
                  <button onClick={() => setShowHints(!showHints)}
                    className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors active:scale-95 ${
                      showHints ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400 hover:text-slate-600'
                    }`}>
                    💡 Gợi ý
                  </button>
                </div>
                <p className="text-lg sm:text-xl leading-[2.5] text-slate-700">
                  {d.currentCloze.display.split(/(___\d+___[.,!?;:'"()]*)/g).map((part, i) => {
                    const blankMatch = part.match(/___((\d+))___(.*)/);
                    if (blankMatch) {
                      const blankIdx = parseInt(blankMatch[1]) - 1;
                      const trailing = blankMatch[3] || '';
                      const hintChar = showHints ? d.currentCloze!.blankedWords[blankIdx]?.[0]?.toUpperCase() + '...' : `${blankIdx + 1}`;
                      return (
                        <span key={i} className="inline-flex items-baseline">
                          <input
                            type="text"
                            value={d.currentCloze!.userAnswers[blankIdx] || ''}
                            onChange={e => d.setClozeAnswer(blankIdx, e.target.value)}
                            placeholder={hintChar}
                            className="inline-block w-28 sm:w-40 mx-1 px-2 py-1.5 text-center text-lg sm:text-xl font-bold border-b-2 border-amber-400 bg-amber-50 rounded-t-lg focus:outline-none focus:border-amber-500 focus:bg-amber-100 transition-colors"
                            autoFocus={blankIdx === 0}
                          />
                          {trailing && <span>{trailing} </span>}
                        </span>
                      );
                    }
                    return <span key={i}>{part}</span>;
                  })}
                </p>
              </div>
              <p className="text-[11px] text-slate-400 text-center">💡 Bôi đen từ trong đáp án để tra nghĩa & lưu vào Sổ tay</p>
            </motion.div>
          )}

          {/* ─── STEP: CLOZE RESULT ─── */}
          {step === 'cloze-result' && d.currentCloze && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className={`flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-sm ${
                (d.clozeScore ?? 0) >= 90 ? 'bg-green-50 text-green-600' :
                (d.clozeScore ?? 0) >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
              }`}>
                {(d.clozeScore ?? 0) >= 90 ? <CheckCircle2 size={16} /> : (d.clozeScore ?? 0) >= 60 ? <AlertTriangle size={16} /> : <XCircle size={16} />}
                {d.clozeScore}% chính xác
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
                {d.currentCloze.blankedWords.map((correctWord, i) => {
                  const userAns = (d.currentCloze!.userAnswers[i] || '').trim();
                  const isCorrect = correctWord.toLowerCase().replace(/[.,!?;:'"()]/g, '') === userAns.toLowerCase().replace(/[.,!?;:'"()]/g, '');
                  return (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: isCorrect ? '#dcfce7' : '#fef2f2', color: isCorrect ? '#16a34a' : '#dc2626' }}>
                        {i + 1}
                      </span>
                      <span className={`font-bold ${isCorrect ? 'text-green-600' : 'text-red-500 line-through'}`}>{userAns || '(trống)'}</span>
                      {!isCorrect && <span className="text-green-600 font-bold">→ {correctWord}</span>}
                      {isCorrect && <CheckCircle2 size={14} className="text-green-500" />}
                    </div>
                  );
                })}
              </div>

              <div className="bg-green-50 rounded-2xl border border-green-200 p-3.5 shadow-sm">
                <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1.5">Câu đầy đủ:</p>
                <p className="text-lg sm:text-xl text-green-800 leading-relaxed font-medium">{d.currentSentence?.text}</p>
              </div>
            </motion.div>
          )}

          {/* ─── STEP: WRITE RESULT ─── */}
          {step === 'write-result' && d.lastDiff && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              {/* Score */}
              <div className={`flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-sm ${
                d.lastDiff.score >= 90 ? 'bg-green-50 text-green-600' :
                d.lastDiff.score >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
              }`}>
                {d.lastDiff.score >= 90 ? <CheckCircle2 size={16} /> : d.lastDiff.score >= 60 ? <AlertTriangle size={16} /> : <XCircle size={16} />}
                {d.lastDiff.score}% chính xác
              </div>

              {/* User input */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Bạn viết:</p>
                <p className="text-lg sm:text-xl leading-relaxed">
                  {d.lastDiff.userDiff.map((w, i) => (
                    <span key={i} className={w.status === 'correct' ? 'text-green-600' : 'text-red-500 line-through decoration-red-300'}>{w.word} </span>
                  ))}
                </p>
              </div>

              {/* Answer */}
              <div className="bg-green-50 rounded-2xl border border-green-200 p-3.5 shadow-sm">
                <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1.5 flex justify-between">
                  Đáp án:
                  <span className="text-[10px] normal-case opacity-70">Nhấn vào từ để nghe phát âm</span>
                </p>
                <p className="text-lg sm:text-xl leading-relaxed">
                  {d.lastDiff.correctDiff.map((w, i) => (
                    <span key={i} 
                      onClick={() => handleWordClick(w.word)}
                      className={`cursor-pointer hover:bg-green-200 rounded px-0.5 transition-colors ${w.status === 'correct' ? 'text-green-700' : 'text-amber-600 font-bold underline decoration-amber-300'}`}>
                      {w.word}{' '}
                    </span>
                  ))}
                </p>
              </div>

              {/* Retry write */}
              <button onClick={handleRetryWrite}
                className="flex items-center justify-center gap-1.5 w-full py-2 text-[#1a56db] bg-blue-50 border border-blue-100 font-bold rounded-xl text-sm active:scale-95">
                <RotateCcw size={14} /> Viết lại
              </button>
            </motion.div>
          )}

          {/* ─── STEP: SPEAK ─── */}
          {step === 'speak' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <p className="text-center text-sm text-slate-500 font-medium mb-2">Bây giờ nói lại câu bạn vừa nghe 🎙️</p>

              <div className="flex items-start gap-2 sm:gap-3">
                <button onClick={voice.toggleRecording} disabled={voice.isProcessing}
                  className={`p-3 sm:p-4 rounded-2xl shadow-lg transition-all active:scale-95 shrink-0 ${
                    voice.isRecording ? 'bg-red-500 text-white animate-pulse shadow-red-200 scale-105'
                    : voice.isProcessing ? 'bg-amber-100 text-amber-600 shadow-amber-100'
                    : 'bg-[#1a56db] text-white shadow-blue-200 hover:bg-blue-700'
                  }`}>
                  {voice.isProcessing ? <Loader2 size={20} className="animate-spin sm:w-6 sm:h-6" /> : voice.isRecording ? <MicOff size={20} className="sm:w-6 sm:h-6" /> : <Mic size={20} className="sm:w-6 sm:h-6" />}
                </button>
                
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-3 shadow-sm focus-within:border-[#1a56db] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between items-center">
                    Bạn đã nói:
                    <span className="text-[10px] font-normal text-slate-300 normal-case">(Có thể sửa lại nếu máy nghe sai)</span>
                  </p>
                  <textarea
                    value={shadowText}
                    onChange={(e) => {
                      setShadowText(e.target.value);
                      d.setShadowingTranscript(e.target.value);
                    }}
                    className="w-full text-lg sm:text-xl text-slate-700 leading-relaxed resize-none focus:outline-none bg-transparent min-h-[120px]"
                    placeholder={voice.isRecording ? '🔴 Đang thu âm...' : voice.isProcessing ? '⏳ Đang nhận dạng...' : 'Ghi âm hoặc gõ lại câu bạn vừa đọc...'}
                  />
                </div>
              </div>
              {voice.isProcessing && (
                <p className="text-xs text-amber-600 text-center animate-pulse font-medium mt-2">
                  {voice.interimTranscript || '🎙️ Groq Whisper đang nhận dạng tiếng Pháp...'}
                </p>
              )}
            </motion.div>
          )}

          {/* ─── STEP: SPEAK RESULT ─── */}
          {step === 'speak-result' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              {/* What user said */}
              {shadowText && (
                <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Bạn đã nói:</p>
                  <p className="text-lg sm:text-xl text-slate-700 leading-relaxed">{shadowText}</p>
                </div>
              )}

              {/* Answer */}
              <div className="bg-green-50 rounded-2xl border border-green-200 p-3.5 shadow-sm">
                <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1.5">Đáp án:</p>
                <p className="text-lg sm:text-xl text-green-800 leading-relaxed font-medium">{d.currentSentence?.text}</p>
              </div>

              {/* Retry speak */}
              <button onClick={handleRetrySpeak}
                className="flex items-center justify-center gap-1.5 w-full py-2 text-[#1a56db] bg-blue-50 border border-blue-100 font-bold rounded-xl text-sm active:scale-95">
                <RotateCcw size={14} /> Nói lại
              </button>
            </motion.div>
          )}

          {/* Session complete */}
          {step === 'done' && sessionResults && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-[#1a56db] to-blue-600 rounded-2xl p-5 text-white shadow-lg">
              <h3 className="font-bold text-lg mb-3">🏆 Hoàn thành!</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center"><p className="text-2xl font-bold">{sessionResults.total}</p><p className="text-xs text-blue-200">Tổng câu</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-yellow-300">{sessionResults.averageScore}%</p><p className="text-xs text-blue-200">Điểm TB</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-green-300">{sessionResults.perfectCount}</p><p className="text-xs text-blue-200">Hoàn hảo</p></div>
              </div>
              <button onClick={d.exitPractice} className="w-full py-3 bg-white/20 text-white font-bold rounded-xl text-sm active:scale-95">Quay lại</button>
            </motion.div>
          )}
        </div>
      </div>

      {/* ─── Bottom action bar (mobile-friendly) ─── */}
      {step !== 'done' && (
        <div className="px-4 py-3 bg-white border-t border-slate-100 shrink-0 safe-area-bottom">
          <div className="max-w-2xl mx-auto flex gap-2 sm:gap-3">
            {step === 'write' && (
              <button onClick={handleCheck} disabled={!d.userInput.trim()}
                className="flex-1 py-4 sm:py-5 bg-[#1a56db] text-white font-bold rounded-2xl text-base sm:text-lg active:scale-95 shadow-md disabled:opacity-40 flex items-center justify-center gap-2">
                <Send size={18} /> Kiểm tra
              </button>
            )}

            {step === 'cloze' && (
              <button onClick={handleClozeCheck} disabled={!d.currentCloze?.userAnswers.some(a => a.trim())}
                className="flex-1 py-4 sm:py-5 bg-amber-500 text-white font-bold rounded-2xl text-base sm:text-lg active:scale-95 shadow-md disabled:opacity-40 flex items-center justify-center gap-2">
                <Send size={18} /> Kiểm tra
              </button>
            )}

            {(step === 'write-result' || step === 'cloze-result') && (
              <>
                <button onClick={handleStartSpeak}
                  className="flex-1 py-4 sm:py-5 bg-green-500 text-white font-bold rounded-2xl text-base sm:text-lg active:scale-95 shadow-md flex items-center justify-center gap-2">
                  <Mic size={18} /> Tiếp: Nói lại
                </button>
                <button onClick={handleNext}
                  className="flex-1 py-4 sm:py-5 bg-slate-200 text-slate-700 font-bold rounded-2xl text-base sm:text-lg active:scale-95 shadow-md flex items-center justify-center gap-1.5">
                  Bỏ qua Nói <ChevronRight size={18} />
                </button>
              </>
            )}

            {step === 'speak' && (
              <button onClick={handleRevealSpeak} disabled={!shadowText && !voice.isProcessing}
                className="flex-1 py-4 sm:py-5 bg-[#1a56db] text-white font-bold rounded-2xl text-base sm:text-lg active:scale-95 shadow-md disabled:opacity-40 flex items-center justify-center gap-2">
                <Eye size={18} /> Xem đáp án
              </button>
            )}

            {step === 'speak-result' && (
              <button onClick={handleNext}
                className="flex-1 py-4 sm:py-5 bg-green-500 text-white font-bold rounded-2xl text-base sm:text-lg active:scale-95 shadow-md flex items-center justify-center gap-2">
                {d.isLastSentence ? '🏆 Xem kết quả' : <>Câu tiếp <ChevronRight size={18} /></>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Step indicator dot
const StepDot: React.FC<{ active: boolean; done: boolean; label: string }> = ({ active, done, label }) => (
  <span className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
    done ? 'bg-green-100 text-green-600' : active ? 'bg-blue-100 text-[#1a56db]' : 'bg-slate-100 text-slate-400'
  }`}>{label}</span>
);
