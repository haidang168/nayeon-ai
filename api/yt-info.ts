

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const videoId = url.searchParams.get('videoId');

  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Missing videoId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );

    if (oembedRes.ok) {
      const data = await oembedRes.json();
      return new Response(JSON.stringify({
        title: data.title || `Video ${videoId}`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch {
    // Fall through to default
  }

  return new Response(JSON.stringify({
    title: `YouTube Video (${videoId})`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
