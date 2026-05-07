import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const videoId = req.query.videoId as string;
  const lang = (req.query.lang as string) || 'fr';

  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId parameter' });
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
      return res.status(404).json({ error: 'Video này không có phụ đề. Hãy thử video khác có subtitle.' });
    }

    const segments = transcript.map((seg: any) => ({
      text: seg.text?.replace(/\n/g, ' ').trim() || '',
      start: (seg.offset || 0) / 1000,
      duration: (seg.duration || 0) / 1000,
    })).filter((seg: any) => seg.text.length > 0);

    return res.status(200).json({ segments, language: lang });

  } catch (err: any) {
    console.error('[YT-API] Error:', err.message);
    const isNoTranscript = err.message?.includes('Transcript') || err.message?.includes('disabled');
    return res.status(isNoTranscript ? 404 : 500).json({
      error: isNoTranscript
        ? 'Video này không có phụ đề hoặc transcript bị tắt. Hãy thử video khác.'
        : (err.message || 'Lỗi khi lấy transcript từ YouTube')
    });
  }
}
