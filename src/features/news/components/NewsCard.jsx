import { useState } from 'react';
import ArticleSummary from './ArticleSummary.jsx';
import { articleKey } from '../../../shared/storage.js';

function highlightPublisherLink(event) {
  const link = event.currentTarget;
  link.classList.add('is-opening');
  window.clearTimeout(link.highlightTimer);
  link.highlightTimer = window.setTimeout(() => link.classList.remove('is-opening'), 700);
}

function RelatedPublishers({ articles }) {
  return (
    <div className="also ui">
      Also covered by: {articles.map(article => (
        <a
          key={articleKey(article)}
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          onPointerDown={highlightPublisherLink}
          onClick={highlightPublisherLink}
        >
          {article.pub}
        </a>
      ))}
    </div>
  );
}

export default function NewsCard({ article, otherCoverage, saved, canSave = false, onSave }) {
  const [imageFailed, setImageFailed] = useState(false);

  function openArticle(event) {
    if (event.target.closest('.save-article,.sum-btn,.sum-box,a,button')) return;
    window.open(article.link, '_blank', 'noopener,noreferrer');
  }

  return (
    <article
      className="card"
      data-link={article.link}
      tabIndex="0"
      onClick={openArticle}
      onKeyDown={event => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
          event.preventDefault();
          window.open(article.link, '_blank', 'noopener,noreferrer');
        }
      }}
    >
      {article.img && !imageFailed && (
        <img src={article.img} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
      )}
      <div className="body">
        <div className="meta ui">
          <span className="pub">{article.pub}</span>
          <span>{article.cats?.[0]}</span>
          <span>{article.date ? new Date(article.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Date unavailable'}</span>
        </div>
        <h2>{article.title}</h2>
        {article.summary && <p>{article.summary}</p>}
        {otherCoverage.length > 0 && <RelatedPublishers articles={otherCoverage} />}
        <div className={`card-actions ui${canSave ? '' : ' summary-only'}`}>
          {canSave && (
            <button className={`save-article${saved ? ' is-saved' : ''}`} type="button" onClick={() => onSave(article)} aria-pressed={saved}>
              {saved ? '\u2605 Saved' : '\u2606 Save'}
            </button>
          )}
          <ArticleSummary article={article} />
        </div>
      </div>
    </article>
  );
}
