export default function AppHeader({ theme, onThemeChange, showTheme = false, showFilter = false, filtersOpen = false, onFilterToggle }) {
  return (
    <header className="ui" id="pageTop">
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
