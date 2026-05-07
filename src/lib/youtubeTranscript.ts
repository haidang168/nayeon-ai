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

  // Pass 1: Split segments that contain sentence-ending punctuation (. ! ?) in the middle
  const fineSegments: TranscriptSegment[] = [];
  for (const seg of cleanSegments) {
    const text = seg.text.replace(/\n/g, ' ').trim();
    if (!text) continue;
    
    // Only split on sentence-ending punctuation (. ! ? …) followed by space
    const parts = text.split(/(?<=[.!?。！？…])\s+/);
    
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

  // Pass 2: Merge segments into full sentences — ONLY split at sentence-ending punctuation (. ! ? …)
  const sentences: DictationSentence[] = [];
  let buffer = '';
  let startTime = 0;
  let endTime = 0;

  const flushBuffer = () => {
    const finalText = buffer.trim();
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
      // Only stop at real sentence endings: . ! ? …
      const isSentenceEnd = /[.!?。！？…]$/.test(buffer.trim());

      if (isSentenceEnd) {
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
