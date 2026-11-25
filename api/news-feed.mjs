// Same-origin RSS fetcher for Vercel. This avoids relying on public CORS relays.
const ALLOWED_HOSTS = [
  'hindustantimes.com', 'thehindu.com', 'indianexpress.com', 'indiatimes.com',
  'feedburner.com', 'feedproxy.google.com', 'indiatoday.in', 'thewire.in',
  'theprint.in', 'newindianexpress.com', 'deccanherald.com', 'tribuneindia.com',
  'livemint.com', 'business-standard.com', 'news18.com', 'firstpost.com',
  'bhaskar.com', 'abplive.com', 'orfonline.org', 'cfr.org', 'techcrunch.com',
  'theverge.com', 'wired.com', 'technologyreview.com', 'arstechnica.com',
  'sciencedaily.com', 'medicalxpress.com', 'statnews.com', 'the-scientist.com',
  'nature.com', 'news.google.com', 'maktoobmedia.com', 'muslimmirror.com',
  'twocircles.net', 'millattimes.com', 'clarionindia.net', 'indiatomorrow.net',
  'ummid.com', 'siasat.com', 'milligazette.com', 'munsifdaily.com',
  'theaawaz.com', 'thequint.com', 'newslaundry.com', 'thenewsminute.com',
  'caravanmagazine.in', 'newsclick.in'
];

function response(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers }
  });
}

function isAllowed(url) {
  return url.protocol === 'https:' && ALLOWED_HOSTS.some(host =>
    url.hostname === host || url.hostname.endsWith(`.${host}`)
  );
}

async function fetchFeed(target) {
  let current = target;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let upstream;
    try {
      upstream = await fetch(current, {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OneNewsHub/1.0; +https://newshub-delta-nine.vercel.app)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-IN,en;q=0.9'
      }
      });
    } finally {
      clearTimeout(timeout);
    }

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get('location');
      if (!location || redirectCount === 3) return response('too many or invalid upstream redirects', 502);
      const next = new URL(location, current);
      if (!isAllowed(next)) return response('redirect host not allowed', 403);
      current = next.toString();
      continue;
    }

    return response(upstream.body, upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/xml',
      // Client-side cache owns freshness; this lets an explicit Refresh bypass it.
      'Cache-Control': 'no-store'
    });
  }

  return response('upstream request failed', 502);
}

export default {
  async fetch(req) {
    if (req.method !== 'GET') return response('method not allowed', 405);
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin) return response('origin not allowed', 403);

    let target;
    try {
      target = new URL(req.url).searchParams.get('url');
      if (!target) return response('missing ?url=', 400);
      const url = new URL(target);
      if (!isAllowed(url)) return response('host not allowed', 403);
      target = url.toString();
    } catch {
      return response('bad url', 400);
    }

    try {
      return await fetchFeed(target);
    } catch (error) {
      console.error('News feed proxy failed:', error?.message || error);
      return response('upstream request failed', 502);
    }
  }
};
