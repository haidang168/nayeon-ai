const videoId = 'xilkpei9oH0';
fetch(`https://www.youtube.com/watch?v=${videoId}`, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
  }
})
.then(r => r.text())
.then(html => {
  const captionsRegex = /"captionTracks":\[(.*?)\]/;
  const match = html.match(captionsRegex);
  if (match) {
    try {
      const tracks = JSON.parse(`[${match[1]}]`);
      const track = tracks.find(t => t.languageCode === 'fr') || tracks[0];
      const url = track.baseUrl;
      console.log('URL:', url);
      fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      })
      .then(r => {
        console.log('Status:', r.status);
        return r.text();
      })
      .then(xml => console.log('Snippet length:', xml.length, 'Snippet:', xml.substring(0, 100)));
    } catch (e) {
      console.error('Parse error', e);
    }
  } else {
    console.log('NO_CAPTIONS');
  }
})
.catch(console.error);
