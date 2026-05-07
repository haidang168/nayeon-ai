import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const videoId = req.query.videoId as string;

  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId' });
  }

  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );

    if (oembedRes.ok) {
      const data = await oembedRes.json();
      return res.status(200).json({
        title: data.title || `Video ${videoId}`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      });
    }
  } catch {
    // Fall through to default
  }

  return res.status(200).json({
    title: `YouTube Video (${videoId})`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  });
}
