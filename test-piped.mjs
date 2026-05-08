const urls = [
  'https://pipedapi.kavin.rocks/streams/xilkpei9oH0',
  'https://api.piped.projectsegfau.lt/streams/xilkpei9oH0',
  'https://piped-api.garudalinux.org/streams/xilkpei9oH0',
  'https://pipedapi.lunar.icu/streams/xilkpei9oH0',
  'https://api.piped.privacydev.net/streams/xilkpei9oH0',
  'https://piped-api.privacy.com.de/streams/xilkpei9oH0',
];

async function test() {
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        console.log('SUCCESS:', url, 'Subtitles:', data.subtitles?.length);
      } else {
        console.log('FAIL HTTP:', url, res.status);
      }
    } catch (e) {
      console.log('ERROR:', url, e.message);
    }
  }
}
test();
