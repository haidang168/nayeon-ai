import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Volume2, ArrowLeft, Loader2, BookOpen, Sparkles, Copy, Check } from 'lucide-react';
import { groq } from '../lib/groq';

interface WordDetailData {
  word: string;
  phonetic: string;
  type: string;
  translation: string;
  wordFamily: string[];
  collocations: { fr: string; en: string }[];
  examples: { fr: string; en: string }[];
  synonyms: string[];
  antonyms: string[];
  confusingWords: string[];
}

interface WordDetailPanelProps {
  word: string;
  initialTranslation?: string;
  onBack: () => void;
  playAudio: (text: string) => void;
}

export const WordDetailPanel: React.FC<WordDetailPanelProps> = ({ word, initialTranslation, onBack, playAudio }) => {
  const [data, setData] = useState<WordDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const playFrenchAudio = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr-') && (v.name.includes('Google') || v.name.includes('Premium')));
    if (frVoice) utterance.voice = frVoice;
    else {
      const fallback = voices.find(v => v.lang.startsWith('fr-'));
      if (fallback) utterance.voice = fallback;
    }
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    let isMounted = true;
    const fetchDetail = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `You are a French-English dictionary expert. Analyze the French word/phrase the user sends. 
Provide a comprehensive analysis for language learners.

Return JSON with EXACTLY this structure:
{
  "word": "original word/phrase",
  "phonetic": "IPA phonetic transcription",
  "type": "part of speech (noun, verb, adj, etc.)",
  "translation": "concise English translation",
  "wordFamily": ["related word 1", "related word 2"],
  "collocations": [
    { "fr": "French collocation phrase", "en": "English meaning" }
  ],
  "examples": [
    { "fr": "Example sentence in French", "en": "English translation" }
  ],
  "synonyms": ["synonym 1", "synonym 2"],
  "antonyms": ["antonym 1", "antonym 2"],
  "confusingWords": ["easily confused word 1", "easily confused word 2"]
}
Return valid JSON only. Use empty arrays [] for fields with no data. Provide at least 3 collocations and 2 examples when possible.`
            },
            { role: "user", content: word }
          ],
          model: "llama-3.1-8b-instant",
          response_format: { type: "json_object" },
          temperature: 0.3
        });

        if (!isMounted) return;
        const raw = completion.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(raw);
        setData(parsed);
      } catch (e) {
        console.error("WordDetail error", e);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (word) fetchDetail();
    return () => { isMounted = false; };
  }, [word]);

  const handleCopyCollocation = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-white shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-800 truncate">{word}</h2>
          {initialTranslation && <p className="text-sm text-slate-400 truncate">{initialTranslation}</p>}
        </div>
        <button
          onClick={() => playFrenchAudio(word)}
          className="p-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl shadow-md shadow-blue-200 active:scale-95 transition-transform"
        >
          <Volume2 size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-blue-500" />
              </div>
            </div>
            <p className="text-sm font-medium text-slate-400">Đang phân tích từ vựng...</p>
          </div>
        ) : error || !data ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-sm font-medium">Không thể phân tích từ này.</p>
            <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold text-slate-600 active:scale-95">Quay lại</button>
          </div>
        ) : (
          <>
            {/* Word header card */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold font-serif tracking-wide">{data.word}</h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {data.phonetic && (
                      <span className="text-blue-300 font-mono text-sm">/{data.phonetic}/</span>
                    )}
                    {data.type && (
                      <span className="text-[11px] font-bold bg-white/15 px-2.5 py-0.5 rounded-md uppercase tracking-wider text-slate-300">{data.type}</span>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-lg font-semibold text-amber-300">{data.translation}</p>

              {data.wordFamily && data.wordFamily.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Word Family</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.wordFamily.map((w, i) => (
                      <button key={i} onClick={() => playFrenchAudio(w)}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium text-slate-200 transition-colors active:scale-95">
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Collocations */}
            {data.collocations && data.collocations.length > 0 && (
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <BookOpen size={14} className="text-blue-600" />
                  </div>
                  <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider">Collocations</h4>
                </div>
                <div className="space-y-2">
                  {data.collocations.map((col, i) => (
                    <div key={i} className="flex items-start gap-2 group">
                      <button onClick={() => playFrenchAudio(col.fr)}
                        className="p-1 shrink-0 mt-0.5 text-blue-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity active:scale-95">
                        <Volume2 size={12} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 leading-snug">{col.fr}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{col.en}</p>
                      </div>
                      <button onClick={() => handleCopyCollocation(col.fr, i)}
                        className="p-1 shrink-0 mt-0.5 text-slate-300 hover:text-slate-500 transition-colors active:scale-95">
                        {copiedIdx === i ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Examples */}
            {data.examples && data.examples.length > 0 && (
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-amber-100 rounded-lg">
                    <Sparkles size={14} className="text-amber-600" />
                  </div>
                  <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider">Examples</h4>
                </div>
                <div className="space-y-3">
                  {data.examples.map((ex, i) => (
                    <div key={i} className="group cursor-pointer" onClick={() => playFrenchAudio(ex.fr)}>
                      <p className="text-sm font-medium text-slate-800 leading-snug group-hover:text-blue-600 transition-colors">"{ex.fr}"</p>
                      <p className="text-xs text-slate-500 mt-0.5 italic">{ex.en}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Synonyms / Antonyms / Confusing */}
            {(data.synonyms?.length > 0 || data.antonyms?.length > 0 || data.confusingWords?.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.synonyms?.length > 0 && (
                  <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                    <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Synonyms</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {data.synonyms.map((s, i) => (
                        <button key={i} onClick={() => playFrenchAudio(s)}
                          className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs font-medium transition-colors active:scale-95">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {data.antonyms?.length > 0 && (
                  <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100">
                    <h4 className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-2">Antonyms</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {data.antonyms.map((s, i) => (
                        <button key={i} onClick={() => playFrenchAudio(s)}
                          className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-medium transition-colors active:scale-95">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {data.confusingWords?.length > 0 && (
                  <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 sm:col-span-2">
                    <h4 className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-2">⚠ Easily Confused</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {data.confusingWords.map((s, i) => (
                        <button key={i} onClick={() => playFrenchAudio(s)}
                          className="px-2.5 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-xs font-medium transition-colors active:scale-95">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};
