import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookHeart, Heart, Volume2, Brain, Search, ChevronRight, Trash2, MessageCircleQuestion, Plus, CheckCircle2, X } from 'lucide-react';
import { FavoriteItem } from '../types';
import { FlashcardReview } from './FlashcardReview';
import { WordDetailPanel } from './WordDetailPanel';
import { groqSafe, groq } from '../lib/groq';
import { syncDataToCloud, loadDataFromCloud } from '../lib/firebase';

interface PhrasebookTabProps {
  favorites: FavoriteItem[];
  toggleFavorite: (item: FavoriteItem) => void;
  updateFavoriteInfo: (id: string | number, textEnVi: string) => void;
  playAudio: (text: string, rate?: number) => void;
}

// Lightweight Groq call to get word type + short English meaning
async function fetchQuickWordInfo(word: string): Promise<string> {
  try {
    const result = await groqSafe(() =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a French dictionary. For the given French word/phrase, respond in EXACTLY this format on one line:\n[type] english meaning\n\nWhere type is one of: nom m., nom f., verbe, adj., adv., prép., conj., expr., pron.\nFor nouns, always specify gender (m. or f.).\nKeep the english meaning very short (2-5 words max).\n\nExamples:\n"maison" → [nom f.] house\n"parler" → [verbe] to speak\n"beau" → [adj.] beautiful, handsome\n"rapidement" → [adv.] quickly\n"au fur et à mesure" → [expr.] gradually, as one goes'
          },
          { role: 'user', content: word }
        ],
        temperature: 0,
        max_tokens: 50,
      })
    );
    const text = result.choices[0]?.message?.content?.trim();
    return text || 'unknown';
  } catch (e) {
    console.error('Quick word info failed:', e);
    return 'unknown';
  }
}

// Questions storage
interface QuestionItem {
  id: string;
  text: string;
  createdAt: number;
}

function loadQuestions(): QuestionItem[] {
  try {
    const saved = localStorage.getItem('french_questions');
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveQuestions(items: QuestionItem[]) {
  localStorage.setItem('french_questions', JSON.stringify(items));
  syncDataToCloud({ frenchQuestions: items });
}

type SubTab = 'vocab' | 'questions';

export const PhrasebookTab: React.FC<PhrasebookTabProps> = ({ favorites, toggleFavorite, updateFavoriteInfo, playAudio }) => {
  const [isReviewing, setIsReviewing] = useState(false);
  const [selectedWord, setSelectedWord] = useState<FavoriteItem | null>(null);
  const [newWordInput, setNewWordInput] = useState('');
  const [toastWord, setToastWord] = useState<string | null>(null);
  const toastTimerRef = useRef<number>(0);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(-1);
  
  // External autocomplete states
  const [externalSuggestions, setExternalSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Sub-tab state
  const [subTab, setSubTab] = useState<SubTab>('vocab');

  // Questions state
  const [questions, setQuestions] = useState<QuestionItem[]>(loadQuestions);
  const [newQuestionInput, setNewQuestionInput] = useState('');

  // Load questions from cloud on mount
  useEffect(() => {
    loadDataFromCloud().then(data => {
      const cloudQs: QuestionItem[] | undefined = data?.frenchQuestions;
      if (cloudQs && cloudQs.length > 0) {
        setQuestions(prev => {
          const merged = new Map(prev.map(q => [q.id, q]));
          cloudQs.forEach(q => { if (!merged.has(q.id)) merged.set(q.id, q); });
          const result = Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
          localStorage.setItem('french_questions', JSON.stringify(result));
          return result;
        });
      }
    }).catch(() => {});
  }, []);

  // Auto-update old favorites that still have placeholder text
  const hasAutoFetchedRef = useRef(false);
  useEffect(() => {
    if (hasAutoFetchedRef.current) return;
    hasAutoFetchedRef.current = true;

    const pending = favorites.filter(f => f.textEnVi === 'Đang chờ phân tích...');
    if (pending.length === 0) return;

    // Process in batches of 3 with 500ms delay between batches to avoid rate limits
    let idx = 0;
    const processBatch = async () => {
      const batch = pending.slice(idx, idx + 3);
      if (batch.length === 0) return;
      await Promise.all(
        batch.map(async (fav) => {
          const info = await fetchQuickWordInfo(fav.textFr);
          if (info !== 'unknown') updateFavoriteInfo(fav.id, info);
        })
      );
      idx += 3;
      if (idx < pending.length) setTimeout(processBatch, 500);
    };
    processBatch();
  }, []); // Run once on mount

  // Fetch external suggestions - dual source for better relevance
  useEffect(() => {
    if (!newWordInput.trim() || newWordInput.trim().length < 2) {
      setExternalSuggestions([]);
      setIsLoadingSuggestions(false);
      return;
    }

    const abortController = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      const query = newWordInput.trim().toLowerCase();
      const results: string[] = [];

      try {
        // Source 1: Wiktionary opensearch (prefix-based, broad)
        const wikiPromise = fetch(
          `https://fr.wiktionary.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=10&namespace=0&format=json&origin=*`,
          { signal: abortController.signal }
        ).then(async res => {
          if (!res.ok) return [];
          const data = await res.json();
          if (data && Array.isArray(data[1])) {
            return (data[1] as string[]).filter(w => {
              const lower = w.toLowerCase();
              // Filter out non-word entries:
              // - too long (likely article titles)
              // - contains special chars that aren't part of French words
              // - starts with uppercase (proper nouns / article titles)
              if (w.length > 35) return false;
              if (/[0-9()[\]{}]/.test(w)) return false;
              if (/^[A-ZÀ-Ö]/.test(w) && !lower.startsWith(query)) return false;
              // Keep entries that are single words or short phrases (max 4 words)
              if (w.split(/\s+/).length > 4) return false;
              return true;
            });
          }
          return [];
        }).catch(() => []);

        // Source 2: Wiktionary search API (relevance-ranked)
        const searchPromise = fetch(
          `https://fr.wiktionary.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=0&srlimit=8&srwhat=title&format=json&origin=*`,
          { signal: abortController.signal }
        ).then(async res => {
          if (!res.ok) return [];
          const data = await res.json();
          if (data?.query?.search) {
            return (data.query.search as { title: string }[])
              .map(r => r.title)
              .filter(w => {
                if (w.length > 35) return false;
                if (/[0-9()[\]{}]/.test(w)) return false;
                if (w.split(/\s+/).length > 4) return false;
                // Must be somewhat related to the query
                if (!w.toLowerCase().includes(query.slice(0, Math.min(3, query.length)))) return false;
                return true;
              });
          }
          return [];
        }).catch(() => []);

        const [wikiResults, searchResults] = await Promise.all([wikiPromise, searchPromise]);

        // Merge and deduplicate, prioritizing prefix matches
        const seen = new Set<string>();
        // First: exact prefix matches from opensearch
        for (const w of wikiResults) {
          const key = w.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            results.push(w);
          }
        }
        // Then: relevance-ranked from search API
        for (const w of searchResults) {
          const key = w.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            results.push(w);
          }
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error('Failed to fetch suggestions', e);
        }
      } finally {
        if (!abortController.signal.aborted) {
          // Sort: exact prefix matches first, then by length (shorter = more likely a base word)
          results.sort((a, b) => {
            const aPrefix = a.toLowerCase().startsWith(query) ? 0 : 1;
            const bPrefix = b.toLowerCase().startsWith(query) ? 0 : 1;
            if (aPrefix !== bPrefix) return aPrefix - bPrefix;
            return a.length - b.length;
          });
          setExternalSuggestions(results.slice(0, 8));
          setIsLoadingSuggestions(false);
        }
      }
    }, 200); // 200ms debounce (faster response)

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [newWordInput]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        addInputRef.current && !addInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Unified search: use newWordInput as the search query for filtering favorites
  const searchQuery = newWordInput.trim();
  
  // Filter favorites by search query
  const filteredFavorites = searchQuery
    ? favorites.filter(f =>
        f.textFr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.textEnVi.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : favorites;

  // Matching favorites for dropdown (limit to 5 for performance)
  const matchingFavorites = searchQuery.length >= 1
    ? favorites.filter(f =>
        f.textFr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.textEnVi.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  // External suggestions filtered to exclude words already shown as favorites
  const filteredExternalSuggestions = externalSuggestions.filter(
    w => !matchingFavorites.some(f => f.textFr.toLowerCase() === w.toLowerCase())
  );

  // Highlight matching text helper
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="text-pink-500 bg-pink-50 rounded px-0.5">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const handleAddWord = async (e: React.FormEvent | string) => {
    // If called from form submit
    if (typeof e !== 'string') {
      e.preventDefault();
    }
    
    const wordText = typeof e === 'string' ? e : newWordInput.trim();
    if (!wordText) return;

    const id = Date.now().toString();

    // Check if already exists
    if (favorites.some(f => f.textFr.toLowerCase() === wordText.toLowerCase())) {
      setNewWordInput('');
      setShowSuggestions(false);
      return; // Already in phrasebook
    }

    // Add immediately with loading placeholder
    toggleFavorite({
      id,
      textFr: wordText,
      textEnVi: '⏳ ...',
      source: 'chat' as any
    });
    setNewWordInput('');
    setShowSuggestions(false);

    // Show toast notification
    clearTimeout(toastTimerRef.current);
    setToastWord(wordText);
    toastTimerRef.current = window.setTimeout(() => setToastWord(null), 2500);

    // Fire background AI call (non-blocking)
    fetchQuickWordInfo(wordText).then(info => {
      updateFavoriteInfo(id, info);
    });
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionInput.trim()) return;

    const newQ: QuestionItem = {
      id: Date.now().toString(),
      text: newQuestionInput.trim(),
      createdAt: Date.now(),
    };
    const updated = [newQ, ...questions];
    setQuestions(updated);
    saveQuestions(updated);
    setNewQuestionInput('');
  };

  const handleDeleteQuestion = (id: string) => {
    const updated = questions.filter(q => q.id !== id);
    setQuestions(updated);
    saveQuestions(updated);
  };

  // Uses playAudio prop directly for Gemini TTS

  // Word Detail view
  if (selectedWord) {
    return (
      <motion.div
        key="word-detail"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-0"
      >
        <WordDetailPanel
          word={selectedWord.textFr}
          initialTranslation={selectedWord.textEnVi}
          onBack={() => setSelectedWord(null)}
          playAudio={playAudio}
        />
      </motion.div>
    );
  }

  // Flashcard Review view
  if (isReviewing) {
    return (
      <motion.div
        key="flashcard-review"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-y-auto min-h-0"
      >
        <FlashcardReview
          favorites={favorites}
          playAudio={playAudio}
          onClose={() => setIsReviewing(false)}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      key="phrasebook"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-0 relative"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastWord && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-green-500 text-white px-4 py-2.5 rounded-2xl shadow-lg shadow-green-200 whitespace-nowrap"
          >
            <CheckCircle2 size={16} className="shrink-0" />
            <span className="font-bold text-sm">Đã lưu &ldquo;<span className="italic">{toastWord}</span>&rdquo; vào sổ tay!</span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Fixed Header */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl shadow-md shadow-pink-200">
              <BookHeart size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Sổ tay từ vựng</h2>
              <p className="text-xs font-medium text-slate-400">{favorites.length} từ đã lưu</p>
            </div>
          </div>

          {favorites.length > 0 && (
            <button
              onClick={() => setIsReviewing(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-2xl font-bold text-xs shadow-md shadow-blue-200 hover:shadow-lg transition-all active:scale-95"
            >
              <Brain size={14} />
              Ôn tập
            </button>
          )}
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-3">
          <button
            onClick={() => setSubTab('vocab')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'vocab'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            📚 Từ vựng
          </button>
          <button
            onClick={() => setSubTab('questions')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'questions'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ❓ Câu hỏi ({questions.length})
          </button>
        </div>

        {/* Search & Add - Vocab tab */}
        {subTab === 'vocab' && (
          <div className="space-y-0">
            <form onSubmit={handleAddWord} className="relative">
              <div className="relative">
                <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${showSuggestions && newWordInput.trim() ? 'text-pink-400' : 'text-slate-300'}`} />
                <input
                  ref={addInputRef}
                  type="text"
                  value={newWordInput}
                  onChange={e => { setNewWordInput(e.target.value); setShowSuggestions(true); setSelectedSuggestionIdx(-1); }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    const totalItems = [...matchingFavorites, ...filteredExternalSuggestions];
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedSuggestionIdx(prev => Math.min(prev + 1, totalItems.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedSuggestionIdx(prev => Math.max(prev - 1, -1));
                    } else if (e.key === 'Enter' && selectedSuggestionIdx >= 0) {
                      e.preventDefault();
                      const item = totalItems[selectedSuggestionIdx];
                      if (typeof item === 'string') {
                        handleAddWord(item);
                      } else {
                        setSelectedWord(item);
                      }
                    } else if (e.key === 'Escape') {
                      setShowSuggestions(false);
                      addInputRef.current?.blur();
                    }
                  }}
                  placeholder="Tìm hoặc thêm từ mới..."
                  className="w-full pl-10 pr-24 py-3 bg-white rounded-2xl border-2 border-slate-100 text-sm focus:outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-50 placeholder:text-slate-300 font-medium transition-all"
                />
                {newWordInput.trim() && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setNewWordInput(''); setShowSuggestions(false); setSelectedSuggestionIdx(-1); }}
                      className="p-1.5 text-slate-300 hover:text-slate-500 rounded-lg transition-colors"
                    >
                      <X size={14} />
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 flex items-center gap-1"
                    >
                      <Plus size={12} />
                      Thêm
                    </button>
                  </div>
                )}
              </div>

              {/* Unified Combobox Dropdown */}
              <AnimatePresence>
                {showSuggestions && newWordInput.trim().length >= 1 && (
                  <motion.div
                    ref={suggestionsRef}
                    initial={{ opacity: 0, y: -4, scaleY: 0.95 }}
                    animate={{ opacity: 1, y: 0, scaleY: 1 }}
                    exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
                    transition={{ duration: 0.15 }}
                    style={{ transformOrigin: 'top' }}
                    className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 z-50 overflow-hidden max-h-[320px] overflow-y-auto custom-scrollbar"
                  >
                    {/* Matching favorites section */}
                    {matchingFavorites.length > 0 && (
                      <>
                        <div className="px-3.5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/80 border-b border-slate-100 flex items-center gap-1.5">
                          <BookHeart size={10} className="text-pink-400" />
                          Trong sổ tay
                        </div>
                        {matchingFavorites.map((fav, idx) => (
                          <div
                            key={fav.id}
                            className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-all border-b border-slate-50 last:border-b-0 group
                              ${selectedSuggestionIdx === idx ? 'bg-blue-50' : 'hover:bg-slate-50'}
                            `}
                            onClick={() => setSelectedWord(fav)}
                          >
                            <div className="w-8 h-8 bg-pink-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-pink-100 transition-colors">
                              <Heart size={12} className="text-pink-400" fill="currentColor" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 text-sm truncate">
                                {highlightMatch(fav.textFr, newWordInput)}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">{fav.textEnVi}</p>
                            </div>
                            <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                              Đã lưu
                            </span>
                            <ChevronRight size={14} className="text-slate-300 shrink-0" />
                          </div>
                        ))}
                      </>
                    )}

                    {/* External Wiktionary suggestions */}
                    {(filteredExternalSuggestions.length > 0 || isLoadingSuggestions) && (
                      <>
                        <div className="px-3.5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/80 border-b border-slate-100 flex items-center gap-1.5">
                          <Search size={10} className="text-blue-400" />
                          Từ điển Pháp
                          {isLoadingSuggestions && (
                            <span className="ml-auto flex items-center gap-1 text-blue-400 normal-case tracking-normal font-bold">
                              <span className="w-3 h-3 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                            </span>
                          )}
                        </div>

                        {isLoadingSuggestions && externalSuggestions.length === 0 ? (
                          <div className="px-4 py-2 space-y-2">
                            {[1, 2, 3].map(i => (
                              <div key={i} className="flex items-center gap-3 animate-pulse">
                                <div className="w-8 h-8 bg-slate-100 rounded-xl" />
                                <div className="flex-1 space-y-1.5">
                                  <div className="h-3.5 bg-slate-100 rounded-lg w-24" />
                                  <div className="h-2.5 bg-slate-50 rounded-lg w-16" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          filteredExternalSuggestions.map((word, idx) => {
                            const globalIdx = matchingFavorites.length + idx;
                            const alreadySaved = favorites.some(f => f.textFr.toLowerCase() === word.toLowerCase());
                            return (
                              <div
                                key={word}
                                className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-all border-b border-slate-50 last:border-b-0 group
                                  ${selectedSuggestionIdx === globalIdx ? 'bg-blue-50' : 'hover:bg-slate-50'}
                                  ${alreadySaved ? 'opacity-50' : ''}
                                `}
                                onClick={() => { if (!alreadySaved) handleAddWord(word); }}
                              >
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                  selectedSuggestionIdx === globalIdx ? 'bg-blue-100' : 'bg-blue-50 group-hover:bg-blue-100'
                                }`}>
                                  <Plus size={14} className="text-blue-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-slate-800 text-sm truncate">
                                    {highlightMatch(word, newWordInput)}
                                  </p>
                                </div>
                                {alreadySaved ? (
                                  <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                                    Đã có
                                  </span>
                                ) : (
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 transition-all ${
                                    selectedSuggestionIdx === globalIdx ? 'text-pink-600 bg-pink-100' : 'text-slate-400 bg-slate-100 group-hover:text-pink-500 group-hover:bg-pink-50'
                                  }`}>
                                    + Thêm
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </>
                    )}

                    {/* No results state */}
                    {!isLoadingSuggestions && matchingFavorites.length === 0 && filteredExternalSuggestions.length === 0 && newWordInput.trim().length >= 2 && (
                      <div className="px-4 py-6 text-center">
                        <p className="text-sm text-slate-400 mb-2">Không tìm thấy trong từ điển</p>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-pink-50 text-pink-600 rounded-xl font-bold text-xs hover:bg-pink-100 transition-colors"
                        >
                          <Plus size={12} />
                          Thêm "{newWordInput.trim()}" vào sổ tay
                        </button>
                      </div>
                    )}

                    {/* Keyboard hint */}
                    {(matchingFavorites.length > 0 || filteredExternalSuggestions.length > 0) && (
                      <div className="px-3.5 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center gap-3 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">↑↓</kbd> chọn</span>
                        <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">↵</kbd> mở/thêm</span>
                        <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">esc</kbd> đóng</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>
        )}

        {/* Add question - Questions tab */}
        {subTab === 'questions' && (
          <form onSubmit={handleAddQuestion} className="flex gap-2">
            <input
              type="text"
              value={newQuestionInput}
              onChange={e => setNewQuestionInput(e.target.value)}
              placeholder="Nhập câu hỏi tiếng Pháp..."
              className="flex-1 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100 placeholder:text-slate-400 font-medium"
            />
            <button
              type="submit"
              disabled={!newQuestionInput.trim()}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 text-white rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95 flex items-center gap-1"
            >
              <Plus size={14} /> Thêm
            </button>
          </form>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 custom-scrollbar">

        {/* ═══ VOCAB TAB ═══ */}
        {subTab === 'vocab' && (
          <>
            {favorites.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 mt-4 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mb-4">
                  <Heart size={32} className="text-pink-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-2">Cuốn sổ còn trống!</h3>
                <p className="text-slate-500 text-sm max-w-sm">Nhấn vào từ trong bài để tra nghĩa, rồi bấm "Lưu thẻ" để thêm vào đây nhé!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFavorites.map((fav) => (
                  <motion.div
                    key={fav.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group relative bg-slate-50 hover:bg-blue-50/50 rounded-2xl p-4 border border-slate-100 hover:border-blue-200 transition-all cursor-pointer active:scale-[0.98]"
                    onClick={() => setSelectedWord(fav)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Play audio button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); playAudio(fav.textFr); }}
                        className="p-2.5 bg-white rounded-xl shadow-sm text-blue-500 hover:text-blue-600 hover:shadow-md transition-all active:scale-95 shrink-0"
                      >
                        <Volume2 size={16} />
                      </button>

                      {/* Word info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-base leading-snug truncate">{fav.textFr}</p>
                        <p className="text-slate-400 text-sm font-medium truncate mt-0.5">{fav.textEnVi}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(fav); }}
                          className="p-2 text-slate-300 hover:text-red-400 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                          title="Xóa"
                        >
                          <Trash2 size={14} />
                        </button>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
                      </div>
                    </div>

                    {/* Source badge */}
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-400 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                      {fav.source === 'chat' ? 'Chat' : 'Dict'}
                    </span>
                  </motion.div>
                ))}

                {searchQuery && filteredFavorites.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <p className="text-sm">Không tìm thấy từ nào phù hợp.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══ QUESTIONS TAB ═══ */}
        {subTab === 'questions' && (
          <>
            {questions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 mt-4 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-4">
                  <MessageCircleQuestion size={32} className="text-amber-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa có câu hỏi nào!</h3>
                <p className="text-slate-500 text-sm max-w-sm">Ghi lại các câu hỏi tiếng Pháp mà bạn muốn nhớ hoặc luyện tập ở đây.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {questions.map((q) => (
                  <motion.div
                    key={q.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group relative bg-amber-50/50 hover:bg-amber-50 rounded-2xl p-4 border border-amber-100 hover:border-amber-200 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => playAudio(q.text)}
                        className="p-2.5 bg-white rounded-xl shadow-sm text-amber-500 hover:text-amber-600 hover:shadow-md transition-all active:scale-95 shrink-0"
                      >
                        <Volume2 size={16} />
                      </button>

                      <p className="flex-1 text-slate-800 font-medium text-sm leading-snug">{q.text}</p>

                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-2 text-slate-300 hover:text-red-400 rounded-xl transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};
