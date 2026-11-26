import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import NewsGrid from './features/news/components/NewsGrid.jsx';
import BriefingAsk from './features/news/components/BriefingAsk.jsx';
import FilterPanel from './features/preferences/FilterPanel.jsx';
import AppHeader from './components/AppHeader.jsx';
import RefreshButton from './components/RefreshButton.jsx';
import { loadPreferences, savePreferences } from './features/preferences/preferences.js';
import { CATEGORIES, DEFAULT_PAPERS, SOURCES } from './features/news/newsSources.js';
import { useSavedArticles } from './features/library/useSavedArticles.js';
import { useReadArticles } from './features/library/useReadArticles.js';
import { useSavedChats } from './features/library/useSavedChats.js';
import { useNewsFeed } from './features/news/useNewsFeed.js';
import AuthDialog from './features/auth/components/AuthDialog.jsx';
import { useAuth } from './features/auth/AuthProvider.jsx';
import { readSharedArticle } from './shared/sharedArticle.js';

const CATEGORY_NAV_SCROLL_KEY = 'inh_category_nav_scroll';

/** React owns the application UI and news feed lifecycle. */
export default function App() {
  const [preferences, setPreferences] = useState(loadPreferences);
  const [draftPreferences, setDraftPreferences] = useState(preferences);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sourceNavigation, setSourceNavigation] = useState(null);
  const [search, setSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [installAvailable, setInstallAvailable] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authDialogMode, setAuthDialogMode] = useState('signin');
  const [authDialogPrompt, setAuthDialogPrompt] = useState('');
  const [activeChat, setActiveChat] = useState(null);
  const [sharedArticle, setSharedArticle] = useState(readSharedArticle);
  const [chatSession, setChatSession] = useState(0);
  const installPrompt = useRef(null);
  const categoryNavRef = useRef(null);
  const categoryNavRestored = useRef(false);
  const auth = useAuth();
  const library = useSavedArticles(auth);
  const chats = useSavedChats(auth);
  const readLibrary = useReadArticles();
  const { savedArticles } = library;
  const feed = useNewsFeed(preferences, search, savedArticles);
  useLayoutEffect(() => {
    const nav = categoryNavRef.current;
    if (!nav || !feed.categoryNav.length || categoryNavRestored.current) return;
    try {
      const savedScroll = Number(window.sessionStorage.getItem(CATEGORY_NAV_SCROLL_KEY));
      if (Number.isFinite(savedScroll)) nav.scrollLeft = savedScroll;
    } catch {
      // Session storage can be unavailable in restricted browser contexts.
    }
    categoryNavRestored.current = true;
  }, [feed.categoryNav.length]);

  useEffect(() => {
    const nav = categoryNavRef.current;
    if (!nav) return undefined;
    const saveScroll = () => {
      try {
        window.sessionStorage.setItem(CATEGORY_NAV_SCROLL_KEY, String(nav.scrollLeft));
      } catch {
        // Session storage can be unavailable in restricted browser contexts.
      }
    };
    nav.addEventListener('scroll', saveScroll, { passive: true });
    window.addEventListener('pagehide', saveScroll);
    return () => {
      saveScroll();
      nav.removeEventListener('scroll', saveScroll);
      window.removeEventListener('pagehide', saveScroll);
    };
  }, []);

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

  function changePreferences(next) {
    setDraftPreferences(next);
  }

  function changeSearch(value) {
    setDraftSearch(value);
  }

  function clearFilters() {
    const defaults = { ...draftPreferences, papers: [...DEFAULT_PAPERS], cats: ['All News'], range: 'latest' };
    changePreferences(defaults);
    setDraftSearch('');
  }

  function applyFilters() {
    setSourceNavigation(null);
    setFiltersOpen(false);
    feed.setShowingSaved(false);
    feed.setActiveCategory(null);
    setPreferences(draftPreferences);
    setSearch(draftSearch);
    feed.reload(true, draftPreferences);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function requireLogin(message = '') {
    setAuthDialogMode('signin');
    setAuthDialogPrompt(message);
    setAuthDialogOpen(true);
  }

  function navigate(action) {
    setSourceNavigation(null);
    if (action !== 'chat') setActiveChat(null);
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
      requireLogin('Sign in to view your library.');
    } else if (action === 'account') {
      requireLogin();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function changeTheme(nextTheme) {
    document.documentElement.dataset.theme = nextTheme;
    setPreferences(current => ({ ...current, theme: nextTheme }));
    setDraftPreferences(current => ({ ...current, theme: nextTheme }));
  }

  function refreshNews() {
    if (feed.loading) return;
    setSourceNavigation(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    feed.reload(true);
  }

  function returnToNews() {
    const url = new URL(window.location.href);
    url.searchParams.delete('shared');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    setSharedArticle(null);
  }

  function openChat(chat) {
    setActiveChat(chat);
    setFiltersOpen(false);
    feed.setShowingSaved(false);
    window.setTimeout(() => document.getElementById('briefingAskTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  function startNewChat() {
    setActiveChat(null);
    setChatSession(current => current + 1);
    setFiltersOpen(false);
    feed.setShowingSaved(false);
    window.setTimeout(() => document.getElementById('briefingQuestion')?.focus(), 0);
  }

  function openChatSource(url) {
    const isInCurrentFeed = feed.groups.some(({ main }) => main.link === url);
    if (!isInCurrentFeed) return false;
    setSourceNavigation({ id: `${Date.now()}-${url}`, url });
    window.setTimeout(() => document.getElementById('grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    return true;
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
      setActiveChat(null);
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
        savedChats={chats.savedChats}
        chatsLoading={chats.loading}
        onOpenChat={openChat}
        onNewChat={startNewChat}
      >
        <FilterPanel
          open={filtersOpen}
          preferences={draftPreferences}
          newspapers={SOURCES}
          categories={CATEGORIES}
          search={draftSearch}
          onChange={changePreferences}
          onSearch={changeSearch}
          onShow={applyFilters}
          onClear={clearFilters}
        />
      </AppHeader>
      <main id="contentMain" className={`${filtersOpen ? 'filters-mode' : ''}${!feed.showingSaved && !filtersOpen ? ' ask-mode' : ''}`}>
        <div className="stats ui">
          <span>Articles: <b>{feed.showingSaved ? savedArticles.length : feed.groups.length}</b></span>
          <span>Newspapers selected: <b>{preferences.papers.length}</b></span>
          <span>Feeds loaded: <b>{feed.feedStatus.loaded}</b></span>
          <span>Last updated: <b>{feed.feedStatus.updated}</b></span>
        </div>
        <div className="category-bar ui" hidden={!feed.categoryNav.length || feed.showingSaved || Boolean(sharedArticle)}>
          <nav className="category-nav" aria-label="News views and categories" ref={categoryNavRef}>
            {feed.categoryNav.map(button => (
              <button
                className="category-pill"
                key={button.value || 'all'}
                type="button"
                aria-pressed={button.active}
                onClick={() => {
                  setSourceNavigation(null);
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
          {chats.error && <div className="note" role="alert">{chats.error}</div>}
          {feed.loadingMessage && <div className="note info">{feed.loadingMessage}</div>}
          {feed.notes.map(note => <div className={`note${note.info ? ' info' : ''}`} key={note.id}>{note.message}</div>)}
        </div>
        <div className={`grid${sharedArticle ? ' shared-article-grid' : ''}`} id="grid">
          <NewsGrid
            groups={sharedArticle ? [{ main: sharedArticle, others: [] }] : (feed.showingSaved && library.loading ? [] : feed.groups)}
            showingSaved={feed.showingSaved}
            resetKey={`${sharedArticle?.link || ''}|${feed.activeCategory || ''}|${search}|${preferences.range}|${preferences.papers.join(',')}|${preferences.cats.join(',')}|${sourceNavigation?.id || ''}`}
            totalArticles={sharedArticle ? 1 : feed.totalArticles}
            loading={feed.loading || (feed.showingSaved && library.loading)}
            savedArticles={savedArticles}
            readArticleKeys={readLibrary.readKeys}
            canSave={Boolean(auth.user)}
            onSave={auth.user ? library.saveArticle : undefined}
            onToggleRead={readLibrary.toggleReadArticle}
            onRequireLogin={requireLogin}
            onRefresh={refreshNews}
            focusArticleRequest={sourceNavigation}
          />
          {sharedArticle && (
            <div className="shared-article-banner ui">
              <span>This article was shared with you. Open the card to visit the publisher.</span>
              <button type="button" onClick={returnToNews}>Back to news</button>
            </div>
          )}
        </div>
      </main>
      {!feed.showingSaved && !filtersOpen && (
        <div className="floating-news-tools has-ask">
          <BriefingAsk key={activeChat?.id || `new-chat-${chatSession}`} groups={feed.groups} canAsk={Boolean(auth.user)} onRequireLogin={requireLogin} savedChat={activeChat} onSaveChat={chats.saveChat} onOpenSource={openChatSource} onNewChat={startNewChat} />
          <RefreshButton refreshing={feed.loading} onRefresh={refreshNews} />
        </div>
      )}
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
