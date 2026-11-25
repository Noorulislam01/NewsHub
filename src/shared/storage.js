function isQuotaError(error) {
  return error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014;
}

export function clearDisposableCaches() {
  try {
    const keysToRemove = [];
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index);
      if (key && (key.startsWith('inh_c_') || key.startsWith('inh_sum_'))) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => window.localStorage.removeItem(key));
  } catch {
    // Storage may be unavailable in private browsing or restricted contexts.
  }
}

export function setLocalStorageItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    if (!isQuotaError(error)) throw error;
    clearDisposableCaches();
    window.localStorage.setItem(key, value);
  }
}

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
      setLocalStorageItem(key, JSON.stringify(value));
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
