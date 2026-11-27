import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function MultiSelect({ id, label, items, selected, allText, allSelection, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(selected);
  const root = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    function closeOutside(event) {
      if (
        root.current &&
        !root.current.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape' && open) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const filteredItems = items.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));

  function openPanel() {
    setDraft(selected);
    setQuery('');
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
    setQuery('');
  }

  function toggle(idToToggle) {
    const next = new Set(draft);
    if (next.has(idToToggle)) next.delete(idToToggle);
    else next.add(idToToggle);
    setDraft([...next]);
  }

  return (
    <>
      <div className={`dd${open ? ' open' : ''}`} id={id} ref={root}>
        <button className="ddbtn" type="button" aria-expanded={open} onClick={() => open ? closePanel() : openPanel()}>
          {label}: {selected.length ? `${selected.length} selected` : 'none'}
        </button>
      </div>
      {open && createPortal(
        <div className="filter-select-overlay">
          <div className="panel filter-select-panel" ref={panelRef}>
            <div className="panel-header">
              <strong>{label}</strong>
              <button className="panel-close" type="button" aria-label={`Cancel ${label} selection`} onClick={closePanel}>×</button>
            </div>
            <div className="list">
              {filteredItems.length ? filteredItems.map(item => (
                <label key={item.id}>
                  <input type="checkbox" checked={draft.includes(item.id)} onChange={() => toggle(item.id)} />
                  {item.name}
                </label>
              )) : <div className="empty">No match</div>}
            </div>
            <div className="panel-footer">
              <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search…" aria-label={`Search ${label}`} />
              <div className="acts">
                <button className="btn" type="button" onClick={() => setDraft(allSelection)}>{allText}</button>
                <button className="btn" type="button" onClick={() => setDraft([])}>Clear All</button>
                <button className="btn" type="button" data-a="close" aria-label="Done selecting" onClick={() => { onChange(draft); closePanel(); }}>Done</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default function FilterPanel({ open, preferences, newspapers, categories, onChange, onShow, onClear, onCancel }) {
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="filter-dialog-layer">
      <button className="filter-dialog-backdrop" type="button" aria-label="Cancel and close filters" onClick={onCancel} />
      <section className="filter-dialog ui" id="tools" role="dialog" aria-modal="true" aria-labelledby="filterDialogTitle">
        <header className="filter-dialog-header">
          <div><h2 id="filterDialogTitle">Filters</h2><p>Choose the publishers, topics, and date range for your feed.</p></div>
          <button className="filter-dialog-close" type="button" aria-label="Close filters" onClick={onCancel}>×</button>
        </header>
        <div className="filter-dialog-fields">
          <MultiSelect id="ddPapers" label="Select Newspapers" items={newspapers} selected={preferences.papers} allText="Select All" allSelection={newspapers.map(source => source.id)} onChange={papers => onChange({ ...preferences, papers })} />
          <MultiSelect id="ddCats" label="Select Categories (Optional)" items={categories.map(category => ({ id: category, name: category }))} selected={preferences.cats} allText="All News" allSelection={['All News']} onChange={cats => onChange({ ...preferences, cats })} />
          <select value={preferences.range} aria-label="Date range" onChange={event => onChange({ ...preferences, range: event.target.value })}>
            <option value="latest">Latest News</option>
            <option value="24">Last 24 Hours</option>
            <option value="48">Last 48 Hours</option>
            <option value="168">Last 7 Days</option>
          </select>
        </div>
        <div className="filter-dialog-actions">
          <button className="btn filter-clear" type="button" onClick={onClear}>Clear filters</button>
          <button className="btn primary" type="button" onClick={onShow}>Show news</button>
        </div>
      </section>
    </div>
  );
}
