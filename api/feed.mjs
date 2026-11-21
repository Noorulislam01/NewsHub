const ALLOWED_HOSTS = new Set(['mea.gov.in', 'www.mea.gov.in', 'news.google.com']);
const MAX_BYTES = 2 * 1024 * 1024;

const error = (status, message) => new Response(JSON.stringify({ error: message }), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

function allowed(url) {
  return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname.toLowerCase());
}

export async function handleFeed(req) {
  if (req.method !== 'GET') return error(405, 'Use GET.');
  let current;
  try {
    const raw = new URL(req.url).searchParams.get('url');
    if (!raw) return error(400, 'Feed URL is required.');
    current = new URL(raw);
  }
  catch { return error(400, 'Invalid feed URL.'); }
  if (!current || !allowed(current)) return error(403, 'Feed host is not allowed.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    let response;
    for (let redirects = 0; redirects <= 3; redirects++) {
      if (!allowed(current)) return error(403, 'Feed redirect host is not allowed.');
      response = await fetch(current, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NewsHubFeed/1.0)',
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
        }
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      if (!location || redirects === 3) return error(502, 'Feed redirect could not be followed.');
      current = new URL(location, current);
    }
    if (!response?.ok) return error(502, `Feed provider returned HTTP ${response?.status || 502}.`);
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BYTES) return error(502, 'Feed response is too large.');
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=120'
      }
    });
  } catch (e) {
    return error(502, e?.name === 'AbortError' ? 'Feed request timed out.' : 'Feed provider could not be reached.');
  } finally {
    clearTimeout(timer);
  }
}

export default { fetch: handleFeed };
