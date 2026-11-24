export const storage = {
  get(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be unavailable in private browsing or quota-limited contexts.
    }
  }
};

export function articleKey(article) {
  return article.link || `${article.title || ''}|${article.pub || ''}`;
}

export function loadSavedArticles() {
  const saved = storage.get('dnh_saved_articles', []);
  return Array.isArray(saved) ? saved : [];
}


export function toggleSavedArticle(current, article) {
  const saved = Array.isArray(current) ? current : [];
  const key = articleKey(article);
  if (!key) return saved;
  return saved.some(item => articleKey(item) === key)
    ? saved.filter(item => articleKey(item) !== key)
    : [{ ...article, _t: undefined }, ...saved];
}
