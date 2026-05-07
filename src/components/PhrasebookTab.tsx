import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookHeart, Heart, Volume2, Brain, Search, ChevronRight, Trash2 } from 'lucide-react';
import { FavoriteItem } from '../types';
import { FlashcardReview } from './FlashcardReview';
import { WordDetailPanel } from './WordDetailPanel';

interface PhrasebookTabProps {
  favorites: FavoriteItem[];
  toggleFavorite: (item: FavoriteItem) => void;
  playAudio: (text: string) => void;
}

export const PhrasebookTab: React.FC<PhrasebookTabProps> = ({ favorites, toggleFavorite, playAudio }) => {
  const [isReviewing, setIsReviewing] = useState(false);
  const [selectedWord, setSelectedWord] = useState<FavoriteItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredFavorites = searchQuery.trim()
    ? favorites.filter(f =>
        f.textFr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.textEnVi.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : favorites;

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
      className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-0"
    >
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

        {/* Search */}
        {favorites.length > 0 && (
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm từ..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100 text-sm focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-50 placeholder:text-slate-300"
            />
          </div>
        )}
      </div>

      {/* Word List */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 custom-scrollbar">
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
                    onClick={(e) => { e.stopPropagation(); playFrenchAudio(fav.textFr); }}
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
      </div>
    </motion.div>
  );
};
