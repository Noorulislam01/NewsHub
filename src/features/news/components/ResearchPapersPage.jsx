import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ArticleSummary from './ArticleSummary.jsx';
import { ArticleMenu, SaveArticleButton } from './NewsCard.jsx';
import RefreshButton from '../../../components/RefreshButton.jsx';
import { createSharedArticleUrl } from '../../../shared/sharedArticle.js';
import { articleKey } from '../../../shared/storage.js';

const SUBJECTS = [
  { id: 'all', label: 'All research' },
  { id: 'health', label: 'Health' },
  { id: 'physics', label: 'Physics' },
  { id: 'biology', label: 'Biology' }
];
const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const DEFAULT_PAGE_SIZE = 20;
const PAGE_BUTTON_COUNT = 5;
const RESEARCH_CACHE_KEY = 'onh_research_results_v1';
const RESEARCH_VIEW_KEY = 'onh_research_view_v1';

function readResearchCache() {
  try {
    const value = JSON.parse(window.localStorage.getItem(RESEARCH_CACHE_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writeResearchCache(requestKey, result) {
  try {
    const cache = readResearchCache();
    cache[requestKey] = { ...result, savedAt: Date.now() };
    const recentEntries = Object.entries(cache)
      .sort((left, right) => (right[1]?.savedAt || 0) - (left[1]?.savedAt || 0))
      .slice(0, 12);
    window.localStorage.setItem(RESEARCH_CACHE_KEY, JSON.stringify(Object.fromEntries(recentEntries)));
  } catch {
    // Keep the in-memory research feed usable when browser storage is unavailable or full.
  }
}

function readResearchView() {
  try {
    const value = JSON.parse(window.localStorage.getItem(RESEARCH_VIEW_KEY) || '{}');
    return {
      subject: SUBJECTS.some(item => item.id === value?.subject) ? value.subject : 'all',
      query: typeof value?.query === 'string' ? value.query.slice(0, 180) : ''
    };
  } catch {
    return { subject: 'all', query: '' };
  }
}

function writeResearchView(subject, query) {
  try {
    window.localStorage.setItem(RESEARCH_VIEW_KEY, JSON.stringify({ subject, query }));
  } catch {
    // Keep the research view usable when browser storage is unavailable.
  }
}

function researchRequestKey(category, query) {
  return `${category}\u0000${query}`;
}

async function fetchResearchPapers(category, query, signal, forceRefresh = false) {
  const params = new URLSearchParams({ category, limit: '30' });
  if (query) params.set('q', query);
  if (forceRefresh) params.set('refresh', '1');
  const response = await fetch(`/api/research?${params}`, { signal });
  let payload = {};
  try { payload = await response.json(); } catch {}
  if (!response.ok) throw new Error(payload.error || 'Could not load research papers.');
  return payload;
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function articleForPaper(paper) {
  return {
    kind: 'research',
    link: paper.url,
    title: paper.title,
    pub: paper.source,
    cats: paper.categories || [],
    date: paper.date ? Date.parse(paper.date) || undefined : undefined,
    summary: paper.abstract || '',
    img: '',
    researchPaper: paper
  };
}

function savedArticleToPaper(article) {
  return article.researchPaper || {
    id: article.link,
    title: article.title,
    authors: article.authors || [],
    date: article.date ? new Date(article.date).toISOString().slice(0, 10) : '',
    abstract: article.summary || '',
    source: article.pub || 'Research repository',
    recordType: article.recordType || 'Research article',
    categories: article.cats || [],
    doi: article.doi || '',
    url: article.link,
    pdfUrl: article.pdfUrl || '',
    openAccess: Boolean(article.openAccess)
  };
}

function PaperCard({ paper, savedArticles, readKeys, canSave, onSave, onToggleRead, onRequireLogin }) {
  const article = paper.article || articleForPaper(paper);
  const saved = savedArticles.some(item => articleKey(item) === articleKey(article));
  const read = readKeys.has(articleKey(article));
  const authors = paper.authors?.slice(0, 4).join(', ');
  const moreAuthors = (paper.authors?.length || 0) > 4 ? ' et al.' : '';
  const [notice, setNotice] = useState('');
  const [noticePosition, setNoticePosition] = useState('top');
  const [confirmUnsave, setConfirmUnsave] = useState(false);

  function showNotice(message, position = 'top') {
    setNoticePosition(position);
    setNotice(message);
    window.setTimeout(() => setNotice(''), 1800);
  }

  function toggleSaved() {
    if (!canSave) {
      onRequireLogin?.('Sign in to save this research paper.');
      return;
    }
    if (saved) {
      setConfirmUnsave(true);
      return;
    }
    savePaper();
  }

  function savePaper() {
    onSave?.(article);
    showNotice(saved ? 'Removed from your Library' : 'Saved to your Library', 'bottom');
  }

  async function sharePaper() {
    try {
      const url = createSharedArticleUrl(article);
      if (navigator.share) {
        try {
          await navigator.share({ title: article.title, text: `${article.title} - One News Hub`, url });
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const copyField = document.createElement('textarea');
        copyField.value = url;
        copyField.setAttribute('readonly', '');
        copyField.style.position = 'fixed';
        copyField.style.opacity = '0';
        document.body.append(copyField);
        copyField.select();
        const copied = document.execCommand('copy');
        copyField.remove();
        if (!copied) throw new Error('Clipboard access is unavailable.');
      }
      showNotice('One News Hub link copied');
    } catch {
      showNotice('Could not share this research paper');
    }
  }

  function toggleRead() {
    if (!canSave) {
      onRequireLogin?.('Sign in to mark research papers as read.');
      return;
    }
    onToggleRead?.(article);
    showNotice(read ? 'Marked as unread' : 'Marked as read');
  }

  function openPaper(event) {
    if (event.target.closest('.article-menu-wrap,.research-card-actions,.research-paper-links,a,button')) return;
    window.open(paper.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <article
      className={`research-paper-card${read ? ' is-read' : ''}`}
      data-link={paper.url}
      tabIndex="0"
      onClick={openPaper}
      onKeyDown={event => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
          event.preventDefault();
          window.open(paper.url, '_blank', 'noopener,noreferrer');
        }
      }}
    >
      <ArticleMenu read={canSave && read} onToggleRead={toggleRead} onShare={sharePaper} />
      <div className="research-paper-meta">
        <span>{paper.source}</span>
        <span className={paper.recordType === 'Preprint' ? 'research-preprint-badge' : 'research-record-badge'}>{paper.recordType}</span>
        <time dateTime={paper.date || undefined}>{formatDate(paper.date)}</time>
      </div>
      <h2><a href={paper.url} target="_blank" rel="noopener noreferrer">{paper.title}</a></h2>
      {authors && <p className="research-paper-authors">{authors}{moreAuthors}</p>}
      {paper.abstract && <p className="research-paper-abstract">{paper.abstract}</p>}
      {paper.categories?.length > 0 && <div className="research-paper-categories">{paper.categories.slice(0, 3).map(category => <span key={category}>{category}</span>)}</div>}
      <div className="research-paper-links">
        {paper.doi && <a className="research-doi" href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer">DOI</a>}
      </div>
      <div className="research-card-actions ui">
        <SaveArticleButton saved={canSave && saved} onClick={toggleSaved} />
        <ArticleSummary article={article} canSummarize={canSave} onRequireLogin={onRequireLogin} />
      </div>
      {notice && <div className={`card-feedback${noticePosition === 'bottom' ? ' card-feedback-bottom' : ''}`} role="status" aria-live="polite">{notice}</div>}
      {confirmUnsave && createPortal(
        <div className="auth-overlay account-confirm-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setConfirmUnsave(false); }}>
          <section className="auth-dialog account-confirm-dialog library-unsave-confirm" role="alertdialog" aria-modal="true" aria-labelledby="researchUnsaveTitle" aria-describedby="researchUnsaveDescription">
            <button className="auth-close" type="button" aria-label="Cancel removing paper" onClick={() => setConfirmUnsave(false)}>×</button>
            <div className="account-confirm-heading"><div className="account-confirm-mark" aria-hidden="true">R</div><h2 id="researchUnsaveTitle">Remove from Library?</h2></div>
            <p className="auth-intro" id="researchUnsaveDescription">Are you sure you want to remove this paper from your Library?</p>
            <div className="account-confirm-actions">
              <button className="btn" type="button" onClick={() => setConfirmUnsave(false)}>Cancel</button>
              <button className="btn primary" type="button" onClick={() => { setConfirmUnsave(false); savePaper(); }}>Remove</button>
            </div>
          </section>
        </div>,
        document.body
      )}
    </article>
  );
}

export default function ResearchPapersPage({ hidden = false, enabled = true, mode = 'browse', savedArticles = [], readKeys = new Set(), canSave = false, onSave, onToggleRead, onRequireLogin }) {
  const libraryMode = mode === 'library';
  const titleId = libraryMode ? 'librarySectionTitle' : 'researchTitle';
  const persistentCache = useRef(null);
  if (persistentCache.current === null) persistentCache.current = readResearchCache();
  const cachedEntries = persistentCache.current;
  const initialView = useRef(null);
  if (initialView.current === null) initialView.current = readResearchView();
  const [subject, setSubject] = useState(initialView.current.subject);
  const [draftQuery, setDraftQuery] = useState(initialView.current.query);
  const [query, setQuery] = useState(initialView.current.query);
  const [papersBySubject, setPapersBySubject] = useState(() => Object.fromEntries(Object.entries(cachedEntries).map(([key, value]) => [key, value?.papers || []])));
  const [unavailableBySubject, setUnavailableBySubject] = useState(() => Object.fromEntries(Object.entries(cachedEntries).map(([key, value]) => [key, value?.unavailable || []])));
  const [errorsBySubject, setErrorsBySubject] = useState({});
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchOpen, setSearchOpen] = useState(false);
  const fetchedKeys = useRef(new Set(Object.keys(cachedEntries)));
  const inFlightKeys = useRef(new Set());
  const requestControllers = useRef(new Map());
  const refreshGeneration = useRef(0);
  const currentRequestKey = researchRequestKey(subject, query);
  const currentRequestKeyRef = useRef(currentRequestKey);
  currentRequestKeyRef.current = currentRequestKey;
  const loading = subjectLoading || refreshingAll;
  const papers = papersBySubject[currentRequestKey] || [];
  const unavailable = unavailableBySubject[currentRequestKey] || [];
  const error = errorsBySubject[currentRequestKey] || '';

  useEffect(() => () => requestControllers.current.forEach(controller => controller.abort()), []);

  useEffect(() => {
    if (searchOpen) document.querySelector('.research-search input')?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!libraryMode) writeResearchView(subject, query);
  }, [subject, query, libraryMode]);

  useEffect(() => {
    if (!enabled || libraryMode) {
      return undefined;
    }
    const requestKey = researchRequestKey(subject, query);
    if (fetchedKeys.current.has(requestKey)) {
      setSubjectLoading(false);
      return undefined;
    }
    if (inFlightKeys.current.has(requestKey)) {
      setSubjectLoading(true);
      return undefined;
    }
    const controller = new AbortController();
    requestControllers.current.set(requestKey, controller);
    inFlightKeys.current.add(requestKey);
    setSubjectLoading(true);
    setErrorsBySubject(current => ({ ...current, [requestKey]: '' }));
    setPage(1);

    fetchResearchPapers(subject, query, controller.signal)
      .then(payload => {
        const result = { papers: payload.papers || [], unavailable: payload.unavailable || [] };
        setPapersBySubject(current => ({ ...current, [requestKey]: result.papers }));
        setUnavailableBySubject(current => ({ ...current, [requestKey]: result.unavailable }));
        writeResearchCache(requestKey, result);
      })
      .catch(requestError => {
        if (requestError.name !== 'AbortError') {
          setErrorsBySubject(current => ({ ...current, [requestKey]: requestError.message || 'Could not load research papers.' }));
        }
      })
      .finally(() => {
        if (requestControllers.current.get(requestKey) === controller) {
          requestControllers.current.delete(requestKey);
          inFlightKeys.current.delete(requestKey);
          if (!controller.signal.aborted) {
            fetchedKeys.current.add(requestKey);
            if (currentRequestKey === requestKey) setSubjectLoading(false);
          }
        }
      });
  }, [subject, query, enabled, libraryMode]);

  async function refreshAllResearch() {
    if (libraryMode) return;
    const generation = ++refreshGeneration.current;
    const refreshQuery = query;
    const requestKeys = SUBJECTS.map(item => researchRequestKey(item.id, refreshQuery));
    requestControllers.current.forEach(controller => controller.abort());
    requestControllers.current.clear();
    inFlightKeys.current.clear();
    setSubjectLoading(false);
    setRefreshingAll(true);
    setPage(1);
    setErrorsBySubject(current => {
      const next = { ...current };
      requestKeys.forEach(key => { next[key] = ''; });
      return next;
    });

    const results = await Promise.allSettled(SUBJECTS.map(async item => {
      const requestKey = researchRequestKey(item.id, refreshQuery);
      const controller = new AbortController();
      requestControllers.current.set(requestKey, controller);
      inFlightKeys.current.add(requestKey);
      try {
        const payload = await fetchResearchPapers(item.id, refreshQuery, controller.signal, true);
        if (generation === refreshGeneration.current) {
          const result = { papers: payload.papers || [], unavailable: payload.unavailable || [] };
          setPapersBySubject(current => ({ ...current, [requestKey]: result.papers }));
          setUnavailableBySubject(current => ({ ...current, [requestKey]: result.unavailable }));
          setErrorsBySubject(current => ({ ...current, [requestKey]: '' }));
          writeResearchCache(requestKey, result);
          fetchedKeys.current.add(requestKey);
        }
        return { key: requestKey, ok: true };
      } catch (requestError) {
        if (requestError.name !== 'AbortError' && generation === refreshGeneration.current) {
          fetchedKeys.current.add(requestKey);
          setErrorsBySubject(current => ({ ...current, [requestKey]: requestError.message || 'Could not load research papers.' }));
        }
        return { key: requestKey, ok: false };
      } finally {
        if (requestControllers.current.get(requestKey) === controller) {
          requestControllers.current.delete(requestKey);
          inFlightKeys.current.delete(requestKey);
        }
      }
    }));

    if (generation === refreshGeneration.current) {
      const successCount = results.filter(result => result.status === 'fulfilled' && result.value.ok).length;
      if (!successCount) {
        const requestKey = researchRequestKey(subject, refreshQuery);
        setErrorsBySubject(current => ({
          ...current,
          [requestKey]: 'Research sources are temporarily unavailable. Please try again.'
        }));
      }
      setSubjectLoading(inFlightKeys.current.has(currentRequestKeyRef.current));
      setRefreshingAll(false);
    }
  }

  const displayedPapers = libraryMode
    ? savedArticles.filter(article => article.kind === 'research').map(article => ({ ...savedArticleToPaper(article), article }))
    : papers;
  const pageCount = Math.ceil(displayedPapers.length / pageSize);
  const currentPage = Math.min(page, Math.max(1, pageCount));
  const visiblePapers = displayedPapers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstPage = Math.max(1, Math.min(currentPage - Math.floor(PAGE_BUTTON_COUNT / 2), pageCount - PAGE_BUTTON_COUNT + 1));
  const lastPage = Math.min(pageCount, firstPage + PAGE_BUTTON_COUNT - 1);

  function changePage(nextPage) {
    setPage(nextPage);
    document.getElementById(titleId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section className="research-page ui" hidden={hidden} aria-labelledby={titleId}>
      {!libraryMode && <header className="research-page-header">
        <div>
          <h1 id={titleId}>Research Papers</h1>
          <p>Explore open research and follow links to the paper source.</p>
        </div>
      </header>}

      {!libraryMode && <form className={`research-search${searchOpen ? ' is-open' : ''}`} role="search" onSubmit={event => {
        event.preventDefault();
        if (!searchOpen) return;
        const nextQuery = draftQuery.trim();
        if (nextQuery !== query) setQuery(nextQuery);
      }}>
        <input type="text" inputMode="search" value={draftQuery} onChange={event => setDraftQuery(event.target.value)} placeholder="Search research papers…" aria-label="Search research papers" />
        {searchOpen && <button className="research-close" type="button" aria-label="Close research search" title="Close search" onClick={() => setSearchOpen(false)}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>}
        {searchOpen && <RefreshButton inline refreshing={loading} itemLabel="research papers" onRefresh={refreshAllResearch} />}
        <button className="btn primary research-submit" type={searchOpen ? 'submit' : 'button'} aria-label={searchOpen ? 'Search research papers' : 'Open research search'} aria-expanded={searchOpen} title="Search research papers" disabled={searchOpen && loading} onClick={() => { if (!searchOpen) setSearchOpen(true); }}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.4 15.4 4.1 4.1" /></svg>
        </button>
      </form>}

      {!libraryMode && <nav className="research-subjects" aria-label="Research subjects">
        {SUBJECTS.map(item => <button
          className={`research-subject${subject === item.id ? ' is-active' : ''}`}
          key={item.id}
          type="button"
          aria-pressed={subject === item.id}
          onClick={() => setSubject(item.id)}
        >{item.label}</button>)}
      </nav>}

      {!libraryMode && unavailable.length > 0 && <p className="research-source-note" role="status">Some sources are unavailable: {unavailable.join(', ')}.</p>}
      {!libraryMode && error && <div className="research-state research-error" role="alert"><p>{error}</p><button className="btn" type="button" onClick={refreshAllResearch}>Try again</button></div>}
      {!libraryMode && loading && papers.length === 0 && <div className="research-state" role="status">Loading research papers…</div>}
      {!libraryMode && !loading && !error && papers.length === 0 && <div className="research-state"><h2>No papers found</h2><p>Try another search or subject.</p></div>}
      {libraryMode && displayedPapers.length === 0 && <div className="research-state"><h2>No saved research yet</h2><p>Use the save button on any research paper to add it to this section of your Library.</p></div>}
      {displayedPapers.length > 0 && <div className="research-paper-grid">
        {visiblePapers.map(paper => <PaperCard
          paper={paper}
          key={paper.id || paper.url}
          savedArticles={savedArticles}
          readKeys={readKeys}
          canSave={canSave}
          onSave={onSave}
          onToggleRead={onToggleRead}
          onRequireLogin={onRequireLogin}
        />)}
      </div>}
      {pageCount > 1 && <nav className="pagination research-pagination" aria-label="Research paper pages">
        <label className="pagination-size">
          <span>Papers per page</span>
          <span className="pagination-select-wrap">
            <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>
              {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
            <svg className="pagination-select-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
          </span>
        </label>
        <div className="pagination-controls">
          <button className="btn pagination-button pagination-prev" type="button" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)} aria-label="Previous page">
            <span className="pagination-arrow" aria-hidden="true">‹</span>
            <span className="pagination-button-label pagination-desktop-label">Previous</span>
            <span className="pagination-button-label pagination-mobile-label">Prev</span>
          </button>
          {Array.from({ length: lastPage - firstPage + 1 }, (_, index) => firstPage + index).map(pageNumber => <button
            className={`btn pagination-button${pageNumber === currentPage ? ' active' : ''}`}
            type="button"
            key={pageNumber}
            aria-current={pageNumber === currentPage ? 'page' : undefined}
            aria-label={`Page ${pageNumber}`}
            onClick={() => changePage(pageNumber)}
          >{pageNumber}</button>)}
          <button className="btn pagination-button pagination-next" type="button" disabled={currentPage >= pageCount} onClick={() => changePage(currentPage + 1)} aria-label="Next page">
            <span className="pagination-button-label">Next</span>
            <span className="pagination-arrow" aria-hidden="true">›</span>
          </button>
        </div>
        <span className="pagination-status" aria-live="polite">Page {currentPage} of {pageCount}</span>
      </nav>}
      {!libraryMode && loading && papers.length > 0 && <p className="research-source-note" role="status">Updating papers…</p>}
      {!libraryMode && <p className="research-disclaimer">Research records link to their original repositories or publishers. Preprints are not necessarily peer reviewed.</p>}
    </section>
  );
}
