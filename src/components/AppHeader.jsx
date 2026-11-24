import { useEffect, useRef, useState } from 'react';

export default function AppHeader({ theme, savedCount, installAvailable, onThemeChange, onNavigate, onInstall, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRoot = useRef(null);
  const menuButton = useRef(null);

  useEffect(() => {
    function closeOutside(event) {
      if (menuRoot.current && !menuRoot.current.contains(event.target)) setMenuOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
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
    if (action === 'install') onInstall();
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
            {theme === 'dark' ? '☀' : '☾'}
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
              onClick={() => setMenuOpen(open => !open)}
            >
              <span /><span /><span />
            </button>
            <nav className="menu-panel" id="mainMenu" aria-label="Main menu" hidden={!menuOpen}>
              <button type="button" onClick={() => selectMenuAction('home')}><span className="menu-symbol">⌂</span>Home</button>
              <button type="button" onClick={() => selectMenuAction('filters')}><span className="menu-symbol">☷</span>Filters</button>
              {installAvailable && <button type="button" onClick={() => selectMenuAction('install')}><span className="menu-symbol">⬇</span>Install app</button>}
              <button type="button" onClick={() => selectMenuAction('saved')}><span className="menu-symbol">★</span>Saved Articles <span className="saved-count">{savedCount}</span></button>
            </nav>
          </div>
        </div>
      </div>
      {children}
    </header>
  );
}
