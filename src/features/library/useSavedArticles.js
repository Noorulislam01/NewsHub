import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../shared/supabase/client.js';
import { articleKey, loadSavedArticles, storage, toggleSavedArticle } from '../../shared/storage.js';

const TABLE = 'saved_articles';
const GUEST_KEY = 'dnh_saved_articles';
const accountCacheKey = userId => `dnh_saved_articles_${userId}`;
const COLUMNS = 'article_url,title,publisher,category,published_at,image_url,article_data,saved_at';

function uniqueArticles(...lists) {
  const seen = new Set();
  return lists.flat().filter(article => {
    const key = articleKey(article);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function articleFromRow(row) {
  const details = row.article_data && typeof row.article_data === 'object' ? row.article_data : {};
  const publishedAt = row.published_at ? Date.parse(row.published_at) : details.date;
  return {
    ...details,
    link: row.article_url,
    title: row.title || details.title || '',
    pub: row.publisher || details.pub || '',
    cats: Array.isArray(details.cats) && details.cats.length ? details.cats : (row.category ? [row.category] : []),
    date: Number.isFinite(publishedAt) ? publishedAt : undefined,
    img: row.image_url || details.img || '',
    summary: details.summary || ''
  };
}

function rowFromArticle(article, userId) {
  if (!article.link) throw new Error('This article has no publisher link and cannot be saved to your account.');
  const timestamp = article.date ? new Date(article.date) : null;
  return {
    user_id: userId,
    article_url: article.link,
    title: article.title || 'Untitled article',
    publisher: article.pub || '',
    category: article.cats?.[0] || '',
    published_at: timestamp && Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : null,
    image_url: article.img || '',
    article_data: article
  };
}

async function fetchAccountArticles(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(articleFromRow);
}

export function useSavedArticles(auth) {
  const [savedArticles, setSavedArticles] = useState(loadSavedArticles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const savedRef = useRef(savedArticles);
  const activeUserId = useRef(auth.user?.id || null);
  const requestId = useRef(0);
  const mutationQueue = useRef(Promise.resolve());
  savedRef.current = savedArticles;

  useEffect(() => {
    if (auth.loading) return;
    const request = ++requestId.current;
    const userId = auth.user?.id || null;
    activeUserId.current = userId;
    setError('');

    if (!userId) {
      const guestArticles = loadSavedArticles();
      savedRef.current = guestArticles;
      setSavedArticles(guestArticles);
      setLoading(false);
      return;
    }

    const cached = storage.get(accountCacheKey(userId), []);
    savedRef.current = Array.isArray(cached) ? cached : [];
    setSavedArticles(savedRef.current);
    setLoading(true);

    async function loadLibrary() {
      try {
        const remote = await fetchAccountArticles(userId);
        if (request !== requestId.current) return;

        const guest = loadSavedArticles();
        let merged = uniqueArticles(remote, guest);
        if (guest.length) {
          const { error: migrationError } = await supabase
            .from(TABLE)
            .upsert(guest.map(article => rowFromArticle(article, userId)), { onConflict: 'user_id,article_url' });
          if (migrationError) throw migrationError;
          storage.set(GUEST_KEY, []);
          merged = uniqueArticles(guest, remote);
        }
        if (request !== requestId.current) return;
        savedRef.current = merged;
        setSavedArticles(merged);
        storage.set(accountCacheKey(userId), merged);
      } catch (loadError) {
        if (request !== requestId.current) return;
        setError(`Could not load saved articles from Supabase: ${loadError?.message || 'request failed'}`);
        const fallback = uniqueArticles(loadSavedArticles(), Array.isArray(cached) ? cached : []);
        savedRef.current = fallback;
        setSavedArticles(fallback);
      } finally {
        if (request === requestId.current) setLoading(false);
      }
    }

    loadLibrary();
  }, [auth.loading, auth.user?.id]);

  const saveArticle = useCallback(article => {
    const userId = activeUserId.current;
    const previous = savedRef.current;
    const wasSaved = previous.some(item => articleKey(item) === articleKey(article));
    const next = toggleSavedArticle(previous, article);
    savedRef.current = next;
    setSavedArticles(next);

    if (!userId) {
      storage.set(GUEST_KEY, next);
      return Promise.resolve();
    }

    storage.set(accountCacheKey(userId), next);
    mutationQueue.current = mutationQueue.current.then(async () => {
      try {
        if (wasSaved) {
          const { error: deleteError } = await supabase
            .from(TABLE)
            .delete()
            .eq('user_id', userId)
            .eq('article_url', article.link);
          if (deleteError) throw deleteError;
        } else {
          const { error: saveError } = await supabase
            .from(TABLE)
            .upsert(rowFromArticle(article, userId), { onConflict: 'user_id,article_url' });
          if (saveError) throw saveError;
        }
        if (activeUserId.current === userId) setError('');
      } catch (saveError) {
        if (activeUserId.current === userId) {
          setError(`Could not sync this saved article: ${saveError?.message || 'request failed'}`);
        }
      }
    });
    return mutationQueue.current;
  }, []);

  return { savedArticles, loading, error, saveArticle };
}
