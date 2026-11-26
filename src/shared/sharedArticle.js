const MAX_SHARED_PAYLOAD = 12_000;

function toBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function safeText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function safeWebUrl(value, maxLength) {
  const candidate = safeText(value, maxLength);
  try {
    const parsed = new URL(candidate);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function normalizeSharedArticle(value) {
  if (!value || typeof value !== 'object') return null;
  const title = safeText(value.title, 400);
  const pub = safeText(value.pub, 120);
  const link = safeWebUrl(value.link, 2000);
  if (!title || !pub || !link) return null;

  return {
    title,
    pub,
    link,
    date: safeText(value.date, 80),
    summary: safeText(value.summary, 1600),
    img: safeWebUrl(value.img, 2000),
    cats: Array.isArray(value.cats) ? value.cats.slice(0, 4).map(category => safeText(category, 80)).filter(Boolean) : []
  };
}

export function createSharedArticleUrl(article) {
  const normalized = normalizeSharedArticle(article);
  if (!normalized) throw new Error('This article does not have a valid publisher link.');
  const payload = toBase64Url(JSON.stringify(normalized));
  if (payload.length > MAX_SHARED_PAYLOAD) throw new Error('This article is too large to share.');

  const url = new URL('/', window.location.origin);
  url.searchParams.set('shared', payload);
  return url.toString();
}

export function readSharedArticle() {
  const payload = new URLSearchParams(window.location.search).get('shared');
  if (!payload || payload.length > MAX_SHARED_PAYLOAD) return null;
  try {
    return normalizeSharedArticle(JSON.parse(fromBase64Url(payload)));
  } catch {
    return null;
  }
}
