import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Check, X, Volume2, Shuffle, Trophy, ArrowRight, Brain } from 'lucide-react';
import { FavoriteItem } from '../types';

interface FlashcardReviewProps {
  favorites: FavoriteItem[];
  playAudio: (text: string) => void;
  onClose: () => void;
}

interface CardState {
  item: FavoriteItem;
  /** Number of times the user got it right in a row */
  streak: number;
  /** Next review timestamp (ms) */
  nextReview: number;
}

const INTERVALS = [0, 60_000, 5 * 60_000, 30 * 60_000, 24 * 3600_000]; // now, 1m, 5m, 30m, 1d

export const FlashcardReview: React.FC<FlashcardReviewProps> = ({ favorites, playAudio, onClose }) => {
  // Load persisted card states from localStorage
  const loadCardStates = useCallback((): Map<string | number, CardState> => {
    const saved = localStorage.getItem('flashcard_states');
    const map = new Map<string | number, CardState>();
    if (saved) {
      try {
        const parsed: CardState[] = JSON.parse(saved);
        parsed.forEach(cs => map.set(cs.item.id, cs));
      } catch (e) {}
    }
    return map;
  }, []);

  const [cardStatesMap, setCardStatesMap] = useState<Map<string | number, CardState>>(loadCardStates);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0 });
  const [isFinished, setIsFinished] = useState(false);

  // Build the review queue: cards due for review (nextReview <= now), shuffled
  const reviewQueue = useMemo(() => {
    const now = Date.now();
    const queue: FavoriteItem[] = [];
    
    for (const fav of favorites) {
      const state = cardStatesMap.get(fav.id);
      if (!state || state.nextReview <= now) {
        queue.push(fav);
      }
    }

    // Shuffle
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    return queue;
  }, [favorites]); // Only compute once on mount

  const currentCard = reviewQueue[currentIndex];

  const persistStates = useCallback((map: Map<string | number, CardState>) => {
    const arr = Array.from(map.values());
    localStorage.setItem('flashcard_states', JSON.stringify(arr));
  }, []);

  const handleAnswer = useCallback((correct: boolean) => {
    if (!currentCard) return;

    const newMap = new Map(cardStatesMap);
    const existing = newMap.get(currentCard.id);
    const currentStreak = existing?.streak || 0;

    let newStreak: number;
    if (correct) {
      newStreak = Math.min(currentStreak + 1, INTERVALS.length - 1);
    } else {
      newStreak = 0; // Reset on wrong answer
    }

    const newState: CardState = {
      item: currentCard,
      streak: newStreak,
      nextReview: Date.now() + INTERVALS[newStreak]
    };
    newMap.set(currentCard.id, newState);
    setCardStatesMap(newMap);
    persistStates(newMap);

    setSessionStats(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      wrong: prev.wrong + (correct ? 0 : 1)
    }));

    // Move to next card
    setIsFlipped(false);
    if (currentIndex + 1 >= reviewQueue.length) {
      setIsFinished(true);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentCard, currentIndex, reviewQueue.length, cardStatesMap, persistStates]);

  // Mastered count
  const masteredCount = useMemo(() => {
    let count = 0;
    cardStatesMap.forEach(cs => {
      if (cs.streak >= 3) count++;
    });
    return count;
  }, [cardStatesMap]);

  if (favorites.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex-1 flex flex-col items-center justify-center text-center p-8"
      >
        <Brain size={48} className="text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa có từ nào để ôn!</h3>
        <p className="text-slate-500 text-sm mb-6">Hãy lưu từ vựng vào Sổ tay trước khi bắt đầu ôn tập nhé.</p>
        <button onClick={onClose} className="px-6 py-3 bg-brand-primary text-white rounded-2xl font-bold text-sm">
          Quay lại
        </button>
      </motion.div>
    );
  }

  if (isFinished || reviewQueue.length === 0) {
    const total = sessionStats.correct + sessionStats.wrong;
    const accuracy = total > 0 ? Math.round((sessionStats.correct / total) * 100) : 0;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-6"
      >
        <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-200">
          <Trophy size={40} className="text-white" />
        </div>
        
        <div>
          <h3 className="text-2xl font-bold text-slate-800 mb-1">
            {reviewQueue.length === 0 ? 'Tuyệt vời!' : 'Hoàn thành!'}
          </h3>
          <p className="text-slate-500 text-sm">
            {reviewQueue.length === 0 
              ? 'Tất cả từ đều đã được ôn xong. Quay lại sau nhé!' 
              : `Bạn đã ôn xong ${total} từ trong phiên này.`
            }
          </p>
        </div>

        {total > 0 && (
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-500">{sessionStats.correct}</p>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Đúng</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-rose-500">{sessionStats.wrong}</p>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Sai</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-brand-primary">{accuracy}%</p>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Chính xác</p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button 
            onClick={() => {
              setCurrentIndex(0);
              setIsFlipped(false);
              setIsFinished(false);
              setSessionStats({ correct: 0, wrong: 0 });
            }}
            className="px-5 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-slate-200 transition-colors"
          >
            <RotateCcw size={16} /> Ôn lại
          </button>
          <button onClick={onClose} className="px-5 py-3 bg-brand-primary text-white rounded-2xl font-bold text-sm hover:bg-brand-primary/90 transition-colors">
            Quay lại Sổ tay
          </button>
        </div>
      </motion.div>
    );
  }

  const progress = ((currentIndex) / reviewQueue.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col gap-4 p-4 sm:p-6"
    >
      {/* Progress bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-brand-primary to-pink-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 100 }}
          />
        </div>
        <span className="text-xs font-bold text-slate-400 whitespace-nowrap">
          {currentIndex + 1}/{reviewQueue.length}
        </span>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between text-xs font-medium">
        <div className="flex gap-3">
          <span className="text-emerald-500">✓ {sessionStats.correct}</span>
          <span className="text-rose-500">✗ {sessionStats.wrong}</span>
        </div>
        <span className="text-amber-500 flex items-center gap-1">
          <Trophy size={12} /> {masteredCount} thuộc
        </span>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          key={currentCard.id}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="w-full max-w-md cursor-pointer"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className="relative w-full aspect-[3/2] perspective-1000">
            <AnimatePresence mode="wait">
              {!isFlipped ? (
                <motion.div
                  key="front"
                  initial={{ rotateY: 180, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: -180, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 bg-gradient-to-br from-brand-primary to-pink-500 rounded-3xl shadow-xl shadow-brand-primary/20 flex flex-col items-center justify-center p-8 text-white"
                >
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-4">Tiếng Pháp</p>
                  <p className="text-2xl sm:text-3xl font-bold text-center leading-snug">{currentCard.textFr}</p>
                  <button 
                    onClick={(e) => { e.stopPropagation(); playAudio(currentCard.textFr); }}
                    className="mt-6 p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors active:scale-95"
                  >
                    <Volume2 size={20} />
                  </button>
                  <p className="mt-6 text-xs opacity-50">Nhấn để lật thẻ</p>
                </motion.div>
              ) : (
                <motion.div
                  key="back"
                  initial={{ rotateY: -180, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: 180, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center justify-center p-8"
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Nghĩa</p>
                  <p className="text-2xl sm:text-3xl font-bold text-center text-slate-800 leading-snug">{currentCard.textEnVi}</p>
                  <p className="mt-2 text-sm text-slate-400">{currentCard.textFr}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Action buttons - only show when flipped */}
      <AnimatePresence>
        {isFlipped && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex items-center justify-center gap-6 pb-2"
          >
            <button
              onClick={() => handleAnswer(false)}
              className="flex flex-col items-center gap-1.5 px-8 py-4 bg-rose-50 text-rose-500 rounded-2xl font-bold text-sm hover:bg-rose-100 transition-colors active:scale-95"
            >
              <X size={24} />
              <span>Chưa biết</span>
            </button>
            <button
              onClick={() => handleAnswer(true)}
              className="flex flex-col items-center gap-1.5 px-8 py-4 bg-emerald-50 text-emerald-500 rounded-2xl font-bold text-sm hover:bg-emerald-100 transition-colors active:scale-95"
            >
              <Check size={24} />
              <span>Đã biết</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
