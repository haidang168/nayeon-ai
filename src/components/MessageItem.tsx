import React from 'react';
import { Volume2, Heart, Lightbulb, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, FavoriteItem } from '../types';

interface MessageItemProps {
  msg: Message;
  isSpeaking: boolean;
  favorites: FavoriteItem[];
  playAudio: (text: string, rate: number) => void;
  toggleFavorite: (item: FavoriteItem) => void;
  generateHintsForMessage: (id: number, text: string) => void;
  setUserInput: (text: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = React.memo(({
  msg,
  isSpeaking,
  favorites,
  playAudio,
  toggleFavorite,
  generateHintsForMessage,
  setUserInput
}) => {
  return (
    <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
      <div className="flex flex-col max-w-[90%] sm:max-w-[85%]">
        <div className="flex flex-col relative group">
          <div className={`px-4 py-3 sm:px-5 sm:py-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-brand-primary text-white rounded-tr-sm' : 'bg-slate-50 text-slate-800 rounded-tl-sm border border-slate-100'}`}>
            <div className="markdown-body font-medium text-base sm:text-[15px] leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.textFr || ''}</ReactMarkdown>
            </div>
            {msg.textEn && <p className={`text-[13px] sm:text-sm mt-1.5 pt-2 border-t font-medium ${msg.role === 'user' ? 'text-blue-100 border-white/20' : 'text-slate-500 border-slate-200'}`}>{msg.textEn}</p>}
          </div>



          {msg.role === 'app' && (
            <div className="flex items-center gap-2 mt-1 px-1">
              <button
                onClick={() => playAudio(msg.textFr!, 1.0)}
                title="Nghe tốc độ chuẩn"
                className={`p-2 rounded-full transition-transform active:scale-95 ${isSpeaking ? 'bg-brand-primary text-white animate-pulse shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-brand-primary'}`}
              >
                <Volume2 size={16} />
              </button>
              <button
                onClick={() => playAudio(msg.textFr!, 0.75)}
                title="Nghe chậm (0.75x)"
                className={`px-2.5 py-1.5 bg-white text-slate-500 rounded-lg hover:bg-slate-50 hover:text-brand-primary transition-all active:scale-95 border border-slate-200 shadow-sm flex items-center gap-1`}
              >
                <span className="text-[10px] font-bold">NGHE CHẬM</span>
              </button>
              <button
                onClick={() => generateHintsForMessage(msg.id, msg.textFr!)}
                disabled={msg.isLoadingHints || (msg.tips && msg.tips.length > 0)}
                title="Gợi ý cách trả lời"
                className={`p-2 rounded-full transition-all ${msg.isLoadingHints ? 'animate-pulse text-amber-500 bg-amber-50' : (msg.tips && msg.tips.length > 0) ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'}`}
              >
                <Lightbulb size={18} />
              </button>
              <button
                onClick={() => toggleFavorite({ id: `msg-${msg.id}`, textFr: msg.textFr || '', textEnVi: msg.textEn || '', source: 'chat' })}
                className="p-2 ml-auto text-slate-400 hover:text-pink-500 transition-colors"
                title="Lưu vào Sổ tay"
              >
                <Heart size={18} fill={favorites.some(f => f.id === `msg-${msg.id}`) ? "currentColor" : "none"} className={favorites.some(f => f.id === `msg-${msg.id}`) ? "text-pink-500" : ""} />
              </button>
            </div>
          )}

          {msg.role === 'app' && msg.isLoadingHints && (
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-600 animate-pulse ml-2">
              <Loader2 size={14} className="animate-spin" /> Nayeon đang nghĩ gợi ý...
            </div>
          )}
          
          {msg.role === 'app' && msg.tips && msg.tips.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 w-full animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                <Lightbulb size={12} className="text-amber-500"/> Gợi ý trả lời:
              </p>
              <div className="flex flex-col gap-2">
                {msg.tips.map((tip, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setUserInput(tip.title)}
                    className="text-left bg-white border border-slate-200 hover:border-brand-primary hover:shadow-md px-3 py-2.5 rounded-xl text-sm transition-all group w-full sm:max-w-[90%]"
                  >
                    <p className="font-bold text-slate-700 group-hover:text-brand-primary">{tip.title}</p>
                    <p className="text-xs text-slate-500 mt-1 font-medium">{tip.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom equality check for React.memo to ensure it only re-renders when absolutely necessary
  return (
    prevProps.msg.id === nextProps.msg.id &&
    prevProps.msg.textFr === nextProps.msg.textFr &&
    prevProps.msg.textEn === nextProps.msg.textEn &&
    prevProps.msg.corrections === nextProps.msg.corrections &&
    prevProps.msg.isLoadingHints === nextProps.msg.isLoadingHints &&
    prevProps.msg.tips?.length === nextProps.msg.tips?.length &&
    prevProps.isSpeaking === nextProps.isSpeaking &&
    prevProps.favorites.length === nextProps.favorites.length
  );
});
