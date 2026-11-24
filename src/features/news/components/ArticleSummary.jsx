import { useState } from 'react';
import { articleKey, storage } from '../../../shared/storage.js';

const SUMMARY_ENDPOINT = '/api/summarize';

function readCachedSummary(key) {
  const cached = storage.get(`inh_sum_${key}`, null);
  return cached?.text
    ? { status: 'done', text: cached.text, basis: cached.basis }
    : { status: 'idle', text: '', basis: '' };
}

export default function ArticleSummary({ article }) {
  const [summary, setSummary] = useState(() => readCachedSummary(articleKey(article)));
  const [open, setOpen] = useState(false);

  async function handleToggle() {
    if (summary.status === 'loading') return;
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (summary.status === 'done') return;

    setSummary({ status: 'loading', text: '', basis: '' });
    try {
      const response = await fetch(SUMMARY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: article.link, title: article.title, snippet: article.summary || '' })
      });
      let data = {};
      try { data = await response.json(); } catch {}
      if (!response.ok || !data.summary) {
        const message = response.status === 404
          ? 'The summary API returned 404. Check this deployment includes the /api/summarize function.'
          : (data.error || 'Could not summarize this article.');
        throw new Error(message);
      }

      const result = { status: 'done', text: data.summary, basis: data.basis || '' };
      storage.set(`inh_sum_${articleKey(article)}`, { text: result.text, basis: result.basis });
      setSummary(result);
    } catch (error) {
      setSummary({ status: 'error', text: error?.message || 'Could not summarize this article.', basis: '' });
    }
  }

  return (
    <div className="summary-control">
      <button className="sum-btn" type="button" onClick={handleToggle} aria-expanded={open}>
        {summary.status === 'loading' ? '⏳ Summarizing…' : (open ? '✕ Hide summary' : '✨ Summary')}
      </button>
      {open && (
        <div className="sum-box ui" aria-live="polite">
          {summary.status === 'loading' && <div className="sum-loading">Reading the article and writing a summary…</div>}
          {summary.status === 'error' && <div className="sum-err">{summary.text} You can still tap the card to read it.</div>}
          {summary.status === 'done' && (
            <>
              <div className="sum-text" style={{ whiteSpace: 'pre-wrap' }}>{summary.text}</div>
              {summary.basis === 'snippet' && <div className="sum-note">Based on the headline and short preview only (the full article could not be read).</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
