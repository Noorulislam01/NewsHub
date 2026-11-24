import NewsCard from './NewsCard.jsx';
import { articleKey } from '../../../shared/storage.js';

export default function NewsGrid({ groups, showingSaved, totalArticles, loading, savedArticles, onSave }) {
  if (loading && groups.length === 0) {
    return <>{Array.from({ length: 6 }, (_, index) => <div className="skel" key={index} />)}</>;
  }

  if (groups.length === 0) {
    const title = showingSaved ? 'No saved articles' : (totalArticles ? 'No stories match these filters' : 'No news loaded');
    const message = showingSaved
      ? 'Tap ☆ Save on any news card to keep it here.'
      : (totalArticles ? 'Clear a filter or widen the date range.' : 'Check your connection, then press Refresh News. Feeds that failed are listed above.');
    return <div className="empty ui" style={{ gridColumn: '1 / -1' }}><h2>{title}</h2><p>{message}</p></div>;
  }

  const savedKeys = new Set(savedArticles.map(articleKey));
  return groups.map(({ main, others }) => (
    <NewsCard
      key={articleKey(main)}
      article={main}
      otherCoverage={others}
      saved={savedKeys.has(articleKey(main))}
      onSave={onSave}
    />
  ));
}
