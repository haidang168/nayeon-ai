import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Check, X, Volume2, Trophy, ArrowRight, Brain, ArrowLeft, Info, Lightbulb, Clock, Zap, Star, BookOpen, Sparkles, HelpCircle, Filter } from 'lucide-react';
import { FavoriteItem } from '../types';
import { syncDataToCloud, loadDataFromCloud } from '../lib/firebase';
import { WordDetailPanel } from './WordDetailPanel';
import { groq, groqSafe } from '../lib/groq';

interface FlashcardReviewProps {
  favorites: FavoriteItem[];
  playAudio: (text: string) => void;
  onClose: () => void;
}

// ══════════════════════════════════════════════════════
// SM-2 Spaced Repetition System
// ══════════════════════════════════════════════════════

type WordLevel = 'new' | 'learning' | 'review' | 'mastered';
type Rating = 'again' | 'hard' | 'good' | 'easy';

interface CardState {
  item: FavoriteItem;
  level: WordLevel;
  easeFactor: number;      // 2.5 default, min 1.3
  interval: number;        // days — time until next review
  nextReview: number;      // timestamp ms
  totalReviews: number;
  correctStreak: number;
  lastReview: number;      // timestamp of last review
}

// Legacy format for migration
interface LegacyCardState {
  item: FavoriteItem;
  streak: number;
  nextReview: number;
}

const DAY_MS = 24 * 3600_000;
const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

function classifyLevel(intervalDays: number): WordLevel {
  if (intervalDays <= 0) return 'new';
  if (intervalDays < 1) return 'learning';
  if (intervalDays < 21) return 'review';
  return 'mastered';
}

/** Migrate old streak-based CardState to new SM-2 format */
function migrateCardState(old: LegacyCardState): CardState {
  const streak = old.streak || 0;
  let interval: number;
  let ease = DEFAULT_EASE;

  if (streak === 0) {
    interval = 0;
  } else if (streak === 1) {
    interval = 0.007; // ~10 minutes in days
  } else if (streak === 2) {
    interval = 0.5;
  } else if (streak === 3) {
    interval = 3;
  } else {
    interval = Math.min(streak * 5, 60);
    ease = 2.5 + (streak - 3) * 0.1;
  }

  return {
    item: old.item,
    level: classifyLevel(interval),
    easeFactor: Math.max(MIN_EASE, ease),
    interval,
    nextReview: old.nextReview,
    totalReviews: streak,
    correctStreak: streak,
    lastReview: old.nextReview > 0 ? old.nextReview - interval * DAY_MS : 0,
  };
}

function isNewFormat(obj: any): obj is CardState {
  return obj && typeof obj.level === 'string' && typeof obj.easeFactor === 'number';
}

/** Calculate the next interval for a given rating */
function calculateNextReview(card: CardState, rating: Rating): CardState {
  const now = Date.now();
  let newInterval: number;
  let newEase = card.easeFactor;
  let newStreak = card.correctStreak;

  switch (rating) {
    case 'again':
      newStreak = 0;
      if (card.level === 'review' || card.level === 'mastered') {
        // Don't fully reset mastered cards — halve the interval
        newInterval = Math.max(1, card.interval * 0.5);
        newEase = Math.max(MIN_EASE, card.easeFactor - 0.2);
      } else {
        // Learning or new card: short interval
        newInterval = 1 / (24 * 60); // 1 minute in days
        newEase = Math.max(MIN_EASE, card.easeFactor - 0.2);
      }
      break;

    case 'hard':
      newStreak = card.correctStreak; // don't reset, but don't increment
      if (card.interval < 1) {
        newInterval = 0.007; // ~10 minutes
      } else {
        newInterval = card.interval * 1.2;
      }
      newEase = Math.max(MIN_EASE, card.easeFactor - 0.15);
      break;

    case 'good':
      newStreak = card.correctStreak + 1;
      if (card.interval < 1) {
        // Learning → first real interval
        newInterval = 1; // 1 day
      } else {
        newInterval = card.interval * card.easeFactor;
      }
      // ease stays the same
      break;

    case 'easy':
      newStreak = card.correctStreak + 1;
      if (card.interval < 1) {
        newInterval = 4; // Jump to 4 days
      } else {
        newInterval = card.interval * card.easeFactor * 1.3;
      }
      newEase = card.easeFactor + 0.15;
      break;
  }

  // Cap interval at 365 days
  newInterval = Math.min(newInterval, 365);

  return {
    ...card,
    easeFactor: newEase,
    interval: newInterval,
    nextReview: now + newInterval * DAY_MS,
    totalReviews: card.totalReviews + 1,
    correctStreak: newStreak,
    lastReview: now,
    level: classifyLevel(newInterval),
  };
}

/** Get preview intervals for all 4 ratings */
function getPreviewIntervals(card: CardState): Record<Rating, string> {
  const previews: Record<Rating, string> = { again: '', hard: '', good: '', easy: '' };
  for (const r of ['again', 'hard', 'good', 'easy'] as Rating[]) {
    const next = calculateNextReview(card, r);
    previews[r] = formatInterval(next.interval);
  }
  return previews;
}

function formatInterval(days: number): string {
  if (days < 1 / (24 * 60)) return '<1m';
  if (days < 1 / 24) return `${Math.round(days * 24 * 60)}m`;
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${(days / 30).toFixed(1)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

type FilterMode = 'due' | 'hard' | 'all';

// ══════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════

export const FlashcardReview: React.FC<FlashcardReviewProps> = ({ favorites, playAudio, onClose }) => {
  // Load persisted card states from localStorage (sync call for initial render)
  const loadCardStatesLocal = useCallback((): Map<string | number, CardState> => {
    const saved = localStorage.getItem('flashcard_states');
    const map = new Map<string | number, CardState>();
    if (saved) {
      try {
        const parsed: any[] = JSON.parse(saved);
        parsed.forEach(cs => {
          // Migrate old format if needed
          const state = isNewFormat(cs) ? cs : migrateCardState(cs as LegacyCardState);
          map.set(state.item.id, state);
        });
      } catch (e) {}
    }
    return map;
  }, []);

  const [cardStatesMap, setCardStatesMap] = useState<Map<string | number, CardState>>(loadCardStatesLocal);
  const [phase, setPhase] = useState<'setup' | 'review' | 'finished'>('setup');
  const [reviewCount, setReviewCount] = useState<number>(10);
  const [selectedMode, setSelectedMode] = useState<string>('mixed');
  const [filterMode, setFilterMode] = useState<FilterMode>('due');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0 });
  const [detailedWord, setDetailedWord] = useState<FavoriteItem | null>(null);
  const [showSrsInfo, setShowSrsInfo] = useState(false);

  // Mode-specific states
  const [typingInput, setTypingInput] = useState('');
  const [isTypingChecked, setIsTypingChecked] = useState(false);
  const [fillInSentence, setFillInSentence] = useState<{fr: string, en: string, answer: string} | null>(null);
  const [isFetchingSentence, setIsFetchingSentence] = useState(false);
  const [hintLevel, setHintLevel] = useState(0); // 0=none, 1=letter count, 2=first letter, 3=first 2 letters...

  // Per-card mode map for mixed mode
  const cardModesRef = useRef<Map<string | number, 'basic' | 'typing'>>(new Map());

  // Locked queue ref: prevents re-shuffle mid-session
  const lockedQueueRef = useRef<FavoriteItem[]>([]);

  // On mount: merge cloud flashcard states with local (cloud wins for conflicts)
  useEffect(() => {
    const mergeCloudStates = async () => {
      try {
        const cloudData = await loadDataFromCloud();
        const cloudStates: any[] | undefined = cloudData?.flashcardStates;
        if (cloudStates && cloudStates.length > 0) {
          setCardStatesMap(prev => {
            const merged = new Map(prev);
            cloudStates.forEach(cs => {
              const state = isNewFormat(cs) ? cs : migrateCardState(cs as LegacyCardState);
              const local = merged.get(state.item.id);
              // Cloud wins if it has a more recent lastReview
              if (!local || (state.lastReview || 0) > (local.lastReview || 0)) {
                merged.set(state.item.id, state);
              }
            });
            // Persist merged result to localStorage
            localStorage.setItem('flashcard_states', JSON.stringify(Array.from(merged.values())));
            return merged;
          });
        }
      } catch (e) {
        console.error('Failed to merge cloud flashcard states:', e);
      }
    };
    mergeCloudStates();
  }, []);

  // ═══ Stats computation ═══
  const stats = useMemo(() => {
    const counts = { new: 0, learning: 0, review: 0, mastered: 0, dueToday: 0, hardWords: 0 };
    const now = Date.now();

    for (const fav of favorites) {
      const state = cardStatesMap.get(fav.id);
      if (!state) {
        counts.new++;
        counts.dueToday++; // new words are always "due"
      } else {
        counts[state.level]++;
        if (state.nextReview <= now) {
          counts.dueToday++;
        }
        if (state.easeFactor < 2.0 || state.correctStreak === 0) {
          counts.hardWords++;
        }
      }
    }
    return counts;
  }, [favorites, cardStatesMap]);

  // Build the review queue based on filter mode
  // Use cardStatesMap (live state) instead of loadCardStatesLocal() to avoid stale data
  const filteredCards = useMemo(() => {
    const now = Date.now();
    const queue: FavoriteItem[] = [];
    
    for (const fav of favorites) {
      const state = cardStatesMap.get(fav.id);
      
      switch (filterMode) {
        case 'due':
          if (!state || state.nextReview <= now) {
            queue.push(fav);
          }
          break;
        case 'hard':
          if (state && (state.easeFactor < 2.0 || state.correctStreak === 0)) {
            queue.push(fav);
          } else if (!state) {
            // Also include new words that haven't been reviewed
            queue.push(fav);
          }
          break;
        case 'all':
          queue.push(fav);
          break;
      }
    }

    return queue;
  }, [favorites, cardStatesMap, filterMode]);

  // Shuffle separately using a shuffle seed that only changes when filter or favorites change
  // This prevents re-shuffling on every cardStatesMap update
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const prevFilterRef = useRef(filterMode);
  const prevFavLenRef = useRef(favorites.length);
  useEffect(() => {
    if (prevFilterRef.current !== filterMode || prevFavLenRef.current !== favorites.length) {
      prevFilterRef.current = filterMode;
      prevFavLenRef.current = favorites.length;
      setShuffleSeed(s => s + 1);
    }
  }, [filterMode, favorites.length]);

  const reviewQueue = useMemo(() => {
    const queue = [...filteredCards];
    // Deterministic shuffle based on seed
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCards, shuffleSeed]);

  // Auto-clamp reviewCount when reviewQueue changes — only in setup phase
  useEffect(() => {
    if (phase !== 'setup') return; // Don't interfere during review
    if (reviewQueue.length > 0) {
      setReviewCount(prev => Math.max(1, Math.min(prev, reviewQueue.length)));
    } else {
      setReviewCount(0);
    }
  }, [reviewQueue.length, phase]);


  // activeQueue: use locked ref during review, otherwise compute from reviewQueue
  const activeQueue = phase === 'review' || phase === 'finished'
    ? lockedQueueRef.current
    : reviewQueue.slice(0, reviewCount);

  const currentCard = activeQueue[currentIndex];

  // Get current card's SRS state (or create default for new card)
  const currentCardState: CardState | null = useMemo(() => {
    if (!currentCard) return null;
    return cardStatesMap.get(currentCard.id) || {
      item: currentCard,
      level: 'new' as WordLevel,
      easeFactor: DEFAULT_EASE,
      interval: 0,
      nextReview: 0,
      totalReviews: 0,
      correctStreak: 0,
      lastReview: 0,
    };
  }, [currentCard, cardStatesMap]);

  // Preview intervals for answer buttons
  const previews = useMemo(() => {
    if (!currentCardState) return null;
    return getPreviewIntervals(currentCardState);
  }, [currentCardState]);

  // Determine what mode this specific card uses
  const currentCardMode: 'basic' | 'typing' = useMemo(() => {
    if (selectedMode === 'basic' || selectedMode === 'typing') return selectedMode as 'basic' | 'typing';
    // mixed mode: look up pre-assigned mode
    if (currentCard && cardModesRef.current.has(currentCard.id)) {
      return cardModesRef.current.get(currentCard.id)!;
    }
    return 'basic';
  }, [selectedMode, currentCard]);

  // Fetch AI sentence for typing mode
  useEffect(() => {
    let isMounted = true;
    if (phase === 'review' && currentCardMode === 'typing' && currentCard) {
      setFillInSentence(null);
      setIsFetchingSentence(true);
      
      const fetchSentence = async () => {
        const isMultiWord = currentCard.textFr.trim().includes(' ');
        const prompt = isMultiWord
          ? `The French expression is: "${currentCard.textFr}".
Write a simple, short French sentence that uses this expression CONJUGATED/DECLINED properly in context (e.g., if it's "avoir mauvaise mine" and the subject is "il", use "a mauvaise mine"; if it's "faire attention", use "fait attention", etc.).
Then replace ONLY the conjugated/declined form of the expression with "___".
Return JSON: {"fr": "sentence with ___", "en": "English translation of the full sentence", "answer": "the exact conjugated text that fills the blank"}
IMPORTANT: "answer" must be the EXACT text that was replaced by ___ (the conjugated/declined form, NOT the infinitive). For example if the sentence is "Il ___ après une nuit sans sommeil" for "avoir mauvaise mine", the answer should be "a mauvaise mine", NOT "avoir mauvaise mine".
Only return valid JSON.`
          : `The French word is: "${currentCard.textFr}".
Write a simple, short French sentence using this word (conjugate or decline it naturally as needed for the sentence context — e.g., plural nouns, conjugated verbs, feminine adjectives).
Then replace that word (in its conjugated/declined form) with "___".
Return JSON: {"fr": "sentence with ___", "en": "English translation of the full sentence", "answer": "the exact word form that fills the blank"}
IMPORTANT: "answer" must be the EXACT form used in the sentence (e.g. if the word is "manger" and the sentence uses "mange", answer is "mange"). Only return valid JSON.`;
        
        try {
          const res = await groqSafe(() => groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' }
          }));
          if (!isMounted) return;
          const data = JSON.parse(res.choices[0]?.message?.content || '{}');
          if (data.fr && data.en && data.answer) {
            setFillInSentence({ fr: data.fr, en: data.en, answer: data.answer.trim() });
          } else if (data.fr && data.en) {
            // Fallback: if AI didn't return answer, use textFr
            setFillInSentence({ fr: data.fr, en: data.en, answer: currentCard.textFr });
          } else {
            throw new Error("Invalid format");
          }
        } catch (e) {
          console.error("AI sentence error:", e);
          if (isMounted) setFillInSentence({ fr: "___", en: currentCard.textEnVi, answer: currentCard.textFr });
        } finally {
          if (isMounted) setIsFetchingSentence(false);
        }
      };
      
      fetchSentence();
    }
    return () => { isMounted = false; };
  }, [phase, currentCardMode, currentCard?.id]);

  // ═══ French text normalization for comparison ═══
  const normalizeFrench = useCallback((text: string): string => {
    return text
      .trim()
      .toLowerCase()
      // Normalize unicode (NFD decomposes accented chars, then strip combining marks)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Remove punctuation
      .replace(/[.,!?;:'"«»\-–—()\[\]]/g, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  // Simple French lemma-like normalization: strip common inflections
  const normalizeFrenchLemma = useCallback((text: string): string => {
    let s = normalizeFrench(text);
    // Common plural/feminine endings
    // Remove trailing 's' (les→le, chats→chat)
    if (s.endsWith('s') && s.length > 2) s = s.slice(0, -1);
    // Remove trailing 'e' for feminine (grande→grand), but be careful with short words
    if (s.endsWith('e') && s.length > 3) s = s.slice(0, -1);
    // Remove trailing 'es' already handled by 's' then 'e'
    return s;
  }, [normalizeFrench]);

  // Helper: check typing correctness
  // Primary: compare against the AI-provided `answer` field (conjugated form)
  // Fallback: compare against textFr (base/infinitive form)
  const isTypingCorrect = useMemo(() => {
    if (!currentCard) return false;
    const inputRaw = typingInput.trim();
    if (!inputRaw) return false;
    const inputNorm = normalizeFrench(inputRaw);
    const inputLemma = normalizeFrenchLemma(inputRaw);

    // 1. If we have an AI-provided answer, compare against it (this is the conjugated form)
    if (fillInSentence?.answer) {
      const answerNorm = normalizeFrench(fillInSentence.answer);
      const answerLemma = normalizeFrenchLemma(fillInSentence.answer);
      // Exact normalized match
      if (inputNorm === answerNorm) return true;
      // Lemma match (handles minor inflection differences like plural s)
      if (inputLemma === answerLemma) return true;
    }

    // 2. Also accept the base/infinitive form (textFr) as correct
    const baseNorm = normalizeFrench(currentCard.textFr);
    const baseLemma = normalizeFrenchLemma(currentCard.textFr);
    if (inputNorm === baseNorm) return true;
    if (inputLemma === baseLemma) return true;

    return false;
  }, [typingInput, currentCard, fillInSentence, normalizeFrench, normalizeFrenchLemma]);

  const persistStates = useCallback((map: Map<string | number, CardState>) => {
    const arr = Array.from(map.values());
    localStorage.setItem('flashcard_states', JSON.stringify(arr));
    // Sync to Firebase for cross-device persistence
    syncDataToCloud({ flashcardStates: arr });
  }, []);

  const handleAnswer = useCallback((rating: Rating) => {
    if (!currentCard) return;

    const newMap = new Map(cardStatesMap);
    const existing: CardState = newMap.get(currentCard.id) || {
      item: currentCard,
      level: 'new',
      easeFactor: DEFAULT_EASE,
      interval: 0,
      nextReview: 0,
      totalReviews: 0,
      correctStreak: 0,
      lastReview: 0,
    };

    const newState = calculateNextReview(existing, rating);
    newState.item = currentCard; // ensure item data is fresh
    newMap.set(currentCard.id, newState);
    setCardStatesMap(newMap);
    persistStates(newMap);

    const isCorrect = rating === 'good' || rating === 'easy';
    setSessionStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1)
    }));

    // Advance to next card first, then reset states
    // This order prevents the old card's UI from flashing with reset states
    if (currentIndex + 1 >= activeQueue.length) {
      setPhase('finished');
    } else {
      setCurrentIndex(prev => prev + 1);
    }

    // Reset local states after advancing
    setIsFlipped(false);
    setTypingInput('');
    setIsTypingChecked(false);
    setFillInSentence(null);
    setHintLevel(0);
  }, [currentCard, currentIndex, activeQueue.length, cardStatesMap, persistStates]);

  // Mastered count
  const masteredCount = useMemo(() => {
    let count = 0;
    cardStatesMap.forEach(cs => {
      if (cs.level === 'mastered') count++;
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

  if (phase === 'finished') {
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
            {activeQueue.length === 0 ? 'Tuyệt vời!' : 'Hoàn thành!'}
          </h3>
          <p className="text-slate-500 text-sm">
            {activeQueue.length === 0 
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
              setTypingInput('');
              setIsTypingChecked(false);
              setPhase('setup');
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

  // ═══════════════════════════════════════════
  // SETUP PHASE
  // ═══════════════════════════════════════════
  if (phase === 'setup') {
    const modes = [
      { id: 'mixed', title: 'Trộn lẫn (khuyên dùng)', desc: 'Random giữa lật thẻ và điền từ — hiệu quả nhất', badge: '🎲 Mixed', badgeCls: 'bg-blue-100 text-blue-700', disabled: false },
      { id: 'basic', title: 'Basic review', desc: 'Lật thẻ truyền thống (nhanh gọn)', badge: 'Classic', badgeCls: 'bg-emerald-100 text-emerald-700', disabled: false },
      { id: 'typing', title: 'Fill in the blank', desc: 'AI tạo câu ngữ cảnh, bạn gõ từ còn thiếu', badge: '✨ AI Active Recall', badgeCls: 'bg-rose-100 text-rose-700', disabled: false },
    ];

    const filterOptions: { id: FilterMode; title: string; desc: string; count: number; icon: React.ReactNode; color: string }[] = [
      { id: 'due', title: 'Đến hạn hôm nay', desc: 'Chỉ ôn từ đã đến lúc cần nhắc lại', count: stats.dueToday, icon: <Clock size={16} />, color: 'blue' },
      { id: 'hard', title: 'Từ khó', desc: 'Ôn lại những từ hay quên, dễ nhầm', count: stats.hardWords, icon: <Zap size={16} />, color: 'orange' },
      { id: 'all', title: 'Tất cả', desc: 'Bỏ qua lịch, ôn toàn bộ từ vựng', count: favorites.length, icon: <BookOpen size={16} />, color: 'slate' },
    ];

    const levelStats: { label: string; count: number; icon: string; color: string; bgColor: string }[] = [
      { label: 'Mới', count: stats.new, icon: '🆕', color: 'text-sky-600', bgColor: 'bg-sky-50 border-sky-100' },
      { label: 'Đang học', count: stats.learning, icon: '📖', color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-100' },
      { label: 'Ôn tập', count: stats.review, icon: '🔄', color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-100' },
      { label: 'Đã thuộc', count: stats.mastered, icon: '⭐', color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-100' },
    ];

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col p-6 sm:p-8 overflow-y-auto custom-scrollbar"
      >
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Brain className="text-blue-500" /> Review Setup
          </h2>
        </div>

        <div className="max-w-2xl mx-auto w-full space-y-7">

          {/* ═══ Stats Summary ═══ */}
          <section>
            <h3 className="text-[15px] font-bold text-slate-800 mb-3 flex items-center gap-2">
              📊 Tình trạng từ vựng
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {levelStats.map(ls => (
                <div key={ls.label} className={`${ls.bgColor} border rounded-xl p-3 text-center`}>
                  <p className="text-lg mb-0.5">{ls.icon}</p>
                  <p className={`text-xl font-black ${ls.color}`}>{ls.count}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{ls.label}</p>
                </div>
              ))}
            </div>

            {/* Today's due summary */}
            {stats.dueToday > 0 && (
              <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shrink-0">
                  <Clock size={18} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-blue-800">
                    {stats.dueToday} từ cần ôn hôm nay
                  </p>
                  <p className="text-xs text-blue-500">
                    Hệ thống tự tính lịch dựa trên mức độ bạn nhớ. Từ thuộc rõ sẽ xuất hiện ít dần.
                  </p>
                </div>
              </div>
            )}
            {stats.dueToday === 0 && (
              <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                  <Sparkles size={18} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-emerald-800">
                    Tất cả từ đã ôn xong! 🎉
                  </p>
                  <p className="text-xs text-emerald-500">
                    Quay lại sau hoặc chọn "Từ khó" / "Tất cả" bên dưới để luyện thêm.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ═══ Filter Mode ═══ */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                <Filter size={15} className="text-blue-500" /> Chọn từ để ôn
              </h3>
              <button
                onClick={() => setShowSrsInfo(!showSrsInfo)}
                className="p-1 text-slate-300 hover:text-blue-500 rounded-full transition-colors"
                title="Spaced Repetition là gì?"
              >
                <HelpCircle size={14} />
              </button>
            </div>

            {/* SRS Info tooltip */}
            <AnimatePresence>
              {showSrsInfo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3 overflow-hidden"
                >
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2">
                    <p className="font-bold text-slate-700">🧠 Hệ thống ôn tập thông minh (SRS)</p>
                    <p>Mỗi khi bạn đánh giá một từ, hệ thống sẽ tính toán thời điểm tối ưu để bạn ôn lại:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>Từ mới</strong>: ôn lại sau vài phút → vài giờ</li>
                      <li><strong>Đang học</strong>: ôn lại sau 1-3 ngày</li>
                      <li><strong>Ôn tập</strong>: ôn lại sau 1-3 tuần</li>
                      <li><strong>Đã thuộc</strong>: ôn lại sau 1-3 tháng (hoặc lâu hơn)</li>
                    </ul>
                    <p>→ Từ bạn nhớ tốt sẽ <strong>xuất hiện ít dần</strong>. Từ hay quên sẽ <strong>quay lại sớm hơn</strong>.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              {filterOptions.map(opt => {
                const colorMap: Record<string, { border: string; bg: string; radio: string }> = {
                  blue: { border: 'border-blue-400 bg-blue-50/40', bg: 'bg-blue-500', radio: 'bg-blue-500 border-blue-500' },
                  orange: { border: 'border-orange-300 bg-orange-50/40', bg: 'bg-orange-500', radio: 'bg-orange-500 border-orange-500' },
                  slate: { border: 'border-slate-300 bg-slate-50/30', bg: 'bg-slate-500', radio: 'bg-slate-500 border-slate-500' },
                };
                const c = colorMap[opt.color] || colorMap.slate;
                const isSelected = filterMode === opt.id;

                return (
                  <div
                    key={opt.id}
                    onClick={() => setFilterMode(opt.id)}
                    className={`p-4 rounded-2xl border-2 flex items-start gap-3 transition-all cursor-pointer
                      ${isSelected ? c.border : 'border-slate-100 hover:border-slate-200 bg-white'}
                    `}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5
                      ${isSelected ? c.radio : 'bg-white border-slate-300'}
                    `}>
                      {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-slate-500">{opt.icon}</span>
                        <h4 className="font-bold text-slate-800 text-[14px]">{opt.title}</h4>
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${isSelected ? c.bg + ' text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {opt.count}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{opt.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ═══ Review Modes ═══ */}
          <section>
            <h3 className="text-[15px] font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="text-blue-500">💡</span> Chế độ ôn
            </h3>
            <div className="space-y-2">
              {modes.map(m => (
                <div 
                  key={m.id}
                  onClick={() => !m.disabled && setSelectedMode(m.id)}
                  className={`p-3.5 rounded-2xl border-2 flex items-start gap-3 transition-all
                    ${m.disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-100' : 'cursor-pointer'}
                    ${selectedMode === m.id && !m.disabled ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 hover:border-slate-200'}
                  `}
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5
                    ${selectedMode === m.id && !m.disabled ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'}
                  `}>
                    {selectedMode === m.id && !m.disabled && <Check size={14} className="text-white" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="font-bold text-slate-800 text-[14px]">{m.title}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.badgeCls}`}>
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ Number of questions ═══ */}
          <section>
            <h3 className="text-[15px] font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="text-orange-500 font-mono font-black text-sm">123</span> Số lượng
            </h3>
            <div className="w-48">
              <input 
                type="number" 
                min={1} 
                max={reviewQueue.length > 0 ? reviewQueue.length : 10}
                value={reviewCount}
                onChange={(e) => setReviewCount(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <p className="text-xs text-slate-400 mt-2">
                Khả dụng: {reviewQueue.length} / {favorites.length} từ
              </p>
            </div>
          </section>

          <button 
            onClick={() => {
              const queue = reviewQueue.slice(0, reviewCount);
              lockedQueueRef.current = queue;
              // Pre-assign modes for mixed
              if (selectedMode === 'mixed') {
                const map = new Map<string | number, 'basic' | 'typing'>();
                queue.forEach(card => {
                  map.set(card.id, Math.random() < 0.5 ? 'basic' : 'typing');
                });
                cardModesRef.current = map;
              }
              setPhase('review');
            }}
            disabled={reviewQueue.length === 0}
            className="w-32 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold shadow-md shadow-blue-200 transition-all active:scale-95"
          >
            Start
          </button>
        </div>
      </motion.div>
    );
  }

  // ═══════════════════════════════════════════
  // REVIEW PHASE
  // ═══════════════════════════════════════════
  
  if (detailedWord) {
    return (
      <div className="flex-1 flex flex-col absolute inset-0 z-50 bg-white">
        <WordDetailPanel
          word={detailedWord.textFr}
          initialTranslation={detailedWord.textEnVi}
          onBack={() => setDetailedWord(null)}
          playAudio={playAudio}
        />
      </div>
    );
  }

  const progress = ((currentIndex) / activeQueue.length) * 100;

  // ═══ Answer Buttons Component ═══
  const renderAnswerButtons = (isTypingResult?: boolean, typingCorrect?: boolean) => {
    if (!previews) return null;

    // In typing mode after check:
    // If correct → show "Đúng" and "Dễ"
    // If wrong → show "Quên" and "Khó"
    if (isTypingResult !== undefined) {
      if (typingCorrect) {
        return (
          <div className="flex items-center justify-center gap-3 w-full">
            <button
              onClick={() => handleAnswer('good')}
              className="flex-1 flex flex-col items-center gap-1 py-3.5 bg-emerald-50 text-emerald-600 rounded-2xl font-bold text-sm hover:bg-emerald-100 transition-colors active:scale-95 border border-emerald-100 shadow-sm"
            >
              <Check size={20} />
              <span>Bình thường</span>
              <span className="text-[10px] font-mono text-emerald-400">{previews.good}</span>
            </button>
            <button
              onClick={() => handleAnswer('easy')}
              className="flex-1 flex flex-col items-center gap-1 py-3.5 bg-gradient-to-br from-amber-50 to-yellow-50 text-amber-600 rounded-2xl font-bold text-sm hover:from-amber-100 hover:to-yellow-100 transition-colors active:scale-95 border border-amber-200 shadow-sm"
            >
              <Star size={20} />
              <span>Quá dễ</span>
              <span className="text-[10px] font-mono text-amber-400">{previews.easy}</span>
            </button>
          </div>
        );
      } else {
        return (
          <div className="flex items-center justify-center gap-3 w-full">
            <button
              onClick={() => handleAnswer('again')}
              className="flex-1 flex flex-col items-center gap-1 py-3.5 bg-rose-50 text-rose-600 rounded-2xl font-bold text-sm hover:bg-rose-100 transition-colors active:scale-95 border border-rose-100 shadow-sm"
            >
              <X size={20} />
              <span>Quên hẳn</span>
              <span className="text-[10px] font-mono text-rose-400">{previews.again}</span>
            </button>
            <button
              onClick={() => handleAnswer('hard')}
              className="flex-1 flex flex-col items-center gap-1 py-3.5 bg-orange-50 text-orange-600 rounded-2xl font-bold text-sm hover:bg-orange-100 transition-colors active:scale-95 border border-orange-100 shadow-sm"
            >
              <Brain size={20} />
              <span>Nhớ mang máng</span>
              <span className="text-[10px] font-mono text-orange-400">{previews.hard}</span>
            </button>
          </div>
        );
      }
    }

    // Full 4-button layout for basic mode
    return (
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => handleAnswer('again')}
          className="flex flex-col items-center gap-1 py-3 bg-rose-50 text-rose-500 rounded-2xl font-bold text-xs hover:bg-rose-100 transition-colors active:scale-95 border border-rose-100 shadow-sm"
        >
          <X size={20} />
          <span>Quên</span>
          <span className="text-[10px] font-mono text-rose-300">{previews.again}</span>
        </button>
        <button
          onClick={() => handleAnswer('hard')}
          className="flex flex-col items-center gap-1 py-3 bg-orange-50 text-orange-500 rounded-2xl font-bold text-xs hover:bg-orange-100 transition-colors active:scale-95 border border-orange-100 shadow-sm"
        >
          <Brain size={20} />
          <span>Khó</span>
          <span className="text-[10px] font-mono text-orange-300">{previews.hard}</span>
        </button>
        <button
          onClick={() => handleAnswer('good')}
          className="flex flex-col items-center gap-1 py-3 bg-emerald-50 text-emerald-500 rounded-2xl font-bold text-xs hover:bg-emerald-100 transition-colors active:scale-95 border border-emerald-100 shadow-sm"
        >
          <Check size={20} />
          <span>Đúng</span>
          <span className="text-[10px] font-mono text-emerald-300">{previews.good}</span>
        </button>
        <button
          onClick={() => handleAnswer('easy')}
          className="flex flex-col items-center gap-1 py-3 bg-gradient-to-br from-amber-50 to-yellow-50 text-amber-500 rounded-2xl font-bold text-xs hover:from-amber-100 hover:to-yellow-100 transition-colors active:scale-95 border border-amber-200 shadow-sm"
        >
          <Star size={20} />
          <span>Dễ</span>
          <span className="text-[10px] font-mono text-amber-300">{previews.easy}</span>
        </button>
      </div>
    );
  };

  // Level badge for current card
  const currentLevel = currentCardState?.level || 'new';
  const levelBadgeMap: Record<WordLevel, { label: string; cls: string }> = {
    new: { label: '🆕 Mới', cls: 'bg-sky-100 text-sky-700' },
    learning: { label: '📖 Đang học', cls: 'bg-amber-100 text-amber-700' },
    review: { label: '🔄 Ôn tập', cls: 'bg-indigo-100 text-indigo-700' },
    mastered: { label: '⭐ Đã thuộc', cls: 'bg-emerald-100 text-emerald-700' },
  };
  const badge = levelBadgeMap[currentLevel];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col gap-3 p-4 sm:p-6 relative"
    >
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-1">
        <button 
          onClick={() => {
            setPhase('setup');
            setCurrentIndex(0);
            setSessionStats({ correct: 0, wrong: 0 });
            setIsFlipped(false);
            setTypingInput('');
            setIsTypingChecked(false);
            setFillInSentence(null);
            setHintLevel(0);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={16} /> Thoát
        </button>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>
            {badge.label}
          </span>
          <button
            onClick={() => setDetailedWord(currentCard)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Info size={16} /> Chi tiết
          </button>
        </div>
      </div>

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
          {currentIndex + 1}/{activeQueue.length}
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

      {/* Review Content */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        {currentCardMode === 'basic' && (
          <motion.div
            key={currentCard.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div className="relative w-full aspect-[3/2]">
              <AnimatePresence mode="wait">
                {!isFlipped ? (
                  <motion.div
                    key="front"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 bg-gradient-to-br from-brand-primary to-pink-500 rounded-3xl shadow-lg flex flex-col items-center justify-center p-8 text-white"
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
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 bg-white rounded-3xl shadow-lg border border-slate-100 flex flex-col items-center justify-center p-8"
                  >
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Nghĩa</p>
                    <p className="text-2xl sm:text-3xl font-bold text-center text-slate-800 leading-snug">{currentCard.textEnVi}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {currentCardMode === 'typing' && (
          <motion.div
            key={`typing-${currentCard.id}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md flex flex-col gap-5"
          >
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm text-center min-h-[160px] flex flex-col justify-center relative">
              <p className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-4 absolute top-6 left-0 right-0">Điền từ còn thiếu</p>
              
              {isFetchingSentence ? (
                <div className="animate-pulse flex flex-col items-center gap-2 mt-4">
                  <div className="w-8 h-8 rounded-full border-2 border-rose-200 border-t-rose-500 animate-spin" />
                  <p className="text-xs text-slate-400">AI đang tạo câu...</p>
                </div>
              ) : fillInSentence ? (
                <div className="mt-4">
                  <p className="text-xl sm:text-2xl font-bold text-slate-800 leading-snug mb-3">
                    {fillInSentence.fr}
                  </p>
                  <p className="text-sm text-slate-500">
                    {fillInSentence.en}
                  </p>
                </div>
              ) : null}
            </div>
            
            <div className="relative">
              <input 
                type="text" 
                value={typingInput}
                onChange={(e) => setTypingInput(e.target.value)}
                disabled={isTypingChecked || isFetchingSentence}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && typingInput.trim() && !isTypingChecked) setIsTypingChecked(true);
                }}
                placeholder="Nhập từ chính xác..."
                autoFocus
                className={`w-full px-6 py-4 rounded-2xl border-2 text-center text-xl font-bold transition-all focus:outline-none
                  ${isTypingChecked 
                    ? (isTypingCorrect 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                        : 'border-rose-500 bg-rose-50 text-rose-700')
                    : 'border-slate-200 focus:border-rose-400 bg-white text-slate-800'
                  }
                  ${isFetchingSentence ? 'opacity-50' : ''}
                `}
              />
              {isTypingChecked && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {isTypingCorrect 
                    ? <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center"><Check size={16} /></div>
                    : <div className="w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center"><X size={16} /></div>
                  }
                </div>
              )}
            </div>

            {/* Hint button */}
            {!isTypingChecked && currentCard && (
              <button
                onClick={() => setHintLevel(prev => prev + 1)}
                className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition-colors active:scale-95"
              >
                <Lightbulb size={16} />
                {hintLevel === 0 ? 'Gợi ý' : `Gợi ý thêm (${hintLevel})`}
              </button>
            )}

            {/* Hint display */}
            {hintLevel > 0 && currentCard && !isTypingChecked && (() => {
              // Use the AI-provided answer (conjugated form) for hints
              const expectedAnswer = fillInSentence?.answer || currentCard.textFr;
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-amber-500 font-bold uppercase tracking-wider mb-1">Gợi ý</p>
                  <p className="text-lg font-bold text-amber-700 tracking-[0.3em] font-mono">
                    {expectedAnswer.split('').map((ch, i) => {
                      if (ch === ' ') return ' ';
                      if (i < hintLevel) return ch;
                      return '•';
                    }).join('')}
                  </p>
                  <p className="text-xs text-amber-400 mt-1">{expectedAnswer.length} ký tự</p>
                </div>
              );
            })()}

            {!isTypingChecked && typingInput.trim() && (
              <button 
                onClick={() => setIsTypingChecked(true)}
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold transition-all active:scale-95 shadow-md"
              >
                Kiểm tra
              </button>
            )}

            <AnimatePresence>
              {isTypingChecked && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 mt-1">
                  {!isTypingCorrect && (
                    <div className="bg-white rounded-2xl p-4 border border-rose-100 text-center shadow-sm">
                      <p className="text-xs text-rose-400 font-bold uppercase tracking-wider mb-1">Đáp án đúng</p>
                      <p className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
                        {fillInSentence?.answer || currentCard.textFr}
                        <button onClick={() => playAudio(fillInSentence?.answer || currentCard.textFr)} className="p-1.5 hover:bg-slate-100 rounded-full text-blue-500">
                          <Volume2 size={18} />
                        </button>
                      </p>
                      {fillInSentence?.answer && fillInSentence.answer.toLowerCase() !== currentCard.textFr.toLowerCase() && (
                        <p className="text-xs text-slate-400 mt-1">
                          Dạng gốc: <span className="font-bold text-slate-600">{currentCard.textFr}</span>
                        </p>
                      )}
                    </div>
                  )}
                  {/* Typing mode answer buttons: 2-button variant */}
                  {renderAnswerButtons(true, isTypingCorrect)}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Action buttons - only show when flipped (Basic mode only) */}
      <AnimatePresence>
        {isFlipped && currentCardMode === 'basic' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="pb-2"
          >
            {renderAnswerButtons()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
