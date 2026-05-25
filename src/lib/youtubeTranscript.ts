/**
 * YouTube Transcript Fetcher
 * 
 * Fetches transcript/subtitles from YouTube videos via Vite dev server proxy.
 * This avoids CORS issues since the proxy runs server-side.
 * 
 * Flow: Client → Vite Proxy (/api/yt-transcript) → YouTube → Parse → Return
 */

export interface TranscriptSegment {
  text: string;
  start: number;   // seconds
  duration: number; // seconds
}

export interface DictationLesson {
  id: string;
  videoId: string;
  title: string;
  sentences: DictationSentence[];
  thumbnailUrl: string;
  savedAt: number; // timestamp
  vocabulary?: Array<{word: string; meaning: string}>;
}

export interface DictationSentence {
  id: string;
  text: string;
  translation?: string;
  startTime: number;
  endTime: number;
  videoId?: string;
}

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Fetch transcript from YouTube video via our Vite proxy
 */
export async function fetchYouTubeTranscript(videoId: string, lang: string = 'fr'): Promise<TranscriptSegment[]> {
  const response = await fetch(`/api/yt-transcript?videoId=${videoId}&lang=${lang}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to fetch transcript: ${response.status}`);
  }
  
  const data = await response.json();
  return data.segments;
}

/**
 * Fetch video info (title, thumbnail) via our Vite proxy
 */
export async function fetchVideoInfo(videoId: string): Promise<{ title: string; thumbnailUrl: string }> {
  const response = await fetch(`/api/yt-info?videoId=${videoId}`);
  
  if (!response.ok) {
    return {
      title: `YouTube Video (${videoId})`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }
  
  return await response.json();
}

/**
 * Merge short transcript segments into full sentences.
 * YouTube often splits sentences into tiny fragments — this merges them
 * into natural sentence boundaries.
 * 
 * Handles apostrophe edge cases: YouTube auto-captions frequently split
 * contractions across segment boundaries (e.g., "I don" + "'t know").
 * This function rejoins them properly.
 */
export function mergeSegmentsIntoSentences(segments: TranscriptSegment[], videoId?: string): DictationSentence[] {
  if (segments.length === 0) return [];

  // Pre-process: fix overlapping segments (YouTube often pads duration for visual display)
  const cleanSegments: TranscriptSegment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = { ...segments[i] };
    if (i < segments.length - 1) {
      const nextSeg = segments[i + 1];
      // If current segment duration extends into next segment, truncate it
      if (seg.start + seg.duration > nextSeg.start) {
        if (nextSeg.start > seg.start) {
          seg.duration = nextSeg.start - seg.start;
        }
      }
    }
    cleanSegments.push(seg);
  }

  // Pre-process: Rejoin segments split at apostrophe boundaries.
  // YouTube auto-captions often split contractions like:
  //   "I don" + "'t know" → should become "I don't know"
  //   "c" + "'est la vie" → should become "c'est la vie"
  //   "l" + "'homme" → should become "l'homme"
  const rejoinedSegments: TranscriptSegment[] = [];
  for (let i = 0; i < cleanSegments.length; i++) {
    const seg = { ...cleanSegments[i] };
    
    // Look ahead: if next segment starts with apostrophe (straight or curly), merge it into this one
    while (i + 1 < cleanSegments.length && /^[''ʼ]/.test(cleanSegments[i + 1].text.trim())) {
      const nextSeg = cleanSegments[i + 1];
      seg.text = seg.text.trimEnd() + nextSeg.text.trimStart();
      seg.duration = (nextSeg.start + nextSeg.duration) - seg.start;
      i++;
    }
    
    rejoinedSegments.push(seg);
  }

  // Pass 1: Split segments that contain sentence-ending punctuation or pauses in the middle
  const fineSegments: TranscriptSegment[] = [];
  for (const seg of rejoinedSegments) {
    let text = seg.text.replace(/\n/g, ' ').trim();
    if (!text) continue;
    
    // Normalize curly/smart apostrophes to straight apostrophe for consistency
    text = text.replace(/[''ʼ]/g, "'");
    
    // Split on sentence-ending punctuation OR commas/colons followed by space.
    // Use a more careful regex that avoids splitting inside contractions:
    // Only split on comma/semicolon/colon when NOT preceded by an apostrophe-based contraction.
    const parts = text.split(/(?<=[.!?。！？…])\s+|(?<=[,;:])\s+(?=[A-ZÀ-Ÿa-zà-ÿ])/);
    
    if (parts.length > 1) {
      let currentStart = seg.start;
      const totalChars = parts.reduce((sum, p) => sum + p.length, 0);
      
      for (const part of parts) {
        if (!part.trim()) continue;
        const ratio = part.length / totalChars;
        const partDur = seg.duration * ratio;
        fineSegments.push({
          text: part,
          start: currentStart,
          duration: partDur
        });
        currentStart += partDur;
      }
    } else {
      fineSegments.push({ ...seg, text });
    }
  }

  // Pass 2: Merge segments into sentences or smaller chunks
  const sentences: DictationSentence[] = [];
  let buffer = '';
  let startTime = 0;
  let endTime = 0;

  const flushBuffer = () => {
    let finalText = buffer.trim();
    // Final cleanup: fix any remaining spaces before apostrophes (e.g., "don 't" → "don't")
    finalText = finalText.replace(/\s+([''ʼ'])/g, '$1');
    if (finalText.length > 0) {
      sentences.push({
        id: `s-${sentences.length}`,
        text: finalText,
        startTime: Math.round(startTime * 10) / 10,
        endTime: Math.round(endTime * 10) / 10,
        ...(videoId ? { videoId } : {}),
      });
    }
    buffer = '';
  };

  for (let i = 0; i < fineSegments.length; i++) {
    const seg = fineSegments[i];

    if (!buffer) {
      buffer = seg.text;
      startTime = seg.start;
      endTime = seg.start + seg.duration;
    } else {
      const wordsCount = buffer.trim().split(/\s+/).length;
      const nextWordsCount = seg.text.trim().split(/\s+/).length;

      // If next segment starts with apostrophe, join without space (contraction continuation)
      const startsWithApostrophe = /^[''ʼ']/.test(seg.text.trim());

      // Flush at sentence-ending punctuation (always)
      const isSentenceEnd = /[.!?。！？…]$/.test(buffer.trim());

      // Flush at comma/semicolon/colon if we already have 4+ words (natural phrase boundary)
      const isPhraseEnd = /[,;:]$/.test(buffer.trim()) && wordsCount >= 4;

      // Hard cap: don't let any chunk exceed 8 words
      const wouldExceedCap = wordsCount + nextWordsCount > 8;

      if (startsWithApostrophe) {
        // Contraction continuation: join without space
        buffer = buffer.trimEnd() + seg.text.trimStart();
        endTime = seg.start + seg.duration;
      } else if (isSentenceEnd || isPhraseEnd || wouldExceedCap) {
        flushBuffer();
        buffer = seg.text;
        startTime = seg.start;
        endTime = seg.start + seg.duration;
      } else {
        buffer += ' ' + seg.text;
        endTime = seg.start + seg.duration;
      }
    }
  }

  if (buffer) {
    flushBuffer();
  }

  return sentences;
}

/**
 * Common French filler / interjection words that are not useful for dictation practice.
 * These are matched case-insensitively against the entire sentence text.
 */
const FILLER_PATTERNS = new Set([
  'oui', 'non', 'ah', 'oh', 'euh', 'hein', 'bon', 'bah', 'bof',
  'voilà', 'alors', 'donc', 'ok', 'ouais', 'allez', 'tiens',
  'merci', 'bonjour', 'salut', 'bonsoir', 'au revoir', 'ciao',
  'ah bon', 'ah oui', 'ah non', 'et voilà', 'c\'est ça',
  'exactement', 'absolument', 'd\'accord', 'bien sûr',
]);

/**
 * Pre-filter sentences using code-based heuristics to remove junk
 * BEFORE sending to AI. This reduces noise and saves AI tokens.
 *
 * Rules:
 * - Remove sentences with < 3 words or > 20 words
 * - Remove pure filler/interjections
 * - Remove sentences with > 30% numbers/special characters
 * - Remove sentences where speech rate > 6 words/second (too fast for shadowing)
 * - Remove sentences with duration < 0.8s (noise)
 */
export function preFilterSentences(sentences: DictationSentence[]): DictationSentence[] {
  return sentences.filter(s => {
    const text = s.text.trim();
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // 1. Word count bounds
    if (wordCount < 3 || wordCount > 20) return false;

    // 2. Duration too short (noise / artifacts)
    const duration = s.endTime - s.startTime;
    if (duration < 0.8) return false;

    // 3. Speech rate too fast for shadowing (> 6 words/sec)
    if (duration > 0 && wordCount / duration > 6) return false;

    // 4. Pure filler sentence (entire text matches a known filler)
    const lower = text.toLowerCase().replace(/[.,!?;:'"()]/g, '').trim();
    if (FILLER_PATTERNS.has(lower)) return false;

    // 5. Too many numbers/special characters (> 30% of chars)
    const specialCount = (text.match(/[0-9@#$%^&*+=<>{}[\]|\\~`]/g) || []).length;
    if (text.length > 0 && specialCount / text.length > 0.3) return false;

    return true;
  });
}
