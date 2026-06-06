import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

/**
 * Vite plugin: YouTube Transcript Proxy
 * 
 * Uses the `youtube-transcript` npm package to reliably fetch transcripts
 * from YouTube videos server-side, bypassing CORS restrictions.
 * 
 * Endpoints:
 *   /api/yt-transcript?videoId=xxx&lang=fr  → Returns transcript segments
 *   /api/yt-info?videoId=xxx               → Returns video title + thumbnail
 */
function youtubeProxyPlugin(): Plugin {
  return {
    name: 'youtube-proxy',
    configureServer(server) {
      // ─── Transcript endpoint ───
      server.middlewares.use('/api/yt-transcript', async (req, res) => {
        const fullUrl = 'http://localhost/api/yt-transcript' + (req.url || '');
        const url = new URL(fullUrl);
        const videoId = url.searchParams.get('videoId');
        const lang = url.searchParams.get('lang') || 'fr';
        console.log(`[YT-Proxy] Transcript request: videoId=${videoId}, lang=${lang}`);

        if (!videoId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing videoId parameter' }));
          return;
        }

        try {
          // Dynamic import since youtube-transcript is ESM
          const { YoutubeTranscript } = await import('youtube-transcript');
          
          let transcript;
          try {
            // Try with specified language first
            transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
          } catch {
            // Fallback to any available language
            console.log(`[YT-Proxy] No ${lang} transcript, trying default...`);
            transcript = await YoutubeTranscript.fetchTranscript(videoId);
          }

          if (!transcript || transcript.length === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Video này không có phụ đề. Hãy thử video khác có subtitle.' }));
            return;
          }

          // Convert to our format: offset is in ms, convert to seconds
          const segments = transcript.map((seg: any) => ({
            text: seg.text?.replace(/\n/g, ' ').trim() || '',
            start: (seg.offset || 0) / 1000,
            duration: (seg.duration || 0) / 1000,
          })).filter((seg: any) => seg.text.length > 0);

          console.log(`[YT-Proxy] Got ${segments.length} segments`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ segments, language: lang }));

        } catch (err: any) {
          console.error('[YT-Proxy] Error:', err.message);
          const isNoTranscript = err.message?.includes('Transcript') || err.message?.includes('disabled');
          res.writeHead(isNoTranscript ? 404 : 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: isNoTranscript 
              ? 'Video này không có phụ đề hoặc transcript bị tắt. Hãy thử video khác.'
              : (err.message || 'Lỗi khi lấy transcript từ YouTube')
          }));
        }
      });

      // ─── Video info endpoint ───
      server.middlewares.use('/api/yt-info', async (req, res) => {
        const fullUrl = 'http://localhost/api/yt-info' + (req.url || '');
        const url = new URL(fullUrl);
        const videoId = url.searchParams.get('videoId');

        if (!videoId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing videoId' }));
          return;
        }

        try {
          const oembedRes = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
          );
          
          if (oembedRes.ok) {
            const data = await oembedRes.json();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              title: data.title || `Video ${videoId}`,
              thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              title: `YouTube Video (${videoId})`,
              thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            }));
          }
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            title: `YouTube Video (${videoId})`,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          }));
        }
      });
    },
  };
}

/**
 * Vite plugin: TTS Proxy (Multi-Provider)
 * 
 * Routes TTS through the PC server for mobile clients.
 * Fallback chain: ElevenLabs → Edge TTS → Gemini TTS
 * 
 * Endpoint:
 *   POST /api/tts  { text: string, voiceName?: string }
 *   Response:       { audio: string, format: "mp3" | "pcm" }
 */
function ttsProxyPlugin(config: { geminiKeys: string; elevenLabsKey: string }): Plugin {
  const geminiKeys = config.geminiKeys.split(',').map(k => k.trim()).filter(k => k);
  const elevenLabsKey = config.elevenLabsKey;

  // ─── Provider 1: ElevenLabs (best quality, needs API key) ───
  async function tryElevenLabs(text: string): Promise<{ audio: string; format: string } | null> {
    if (!elevenLabsKey) return null;

    try {
      // Default multilingual voice — "Rachel" works great for French
      const voiceId = '21m00Tcm4TlvDq8ikWAM';
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_flash_v2_5',  // Fast + multilingual
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.status === 401) {
        console.warn('[TTS] ElevenLabs: Invalid API key');
        return null;
      }
      if (response.status === 429) {
        console.warn('[TTS] ElevenLabs: Quota exceeded, falling back to Edge TTS');
        return null;
      }
      if (!response.ok) {
        console.warn('[TTS] ElevenLabs: HTTP', response.status);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      console.log(`[TTS] ✓ ElevenLabs: "${text.slice(0, 40)}..." (${Math.round(arrayBuffer.byteLength / 1024)}KB)`);
      return { audio: base64, format: 'mp3' };
    } catch (e: any) {
      console.warn('[TTS] ElevenLabs failed:', e?.message?.slice(0, 80));
      return null;
    }
  }

  // ─── Provider 2: Edge TTS (free, fast, reliable) ───
  async function tryEdgeTTS(text: string): Promise<{ audio: string; format: string } | null> {
    try {
      const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
      const tts = new MsEdgeTTS();
      await tts.setMetadata(
        'fr-FR-VivienneMultilingualNeural',  // Excellent French neural voice
        OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
      );

      const { audioStream } = await tts.toStream(text);

      // Collect stream into buffer with 8s timeout
      const audioChunks: Buffer[] = [];
      const audioPromise = new Promise<Buffer>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Edge TTS stream timeout')), 8000);
        audioStream.on('data', (chunk: Buffer) => audioChunks.push(chunk));
        audioStream.on('end', () => { clearTimeout(timeout); resolve(Buffer.concat(audioChunks)); });
        audioStream.on('error', (err: Error) => { clearTimeout(timeout); reject(err); });
      });

      const audioBuffer = await audioPromise;
      const base64 = audioBuffer.toString('base64');
      console.log(`[TTS] ✓ Edge TTS: "${text.slice(0, 40)}..." (${Math.round(audioBuffer.length / 1024)}KB)`);
      return { audio: base64, format: 'mp3' };
    } catch (e: any) {
      console.warn('[TTS] Edge TTS failed:', e?.message?.slice(0, 80));
      return null;
    }
  }

  // ─── Provider 3: Gemini TTS (existing fallback) ───
  async function tryGeminiTTS(text: string, voiceName: string): Promise<{ audio: string; format: string } | null> {
    if (geminiKeys.length === 0) return null;

    try {
      const { GoogleGenAI, Modality } = await import('@google/genai');
      const shuffled = [...geminiKeys].sort(() => Math.random() - 0.5);

      for (const key of shuffled.slice(0, 2)) {
        try {
          const client = new GoogleGenAI({ apiKey: key });
          const resultPromise = client.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: [{ parts: [{ text }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
            },
          });
          const result = await Promise.race([
            resultPromise,
            new Promise((_, rej) => setTimeout(() => rej(new Error('Gemini timeout')), 15000))
          ]) as any;
          const audio = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (audio) {
            console.log(`[TTS] ✓ Gemini: "${text.slice(0, 40)}..."`);
            return { audio, format: 'pcm' };
          }
        } catch (e: any) {
          console.warn('[TTS] Gemini key failed:', e?.message?.slice(0, 80));
        }
      }
    } catch (e: any) {
      console.warn('[TTS] Gemini import failed:', e?.message);
    }
    return null;
  }

  return {
    name: 'tts-proxy',
    configureServer(server) {
      server.middlewares.use('/api/tts', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString());
            const { text, voiceName = 'Kore' } = body;

            if (!text) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing text' }));
              return;
            }

            // Fallback chain: ElevenLabs → Edge TTS → Gemini
            const result =
              await tryElevenLabs(text) ||
              await tryEdgeTTS(text) ||
              await tryGeminiTTS(text, voiceName);

            if (result) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } else {
              console.error('[TTS] All providers failed for:', text.slice(0, 50));
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'All TTS providers failed' }));
            }
          } catch (e: any) {
            console.error('[TTS] Parse error:', e.message);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request body' }));
          }
        });
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      basicSsl(),
      youtubeProxyPlugin(),
      ttsProxyPlugin({
        geminiKeys: env.GEMINI_API_KEY || '',
        elevenLabsKey: env.ELEVENLABS_API_KEY || '',
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GROQ_API_KEY': JSON.stringify(env.GROQ_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

