import { useCallback, useState } from 'react';
import { articleKey, storage } from '../../shared/storage.js';

const READ_ARTICLES_KEY = 'inh_read_articles';
const MAX_READ_ARTICLES = 3000;

function loadReadKeys() {
  const saved = storage.get(READ_ARTICLES_KEY, []);
  return new Set(Array.isArray(saved) ? saved.filter(key => typeof key === 'string' && key) : []);
}

export function useReadArticles() {
  const [readKeys, setReadKeys] = useState(loadReadKeys);

  const toggleReadArticle = useCallback(article => {
    const key = articleKey(article);
    if (!key) return;

    setReadKeys(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else {
        next.add(key);
        while (next.size > MAX_READ_ARTICLES) next.delete(next.values().next().value);
      }
      storage.set(READ_ARTICLES_KEY, [...next]);
      return next;
    });
  }, []);

  return { readKeys, toggleReadArticle };
}
