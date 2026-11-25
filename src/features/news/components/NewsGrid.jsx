import NewsCard from './NewsCard.jsx';
import { articleKey } from '../../../shared/storage.js';

export default function NewsGrid({ groups, showingSaved, totalArticles, loading, savedArticles, canSave, onSave, onRequireLogin, onRefresh }) {
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
  return groups.map(({ main, others }) => (
    <NewsCard
      key={articleKey(main)}
      article={main}
      otherCoverage={others}
      saved={savedKeys.has(articleKey(main))}
      canSave={canSave}
      onSave={onSave}
      onRequireLogin={onRequireLogin}
    />
  ));
}
