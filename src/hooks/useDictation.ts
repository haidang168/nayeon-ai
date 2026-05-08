import { useState, useCallback, useRef, useEffect } from 'react';
import {
  DictationLesson,
  DictationSentence,
  extractVideoId,
  fetchYouTubeTranscript,
  fetchVideoInfo,
  mergeSegmentsIntoSentences,
} from '../lib/youtubeTranscript';
import { groq } from '../lib/groq';
import { useStats } from './useStats';
import { syncDataToCloud, loadDataFromCloud } from '../lib/firebase';

// ─── SRS for wrong sentences ───
interface SRSItem {
  sentence: DictationSentence;
  lessonTitle: string;
  wrongCount: number;
  lastWrong: number; // timestamp
}

const SRS_STORAGE_KEY = 'dictation_srs_items';
const LESSONS_STORAGE_KEY = 'dictation_lessons';

function loadSRSItems(): SRSItem[] {
  try {
    const saved = localStorage.getItem(SRS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveSRSItems(items: SRSItem[]) {
  localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(items));
}

function loadSavedLessons(): DictationLesson[] {
  try {
    const saved = localStorage.getItem(LESSONS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveLessonsToStorage(lessons: DictationLesson[]) {
  localStorage.setItem(LESSONS_STORAGE_KEY, JSON.stringify(lessons));
}

// ─── Word-level diff engine ───
export interface DiffWord {
  word: string;
  status: 'correct' | 'wrong' | 'missing' | 'extra';
}

/**
 * Compare user input vs correct answer at word level.
 * Returns arrays for both user's input and the correct answer with status markers.
 */
export function computeWordDiff(userText: string, correctText: string, mode: 'easy' | 'hard' = 'easy'): {
  userDiff: DiffWord[];
  correctDiff: DiffWord[];
  score: number; // 0-100
} {
  const normalizeForSplit = (t: string) => t
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[\u00A0]/g, ' ')
    .trim();

  // Split keeping punctuation attached to words if any
  const userWords = normalizeForSplit(userText).split(/\s+/).filter(w => w.length > 0);
  const correctWords = normalizeForSplit(correctText).split(/\s+/).filter(w => w.length > 0);

  const cleanWord = (w: string) => {
    let clean = w.toLowerCase();
    if (mode === 'easy') {
      // Remove accents and punctuation in easy mode
      clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      clean = clean.replace(/[.,!?;:'"()]/g, '');
    } else {
      // Hard mode: keep punctuation and accents, just lower case
    }
    return clean;
  };

  // LCS-based diff for accurate word matching
  const m = userWords.length;
  const n = correctWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const uClean = cleanWord(userWords[i - 1]);
      const cClean = cleanWord(correctWords[j - 1]);
      if (uClean === cClean && uClean !== '') {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find which words match
  const userMatched = new Set<number>();
  const correctMatched = new Set<number>();
  let i = m, j = n;
  while (i > 0 && j > 0) {
    const uClean = cleanWord(userWords[i - 1]);
    const cClean = cleanWord(correctWords[j - 1]);
    if (uClean === cClean && uClean !== '') {
      userMatched.add(i - 1);
      correctMatched.add(j - 1);
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const userDiff: DiffWord[] = userWords.map((word, idx) => ({
    word,
    status: userMatched.has(idx) ? 'correct' : 'extra',
  }));

  const correctDiff: DiffWord[] = correctWords.map((word, idx) => ({
    word,
    status: correctMatched.has(idx) ? 'correct' : 'missing',
  }));

  const lcsLength = dp[m][n];
  const score = n > 0 ? Math.round((lcsLength / n) * 100) : 0;

  return { userDiff, correctDiff, score };
}

// ─── Cloze Test Generator ───
export interface ClozeData {
  /** The sentence with blanks as ___1___, ___2___, etc. */
  display: string;
  /** The words that were blanked out, in order */
  blankedWords: string[];
  /** User's answers for each blank */
  userAnswers: string[];
}

/**
 * Generate cloze blanks for a sentence by selecting 3-4 important keywords.
 * Uses simple heuristics: pick content words (nouns, verbs, adjectives) that are 3+ chars.
 */
export function generateCloze(sentence: string, numBlanks: number = 3): ClozeData {
  const words = sentence.split(/\s+/);
  if (words.length <= numBlanks) {
    // Too short, blank everything
    return {
      display: words.map((_, i) => `___${i + 1}___`).join(' '),
      blankedWords: words.map(w => w.replace(/[.,!?;:"'()]/g, '')),
      userAnswers: words.map(() => ''),
    };
  }

  // Score each word: longer content words get higher score
  // Skip very common small words (articles, prepositions)
  const skipWords = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'à', 'au', 'aux', 'et', 'ou', 'en', 'y', 'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'ne', 'pas', 'se', 'ce', 'que', 'qui', 'est', 'a', 'the', 'is', 'a', 'an', 'and', 'or', 'to', 'in', 'of', 'for', 'it', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her']);

  const scored = words.map((w, i) => {
    const clean = w.toLowerCase().replace(/[.,!?;:"'()]/g, '');
    let score = clean.length; // Longer words are more important
    if (skipWords.has(clean)) score = -1;
    if (clean.length < 3) score = Math.max(score - 2, -1);
    // Avoid first and last word for better context
    if (i === 0 || i === words.length - 1) score -= 1;
    return { word: w, clean, index: i, score };
  });

  // Pick top N words with highest scores, spread evenly across the sentence
  const candidates = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  const actualBlanks = Math.min(numBlanks, candidates.length, Math.ceil(words.length * 0.5));
  const selected = new Set<number>();

  // Greedy selection: pick highest scored, ensuring minimum gap of 1 word
  for (const c of candidates) {
    if (selected.size >= actualBlanks) break;
    let tooClose = false;
    for (const idx of selected) {
      if (Math.abs(c.index - idx) < 2) { tooClose = true; break; }
    }
    if (!tooClose) selected.add(c.index);
  }

  // If we still need more, relax the gap constraint
  if (selected.size < actualBlanks) {
    for (const c of candidates) {
      if (selected.size >= actualBlanks) break;
      if (!selected.has(c.index)) selected.add(c.index);
    }
  }

  const blankedWords: string[] = [];
  const display = words.map((w, i) => {
    if (selected.has(i)) {
      blankedWords.push(w.replace(/[.,!?;:"'()]/g, ''));
      // Keep trailing punctuation visible
      const trailing = w.match(/[.,!?;:"'()]+$/)?.[0] || '';
      return `___${blankedWords.length}___${trailing}`;
    }
    return w;
  }).join(' ');

  return {
    display,
    blankedWords,
    userAnswers: blankedWords.map(() => ''),
  };
}

// ─── Main hook ───
export type DictationMode = 'dictation' | 'shadowing';
export type DictationStyle = 'full' | 'cloze';
export type PracticePhase = 'browse' | 'import' | 'practice' | 'review-srs';

export function useDictation() {
  const stats = useStats();
  const [phase, setPhase] = useState<PracticePhase>('browse');
  const [mode, setMode] = useState<DictationMode>('dictation');
  const [difficultyMode, setDifficultyMode] = useState<'easy'|'hard'>('easy');
  const [autoLoop, setAutoLoop] = useState(false);
  const [dictationStyle, setDictationStyle] = useState<DictationStyle>('full');
  const [savedLessons, setSavedLessons] = useState<DictationLesson[]>([]);
  const [currentLesson, setCurrentLesson] = useState<DictationLesson | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [lastDiff, setLastDiff] = useState<{ userDiff: DiffWord[]; correctDiff: DiffWord[]; score: number } | null>(null);
  const [sessionScores, setSessionScores] = useState<number[]>([]);
  const [isSlowSpeed, setIsSlowSpeed] = useState(false);
  const [srsItems, setSrsItems] = useState<SRSItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cloze state
  const [currentCloze, setCurrentCloze] = useState<ClozeData | null>(null);
  const [clozeChecked, setClozeChecked] = useState(false);
  const [clozeScore, setClozeScore] = useState<number | null>(null);

  // YouTube import state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importPreview, setImportPreview] = useState<{
    title: string;
    thumbnailUrl: string;
    sentences: DictationSentence[];
    videoId: string;
    vocabulary?: Array<{word: string; meaning: string}>;
  } | null>(null);
  const [selectedSentenceIds, setSelectedSentenceIds] = useState<Set<string>>(new Set());

  // Shadowing state
  const [shadowingTranscript, setShadowingTranscript] = useState('');
  const [showShadowingAnswer, setShowShadowingAnswer] = useState(false);

  const currentSentence = currentLesson?.sentences[currentIndex] ?? null;
  const totalSentences = currentLesson?.sentences.length ?? 0;
  const isLastSentence = currentIndex >= totalSentences - 1;

  // ─── Initial Load from Cloud ───
  useEffect(() => {
    const initData = async () => {
      const cloudData = await loadDataFromCloud();
      let initialLessons = cloudData?.dictationLessons;
      let initialSrs = cloudData?.dictationSrs;

      let needsSync = false;

      if (!initialLessons) {
        initialLessons = loadSavedLessons();
        if (initialLessons && initialLessons.length > 0) needsSync = true;
      }
      if (!initialSrs) {
        initialSrs = loadSRSItems();
        if (initialSrs && initialSrs.length > 0) needsSync = true;
      }

      setSavedLessons(initialLessons || []);
      setSrsItems(initialSrs || []);
      setIsLoaded(true);

      // Sync legacy local storage data up to Firebase
      if (needsSync) {
        syncDataToCloud({ 
          dictationLessons: initialLessons || [],
          dictationSrs: initialSrs || []
        });
      }
    };
    initData();
  }, []);

  const updateSavedLessons = useCallback((lessons: DictationLesson[]) => {
    setSavedLessons(lessons);
    saveLessonsToStorage(lessons);
    syncDataToCloud({ dictationLessons: lessons });
  }, []);

  const updateSrsItems = useCallback((items: SRSItem[]) => {
    setSrsItems(items);
    saveSRSItems(items);
    syncDataToCloud({ dictationSrs: items });
  }, []);

  // ─── YouTube Import ───
  const importFromYouTube = useCallback(async () => {
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      setImportError('Link YouTube không hợp lệ. Vui lòng kiểm tra lại.');
      return;
    }

    setIsImporting(true);
    setImportError('');
    setImportPreview(null);

    try {
      const [segments, info] = await Promise.all([
        fetchYouTubeTranscript(videoId),
        fetchVideoInfo(videoId),
      ]);

      if (segments.length === 0) {
        setImportError('Video này không có phụ đề tiếng Pháp. Hãy thử video khác.');
        return;
      }

      const allSentences = mergeSegmentsIntoSentences(segments, videoId);

      // ── AI auto-filter: pick only sentences with useful collocations/chunks/patterns ──
      const allTexts = allSentences.map((s, i) => `${i}: ${s.text}`).join('\n');
      
      let selectedIndices: number[] = [];
      let extractedVocab: Array<{word: string; meaning: string}> = [];
      try {
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `You are a French language learning expert. From the numbered list of sentences below, do TWO things:
1. Select ONLY the ones that are most valuable for language learners to practice dictation.
SELECT sentences that contain:
- Common collocations (e.g. "faire attention", "avoir besoin de")
- Useful chunks and fixed expressions
- Important sentence patterns used frequently in daily life
- Rich vocabulary worth learning

SKIP sentences that are:
- Filler/transition phrases (e.g. "alors", "bon", "voilà")
- Too short (under 4 words) or too long (over 15 words)
- Channel intros/outros, greetings that are not linguistically useful
- Repeated patterns

2. Extract 5-10 difficult or useful French vocabulary words/phrases from the entire transcript.

Return a JSON object: 
{ 
  "indices": [0, 3, 5, ...],
  "vocabulary": [
    { "word": "word in french", "meaning": "vietnamese meaning" }
  ]
}
Pick 10-25 of the best sentences. Return valid JSON only.`
            },
            { role: "user", content: allTexts }
          ],
          model: "llama-3.1-8b-instant",
          response_format: { type: "json_object" },
          temperature: 0.2
        });
        
        const raw = completion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(raw);
        selectedIndices = (parsed.indices || []).filter((i: number) => i >= 0 && i < allSentences.length);
        extractedVocab = parsed.vocabulary || [];
      } catch (aiErr) {
        console.warn("AI filter failed, falling back to heuristic", aiErr);
      }

      // Fallback: if AI returned nothing, use heuristic (sentences with 4-12 words)
      if (selectedIndices.length === 0) {
        selectedIndices = allSentences
          .map((s, i) => ({ i, wc: s.text.split(/\s+/).length }))
          .filter(s => s.wc >= 4 && s.wc <= 12)
          .slice(0, 20)
          .map(s => s.i);
      }

      const filteredSentences = selectedIndices.map(i => allSentences[i]);
      const selected = new Set<string>(filteredSentences.map(s => s.id));
      setSelectedSentenceIds(selected);

      setImportPreview({
        title: info.title,
        thumbnailUrl: info.thumbnailUrl,
        sentences: allSentences, // keep all for manual adjustment
        videoId,
        vocabulary: extractedVocab
      });
    } catch (err: any) {
      setImportError(err.message || 'Không thể lấy phụ đề từ video này.');
    } finally {
      setIsImporting(false);
    }
  }, [youtubeUrl]);

  const toggleSentenceSelection = useCallback((id: string) => {
    setSelectedSentenceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const confirmImport = useCallback(() => {
    if (!importPreview) return;

    // Filter sentences based on user selection
    const finalSentences = importPreview.sentences.filter(s => selectedSentenceIds.has(s.id));
    if (finalSentences.length === 0) {
      setImportError('Vui lòng chọn ít nhất 1 câu để luyện tập.');
      return;
    }

    const lesson: DictationLesson = {
      id: `yt-${importPreview.videoId}-${Date.now()}`,
      videoId: importPreview.videoId,
      title: importPreview.title,
      sentences: finalSentences, // only save selected ones!
      thumbnailUrl: importPreview.thumbnailUrl,
      savedAt: Date.now(),
      vocabulary: importPreview.vocabulary,
    };

    const updated = [lesson, ...savedLessons];
    updateSavedLessons(updated);
    setImportPreview(null);
    setYoutubeUrl('');
    setPhase('browse');
  }, [importPreview, savedLessons, selectedSentenceIds, updateSavedLessons]);

  // ─── Start Practice ───
  const startLesson = useCallback((lesson: DictationLesson) => {
    setCurrentLesson(lesson);
    setCurrentIndex(0);
    setUserInput('');
    setIsChecked(false);
    setLastDiff(null);
    setSessionScores([]);
    setShadowingTranscript('');
    setShowShadowingAnswer(false);
    setPhase('practice');
  }, []);

  // ─── Start SRS Review ───
  const startSRSReview = useCallback(() => {
    if (srsItems.length === 0) return;

    // Build a "virtual lesson" from SRS items
    const sentences: DictationSentence[] = srsItems.map(item => item.sentence);
    const lesson: DictationLesson = {
      id: 'srs-review',
      videoId: '',
      title: `Ôn tập câu sai (${srsItems.length} câu)`,
      sentences,
      thumbnailUrl: '',
      savedAt: Date.now(),
    };

    setCurrentLesson(lesson);
    setCurrentIndex(0);
    setUserInput('');
    setIsChecked(false);
    setLastDiff(null);
    setSessionScores([]);
    setShadowingTranscript('');
    setShowShadowingAnswer(false);
    setPhase('review-srs');
  }, [srsItems]);

  // ─── Check Answer (Dictation mode) ───
  const checkAnswer = useCallback(() => {
    if (!currentSentence || isChecked) return;

    const diff = computeWordDiff(userInput, currentSentence.text, difficultyMode);
    setLastDiff(diff);
    setIsChecked(true);
    setSessionScores(prev => [...prev, diff.score]);

    if (diff.score >= 60) {
      stats.addXP(2);
    }

    // If score < 80%, add to SRS
    if (diff.score < 80) {
      setSrsItems(prev => {
        const existing = prev.find(item => item.sentence.id === currentSentence.id);
        let updated: SRSItem[];
        if (existing) {
          updated = prev.map(item =>
            item.sentence.id === currentSentence.id
              ? { ...item, wrongCount: item.wrongCount + 1, lastWrong: Date.now() }
              : item
          );
        } else {
          updated = [...prev, {
            sentence: currentSentence,
            lessonTitle: currentLesson?.title || '',
            wrongCount: 1,
            lastWrong: Date.now(),
          }];
        }
        updateSrsItems(updated);
        return updated;
      });
    } else {
      // If score >= 80%, remove from SRS if exists
      setSrsItems(prev => {
        const updated = prev.filter(item => item.sentence.id !== currentSentence.id);
        updateSrsItems(updated);
        return updated;
      });
    }
  }, [currentSentence, userInput, isChecked, currentLesson, difficultyMode, stats, updateSrsItems]);

  // ─── Reveal Answer (Shadowing mode) ───
  const revealAnswer = useCallback(() => {
    setShowShadowingAnswer(true);
  }, []);

  // ─── Next Sentence ───
  const goNext = useCallback(() => {
    if (isLastSentence) return;
    setCurrentIndex(prev => prev + 1);
    setUserInput('');
    setIsChecked(false);
    setLastDiff(null);
    setShadowingTranscript('');
    setShowShadowingAnswer(false);
  }, [isLastSentence]);

  // ─── Session Results ───
  const getSessionResults = useCallback(() => {
    if (sessionScores.length === 0) return null;
    const avg = Math.round(sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length);
    const perfect = sessionScores.filter(s => s === 100).length;
    return {
      total: sessionScores.length,
      averageScore: avg,
      perfectCount: perfect,
      scores: sessionScores,
    };
  }, [sessionScores]);

  // ─── Delete Lesson ───
  const deleteLesson = useCallback((lessonId: string) => {
    const updated = savedLessons.filter(l => l.id !== lessonId);
    updateSavedLessons(updated);
  }, [savedLessons, updateSavedLessons]);

  // ─── Back to browse ───
  const exitPractice = useCallback(() => {
    setCurrentLesson(null);
    setPhase('browse');
    setCurrentIndex(0);
    setUserInput('');
    setIsChecked(false);
    setLastDiff(null);
    setSessionScores([]);
  }, []);

  // ─── Cloze: generate blanks for current sentence ───
  const generateClozeForCurrent = useCallback(() => {
    if (!currentSentence) return;
    const cloze = generateCloze(currentSentence.text, 3);
    setCurrentCloze(cloze);
    setClozeChecked(false);
    setClozeScore(null);
  }, [currentSentence]);

  const setClozeAnswer = useCallback((index: number, value: string) => {
    setCurrentCloze(prev => {
      if (!prev) return prev;
      const newAnswers = [...prev.userAnswers];
      newAnswers[index] = value;
      return { ...prev, userAnswers: newAnswers };
    });
  }, []);

  const checkClozeAnswer = useCallback(() => {
    if (!currentCloze) return;
    let correct = 0;
    for (let i = 0; i < currentCloze.blankedWords.length; i++) {
      const expected = currentCloze.blankedWords[i].toLowerCase().replace(/[.,!?;:'"()]/g, '');
      const given = (currentCloze.userAnswers[i] || '').toLowerCase().replace(/[.,!?;:'"()]/g, '').trim();
      if (expected === given) correct++;
    }
    const score = Math.round((correct / currentCloze.blankedWords.length) * 100);
    setClozeChecked(true);
    setClozeScore(score);
    setSessionScores(prev => [...prev, score]);

    if (score >= 60) {
      stats.addXP(2);
    }

    // SRS tracking for cloze too
    if (score < 80 && currentSentence) {
      setSrsItems(prev => {
        const existing = prev.find(item => item.sentence.id === currentSentence.id);
        let updated: SRSItem[];
        if (existing) {
          updated = prev.map(item =>
            item.sentence.id === currentSentence.id
              ? { ...item, wrongCount: item.wrongCount + 1, lastWrong: Date.now() }
              : item
          );
        } else {
          updated = [...prev, {
            sentence: currentSentence,
            lessonTitle: currentLesson?.title || '',
            wrongCount: 1,
            lastWrong: Date.now(),
          }];
        }
        updateSrsItems(updated);
        return updated;
      });
    }
  }, [currentCloze, currentSentence, currentLesson, stats, updateSrsItems]);

  return {
    isLoaded,
    // Phase & Mode
    phase, setPhase,
    mode, setMode,
    difficultyMode, setDifficultyMode,
    autoLoop, setAutoLoop,
    dictationStyle, setDictationStyle,

    // Saved lessons
    savedLessons,
    deleteLesson,

    // YouTube Import
    youtubeUrl, setYoutubeUrl,
    isImporting,
    importError,
    importPreview,
    selectedSentenceIds,
    toggleSentenceSelection,
    importFromYouTube,
    confirmImport,

    // Practice session
    currentLesson,
    currentSentence,
    currentIndex,
    totalSentences,
    isLastSentence,
    startLesson,
    exitPractice,

    // Dictation (full sentence)
    userInput, setUserInput,
    isChecked,
    lastDiff,
    checkAnswer,

    // Cloze test
    currentCloze,
    clozeChecked,
    clozeScore,
    generateClozeForCurrent,
    setClozeAnswer,
    checkClozeAnswer,

    // Shadowing
    shadowingTranscript, setShadowingTranscript,
    showShadowingAnswer,
    revealAnswer,

    // Speed
    isSlowSpeed, setIsSlowSpeed,

    // Navigation
    goNext,
    getSessionResults,

    // SRS
    srsItems,
    startSRSReview,
  };
}
