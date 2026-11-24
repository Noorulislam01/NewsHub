import { DEFAULT_PAPERS, NEW_RESEARCH_SOURCE_IDS, SOURCES, CATEGORIES } from '../news/newsSources.js';
import { storage } from '../../shared/storage.js';

const PREFERENCES_KEY = 'inh_prefs';

export function loadPreferences() {
  const stored = storage.get(PREFERENCES_KEY, {}) || {};
  const papers = Array.isArray(stored.papers)
    ? stored.papers.filter(id => SOURCES.some(source => source.id === id))
    : DEFAULT_PAPERS.slice();

  if (!storage.get('inh_research_sources_added_v1', false)) {
    if (Array.isArray(stored.papers)) {
      for (const id of NEW_RESEARCH_SOURCE_IDS) {
        if (!papers.includes(id)) papers.push(id);
      }
      storage.set(PREFERENCES_KEY, { ...stored, papers });
    }
    storage.set('inh_research_sources_added_v1', true);
  }

  const cats = Array.isArray(stored.cats) ? stored.cats.filter(category => CATEGORIES.includes(category)) : ['All News'];
  const themePreference = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

  return {
    papers,
    cats: cats.length ? cats : ['All News'],
    range: ['latest', '24', '48', '168'].includes(String(stored.range)) ? String(stored.range) : 'latest',
    theme: ['dark', 'light'].includes(stored.theme) ? stored.theme : themePreference
  };
}

export function savePreferences(preferences) {
  storage.set(PREFERENCES_KEY, preferences);
}
