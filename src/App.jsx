import { useCallback, useEffect, useRef, useState } from 'react';
import NewsGrid from './features/news/components/NewsGrid.jsx';
import FilterPanel from './features/preferences/FilterPanel.jsx';
import AppHeader from './components/AppHeader.jsx';
import RefreshButton from './components/RefreshButton.jsx';
import { loadPreferences, savePreferences } from './features/preferences/preferences.js';
import { CATEGORIES, DEFAULT_PAPERS, SOURCES } from './features/news/newsSources.js';
import { useSavedArticles } from './features/library/useSavedArticles.js';
import { useNewsFeed } from './features/news/useNewsFeed.js';
import AuthDialog from './features/auth/components/AuthDialog.jsx';
import { useAuth } from './features/auth/AuthProvider.jsx';

/** React owns the application UI and news feed lifecycle. */
export default function App() {
  const [preferences, setPreferences] = useState(loadPreferences);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [installAvailable, setInstallAvailable] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authDialogMode, setAuthDialogMode] = useState('signin');
  const [authDialogPrompt, setAuthDialogPrompt] = useState('');
  const installPrompt = useRef(null);
  const auth = useAuth();
  const library = useSavedArticles(auth);
  const { savedArticles } = library;
  const feed = useNewsFeed(preferences, search, savedArticles);

  const closeAuthDialog = useCallback(() => {
    setAuthDialogOpen(false);
    setAuthDialogPrompt('');
    auth.clearPasswordRecovery();
  }, [auth.clearPasswordRecovery]);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    document.body.classList.toggle('filters-open', filtersOpen);
    return () => document.body.classList.remove('filters-open');
  }, [filtersOpen]);

  useEffect(() => {
    if (!auth.passwordRecovery) return;
    setAuthDialogMode('recovery');
    setAuthDialogOpen(true);
    auth.clearPasswordRecovery();
  }, [auth.passwordRecovery, auth.clearPasswordRecovery]);

  useEffect(() => {
    const onBeforeInstall = event => {
      event.preventDefault();
      installPrompt.current = event;
      setInstallAvailable(true);
    };
    const onInstalled = () => {
      installPrompt.current = null;
      setInstallAvailable(false);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    if (import.meta.env.PROD && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function changePreferences(next, options = {}) {
    setPreferences(next);
    if (options.reload) feed.reload(false, next);
  }

  function changeSearch(value) {
    setSearch(value);
  }

  function clearFilters() {
    const defaults = { ...preferences, papers: [...DEFAULT_PAPERS], cats: ['All News'], range: 'latest' };
    changePreferences(defaults, { reload: true });
    setSearch('');
    feed.setActiveCategory(null);
  }

  function applyFilters() {
    setFiltersOpen(false);
    feed.setShowingSaved(false);
    feed.setActiveCategory(null);
    feed.reload(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function requireLogin(message = '') {
    setAuthDialogMode('signin');
    setAuthDialogPrompt(message);
    setAuthDialogOpen(true);
  }

  function navigate(action) {
    if (action === 'home') {
      setFiltersOpen(false);
      feed.setShowingSaved(false);
    } else if (action === 'filters') {
      setFiltersOpen(true);
    } else if (action === 'saved' && auth.user) {
      setSearch('');
      setFiltersOpen(false);
      feed.setShowingSaved(true);
    } else if (action === 'saved') {
      requireLogin('Sign in to view your saved articles.');
    } else if (action === 'account') {
      requireLogin();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function changeTheme(nextTheme) {
    document.documentElement.dataset.theme = nextTheme;
    setPreferences(current => ({ ...current, theme: nextTheme }));
  }

  function refreshNews() {
    if (feed.loading) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    feed.reload(true);
  }

  async function installApp() {
    const prompt = installPrompt.current;
    if (!prompt) return;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } finally {
      installPrompt.current = null;
      setInstallAvailable(false);
    }
  }

  async function signOut() {
    try {
      await auth.signOut();
      feed.setShowingSaved(false);
    } catch (error) {
      console.error('Could not sign out:', error?.message || error);
    }
  }

  return (
    <>
      <AppHeader
        theme={preferences.theme}
        savedCount={savedArticles.length}
        authUser={auth.user}
        installAvailable={installAvailable}
        onThemeChange={changeTheme}
        onNavigate={navigate}
        onInstall={installApp}
        onSignOut={signOut}
      >
        <FilterPanel
          open={filtersOpen}
          preferences={preferences}
          newspapers={SOURCES}
          categories={CATEGORIES}
          search={search}
          onChange={changePreferences}
          onSearch={changeSearch}
          onShow={applyFilters}
          onClear={clearFilters}
        />
      </AppHeader>
      <main id="contentMain" className={filtersOpen ? 'filters-mode' : ''}>
        <div className="stats ui">
          <span>Articles: <b>{feed.showingSaved ? savedArticles.length : feed.groups.length}</b></span>
          <span>Newspapers selected: <b>{preferences.papers.length}</b></span>
          <span>Feeds loaded: <b>{feed.feedStatus.loaded}</b></span>
          <span>Last updated: <b>{feed.feedStatus.updated}</b></span>
        </div>
        <div className="category-bar ui" hidden={!feed.categoryNav.length}>
          <nav className="category-nav" aria-label="Browse news categories">
            {feed.categoryNav.map(button => (
              <button
                className="category-pill"
                key={button.value || 'all'}
                type="button"
                aria-pressed={button.active}
                onClick={() => {
                  feed.setActiveCategory(button.value || null);
                  document.getElementById('grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {button.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="notes ui" id="notes" aria-live="polite">
          {library.error && <div className="note" role="alert">{library.error}</div>}
          {feed.loadingMessage && <div className="note info">{feed.loadingMessage}</div>}
          {feed.notes.map(note => <div className={`note${note.info ? ' info' : ''}`} key={note.id}>{note.message}</div>)}
        </div>
        <div className="grid" id="grid">
          <NewsGrid
            groups={feed.showingSaved && library.loading ? [] : feed.groups}
            showingSaved={feed.showingSaved}
            totalArticles={feed.totalArticles}
            loading={feed.loading || (feed.showingSaved && library.loading)}
            savedArticles={savedArticles}
            canSave={Boolean(auth.user)}
            onSave={auth.user ? library.saveArticle : undefined}
            onRequireLogin={requireLogin}
          />
        </div>
      </main>
      <RefreshButton refreshing={feed.loading} onRefresh={refreshNews} />
      <footer className="site-footer ui">
        <div className="footer-inner">
          <div className="footer-copy">
            <p className="footer-tagline">A clearer view of the stories shaping today.</p>
            <div className="footer-meta">
              <span>© <span>{new Date().getFullYear()}</span> One News Hub</span>
              <span>Read every story at its original source.</span>
            </div>
          </div>
          <img className="footer-logo" src="/one-news-hub-192.png" alt="One News Hub logo" width="74" height="74" />
        </div>
      </footer>
      <AuthDialog
        open={authDialogOpen}
        initialMode={authDialogMode}
        configured={auth.configured}
        promptMessage={authDialogPrompt}
        onClose={closeAuthDialog}
        onSignIn={auth.signIn}
        onSignUp={auth.signUp}
        onSendPasswordReset={auth.sendPasswordReset}
        onUpdatePassword={auth.updatePassword}
        onSuccess={closeAuthDialog}
      />
    </>
  );
}
