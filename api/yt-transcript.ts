export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const videoId = url.searchParams.get('videoId');
  const lang = url.searchParams.get('lang') || 'fr';

  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Missing videoId parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { YoutubeTranscript } = await import('youtube-transcript');

    let transcript;
    try {
      transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
    } catch {
      console.log(`[YT-API] No ${lang} transcript, trying default...`);
      transcript = await YoutubeTranscript.fetchTranscript(videoId);
    }

    if (!transcript || transcript.length === 0) {
      return new Response(JSON.stringify({ error: 'Video này không có phụ đề. Hãy thử video khác có subtitle.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const segments = transcript.map((seg: any) => ({
      text: seg.text?.replace(/\n/g, ' ').trim() || '',
      start: (seg.offset || 0) / 1000,
      duration: (seg.duration || 0) / 1000,
    })).filter((seg: any) => seg.text.length > 0);

    return new Response(JSON.stringify({ segments, language: lang }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[YT-API] Error:', err.message);
    const isNoTranscript = err.message?.includes('Transcript') || err.message?.includes('disabled');
    return new Response(JSON.stringify({
      error: isNoTranscript
        ? 'Video này không có phụ đề hoặc transcript bị tắt. Hãy thử video khác.'
        : (err.message || 'Lỗi khi lấy transcript từ YouTube')
    }), {
      status: isNoTranscript ? 404 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
