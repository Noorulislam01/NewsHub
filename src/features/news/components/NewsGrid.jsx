import { useEffect, useState } from 'react';
import NewsCard from './NewsCard.jsx';
import { articleKey } from '../../../shared/storage.js';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const PAGE_BUTTON_COUNT = 5;

export default function NewsGrid({ groups, showingSaved, resetKey, totalArticles, loading, savedArticles, readArticleKeys, canSave, onSave, onRequireLogin, onRefresh, onToggleRead }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  useEffect(() => {
    setPage(1);
  }, [resetKey, showingSaved]);

  if (loading && groups.length === 0) {
    return <>{Array.from({ length: 6 }, (_, index) => <div className="skel" key={index} />)}</>;
  }

  if (groups.length === 0) {
    const title = showingSaved ? 'No saved articles' : (totalArticles ? 'No stories match these filters' : 'Your news feed is ready');
    const message = showingSaved
      ? 'Tap ☆ Save on any news card to keep it here.'
      : (totalArticles ? 'Clear a filter or widen the date range.' : 'Load the latest headlines to get started. You can choose publishers and sections in Filters.');
    return (
      <div className="empty ui" style={{ gridColumn: '1 / -1' }}>
        <h2>{title}</h2>
        <p>{message}</p>
        {!showingSaved && !totalArticles && (
          <button className="btn primary" type="button" onClick={onRefresh}>Load latest news</button>
        )}
      </div>
    );
  }

  const savedKeys = new Set(savedArticles.map(articleKey));
  const pageCount = Math.ceil(groups.length / pageSize);
  const currentPage = Math.min(page, pageCount);
  const visibleGroups = groups.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstPage = Math.max(1, Math.min(currentPage - Math.floor(PAGE_BUTTON_COUNT / 2), pageCount - PAGE_BUTTON_COUNT + 1));
  const lastPage = Math.min(pageCount, firstPage + PAGE_BUTTON_COUNT - 1);

  const changePage = nextPage => {
    setPage(nextPage);
    document.getElementById('grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return <>
    {visibleGroups.map(({ main, others }) => (
      <NewsCard
        key={articleKey(main)}
        article={main}
        otherCoverage={others}
        saved={savedKeys.has(articleKey(main))}
        read={readArticleKeys?.has(articleKey(main)) || false}
        canSave={canSave}
        onSave={onSave}
        onRequireLogin={onRequireLogin}
        onToggleRead={onToggleRead}
      />
    ))}
    {pageCount > 1 && (
      <nav className="pagination" aria-label="News article pages">
        <label className="pagination-size">
          <span>Articles per page</span>
          <span className="pagination-select-wrap">
            <select
              value={pageSize}
              onChange={event => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
            <svg className="pagination-select-arrow" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4 6 4 4 4-4" />
            </svg>
          </span>
        </label>
        <div className="pagination-controls">
          <button className="btn pagination-button" type="button" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)} aria-label="Previous page">
            Previous
          </button>
          {Array.from({ length: lastPage - firstPage + 1 }, (_, index) => firstPage + index).map(pageNumber => (
            <button
              className={`btn pagination-button${pageNumber === currentPage ? ' active' : ''}`}
              type="button"
              key={pageNumber}
              aria-current={pageNumber === currentPage ? 'page' : undefined}
              aria-label={`Page ${pageNumber}`}
              onClick={() => changePage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          <button className="btn pagination-button" type="button" disabled={currentPage >= pageCount} onClick={() => changePage(currentPage + 1)} aria-label="Next page">
            Next
          </button>
        </div>
        <span className="pagination-status" aria-live="polite">Page {currentPage} of {pageCount}</span>
      </nav>
    )}
  </>;
}
