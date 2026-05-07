import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Volume2, X, Loader2, BookOpen, Send, Heart } from 'lucide-react';
import { groq } from '../lib/groq';
import { FavoriteItem } from '../types';

interface DictionaryPopupProps {
  word: string;
  x: number;
  y: number;
  onClose: () => void;
  playAudio: (text: string, rate?: number) => void;
  favorites?: FavoriteItem[];
  toggleFavorite?: (item: FavoriteItem) => void;
  onAskChat?: (word: string) => void;
}

interface DictResult {
  word: string;
  translation: string;
}

export const DictionaryPopup: React.FC<DictionaryPopupProps> = ({ word, x, y, onClose, playAudio, favorites, toggleFavorite, onAskChat }) => {
  const [data, setData] = useState<DictResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const playFrenchAudio = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    // Find a good French voice
    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr-') && (v.name.includes('Google') || v.name.includes('Premium')));
    if (frVoice) {
      utterance.voice = frVoice;
    } else {
      const fallback = voices.find(v => v.lang.startsWith('fr-'));
      if (fallback) utterance.voice = fallback;
    }
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    let isMounted = true;
    const fetchMeaning = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const completion = await groq.chat.completions.create({
          messages: [
            { 
              role: "system", 
              content: `You are a French-English dictionary. Translate the French word/phrase the user sends into English as CONCISELY as possible.
IMPORTANT: Only provide the core meaning, 1-3 words maximum.

Return JSON with EXACTLY this structure:
{
  "word": "original French word/phrase",
  "translation": "concise English meaning"
}
Return valid JSON only.`
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
        console.error("Dictionary error", e);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (word) {
      fetchMeaning();
    }

    return () => { isMounted = false; };
  }, [word]);

  // Calculate position: if there's enough space above the selection, place it above.
  // Otherwise place it below.
  const isEnoughSpaceAbove = y > 380;
  const popupX = Math.max(10, Math.min(window.innerWidth - 340, x - 160));
  
  const positionStyle = isEnoughSpaceAbove 
    ? { left: popupX, bottom: window.innerHeight - y + 10 }
    : { left: popupX, top: y + 30 };

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, y: isEnoughSpaceAbove ? 10 : -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: isEnoughSpaceAbove ? 10 : -10, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed z-[100] w-[280px] bg-[#221f1d] text-white rounded-[24px] shadow-2xl dict-popup-container"
      style={positionStyle}
      onMouseUp={(e) => e.stopPropagation()} 
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Top right close button */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-stone-400 hover:text-white transition-colors"
      >
        <X size={18} />
      </button>

      <div className="p-5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-6 gap-3 text-stone-400">
            <Loader2 size={24} className="animate-spin text-amber-500" />
            <p className="text-sm font-medium">Đang tra từ...</p>
          </div>
        ) : error || !data ? (
          <div className="text-center py-6 text-stone-400">
            <p className="text-sm font-medium">Không thể tra cứu từ này.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="pr-8 cursor-move active:cursor-grabbing" title="Kéo thả để di chuyển">
              <h3 className="text-[22px] font-bold text-white font-serif tracking-wide leading-tight">{data.word || word}</h3>
              <p className="text-stone-300 italic mt-1 text-[15px]">{data.translation}</p>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => playFrenchAudio(data.word || word)}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#332f2b] hover:bg-[#3d3834] text-white rounded-full text-sm font-semibold transition-colors active:scale-95"
              >
                <Volume2 size={16} />
                Nghe
              </button>

              {toggleFavorite && (
                <button 
                  onClick={() => {
                    toggleFavorite({
                      id: `dict-${data.word || word}`,
                      textFr: data.word || word,
                      textEnVi: data.translation,
                      source: 'flashcard'
                    });
                  }}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-[#221f1d] rounded-full text-sm font-bold transition-colors active:scale-95 ml-auto"
                >
                  <span className="text-lg leading-none">+</span>
                  Lưu thẻ
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
