import React, { useRef, useEffect } from 'react';
import { MessageItem } from './MessageItem';
import { Message, FavoriteItem } from '../types';

interface ChatWindowProps {
  messages: Message[];
  isAiTyping: boolean;
  isSpeaking: boolean;
  favorites: FavoriteItem[];
  playAudio: (text: string, rate: number) => void;
  toggleFavorite: (item: FavoriteItem) => void;
  generateHintsForMessage: (id: number, text: string) => void;
  setUserInput: (text: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  isAiTyping,
  isSpeaking,
  favorites,
  playAudio,
  toggleFavorite,
  generateHintsForMessage,
  setUserInput
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 flex flex-col gap-6 scroll-smooth min-h-0 relative">
      {messages.length === 0 && !isAiTyping && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
          <p className="text-slate-400 font-bold text-lg">Hãy bắt đầu cuộc trò chuyện!</p>
        </div>
      )}

      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          msg={msg}
          isSpeaking={isSpeaking}
          favorites={favorites}
          playAudio={playAudio}
          toggleFavorite={toggleFavorite}
          generateHintsForMessage={generateHintsForMessage}
          setUserInput={setUserInput}
        />
      ))}

      {isAiTyping && (
        <div className="flex items-center gap-3 ml-12 animate-in fade-in">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-wave" style={{ animationDelay: '0s' }}></span>
            <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-wave" style={{ animationDelay: '0.2s' }}></span>
            <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-wave" style={{ animationDelay: '0.4s' }}></span>
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nayeon đang gõ...</span>
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
  );
};
