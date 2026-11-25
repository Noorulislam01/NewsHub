import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { classifyArticle } from './classification.js';
import { createNewsService } from './newsService.js';
import { CATEGORIES, SOURCES } from './newsSources.js';
import { storage } from '../../shared/storage.js';

const STOP_WORDS = new Set('the a an of to in on for and or at by with is are was be as from after over says said new how why what who will its it this that into amid'.split(' '));
const ACTIVE_CATEGORY_KEY = 'inh_active_category';
const cache = storage;

function tokens(title) {
  return new Set(String(title || '').toLowerCase().replace(/[^a-z0-9\u0900-\u097f ]/g, ' ').split(/\s+/).filter(word => word.length > 2 && !STOP_WORDS.has(word)));
}

function similarity(left, right) {
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection++;
  const union = left.size + right.size - intersection;
  return union ? intersection / union : 0;
}

function groupStories(articles) {
  const groups = [];
  for (const article of articles) {
    const articleTokens = tokens(article.title);
    const match = articleTokens.size >= 4 && groups.find(group =>
      group.main.pub !== article.pub &&
      !group.others.some(other => other.pub === article.pub) &&
      similarity(group.tokens, articleTokens) >= 0.6
    );
    if (match) match.others.push(article);
    else groups.push({ main: article, others: [], tokens: articleTokens });
  }
  return groups.map(({ main, others }) => ({ main, others }));
}

function categoryButtons(articles, preferences, activeCategory, showingSaved) {
  if (showingSaved) return [];
  const selected = preferences.cats.filter(category => category !== 'All News');
  let categories = selected;
  if (!selected.length) {
    const hours = preferences.range === 'latest' ? 0 : Number(preferences.range);
    const now = Date.now();
    const available = new Set();
    articles
      .filter(article => preferences.papers.includes(article.pid) && (!hours || (article.date && now - article.date <= hours * 36e5)))
      .forEach(article => article.cats.forEach(category => {
        if (CATEGORIES.includes(category) && category !== 'All News') available.add(category);
      }));
    categories = CATEGORIES.filter(category => available.has(category));
  }
  const showReset = !selected.length || selected.length > 1;
  return [
    ...(showReset ? [{ label: selected.length ? 'All selected' : 'All News', value: '', active: activeCategory === null }] : []),
    ...categories.map(category => ({
      label: category,
      value: category,
      active: activeCategory === category || (!activeCategory && selected.length === 1)
    }))
  ];
}

export function useNewsFeed(preferences, search, savedArticles) {
  const preferencesRef = useRef(preferences);
  const requestId = useRef(0);
  const initialLoadStarted = useRef(false);
  const activeRef = useRef(false);
  const newsService = useRef(null);
  const updatedRef = useRef('never');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [notes, setNotes] = useState([]);
  const [feedStatus, setFeedStatus] = useState({ loaded: '0', updated: 'never' });
  const [activeCategory, setActiveCategory] = useState(() => {
    const saved = storage.get(ACTIVE_CATEGORY_KEY, null);
    const selectedCategories = preferences.cats.filter(category => category !== 'All News');
    return CATEGORIES.includes(saved) && (!selectedCategories.length || selectedCategories.includes(saved))
      ? saved
      : null;
  });
  const [showingSaved, setShowingSaved] = useState(false);

  preferencesRef.current = preferences;
  newsService.current ||= createNewsService({ cache, getRange: () => preferencesRef.current.range });

  useEffect(() => {
    storage.set(ACTIVE_CATEGORY_KEY, activeCategory);
  }, [activeCategory]);

  const reload = useCallback(async (force = false, nextPreferences) => {
    const id = ++requestId.current;
    const currentPreferences = nextPreferences || preferencesRef.current;
    preferencesRef.current = currentPreferences;
    const sources = SOURCES.filter(source => currentPreferences.papers.includes(source.id));
    const bySource = {};
    let updated = updatedRef.current;
    setNotes([]);
    setLoading(true);
    setLoadingMessage('');

    const appendNote = (message, info = false) => setNotes(current => [...current, { id: `${Date.now()}-${Math.random()}`, message, info }]);
    const updateArticles = () => setArticles(sources.flatMap(source => bySource[source.id] || []));
    const tagArticles = (source, items) => items.map(article => ({
      ...article,
      pid: source.id,
      pub: source.name,
      cats: classifyArticle(article)
    }));

    if (!sources.length) {
      setArticles([]);
      setFeedStatus({ loaded: '0', updated });
      appendNote('Select at least one newspaper, then press Show News.', true);
      setLoading(false);
      return;
    }

    if (!navigator.onLine) appendNote('You appear to be offline. Showing cached news where available.', true);

    // Show the last fetched set immediately, then replace/update it as each feed finishes.
    for (const source of sources) {
      const previous = cache.get(`inh_c_${source.id}`, null);
      if (Array.isArray(previous?.items)) bySource[source.id] = tagArticles(source, previous.items);
    }
    updateArticles();

    let succeeded = 0;
    let finished = 0;
    setFeedStatus({ loaded: `0/${sources.length}`, updated });
    setLoadingMessage(`Updating news… 0/${sources.length} sources checked`);

    await Promise.all(sources.map(async source => {
      try {
        const result = await newsService.current.loadSource(source, force);
        if (id !== requestId.current || !activeRef.current) return;
        bySource[source.id] = tagArticles(source, result.items);
        succeeded++;
        if (result.stale) appendNote(`${source.name}: live fetch failed (${result.err}); showing earlier saved results.`);
        else {
          updated = new Date().toLocaleTimeString('en-IN');
          updatedRef.current = updated;
        }
      } catch (error) {
        if (id !== requestId.current || !activeRef.current) return;
        appendNote(`${source.name}: feed could not be loaded (${error?.message || 'network error'}).`);
      }
      if (id !== requestId.current || !activeRef.current) return;
      finished++;
      updateArticles();
      setFeedStatus({ loaded: `${succeeded}/${sources.length}`, updated });
      setLoadingMessage(`Updating news… ${finished}/${sources.length} sources checked`);
    }));

    if (id !== requestId.current || !activeRef.current) return;
    if (!succeeded) appendNote('All selected feeds failed. Check your internet connection and try Refresh News. If this keeps happening, the publishers or public CORS relays may be temporarily blocking requests.', true);
    setLoadingMessage('');
    setLoading(false);
  }, []);

  useEffect(() => {
    activeRef.current = true;
    if (!initialLoadStarted.current) {
      initialLoadStarted.current = true;
      const sources = SOURCES.filter(source => preferencesRef.current.papers.includes(source.id));
      let cachedSources = 0;
      let mostRecentCache = 0;
      const cachedArticles = sources.flatMap(source => {
        const previous = cache.get(`inh_c_${source.id}`, null);
        if (!Array.isArray(previous?.items)) return [];
        cachedSources++;
        mostRecentCache = Math.max(mostRecentCache, Number(previous.t) || 0);
        return previous.items.map(article => ({
          ...article,
          pid: source.id,
          pub: source.name,
          cats: classifyArticle(article)
        }));
      });
      setArticles(cachedArticles);
      setFeedStatus({
        loaded: `${cachedSources}/${sources.length}`,
        updated: mostRecentCache ? new Date(mostRecentCache).toLocaleTimeString('en-IN') : 'never'
      });
      setLoading(false);
    }
    return () => { activeRef.current = false; };
  }, [reload]);

  useEffect(() => {
    const onOffline = () => setNotes(current => [...current, { id: `offline-${Date.now()}`, message: 'You are offline. Showing last loaded results.', info: true }]);
    window.addEventListener('offline', onOffline);
    return () => window.removeEventListener('offline', onOffline);
  }, []);

  const visibleArticles = useMemo(() => {
    if (showingSaved) return savedArticles;
    const query = search.trim().toLowerCase();
    const categories = preferences.cats.filter(category => category !== 'All News');
    const hours = preferences.range === 'latest' ? 0 : Number(preferences.range);
    const now = Date.now();
    return articles
      .filter(article => preferences.papers.includes(article.pid))
      .filter(article => !categories.length || article.cats.some(category => categories.includes(category)))
      .filter(article => !activeCategory || article.cats.includes(activeCategory))
      .filter(article => !hours || (article.date && now - article.date <= hours * 36e5))
      .filter(article => !query || `${article.title} ${article.summary}`.toLowerCase().includes(query))
      .sort((left, right) => (right.date || 0) - (left.date || 0));
  }, [articles, preferences, search, activeCategory, showingSaved, savedArticles]);

  const groups = useMemo(() => groupStories(visibleArticles), [visibleArticles]);
  const categoryNav = useMemo(() => categoryButtons(articles, preferences, activeCategory, showingSaved), [articles, preferences, activeCategory, showingSaved]);

  return {
    articles,
    groups,
    totalArticles: articles.length,
    loading,
    loadingMessage,
    notes,
    feedStatus,
    categoryNav,
    activeCategory,
    setActiveCategory,
    showingSaved,
    setShowingSaved,
    reload
  };
}
