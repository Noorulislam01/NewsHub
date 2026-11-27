import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import NewsGrid from './features/news/components/NewsGrid.jsx';
import BriefingAsk from './features/news/components/BriefingAsk.jsx';
import FilterPanel from './features/preferences/FilterPanel.jsx';
import AppHeader from './components/AppHeader.jsx';
import BottomNavigation from './components/BottomNavigation.jsx';
import RefreshButton from './components/RefreshButton.jsx';
import ToolsPage from './components/ToolsPage.jsx';
import AskNewsPage from './features/news/components/AskNewsPage.jsx';
import ResearchPapersPage from './features/news/components/ResearchPapersPage.jsx';
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
const ACTIVE_TAB_KEY = 'inh_active_tab';
const APP_TABS = new Set(['home', 'library', 'ask', 'research', 'tools']);

function isResearchArticle(article) {
  return article?.kind === 'research';
}

function getInitialTab() {
  try {
    if (new URL(window.location.href).searchParams.has('shared')) return 'home';
    const savedTab = window.sessionStorage.getItem(ACTIVE_TAB_KEY);
    return APP_TABS.has(savedTab) ? savedTab : 'home';
  } catch {
    return 'home';
  }
}

/** React owns the application UI and news feed lifecycle. */
export default function App() {
  const [preferences, setPreferences] = useState(loadPreferences);
  const [draftPreferences, setDraftPreferences] = useState(preferences);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [newsSearchOpen, setNewsSearchOpen] = useState(false);
  const [newsSearchDraft, setNewsSearchDraft] = useState('');
  const [newsSearch, setNewsSearch] = useState('');
  const [librarySection, setLibrarySection] = useState('news');
  const [sourceNavigation, setSourceNavigation] = useState(null);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authDialogMode, setAuthDialogMode] = useState('signin');
  const [authDialogPrompt, setAuthDialogPrompt] = useState('');
  const [activeChat, setActiveChat] = useState(null);
  const [askStoryGroup, setAskStoryGroup] = useState(null);
  const [sharedArticle, setSharedArticle] = useState(readSharedArticle);
  const [chatSession, setChatSession] = useState(0);
  const installPrompt = useRef(null);
  const categoryNavRef = useRef(null);
  const newsSearchInputRef = useRef(null);
  const categoryNavRestored = useRef(false);
  const homeScrollPosition = useRef(0);
  const restoreHomeScroll = useRef(false);
  const researchScrollPosition = useRef(0);
  const restoreResearchScroll = useRef(false);
  const auth = useAuth();
  const library = useSavedArticles(auth);
  const chats = useSavedChats(auth);
  const readLibrary = useReadArticles();
  const { savedArticles } = library;
  const savedNewsArticles = savedArticles.filter(article => !isResearchArticle(article));
  const savedResearchArticles = savedArticles.filter(isResearchArticle);
  const savedNewsGroups = savedNewsArticles.map(main => ({ main, others: [] }));
  const feed = useNewsFeed(preferences, newsSearch, savedArticles, activeTab === 'library');
  useEffect(() => {
    if (newsSearchOpen) newsSearchInputRef.current?.focus();
  }, [newsSearchOpen]);
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

  useLayoutEffect(() => {
    if (activeTab !== 'home' || !restoreHomeScroll.current) return;
    const previousPosition = homeScrollPosition.current;
    window.scrollTo({ top: previousPosition, behavior: 'auto' });
    restoreHomeScroll.current = false;
    if (previousPosition <= 0) return;
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab]);

  useLayoutEffect(() => {
    if (activeTab !== 'research' || !restoreResearchScroll.current) return;
    const previousPosition = researchScrollPosition.current;
    window.scrollTo({ top: previousPosition, behavior: 'auto' });
    restoreResearchScroll.current = false;
    if (previousPosition <= 0) return;
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab]);

  useLayoutEffect(() => {
    if (activeTab !== 'home' || sharedArticle) return undefined;
    let previousRestoration = 'auto';
    try {
      previousRestoration = window.history.scrollRestoration;
      window.history.scrollRestoration = 'manual';
    } catch {
      // Fall back to explicitly scrolling to the top if unsupported.
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    return () => {
      window.cancelAnimationFrame(frame);
      try {
        window.history.scrollRestoration = previousRestoration;
      } catch {
        // Ignore unsupported history restoration controls.
      }
    };
  }, []);

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
    try {
      window.sessionStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    } catch {
      // Keep navigation usable when browser storage is unavailable.
    }
  }, [activeTab]);

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

  function clearFilters() {
    const defaults = { ...draftPreferences, papers: [...DEFAULT_PAPERS], cats: ['All News'], range: 'latest' };
    changePreferences(defaults);
  }

  function openFilters() {
    setDraftPreferences(preferences);
    setFiltersOpen(true);
  }

  function cancelFilters() {
    setDraftPreferences(preferences);
    setFiltersOpen(false);
  }

  function applyFilters() {
    setActiveTab('home');
    setSourceNavigation(null);
    setFiltersOpen(false);
    feed.setShowingSaved(false);
    feed.setActiveCategory(null);
    setPreferences(draftPreferences);
    feed.reload(true, draftPreferences);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function requireLogin(message = '') {
    setAuthDialogMode('signin');
    setAuthDialogPrompt(message);
    setAuthDialogOpen(true);
  }

  function rememberHomeScroll() {
    if (activeTab === 'home' && !filtersOpen) homeScrollPosition.current = window.scrollY;
  }

  function rememberCurrentSectionScroll() {
    if (activeTab === 'home') rememberHomeScroll();
    if (activeTab === 'research') researchScrollPosition.current = window.scrollY;
  }

  function navigate(action) {
    rememberCurrentSectionScroll();
    setSourceNavigation(null);
    if (action === 'home') {
      const alreadyOnHome = activeTab === 'home';
      restoreHomeScroll.current = !alreadyOnHome;
      if (alreadyOnHome) {
        homeScrollPosition.current = 0;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setActiveTab('home');
      setFiltersOpen(false);
      feed.setShowingSaved(false);
    } else if (action === 'filters') {
      setActiveTab('home');
      openFilters();
    } else if (action === 'saved' && auth.user) {
      setActiveTab('library');
      setFiltersOpen(false);
      feed.setShowingSaved(true);
    } else if (action === 'saved') {
      setActiveTab('home');
      requireLogin('Sign in to view your library.');
    } else if (action === 'account') {
      requireLogin();
    }
    if (action !== 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
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
    setActiveTab('ask');
    setActiveChat(chat);
    setAskStoryGroup(null);
    setFiltersOpen(false);
    feed.setShowingSaved(false);
    window.setTimeout(() => document.getElementById('briefingAskTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  function startNewChat(focusInput = true) {
    rememberHomeScroll();
    setActiveTab('ask');
    setActiveChat(null);
    setAskStoryGroup(null);
    setChatSession(current => current + 1);
    setFiltersOpen(false);
    feed.setShowingSaved(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (focusInput) window.setTimeout(() => document.getElementById('briefingQuestion')?.focus(), 0);
  }

  function exploreStory(group) {
    rememberHomeScroll();
    setActiveTab('ask');
    setActiveChat(null);
    setAskStoryGroup(group);
    setChatSession(current => current + 1);
    setFiltersOpen(false);
    feed.setShowingSaved(false);
    window.setTimeout(() => document.getElementById('briefingQuestion')?.focus(), 0);
  }

  function clearAskStoryGroup() {
    setAskStoryGroup(null);
    setChatSession(current => current + 1);
  }

  function openChatSource(url) {
    const findGroup = groups => groups.find(({ main, others }) => main.link === url || others.some(article => article.link === url));
    const currentGroup = findGroup(feed.groups);
    const matchingGroup = currentGroup || findGroup(feed.allSelectedGroups);
    if (!matchingGroup) return false;
    if (!currentGroup) {
      feed.setActiveCategory(null);
      setNewsSearch('');
      setNewsSearchDraft('');
    }
    const cardUrl = matchingGroup.main.link;
    setActiveTab('home');
    setFiltersOpen(false);
    feed.setShowingSaved(false);
    setSourceNavigation({ id: `${Date.now()}-${url}`, url: cardUrl });
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
      setActiveTab('home');
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
        onThemeChange={changeTheme}
        showFilter={activeTab === 'home' && !feed.showingSaved && !sharedArticle}
        filtersOpen={filtersOpen}
        autoHide={(activeTab === 'home' || activeTab === 'research') && !filtersOpen}
        onFilterToggle={() => filtersOpen ? cancelFilters() : openFilters()}
      />
      <FilterPanel
        open={filtersOpen}
        preferences={draftPreferences}
        newspapers={SOURCES}
        categories={CATEGORIES}
        onChange={changePreferences}
        onShow={applyFilters}
        onClear={clearFilters}
        onCancel={cancelFilters}
      />
      <main id="contentMain" className={activeTab === 'ask' ? 'ask-tab-mode' : ''}>
        {activeTab === 'home' && <div className="stats ui">
          <span>Articles: <b>{feed.groups.length}</b></span>
          <span>Newspapers selected: <b>{preferences.papers.length}</b></span>
          <span>Feeds loaded: <b>{feed.feedStatus.loaded}</b></span>
          <span>Last updated: <b>{feed.feedStatus.updated}</b></span>
        </div>}
        {activeTab === 'library' && <>
          <div className="library-heading-group ui">
            <h1 id="librarySectionTitle" className="library-heading">{librarySection === 'research' ? 'Saved Research' : 'Saved News'}</h1>
            <p>{librarySection === 'research' ? 'Research papers saved to your Library.' : 'News articles saved to your Library.'}</p>
          </div>
          <nav className="library-section-tabs ui" aria-label="Library sections">
          <button className={librarySection === 'news' ? 'is-active' : ''} type="button" aria-pressed={librarySection === 'news'} onClick={() => setLibrarySection('news')}>
            <span>News</span><small>{savedNewsArticles.length}</small>
          </button>
          <button className={librarySection === 'research' ? 'is-active' : ''} type="button" aria-pressed={librarySection === 'research'} onClick={() => setLibrarySection('research')}>
            <span>Research</span><small>{savedResearchArticles.length}</small>
          </button>
          </nav>
        </>}
        <div className="category-bar ui" hidden={activeTab !== 'home' || feed.showingSaved || Boolean(sharedArticle)}>
          <nav className="category-nav" aria-label="News views and categories" ref={categoryNavRef} hidden={!feed.categoryNav.length}>
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
        {(activeTab === 'home' || activeTab === 'library') && <div className="notes ui" id="notes" aria-live="polite">
          {library.error && <div className="note" role="alert">{library.error}</div>}
          {activeTab === 'home' && chats.error && <div className="note" role="alert">{chats.error}</div>}
          {activeTab === 'home' && feed.loadingMessage && <div className="note info">{feed.loadingMessage}</div>}
          {activeTab === 'home' && feed.notes.map(note => <div className={`note${note.info ? ' info' : ''}`} key={note.id}>{note.message}</div>)}
        </div>}
        <div className={`grid${sharedArticle ? ' shared-article-grid' : ''}`} id="grid" hidden={activeTab !== 'home' && (activeTab !== 'library' || librarySection === 'research')}>
          <NewsGrid
            groups={sharedArticle ? [{ main: sharedArticle, others: [] }] : (activeTab === 'library' ? (library.loading ? [] : savedNewsGroups) : feed.groups)}
            showingSaved={activeTab === 'library'}
            resetKey={`${sharedArticle?.link || ''}|${feed.activeCategory || ''}|${preferences.range}|${preferences.papers.join(',')}|${preferences.cats.join(',')}|${sourceNavigation?.id || ''}|${librarySection}|${newsSearch}`}
            totalArticles={sharedArticle ? 1 : activeTab === 'library' ? savedNewsArticles.length : feed.totalArticles}
            loading={activeTab === 'library' ? library.loading : feed.loading}
            savedArticles={savedArticles}
            readArticleKeys={readLibrary.readKeys}
            canSave={Boolean(auth.user)}
            onSave={auth.user ? library.saveArticle : undefined}
            onToggleRead={readLibrary.toggleReadArticle}
            onRequireLogin={requireLogin}
            onRefresh={refreshNews}
            onExploreStory={exploreStory}
            focusArticleRequest={sourceNavigation}
            emptyTitle={activeTab === 'library' && savedResearchArticles.length ? 'No news saved yet' : undefined}
            emptyMessage={activeTab === 'library' && savedResearchArticles.length ? 'Save news cards from Home to see them in this Library section.' : undefined}
          />
          {sharedArticle && (
            <div className="shared-article-banner ui">
              <span>This article was shared with you. Open the card to visit the publisher.</span>
              <button type="button" onClick={returnToNews}>Back to news</button>
            </div>
          )}
        </div>
        <ResearchPapersPage
          hidden={!(activeTab === 'library' && librarySection === 'research')}
          enabled={false}
          mode="library"
          savedArticles={savedResearchArticles}
          readKeys={readLibrary.readKeys}
          canSave={Boolean(auth.user)}
          onSave={library.saveArticle}
          onToggleRead={readLibrary.toggleReadArticle}
          onRequireLogin={requireLogin}
        />
        <AskNewsPage hidden={activeTab !== 'ask'} authUser={auth.user} chats={chats.savedChats} chatsLoading={chats.loading} onOpenChat={openChat} onRequireLogin={requireLogin}>
          <BriefingAsk key={activeChat?.id || `new-chat-${chatSession}`} groups={askStoryGroup ? [askStoryGroup] : feed.groups} storyGroup={askStoryGroup} pageMode canAsk={Boolean(auth.user)} onRequireLogin={requireLogin} savedChat={activeChat} onSaveChat={chats.saveChat} onOpenSource={openChatSource} onNewChat={startNewChat} onClearStoryGroup={clearAskStoryGroup} />
        </AskNewsPage>
        <ResearchPapersPage
          hidden={activeTab !== 'research'}
          enabled={activeTab === 'research'}
          savedArticles={savedArticles}
          readKeys={readLibrary.readKeys}
          canSave={Boolean(auth.user)}
          onSave={library.saveArticle}
          onToggleRead={readLibrary.toggleReadArticle}
          onRequireLogin={requireLogin}
        />
        {activeTab === 'tools' && <ToolsPage authUser={auth.user} theme={preferences.theme} onThemeChange={changeTheme} installAvailable={installAvailable} onInstall={installApp} onSignOut={signOut} onRequireLogin={requireLogin} />}
      </main>
      {activeTab === 'home' && !filtersOpen && !feed.showingSaved && !sharedArticle && <form className={`research-search home-news-search${newsSearchOpen ? ' is-open' : ''}`} role="search" onSubmit={event => {
        event.preventDefault();
        if (!newsSearchOpen) return;
        setNewsSearch(newsSearchDraft.trim());
      }}>
        <input
          ref={newsSearchInputRef}
          type="text"
          inputMode="search"
          value={newsSearchDraft}
          onChange={event => setNewsSearchDraft(event.target.value)}
          placeholder="Search news..."
          aria-label="Search news"
        />
        {newsSearchOpen && <button className="research-close" type="button" aria-label="Close news search" title="Close search" onClick={() => setNewsSearchOpen(false)}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>}
        {newsSearchOpen && <RefreshButton inline refreshing={feed.loading} onRefresh={refreshNews} />}
        <button className="btn primary research-submit" type={newsSearchOpen ? 'submit' : 'button'} aria-label={newsSearchOpen ? 'Search news' : 'Open news search'} aria-expanded={newsSearchOpen} title="Search news" disabled={newsSearchOpen && feed.loading} onClick={() => { if (!newsSearchOpen) setNewsSearchOpen(true); }}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.4 15.4 4.1 4.1" /></svg>
        </button>
      </form>}
      <BottomNavigation
        activeTab={activeTab}
        savedCount={savedArticles.length}
        authUser={auth.user}
        savedCountReady={library.ready}
        onTabChange={tab => {
          if (tab === 'home') navigate('home');
          else if (tab === 'library') navigate('saved');
          else if (tab === 'ask') {
            if (activeTab !== 'ask') {
              rememberCurrentSectionScroll();
              setActiveTab('ask');
              setFiltersOpen(false);
              feed.setShowingSaved(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          } else if (tab === 'tools') {
            rememberCurrentSectionScroll();
            setActiveTab('tools');
            setFiltersOpen(false);
            feed.setShowingSaved(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else if (tab === 'research') {
            if (activeTab === 'research') {
              researchScrollPosition.current = 0;
              window.scrollTo({ top: 0, behavior: 'smooth' });
              return;
            }
            rememberCurrentSectionScroll();
            restoreResearchScroll.current = researchScrollPosition.current > 0;
            setActiveTab('research');
            setFiltersOpen(false);
            feed.setShowingSaved(false);
            if (!restoreResearchScroll.current) window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      />
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
