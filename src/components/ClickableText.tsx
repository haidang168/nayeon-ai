import React, { useCallback } from 'react';

interface ClickableTextProps {
  text: string;
  playAudio: (text: string, rate?: number) => void;
  className?: string;
  wordClassName?: string;
}

/**
 * Renders text as individually clickable words.
 * Tapping any word plays its pronunciation via Gemini TTS.
 * 
 * Performance: Zero API calls on render. TTS only fires on user tap.
 * Punctuation is kept attached to its word for natural display.
 */
export const ClickableText: React.FC<ClickableTextProps> = React.memo(({ 
  text, 
  playAudio, 
  className = '',
  wordClassName = ''
}) => {
  const handleWordClick = useCallback((word: string) => {
    // Strip punctuation for cleaner pronunciation
    const clean = word.replace(/[.,!?;:"()«»\-—…]/g, '').trim();
    if (clean.length > 0) {
      playAudio(clean, 1.0);
    }
  }, [playAudio]);

  if (!text) return null;

  const words = text.split(/(\s+)/); // Split but keep whitespace tokens

  return (
    <span className={className}>
      {words.map((segment, i) => {
        // If it's whitespace, render as-is
        if (/^\s+$/.test(segment)) {
          return <span key={i}>{segment}</span>;
        }
        // Render clickable word
        return (
          <span
            key={i}
            onClick={() => handleWordClick(segment)}
            className={`cursor-pointer rounded px-[1px] transition-colors duration-150 hover:bg-blue-100 hover:text-blue-700 active:bg-blue-200 active:scale-95 ${wordClassName}`}
            title="Nhấn để nghe phát âm"
          >
            {segment}
          </span>
        );
      })}
    </span>
  );
});

ClickableText.displayName = 'ClickableText';
