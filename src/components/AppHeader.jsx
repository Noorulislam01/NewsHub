import { useEffect, useState } from 'react';

export default function AppHeader({ theme, onThemeChange, showTheme = false, showFilter = false, filtersOpen = false, onFilterToggle, autoHide = false }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!autoHide || filtersOpen) {
      setHidden(false);
      return undefined;
    }

    let previousY = window.scrollY;
    let ticking = false;
    const updateHeader = () => {
      const currentY = window.scrollY;
      if (currentY <= 80) setHidden(false);
      else if (Math.abs(currentY - previousY) > 8) setHidden(currentY > previousY);
      previousY = currentY;
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateHeader);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [autoHide, filtersOpen]);

  useEffect(() => {
    document.body.classList.toggle('app-header-hidden', autoHide && hidden);
    return () => document.body.classList.remove('app-header-hidden');
  }, [autoHide, hidden]);

  return (
    <header className={`ui${autoHide ? ' header-auto-hide' : ''}${hidden && autoHide ? ' header-hidden' : ''}`} id="pageTop">
      <div className="bar">
        <div className="header-brand">
          <img className="header-logo" src="/one-news-hub-192.png" alt="One News Hub logo" width="44" height="44" />
          <div className="brand">One <span>News</span> Hub</div>
        </div>
        <div className="header-actions">
          {showTheme && <button
            className="btn theme-icon"
            type="button"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
          >
            <span className="theme-symbol" key={theme} aria-hidden="true">
              {theme === 'dark' ? '☀' : '☾'}
            </span>
          </button>}
          {showFilter && <button
            className={`btn header-filter-icon${filtersOpen ? ' is-active' : ''}`}
            type="button"
            aria-label={filtersOpen ? 'Close filters' : 'Open filters'}
            title={filtersOpen ? 'Close filters' : 'Open filters'}
            aria-expanded={filtersOpen}
            onClick={onFilterToggle}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M7 12h10m-7 6h4" /></svg>
          </button>}
        </div>
      </div>
    </header>
  );
}
