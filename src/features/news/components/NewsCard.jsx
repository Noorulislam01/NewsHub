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

function ReadStatusButton({ read, onToggle }) {
  return (
    <button
      className={`read-article${read ? ' is-read' : ''}`}
      type="button"
      aria-pressed={Boolean(read)}
      aria-label={read ? 'Mark this article unread' : 'Mark this article read'}
      title={read ? 'Mark as unread' : 'Mark as read'}
      onClick={onToggle}
    >
      <span>{read ? 'Unread' : 'Read'}</span>
    </button>
  );
}

function SaveButton({ saved, onClick, overlay = false }) {
  return (
    <button
      className={`save-article save-article-icon${overlay ? ' save-article-overlay' : ''}${saved ? ' is-saved' : ''}`}
      type="button"
      onClick={onClick}
      aria-label={saved ? 'Remove saved article' : 'Save article'}
      aria-pressed={Boolean(saved)}
      title={saved ? 'Remove saved article' : 'Save article'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75Z" />
      </svg>
    </button>
  );
}

export default function NewsCard({ article, otherCoverage, saved, read, canSave, onSave, onRequireLogin, onToggleRead }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [cardNotice, setCardNotice] = useState('');
  const [noticePosition, setNoticePosition] = useState('top');
  const cardNoticeTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(cardNoticeTimer.current), []);

  function showCardNotice(message, position = 'top') {
    setCardNotice(message);
    setNoticePosition(position);
    window.clearTimeout(cardNoticeTimer.current);
    cardNoticeTimer.current = window.setTimeout(() => setCardNotice(''), 1800);
  }

  function toggleRead() {
    if (!canSave) {
      onRequireLogin?.('Sign in to mark articles as read.');
      return;
    }
    onToggleRead?.(article);
    showCardNotice(read ? 'Marked as unread' : 'Marked as read', 'bottom');
  }

  function toggleSaved() {
    if (!canSave) {
      onRequireLogin?.('Sign in to save this article.');
      return;
    }
    onSave?.(article);
    showCardNotice(saved ? 'Removed from your saved articles' : 'Saved to your library');
  }

  function openArticle(event) {
    if (event.target.closest('.save-article,.read-article,.sum-btn,.sum-box,a,button')) return;
    window.open(article.link, '_blank', 'noopener,noreferrer');
  }

  return (
    <article
      className={`card${read ? ' is-read' : ''}${!article.img || imageFailed ? ' card-no-image' : ''}`}
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
          <SaveButton saved={canSave && saved} onClick={toggleSaved} overlay />
        </div>
      )}
      {(!article.img || imageFailed) && <SaveButton saved={canSave && saved} onClick={toggleSaved} overlay />}
      <div className="body">
        <div className="meta ui">
          <span className="pub">{article.pub}</span>
          <span>{article.cats?.[0]}</span>
          <span>{article.date ? new Date(article.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Date unavailable'}</span>
        </div>
        <h2>{article.title}</h2>
        {article.summary && <p>{article.summary}</p>}
        {otherCoverage.length > 0 && <RelatedPublishers articles={otherCoverage} />}
        <div className="card-actions ui">
          <ReadStatusButton read={canSave && read} onToggle={toggleRead} />
          <ArticleSummary article={article} canSummarize={canSave} onRequireLogin={onRequireLogin} />
        </div>
      </div>
      {cardNotice && <div className={`card-feedback${noticePosition === 'bottom' ? ' card-feedback-bottom' : ''}`} role="status" aria-live="polite">{cardNotice}</div>}
    </article>
  );
}
