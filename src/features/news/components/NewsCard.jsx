import { useEffect, useRef, useState } from 'react';
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

function ReadStatusButton({ read, onToggle, overlay = false }) {
  return (
    <button
      className={`read-article${overlay ? ' read-article-overlay' : ''}${read ? ' is-read' : ''}`}
      type="button"
      aria-pressed={Boolean(read)}
      aria-label={read ? 'Mark this article unread' : 'Mark this article read'}
      title={read ? 'Mark as unread' : 'Mark as read'}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 7.5c-2-1.7-5-2-8-1.3v12c3-.7 6-.4 8 1.3m0-12c2-1.7 5-2 8-1.3v12c-3-.7-6-.4-8 1.3" />
        <path d="M12 7.5v12" />
      </svg>
    </button>
  );
}

export default function NewsCard({ article, otherCoverage, saved, read, canSave, onSave, onRequireLogin, onToggleRead }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [readNotice, setReadNotice] = useState('');
  const readNoticeTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(readNoticeTimer.current), []);

  function toggleRead() {
    onToggleRead?.(article);
    setReadNotice(read ? 'Marked as unread' : 'Marked as read');
    window.clearTimeout(readNoticeTimer.current);
    readNoticeTimer.current = window.setTimeout(() => setReadNotice(''), 1700);
  }

  function openArticle(event) {
    if (event.target.closest('.save-article,.read-article,.sum-btn,.sum-box,a,button')) return;
    window.open(article.link, '_blank', 'noopener,noreferrer');
  }

  return (
    <article
      className={`card${read ? ' is-read' : ''}`}
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
        <div className="card-image">
          <img src={article.img} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
          {canSave && <ReadStatusButton read={read} onToggle={toggleRead} overlay />}
          {canSave && readNotice && <div className="read-toast" role="status" aria-live="polite">{readNotice}</div>}
        </div>
      )}
      <div className="body">
        <div className="meta ui">
          <span className="pub">{article.pub}</span>
          <span>{article.cats?.[0]}</span>
          <span>{article.date ? new Date(article.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Date unavailable'}</span>
          {canSave && (!article.img || imageFailed) && <ReadStatusButton read={read} onToggle={toggleRead} />}
          {canSave && (!article.img || imageFailed) && readNotice && <div className="read-toast read-toast-inline" role="status" aria-live="polite">{readNotice}</div>}
        </div>
        <h2>{article.title}</h2>
        {article.summary && <p>{article.summary}</p>}
        {otherCoverage.length > 0 && <RelatedPublishers articles={otherCoverage} />}
        <div className="card-actions ui">
          <button className={`save-article${canSave && saved ? ' is-saved' : ''}`} type="button" onClick={() => canSave ? onSave?.(article) : onRequireLogin?.('Sign in to save this article.') } aria-pressed={Boolean(canSave && saved)}>
            {canSave && saved ? '\u2605 Saved' : '\u2606 Save'}
          </button>
          <ArticleSummary article={article} canSummarize={canSave} onRequireLogin={onRequireLogin} />
        </div>
      </div>
    </article>
  );
}
