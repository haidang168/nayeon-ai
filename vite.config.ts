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

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), basicSsl(), youtubeProxyPlugin()],
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
