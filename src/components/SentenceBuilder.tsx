import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import {
  Loader2, ChevronRight, RotateCcw, Volume2, Sparkles, Shuffle,
  CheckCircle2, XCircle, AlertTriangle, ArrowLeft, Delete, Trash2, GripVertical, X
} from 'lucide-react';
import { groq, groqSafe } from '../lib/groq';
import { useStats } from '../hooks/useStats';
import { ClickableText } from './ClickableText';

interface SentenceBuilderProps {
  playAudio: (text: string, rate?: number) => void;
  isSpeaking: boolean;
  difficulty: string;
  onBack: () => void;
}

interface JumbleWord {
  id: string;
  text: string;
  isDistractor: boolean;
}

interface SentenceData {
  french: string;
  translation: string;
  distractors: string[];
  level: string;
}

interface SentenceExplanation {
  usage: string;
  situations: string[];
  grammar?: string;
  similar?: string[];
}

/**
 * Prepare jumble words from a sentence + distractor list.
 * Strips punctuation, lowercases, assigns unique IDs, then shuffles.
 */
function buildJumbleBank(sentence: string, distractors: string[]): {
  correctWords: string[];
  bankWords: JumbleWord[];
} {
  const cleanWord = (w: string) => w.replace(/[.,!?;:"()«»]/g, '').toLowerCase();
  const correctWords = sentence.split(/\s+/).filter(w => w.length > 0).map(cleanWord);

  const originals: JumbleWord[] = correctWords.map((w, i) => ({
    id: `o-${i}`, text: w, isDistractor: false,
  }));

  const existingSet = new Set(correctWords);
  const distWordList: JumbleWord[] = distractors
    .map(w => cleanWord(w))
    .filter(w => w.length >= 2 && !existingSet.has(w))
    .slice(0, 3)
    .map((w, i) => ({ id: `d-${i}`, text: w, isDistractor: true }));

  const bankWords = [...originals, ...distWordList].sort(() => Math.random() - 0.5);
  return { correctWords, bankWords };
}

export const SentenceBuilder: React.FC<SentenceBuilderProps> = ({ playAudio, isSpeaking, difficulty, onBack }) => {
  const stats = useStats();
  const [sentenceData, setSentenceData] = useState<SentenceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<string>('');

  // Jumble state
  const [correctWords, setCorrectWords] = useState<string[]>([]);
  const [bankWords, setBankWords] = useState<JumbleWord[]>([]);
  const [userWords, setUserWords] = useState<JumbleWord[]>([]);

  // Result state
  const [score, setScore] = useState<number | null>(null);
  const [explanation, setExplanation] = useState<SentenceExplanation | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

  // Session tracking per level
  const [levelStats, setLevelStats] = useState<Record<string, { count: number; totalScore: number }>>({});
  const currentLevelStat = levelStats[difficulty] || { count: 0, totalScore: 0 };

  // Session topic tracking — topics already used this session (no repeats until all 35 done)
  const sessionTopicsRef = React.useRef<Set<string>>(new Set());

  // Full topic bank (30+ categories)
  const TOPIC_BANK = [
    'shopping at a market or supermarket',
    'ordering food and drinks at a café or restaurant',
    'asking for directions in a city',
    'talking about your family and relatives',
    'describing your daily routine',
    'discussing weekend plans or leisure activities',
    'booking a hotel or accommodation',
    'talking about the weather and seasons',
    'describing your home or apartment',
    'discussing your job or studies',
    'talking about hobbies and sports',
    'making a doctor or dentist appointment',
    'buying clothes and accessories',
    'using public transport (metro, bus, train)',
    'discussing a recent film, book, or series',
    'talking about food preferences and cooking',
    'making plans with a friend',
    'talking about travel and holidays',
    'discussing health and wellbeing',
    'talking about music and concerts',
    'describing a person\'s appearance and personality',
    'talking about technology and social media',
    'discussing environmental issues',
    'talking about celebrations and holidays (Christmas, birthdays)',
    'expressing opinions about a news topic',
    'renting a flat or house',
    'describing a past event or memory',
    'talking about childhood and school',
    'discussing money, budgeting, or prices',
    'asking for help or clarification politely',
    'talking about art, museums, or exhibitions',
    'discussing relationships and friendships',
    'talking about animals and pets',
    'describing a neighbourhood or city',
    'expressing feelings and emotions',
    // ── DELF-inspired themes ──
    // Éducation
    'school punishments and discipline',
    'online courses and distance learning',
    'homework and study habits',
    'mobile phones in schools',
    'grading systems and student evaluation',
    'music education for children',
    'homeschooling and alternative education',
    // Travail
    'remote work and telecommuting',
    'work-life balance and well-being',
    'job interviews and career changes',
    'the four-day work week',
    'workplace discrimination and equality',
    'retirement and older workers',
    'robots and automation at work',
    // Environnement
    'climate change and global warming',
    'renewable energy and solar panels',
    'recycling and waste sorting',
    'green spaces and community gardens',
    'sustainable development and eco-responsibility',
    'carpooling and shared mobility',
    'energy-saving habits at home',
    // Médias & Internet
    'fake news and misinformation',
    'social media habits and safety',
    'data privacy and online security',
    'digital detox and screen time limits',
    'advertising and consumer influence',
    'podcasts and online radio',
    'living without Internet for a day',
    // Loisirs & Culture
    'video games and e-sports',
    'cinema versus streaming services',
    'board games and family game nights',
    'museum visits and art exhibitions',
    'reading habits and audiobooks',
    'literary prizes and book recommendations',
    'animal-free circuses and modern entertainment',
    // Société
    'volunteering and charity work',
    'gender equality in everyday life',
    'housing challenges in big cities',
    'intergenerational relationships and solidarity',
    'immigration and cultural integration',
    // Santé
    'healthy eating and nutrition habits',
    'stress management and mental health',
    'sports and physical fitness routines',
    'vegetarianism and dietary choices',
    // Vie quotidienne
    'responsible and ethical consumption',
    'city versus countryside living',
    'future of transportation and mobility',
  ];

  // ─── Generate a new sentence via AI ───
  const generateSentence = useCallback(async () => {
    setIsLoading(true);
    setScore(null);
    setExplanation(null);
    setUserWords([]);
    
    const levelInstructions = {
      'A1': 'A1 (Beginner): Simple, everyday sentences. Focus on basic interactions, descriptions, or routines. Length: ~4-8 words. Keep grammar straightforward.',
      'A2': 'A2 (Elementary): Slightly more detailed sentences. Can include past/future plans and simple connectors (mais, parce que, etc.). Length: ~6-10 words.',
      'B1': 'B1 (Intermediate): Sentences expressing opinions, feelings, or hypothetical situations. Use a natural mix of tenses. Length: ~8-12 words.',
      'B2': 'B2 (Upper-Intermediate): Nuanced sentences with complex structures, relative clauses, or advanced connectors. Can be abstract. Length: ~10-15 words.'
    }[difficulty] || 'Standard level.';

    // Pick a topic not yet used this session; reset when all are exhausted
    if (sessionTopicsRef.current.size >= TOPIC_BANK.length) {
      sessionTopicsRef.current = new Set();
    }
    const remaining = TOPIC_BANK.filter(t => !sessionTopicsRef.current.has(t));
    const topic = remaining[Math.floor(Math.random() * remaining.length)];
    sessionTopicsRef.current.add(topic);
    setCurrentTopic(topic);

    try {
      const completion = await groqSafe(() => groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are an expert French language teacher. Generate ONE natural French sentence appropriate for ${difficulty} level students to practice sentence building.

RULES:
1. ${levelInstructions}
2. The sentence MUST relate to the topic: "${topic}".
3. Use practical, natural French phrasing that a native speaker would actually say.
4. Include an English translation.
5. Provide exactly 3 DISTRACTOR words (French words that do NOT belong in this sentence but are plausible French words from the same topic).

Return JSON:
{
  "french": "The complete French sentence with proper punctuation",
  "translation": "English translation",
  "distractors": ["word1", "word2", "word3"],
  "level": "${difficulty}"
}
Return valid JSON only.`
          },
          { role: "user", content: `Generate a ${difficulty} level French sentence about: ${topic}` }
        ],
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" },
        temperature: 1.0
      }));
      const raw = completion.choices[0]?.message?.content || '{}';
      const parsed: SentenceData = JSON.parse(raw);
      setSentenceData(parsed);

      // Build jumble bank
      const { correctWords: cw, bankWords: bw } = buildJumbleBank(parsed.french, parsed.distractors);
      setCorrectWords(cw);
      setBankWords(bw);
      setUserWords([]);

    } catch (e) {
      console.error("Sentence generation error", e);
    } finally {
      setIsLoading(false);
    }
  }, [difficulty]);

  // ─── Check answer ───
  const checkAnswer = useCallback(() => {
    if (userWords.length === 0) return;

    const userStr = userWords.map(w => w.text).join(' ');
    const correctStr = correctWords.join(' ');

    // Simple scoring: count matching words in order via LCS
    const m = userWords.length;
    const n = correctWords.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (userWords[i - 1].text === correctWords[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    const lcs = dp[m][n];
    const calculatedScore = n > 0 ? Math.round((lcs / n) * 100) : 0;
    setScore(calculatedScore);
    setLevelStats(prev => {
      const stat = prev[difficulty] || { count: 0, totalScore: 0 };
      return {
        ...prev,
        [difficulty]: {
          count: stat.count + 1,
          totalScore: stat.totalScore + calculatedScore
        }
      };
    });

    if (calculatedScore >= 60) {
      stats.addXP(2);
    }
  }, [userWords, correctWords, stats]);

  // ─── Generate explanation after checking ───
  const generateExplanation = useCallback(async () => {
    if (!sentenceData) return;
    setIsLoadingExplanation(true);
    try {
      const completion = await groqSafe(() => groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a French language coach. The student just practiced building the sentence below. Explain HOW and WHEN this sentence is used in real life.

Return JSON:
{
  "usage": "A clear, concise explanation in English of what this sentence means and how it's used (2-3 sentences)",
  "situations": ["Situation 1 in English where you'd use this", "Situation 2", "Situation 3"],
  "grammar": "Brief grammar note in English (e.g. which tense, which structure, any irregular forms)",
  "similar": ["Similar French sentence 1", "Similar French sentence 2"]
}
Return valid JSON only.`
          },
          { role: "user", content: `Sentence: "${sentenceData.french}"\nTranslation: "${sentenceData.translation}"` }
        ],
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" },
        temperature: 0.3
      }));
      const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
      setExplanation(parsed);
    } catch (e) {
      console.error("Explanation error", e);
    } finally {
      setIsLoadingExplanation(false);
    }
  }, [sentenceData]);

  // Auto-generate explanation when score is shown
  useEffect(() => {
    if (score !== null && sentenceData && !explanation) {
      generateExplanation();
    }
  }, [score, sentenceData, explanation, generateExplanation]);

  // ─── Word interactions ───
  const selectWord = (wordId: string) => {
    const word = bankWords.find(w => w.id === wordId);
    if (!word) return;
    setBankWords(prev => prev.filter(w => w.id !== wordId));
    setUserWords(prev => [...prev, word]);
  };

  const deselectWord = (wordId: string) => {
    const word = userWords.find(w => w.id === wordId);
    if (!word) return;
    setUserWords(prev => prev.filter(w => w.id !== wordId));
    setBankWords(prev => [...prev, word]);
  };

  const removeLast = () => {
    if (userWords.length === 0) return;
    const last = userWords[userWords.length - 1];
    setUserWords(prev => prev.slice(0, -1));
    setBankWords(prev => [...prev, last]);
  };

  const clearAll = () => {
    if (userWords.length === 0) return;
    setBankWords(prev => [...prev, ...userWords]);
    setUserWords([]);
  };

  // ─── Drag & Drop reorder handler ───
  const handleReorder = (newOrder: JumbleWord[]) => {
    setUserWords(newOrder);
  };

  const retry = () => {
    if (!sentenceData) return;
    const { correctWords: cw, bankWords: bw } = buildJumbleBank(sentenceData.french, sentenceData.distractors);
    setCorrectWords(cw);
    setBankWords(bw);
    setUserWords([]);
    setScore(null);
    setExplanation(null);
  };

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        if (score === null && userWords.length > 0) {
          e.preventDefault();
          checkAnswer();
        } else if (score !== null) {
          e.preventDefault();
          generateSentence();
        }
      } else if (e.key === 'Backspace' && score === null && !['TEXTAREA', 'INPUT'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        removeLast();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [score, userWords, checkAnswer, generateSentence]);

  // Load first sentence on mount or when difficulty changes
  useEffect(() => {
    generateSentence();
  }, [generateSentence]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/80 border-b border-slate-100 shrink-0">
        <button onClick={onBack} className="text-sm font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1 active:scale-95">
          <ArrowLeft size={14} /> Quay lại
        </button>
        <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
          {currentLevelStat.count > 0 && (
            <span className="bg-green-50 text-green-600 px-2.5 py-1 rounded-lg">
              TB: {Math.round(currentLevelStat.totalScore / currentLevelStat.count)}% ({currentLevelStat.count} câu)
            </span>
          )}
          <span className="bg-purple-50 text-purple-600 px-2.5 py-1 rounded-lg flex items-center gap-1">
            <Shuffle size={12} /> {difficulty}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-lg mx-auto space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-purple-500" />
              <p className="text-sm text-slate-400 font-medium">Đang tạo câu mới...</p>
            </div>
          ) : sentenceData && (
            <AnimatePresence mode="wait">
              {/* Prompt Card — Vietnamese meaning */}
              <motion.div
                key={sentenceData.french}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-purple-700 to-indigo-800 rounded-2xl p-5 text-white shadow-lg"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-300 mb-2 flex items-center gap-1">
                  <Sparkles size={10} /> Ghép câu tiếng Pháp
                </p>
                {currentTopic && (
                  <p className="text-[10px] font-semibold text-purple-200/80 mb-3 bg-white/10 px-2 py-1 rounded-lg inline-flex items-center gap-1">
                    🏷️ {currentTopic}
                  </p>
                )}
                <p className="text-lg font-semibold leading-snug">{sentenceData.translation}</p>
                <p className="text-xs text-purple-300 mt-2 italic">Arrange the words below to form the correct French sentence</p>
              </motion.div>

              {/* ─── PRACTICE: Jumble area ─── */}
              {score === null && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-purple-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Shuffle size={12} /> Câu trả lời của bạn
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-300 font-bold">
                          {userWords.length} / {correctWords.length} từ
                        </span>
                        {userWords.length > 0 && (
                          <>
                            <button onClick={removeLast} className="p-1 text-slate-400 hover:text-red-400 rounded-lg active:scale-90" title="Xóa từ cuối (Backspace)">
                              <Delete size={14} />
                            </button>
                            <button onClick={clearAll} className="p-1 text-slate-400 hover:text-red-500 rounded-lg active:scale-90" title="Xóa hết">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Dropzone — drag & drop reorder */}
                    <div
                      className={`min-h-[72px] rounded-xl border-2 border-dashed p-3 transition-colors ${
                        userWords.length > 0
                          ? 'border-purple-300 bg-purple-50/50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      {userWords.length === 0 ? (
                        <p className="text-sm text-slate-300 italic w-full text-center py-2">
                          Nhấn vào các từ bên dưới để ghép câu...
                        </p>
                      ) : (
                        <Reorder.Group
                          axis="x"
                          values={userWords}
                          onReorder={handleReorder}
                          className="flex flex-wrap gap-2 items-start"
                          as="div"
                        >
                          {userWords.map((word) => (
                            <DraggableWordChip
                              key={word.id}
                              word={word}
                              onRemove={() => deselectWord(word.id)}
                            />
                          ))}
                        </Reorder.Group>
                      )}
                    </div>

                    {/* Hint: drag to reorder */}
                    {userWords.length > 1 && (
                      <p className="text-[10px] text-slate-300 text-center mt-1.5 flex items-center justify-center gap-1">
                        <GripVertical size={10} /> Kéo thả để sắp xếp lại thứ tự
                      </p>
                    )}

                    {/* Separator */}
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-slate-100" />
                      <span className="text-[10px] text-slate-300 font-bold uppercase">Từ gợi ý</span>
                      <div className="flex-1 h-px bg-slate-100" />
                    </div>

                    {/* Word bank */}
                    <div className="flex flex-wrap gap-2 justify-center min-h-[44px]">
                      <AnimatePresence mode="popLayout">
                        {bankWords.map((word) => (
                          <motion.button
                            key={word.id}
                            layoutId={word.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            onClick={() => selectWord(word.id)}
                            className="px-3 py-2 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl text-sm shadow-sm active:scale-90 transition-all cursor-pointer hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
                          >
                            {word.text}
                          </motion.button>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400 flex-wrap">
                    <span>⌨️ Backspace = gỡ từ cuối</span>
                    <span>•</span>
                    <span>Enter = kiểm tra</span>
                    <span>•</span>
                    <span>🖱️ Kéo thả = đổi vị trí</span>
                  </div>
                </motion.div>
              )}

              {/* ─── RESULT ─── */}
              {score !== null && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  {/* Score bar */}
                  <div className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm ${
                    score >= 90 ? 'bg-green-50 text-green-600' :
                    score >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {score >= 90 ? <CheckCircle2 size={16} /> : score >= 60 ? <AlertTriangle size={16} /> : <XCircle size={16} />}
                    {score}% — {score >= 90 ? 'Xuất sắc!' : score >= 60 ? 'Khá tốt!' : 'Cần cải thiện'}
                  </div>

                  {/* What user built */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Bạn ghép:</p>
                    <p className="text-base leading-relaxed">
                      {userWords.map((w, i) => {
                        const isCorrectPos = w.text === correctWords[i];
                        return (
                          <span key={w.id} className={isCorrectPos ? 'text-green-600' : 'text-red-500'}>{w.text} </span>
                        );
                      })}
                    </p>
                  </div>

                  {/* Correct answer */}
                  <div className="bg-green-50 rounded-2xl border border-green-200 p-3.5 shadow-sm">
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1.5 flex justify-between">
                      Đáp án:
                      <button onClick={() => playAudio(sentenceData.french)} disabled={isSpeaking}
                        className="text-[10px] normal-case flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity active:scale-95">
                        {isSpeaking ? <Loader2 size={10} className="animate-spin" /> : <Volume2 size={10} />} Nghe
                      </button>
                    </p>
                    <ClickableText text={sentenceData.french} playAudio={playAudio} className="text-base text-green-800 leading-relaxed font-medium" wordClassName="hover:bg-green-200 active:bg-green-300 rounded px-0.5" />
                  </div>

                  {/* AI Explanation */}
                  {isLoadingExplanation && (
                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-purple-500">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="font-medium">Đang phân tích câu...</span>
                    </div>
                  )}

                  {explanation && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-4 shadow-sm space-y-3">
                      <p className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1">
                        💡 Giải thích & Ứng dụng
                      </p>
                      
                      {/* Usage explanation */}
                      <p className="text-sm text-purple-900 leading-relaxed">{explanation.usage}</p>

                      {/* Situations */}
                      {explanation.situations && explanation.situations.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-1.5">📍 Dùng trong tình huống:</p>
                          <div className="space-y-1.5">
                            {explanation.situations.map((sit, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm text-purple-800">
                                <span className="w-5 h-5 rounded-full bg-purple-200 text-purple-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                                <span>{sit}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Grammar note */}
                      {explanation.grammar && (
                        <div className="bg-white/60 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">📝 Ngữ pháp</p>
                          <p className="text-sm text-indigo-800">{explanation.grammar}</p>
                        </div>
                      )}

                      {/* Similar sentences */}
                      {explanation.similar && Array.isArray(explanation.similar) && explanation.similar.length > 0 && (
                        <div className="bg-white/60 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2">🔗 Similar sentences</p>
                          <div className="space-y-2">
                            {explanation.similar.map((sim, i) => (
                              <ClickableText key={i} text={sim} playAudio={playAudio} className="text-sm text-indigo-800 italic block" wordClassName="hover:bg-indigo-100 active:bg-indigo-200 rounded px-0.5" />
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Retry */}
                  <button onClick={retry}
                    className="flex items-center justify-center gap-1.5 w-full py-2 text-purple-600 bg-purple-50 border border-purple-100 font-bold rounded-xl text-sm active:scale-95">
                    <RotateCcw size={14} /> Ghép lại
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-3 bg-white border-t border-slate-100 shrink-0 safe-area-bottom">
        <div className="max-w-lg mx-auto flex gap-2">
          {score === null ? (
            <button onClick={checkAnswer} disabled={userWords.length === 0}
              className="flex-1 py-3.5 bg-purple-500 text-white font-bold rounded-2xl text-sm active:scale-95 shadow-md disabled:opacity-40 flex items-center justify-center gap-2">
              <Sparkles size={15} /> Kiểm tra (Enter)
            </button>
          ) : (
            <>
              <button onClick={retry}
                className="flex-1 py-3.5 bg-slate-200 text-slate-700 font-bold rounded-2xl text-sm active:scale-95 flex items-center justify-center gap-1.5">
                <RotateCcw size={14} /> Ghép lại
              </button>
              <button onClick={() => generateSentence()}
                className="flex-1 py-3.5 bg-green-500 text-white font-bold rounded-2xl text-sm active:scale-95 shadow-md flex items-center justify-center gap-1.5">
                Câu tiếp <ChevronRight size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Draggable word chip inside the Reorder group.
 * Supports drag to reorder + click X to remove + click to deselect.
 */
const DraggableWordChip: React.FC<{
  word: JumbleWord;
  onRemove: () => void;
}> = ({ word, onRemove }) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={word}
      dragControls={dragControls}
      dragListener={true}
      as="div"
      className="relative group flex items-center gap-1 px-3 py-2 bg-purple-500 text-white font-bold rounded-xl text-sm shadow-sm cursor-grab active:cursor-grabbing select-none hover:bg-purple-600 transition-colors"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileDrag={{ scale: 1.08, boxShadow: '0 8px 25px rgba(139, 92, 246, 0.4)', zIndex: 50 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <GripVertical size={12} className="opacity-40 group-hover:opacity-70 shrink-0 -ml-1" />
      <span>{word.text}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="ml-0.5 -mr-1 p-0.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-purple-700 transition-opacity"
        title="Gỡ từ này"
      >
        <X size={11} />
      </button>
    </Reorder.Item>
  );
};
