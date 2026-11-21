// Shared Vercel/Netlify handler: fetches a news article and returns a short AI summary.
// Uses GEMINI_API_KEY first, then configured AI Gateway or Anthropic credentials as fallbacks.
// Optional: GEMINI_MODEL (default below), ALLOWED_ORIGIN (the deployed site origin).

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const CLAUDE_MODEL = 'claude-haiku-5-5';
const MAX_ARTICLE_CHARS = 9000; // shorter input = fewer tokens per minute used

const json = (code, body) => new Response(JSON.stringify(body), {
  status: code,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

function isSafeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (!/^https?:$/.test(u.protocol)) return false;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h)) return false;
  if (h.includes(':')) return false; // IPv6 literals
  return true;
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function extractText(html) {
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, ' ');
  // Prefer an <article> block if the page has one
  const art = html.match(/<article[\s\S]*?<\/article>/i);
  const scope = art ? art[0] : html;
  const paras = [...scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter(t => t.length > 40);
  return paras.join('\n\n').slice(0, MAX_ARTICLE_CHARS);
}

async function fetchArticle(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsHubSummarizer/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    if (!res.ok) return '';
    const type = res.headers.get('content-type') || '';
    if (!type.includes('html')) return '';
    return extractText(await res.text());
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

class ProviderError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function postJson(url, headers, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new ProviderError(res.status, await res.text());
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function geminiProvider(name, base, headers) {
  return {
    name,
    async run(system, userMsg) {
      const out = await postJson(
        `${base}/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
        headers,
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: userMsg }] }],
          generationConfig: { maxOutputTokens: 1200, temperature: 0.3 }
        }
      );
      const parts = out?.candidates?.[0]?.content?.parts || [];
      return parts.filter(p => p.text && !p.thought).map(p => p.text).join('\n').trim();
    }
  };
}

function claudeProvider(name, url, headers) {
  return {
    name,
    async run(system, userMsg) {
      const out = await postJson(url, { 'anthropic-version': '2023-06-01', ...headers }, {
        model: CLAUDE_MODEL, max_tokens: 500, system, messages: [{ role: 'user', content: userMsg }]
      });
      return (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    }
  };
}

// Order: your own Gemini key first, then Netlify AI Gateway (Gemini, then Claude) as backups.
function buildProviders() {
  const env = process.env;
  const list = [];
  const trim = u => String(u).replace(/\/+$/, '');
  if (env.GEMINI_API_KEY) {
    list.push(geminiProvider('Gemini', trim(env.GOOGLE_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com'),
      { 'x-goog-api-key': env.GEMINI_API_KEY }));
  }
  if (env.NETLIFY_AI_GATEWAY_URL && env.NETLIFY_AI_GATEWAY_KEY) {
    const gw = trim(env.NETLIFY_AI_GATEWAY_URL);
    list.push(geminiProvider('AI Gateway Gemini', gw, { 'x-goog-api-key': env.NETLIFY_AI_GATEWAY_KEY }));
    list.push(claudeProvider('AI Gateway Claude', `${gw}/anthropic/v1/messages`,
      { authorization: `Bearer ${env.NETLIFY_AI_GATEWAY_KEY}` }));
  } else if (env.ANTHROPIC_API_KEY) {
    list.push(claudeProvider('Claude', `${trim(env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com')}/v1/messages`,
      { 'x-api-key': env.ANTHROPIC_API_KEY }));
  }
  return list;
}

export async function handleSummarize(req) {
  if (req.method === 'GET') return json(200, { ok: true, service: 'summary' });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed) {
    const origin = req.headers.get('origin') || '';
    if (origin !== allowed) return json(403, { error: 'Origin not allowed.' });
  }

  const providers = buildProviders();
  if (!providers.length) {
    return json(503, { error: 'No AI provider key is configured. Add GEMINI_API_KEY to this Vercel project for the Production environment, then redeploy.' });
  }

  let data;
  try { data = JSON.parse((await req.text()) || '{}'); } catch { return json(400, { error: 'Bad request.' }); }
  const url = String(data.url || '');
  const title = String(data.title || '').slice(0, 400);
  const snippet = String(data.snippet || '').slice(0, 1500);
  if (!isSafeUrl(url)) return json(400, { error: 'Invalid article link.' });

  const fullText = await fetchArticle(url);
  const haveFull = fullText.length > 600;
  const material = haveFull ? fullText : [title, snippet].filter(Boolean).join('\n\n');
  if (material.length < 40) return json(422, { error: 'Could not read this article.' });

  const system =
    'You summarize news articles for a busy reader. Write a clear, neutral summary of 4 to 6 short ' +
    'bullet points (each starting with "• "), covering who, what, when, where and why it matters. ' +
    'Use only facts present in the text provided. Do not add opinions or outside information. ' +
    'Reply in the same language as the article. Output only the bullets.';

  const userMsg =
    `Headline: ${title}\n\n` +
    (haveFull ? 'Article text:\n' : 'Only a short snippet is available:\n') +
    material;

  // Try each provider in turn. If one is rate limited (429) or failing, fall back to the next,
  // so a busy free-tier key doesn't stop summaries from working.
  let sawRateLimit = false;
  let lastFailure = null;
  for (const p of providers) {
    try {
      const text = await p.run(system, userMsg);
      if (text) return json(200, { summary: text, basis: haveFull ? 'full' : 'snippet' });
      console.error(p.name, 'returned an empty summary');
    } catch (e) {
      if (e.status === 429) sawRateLimit = true;
      lastFailure = { provider: p.name, status: e.status || 0 };
      console.error(p.name, 'failed', e.status || '', String(e.message || e).slice(0, 300));
    }
  }
  let error = 'The summary service returned an error.';
  if (sawRateLimit) error = 'Too many summaries right now. Please try again in a minute.';
  else if (lastFailure?.provider === 'Gemini' && [401, 403].includes(lastFailure.status)) {
    error = 'Gemini rejected the API key. Check GEMINI_API_KEY in Vercel, enable it for Production, and confirm its restrictions allow the Gemini API.';
  } else if (lastFailure?.provider === 'Gemini' && lastFailure.status === 404) {
    error = 'Gemini could not find the configured model. Check GEMINI_MODEL in Vercel; the default is gemini-3.8-flash.';
  } else if (lastFailure?.provider === 'Gemini' && lastFailure.status === 400) {
    error = 'Gemini rejected the request. Check the Vercel function logs for details.';
  }
  return json(sawRateLimit ? 429 : 502, {
    error
  });
}

// Vercel's Web Handler format also keeps this implementation usable by Netlify.
export default { fetch: handleSummarize };
