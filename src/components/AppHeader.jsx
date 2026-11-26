import { useEffect, useRef, useState } from 'react';

export default function AppHeader({ theme, savedCount, authUser, installAvailable, savedChats = [], chatsLoading = false, onOpenChat, onNewChat, onThemeChange, onNavigate, onInstall, onSignOut, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);
  const [chatsExpanded, setChatsExpanded] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const menuRoot = useRef(null);
  const menuButton = useRef(null);
  const shareFeedbackTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(shareFeedbackTimer.current), []);

  useEffect(() => {
    function closeOutside(event) {
      if (menuRoot.current && !menuRoot.current.contains(event.target)) {
        setMenuOpen(false);
        setAccountExpanded(false);
        setChatsExpanded(false);
      }
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
        setAccountExpanded(false);
        setChatsExpanded(false);
        menuButton.current?.focus();
      }
    }
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  function selectMenuAction(action) {
    setMenuOpen(false);
    setAccountExpanded(false);
    setChatsExpanded(false);
    if (action === 'install') onInstall();
    else if (action === 'signout') onSignOut();
    else onNavigate(action);
  }

  async function shareApp() {
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const appUrl = import.meta.env.VITE_PUBLIC_SITE_URL?.trim()
      || (isLocal ? 'https://newshub-delta-nine.vercel.app/' : `${window.location.origin}/`);
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'One News Hub', text: 'A clearer view of the stories shaping today.', url: appUrl });
          setShareFeedback('Thanks for sharing One News Hub.');
        } catch (error) {
          if (error?.name === 'AbortError') return;
          await copyAppUrl(appUrl);
        }
      } else {
        await copyAppUrl(appUrl);
      }
    } catch {
      setShareFeedback('Could not share the app link.');
    }
    window.clearTimeout(shareFeedbackTimer.current);
    shareFeedbackTimer.current = window.setTimeout(() => setShareFeedback(''), 2400);
  }

  async function copyAppUrl(url) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      setShareFeedback('App link copied.');
      return;
    }
    const input = document.createElement('textarea');
    input.value = url;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    if (!copied) throw new Error('Clipboard access is unavailable.');
    setShareFeedback('App link copied.');
  }

  return (
    <header className="ui" id="pageTop">
      <div className="bar">
        <div className="header-brand">
          <img className="header-logo" src="/one-news-hub-192.png" alt="One News Hub logo" width="44" height="44" />
          <div className="brand">One <span>News</span> Hub</div>
        </div>
        <div className="header-actions">
          <button
            className="btn theme-icon"
            type="button"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
          >
            <span className="theme-symbol" key={theme} aria-hidden="true">
              {theme === 'dark' ? '☀' : '☾'}
            </span>
          </button>
          <div className="menu-wrap" ref={menuRoot}>
            <button
              className="btn menu-toggle"
              ref={menuButton}
              type="button"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              aria-controls="mainMenu"
              title="Menu"
              onClick={() => setMenuOpen(open => {
                if (open) {
                  setAccountExpanded(false);
                  setChatsExpanded(false);
                }
                return !open;
              })}
            >
              <span /><span /><span />
            </button>
            <nav className="menu-panel" id="mainMenu" aria-label="Main menu" hidden={!menuOpen}>
              <button
                type="button"
                className="menu-account-button"
                aria-expanded={Boolean(authUser && accountExpanded)}
                aria-controls="menuAccountDetails"
                onClick={() => authUser
                  ? setAccountExpanded(expanded => !expanded)
                  : selectMenuAction('account')}
              >
                <svg className="menu-user-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 20c.5-3.6 3.2-5.5 7-5.5s6.5 1.9 7 5.5" />
                </svg>
                Account
              </button>
              {authUser && accountExpanded && (
                <div className="menu-account-details" id="menuAccountDetails">
                  <div className="menu-account" role="status">{authUser.email || 'Signed in'}</div>
                  <button type="button" className="menu-account-signout" onClick={() => selectMenuAction('signout')}>
                    <svg className="menu-signout-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M10 17l5-5-5-5M15 12H3" />
                      <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" />
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
              <button type="button" onClick={() => selectMenuAction('home')}><span className="menu-symbol">&#x2302;</span>Home</button>
              <button type="button" onClick={() => selectMenuAction('filters')}><span className="menu-symbol">&#x2637;</span>Filters</button>
              {installAvailable && <button type="button" onClick={() => selectMenuAction('install')}><span className="menu-symbol">&#x2B07;</span>Install app</button>}
              <button type="button" onClick={shareApp}>
                <svg className="menu-share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <path d="m8.7 10.6 6.6-4.2m-6.6 9 6.6 4.2" />
                </svg>
                Share this app
              </button>
              {shareFeedback && <div className="menu-share-feedback" role="status" aria-live="polite">{shareFeedback}</div>}
              <button type="button" onClick={() => selectMenuAction('saved')}>
                <svg className="menu-library-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75Z" />
                </svg>
                Library <span className="saved-count">{savedCount}</span>
              </button>
              {authUser && <div className="menu-chat-section">
                <button type="button" className="menu-chat-section-toggle" aria-expanded={chatsExpanded} aria-controls="savedChatList" onClick={() => setChatsExpanded(value => !value)}>
                  <svg className="menu-chat-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                    <path d="M5 5.75A2.75 2.75 0 0 1 7.75 3h8.5A2.75 2.75 0 0 1 19 5.75v7.5A2.75 2.75 0 0 1 16.25 16H10l-5 4v-6.5A2.75 2.75 0 0 1 5 13V5.75Z" />
                    <path d="M8 8h8M8 11.5h5" />
                  </svg>
                  <span>Chats</span><span className="saved-count">{savedChats.length}</span>
                  <svg className="menu-chat-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
                </button>
                {chatsExpanded && <div className="menu-chat-history" id="savedChatList">
                  <button className="menu-chat-new" type="button" onClick={() => { setMenuOpen(false); setChatsExpanded(false); onNewChat?.(); }}>
                    <span aria-hidden="true">+</span> New chat
                  </button>
                  {chatsLoading && <span className="menu-chat-empty">Loading chats…</span>}
                  {!chatsLoading && !savedChats.length && <span className="menu-chat-empty">Your conversations will appear here after an answer is saved.</span>}
                  {savedChats.map(chat => <button className="menu-chat-item" key={chat.id} type="button" onClick={() => { setMenuOpen(false); setChatsExpanded(false); onOpenChat?.(chat); }}>
                    <span>{chat.title || 'News chat'}</span><small>{new Date(chat.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small>
                  </button>)}
                </div>}
              </div>}
            </nav>
          </div>
        </div>
      </div>
      {children}
    </header>
  );
}
