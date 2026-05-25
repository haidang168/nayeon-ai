import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Volume2, ArrowLeft, Loader2 } from 'lucide-react';
import { groq } from '../lib/groq';

interface WordDetailData {
  word: string;
  phonetic: string;
  type: string;
  translation: string;
  usageContext: string;
  examples: { fr: string; en: string }[];
  synonyms: { word: string; example: string }[];
}

interface WordDetailPanelProps {
  word: string;
  initialTranslation?: string;
  onBack: () => void;
  playAudio: (text: string, rate?: number) => void;
}

export const WordDetailPanel: React.FC<WordDetailPanelProps> = ({ word, initialTranslation, onBack, playAudio }) => {
  const [data, setData] = useState<WordDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

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
  "type": "part of speech (e.g. noun, verb, adj)",
  "translation": "English/Vietnamese equivalent",
  "usageContext": "Detailed explanation of when and how to use this word, its nuance and register (informal, formal).",
  "examples": [
    { "fr": "Example sentence in French", "en": "English/Vietnamese translation" }
  ],
  "synonyms": [
    { "word": "synonym", "example": "Short example sentence using this synonym" }
  ]
}
Return valid JSON only. Use empty arrays [] for fields with no data. Provide at least 3 examples and 2 synonyms when possible.`
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
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => playAudio(word, 0.5)}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg shadow-sm active:scale-95 transition-all text-xs font-bold"
            title="Đọc chậm"
          >
            0.5x
          </button>
          <button
            onClick={() => playAudio(word, 1.0)}
            className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl shadow-md shadow-blue-200 active:scale-95 transition-transform"
            title="Đọc bình thường"
          >
            <Volume2 size={18} />
          </button>
        </div>
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
            {/* PickVocab Style Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-3xl font-bold text-slate-800">{data.word}</h3>
                {data.phonetic && (
                  <span className="text-slate-400 font-medium">/{data.phonetic}/</span>
                )}
                <button 
                  onClick={() => playAudio(data.word)}
                  className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors active:scale-95"
                >
                  <Volume2 size={20} />
                </button>
              </div>

              {/* Progress tag mock */}
              <div className="flex items-center gap-2 mb-6">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Progress</span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-md">
                  <div className="flex gap-0.5">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-sm"></div>
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-sm"></div>
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-sm"></div>
                  </div>
                  New
                </span>
              </div>

              {/* Definition */}
              <div className="text-slate-700 leading-relaxed text-[15px]">
                {data.type && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-emerald-400 text-emerald-600 text-xs font-medium mr-2 bg-emerald-50/50">
                    {data.type}
                  </span>
                )}
                {data.translation && (
                  <span className="font-medium text-slate-800 mr-2">
                    (Equivalent: {data.translation})
                  </span>
                )}
              </div>
            </div>

            {/* Usage Context */}
            {data.usageContext && (
              <div className="mb-8">
                <h4 className="text-lg font-bold text-slate-800 mb-3">Usage context</h4>
                <p className="text-slate-600 leading-relaxed text-[15px]">
                  {data.usageContext}
                </p>
              </div>
            )}

            {/* Examples (PickVocab style) */}
            {data.examples && data.examples.length > 0 && (
              <div className="mb-8">
                <h4 className="text-lg font-bold text-slate-800 mb-4">Examples</h4>
                <div className="space-y-6">
                  {data.examples.map((ex, i) => (
                    <div key={i} className="flex gap-4">
                      <span className="text-slate-400 font-medium w-4 shrink-0 text-right">{i + 1}.</span>
                      <div className="flex-1">
                        <div 
                          className="pl-4 border-l-2 border-slate-200 text-slate-700 mb-2 cursor-pointer hover:border-blue-300 hover:text-blue-700 transition-colors"
                          onClick={() => playAudio(ex.fr)}
                        >
                          <p className="italic text-[15px]">{ex.fr}</p>
                        </div>
                        <p className="pl-4 text-slate-500 text-[14px]">{ex.en}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Synonyms (PickVocab style) */}
            {data.synonyms && data.synonyms.length > 0 && (
              <div className="mb-8">
                <h4 className="text-lg font-bold text-slate-800 mb-4">Synonyms</h4>
                <div className="space-y-6">
                  {data.synonyms.map((syn, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <button 
                        onClick={() => playAudio(syn.word)}
                        className="text-left font-medium text-blue-600 hover:underline text-[16px] w-fit"
                      >
                        {syn.word}
                      </button>
                      <div className="pl-4 border-l-2 border-slate-200 text-slate-600">
                        <p className="italic text-[15px]">{syn.example}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};
