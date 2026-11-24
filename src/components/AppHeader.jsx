import { useEffect, useRef, useState } from 'react';

export default function AppHeader({ theme, savedCount, authUser, installAvailable, onThemeChange, onNavigate, onInstall, onSignOut, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);
  const menuRoot = useRef(null);
  const menuButton = useRef(null);

  useEffect(() => {
    function closeOutside(event) {
      if (menuRoot.current && !menuRoot.current.contains(event.target)) {
        setMenuOpen(false);
        setAccountExpanded(false);
      }
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
        setAccountExpanded(false);
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
    if (action === 'install') onInstall();
    else if (action === 'signout') onSignOut();
    else onNavigate(action);
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
                if (open) setAccountExpanded(false);
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
                    <span className="menu-symbol">&#x21AA;</span>Sign out
                  </button>
                </div>
              )}
              <button type="button" onClick={() => selectMenuAction('home')}><span className="menu-symbol">&#x2302;</span>Home</button>
              <button type="button" onClick={() => selectMenuAction('filters')}><span className="menu-symbol">&#x2637;</span>Filters</button>
              {installAvailable && <button type="button" onClick={() => selectMenuAction('install')}><span className="menu-symbol">&#x2B07;</span>Install app</button>}
              <button type="button" onClick={() => selectMenuAction('saved')}><span className="menu-symbol">&#x2605;</span>Saved Articles <span className="saved-count">{savedCount}</span></button>
            </nav>
          </div>
        </div>
      </div>
      {children}
    </header>
  );
}
