import { useEffect, useRef, useState } from 'react';
import ArticleSummary from './ArticleSummary.jsx';
import { articleKey } from '../../../shared/storage.js';
import { createSharedArticleUrl } from '../../../shared/sharedArticle.js';

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

function SaveArticleButton({ saved, onClick }) {
  return (
    <button
      className={`save-article-button${saved ? ' is-saved' : ''}`}
      type="button"
      aria-pressed={Boolean(saved)}
      aria-label={saved ? 'Remove article from Library' : 'Save article to Library'}
      title={saved ? 'Remove from Library' : 'Save to Library'}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75Z" />
      </svg>
      <span>{saved ? 'Saved' : 'Save'}</span>
    </button>
  );
}

function ArticleMenu({ read, onToggleRead, onShare }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = event => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="article-menu-wrap" ref={menuRef}>
      <button
        className="article-menu-trigger"
        type="button"
        onClick={event => { event.stopPropagation(); setOpen(value => !value); }}
        aria-label="Article options"
        aria-expanded={open}
        title="Article options"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {open && (
        <div className="article-menu" role="menu" aria-label="Article actions">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onToggleRead(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4.5h14v15H5z" /><path d="M8 8h8m-8 4h8m-8 4h5" />
            </svg>
            <span>{read ? 'Mark as unread' : 'Mark as read'}</span>
          </button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onShare(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <path d="m8.7 10.6 6.6-4.2m-6.6 9 6.6 4.2" />
            </svg>
            <span>Share this article</span>
          </button>
        </div>
      )}
    </div>
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
    showCardNotice(read ? 'Marked as unread' : 'Marked as read');
  }

  function toggleSaved() {
    if (!canSave) {
      onRequireLogin?.('Sign in to save this article.');
      return;
    }
    onSave?.(article);
    showCardNotice(saved ? 'Removed from your library' : 'Saved to your library', 'bottom');
  }

  async function shareArticle() {
    try {
      const url = createSharedArticleUrl(article);
      if (navigator.share) {
        try {
          await navigator.share({ title: article.title, text: `${article.title} — One News Hub`, url });
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('textarea');
        input.value = url;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.append(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('Clipboard access is unavailable.');
      }
      showCardNotice('One News Hub link copied');
    } catch {
      showCardNotice('Could not share this article');
    }
  }

  function openArticle(event) {
    if (event.target.closest('.article-menu-wrap,.read-article,.sum-btn,.sum-box,a,button')) return;
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
          <ArticleMenu read={canSave && read} onToggleRead={toggleRead} onShare={shareArticle} />
        </div>
      )}
      <div className="body">
        <div className="card-copy">
          {(!article.img || imageFailed) && <ArticleMenu read={canSave && read} onToggleRead={toggleRead} onShare={shareArticle} />}
          <div className="meta ui">
            <span className="pub">{article.pub}</span>
            <span>{article.cats?.[0]}</span>
            <span>{article.date ? new Date(article.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Date unavailable'}</span>
          </div>
          <h2>{article.title}</h2>
          {article.summary && <p>{article.summary}</p>}
          {otherCoverage.length > 0 && <RelatedPublishers articles={otherCoverage} />}
        </div>
        <div className="card-actions ui">
          <SaveArticleButton saved={canSave && saved} onClick={toggleSaved} />
          <ArticleSummary article={article} canSummarize={canSave} onRequireLogin={onRequireLogin} />
        </div>
      </div>
      {cardNotice && <div className={`card-feedback${noticePosition === 'bottom' ? ' card-feedback-bottom' : ''}`} role="status" aria-live="polite">{cardNotice}</div>}
    </article>
  );
}
