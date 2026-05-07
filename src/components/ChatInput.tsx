import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Send, Sparkles } from 'lucide-react';

interface ChatInputProps {
  userInput: string;
  setUserInput: (text: string) => void;
  handleSendMessage: () => void;
  isAiTyping: boolean;
  isRecording: boolean;
  isProcessingVoice?: boolean;
  interimTranscript?: string;
  toggleRecording: () => void;
  showEvaluateButton?: boolean;
  onEvaluate?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  userInput,
  setUserInput,
  handleSendMessage,
  isAiTyping,
  isRecording,
  isProcessingVoice,
  interimTranscript,
  toggleRecording,
  showEvaluateButton,
  onEvaluate
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [userInput]);

  const getPlaceholder = () => {
    if (isProcessingVoice) return '⏳ Đang nhận dạng giọng nói...';
    if (isRecording) return '🔴 Đang thu âm — nhấn lại để dừng & gửi';
    return 'Nhập tiếng Pháp hoặc Việt...';
  };

  const isMicDisabled = isAiTyping || isProcessingVoice;

  return (
    <div className="p-4 sm:p-6 bg-white border-t border-slate-100 shrink-0 flex flex-col gap-3">
      {showEvaluateButton && (
        <div className="flex justify-end">
          <button
            onClick={onEvaluate}
            disabled={isAiTyping}
            className="text-xs font-bold px-3 py-1.5 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white rounded-lg transition-all border border-brand-primary/20 flex items-center gap-1 shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Sparkles size={14} /> KẾT THÚC &amp; NHẬN XÉT
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 sm:gap-3 relative">
        {/* Mic button — push-to-talk with Groq Whisper */}
        <button
          onClick={toggleRecording}
          disabled={isMicDisabled}
          className={`p-3 sm:p-4 rounded-2xl shadow-lg transition-all active:scale-95 shrink-0
            ${isRecording
              ? 'bg-red-500 text-white shadow-red-200 animate-pulse scale-105'
              : isProcessingVoice
              ? 'bg-amber-100 text-amber-600 shadow-amber-100'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }
            ${isMicDisabled && !isRecording ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          title={isRecording ? 'Nhấn để dừng & nhận dạng' : 'Nhấn để ghi âm (Whisper AI)'}
        >
          {isProcessingVoice
            ? <Loader2 size={20} className="animate-spin sm:w-6 sm:h-6" />
            : isRecording
            ? <MicOff size={20} className="sm:w-6 sm:h-6" />
            : <Mic size={20} className="sm:w-6 sm:h-6" />
          }
        </button>

        <div className="flex-1 relative group">
          <textarea
            ref={textareaRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={getPlaceholder()}
            rows={1}
            className={`w-full bg-slate-50 border-2 p-3 sm:p-4 pr-12 sm:pr-14 rounded-2xl focus:outline-none focus:border-brand-primary focus:bg-white transition-all text-slate-800 text-base font-bold placeholder:font-medium resize-none overflow-y-auto max-h-[120px] placeholder:text-slate-400
              ${isRecording ? 'border-red-300 bg-red-50/60' : 'border-transparent'}
            `}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!userInput.trim() || isAiTyping}
            className={`absolute right-1.5 sm:right-2 top-1.5 sm:top-2 p-1.5 sm:p-2 rounded-xl transition-all ${userInput.trim() && !isAiTyping ? 'bg-brand-primary text-white shadow-md active:scale-95' : 'text-slate-300'}`}
          >
            {isAiTyping ? <Loader2 size={18} className="animate-spin sm:w-6 sm:h-6" /> : <Send size={18} className="sm:w-6 sm:h-6" />}
          </button>
        </div>
      </div>

      {/* Whisper processing status */}
      {isProcessingVoice && (
        <p className="text-xs text-amber-600 text-center animate-pulse font-medium">
          {interimTranscript || '🎙️ Groq Whisper đang nhận dạng tiếng Pháp...'}
        </p>
      )}
    </div>
  );
};
