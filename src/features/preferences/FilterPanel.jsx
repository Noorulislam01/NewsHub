import { useEffect, useRef, useState } from 'react';

function MultiSelect({ id, label, items, selected, allText, onChange, onSelectAll }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef(null);

  useEffect(() => {
    function closeOutside(event) {
      if (root.current && !root.current.contains(event.target)) setOpen(false);
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

  function toggle(idToToggle) {
    const next = new Set(selected);
    if (next.has(idToToggle)) next.delete(idToToggle);
    else next.add(idToToggle);
    onChange([...next]);
  }

  return (
    <div className={`dd${open ? ' open' : ''}`} id={id} ref={root}>
      <button className="ddbtn" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        {label}: {selected.length ? `${selected.length} selected` : 'none'}
      </button>
      {open && (
        <div className="panel">
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search…" aria-label={`Search ${label}`} />
          <div className="acts">
            <button className="btn" type="button" onClick={() => onSelectAll ? onSelectAll() : onChange(items.map(item => item.id))}>{allText}</button>
            <button className="btn" type="button" onClick={() => onChange([])}>Clear All</button>
            <button className="btn" type="button" aria-label="Minimise list" onClick={() => setOpen(false)}>Done ▲</button>
          </div>
          <div className="list">
            {filteredItems.length ? filteredItems.map(item => (
              <label key={item.id}>
                <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                {item.name}
              </label>
            )) : <div className="empty">No match</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FilterPanel({ open, preferences, newspapers, categories, onChange, onSearch, search, onShow, onClear }) {
  return (
    <div className={`tools${open ? '' : ' hide'}`} id="tools" aria-label="News filters">
      <input type="search" value={search} onChange={event => onSearch(event.target.value)} placeholder="Search news" aria-label="Search news" />
      <MultiSelect id="ddPapers" label="Select Newspapers" items={newspapers} selected={preferences.papers} allText="Select All" onChange={papers => onChange({ ...preferences, papers })} />
      <MultiSelect id="ddCats" label="Select Categories (Optional)" items={categories.map(category => ({ id: category, name: category }))} selected={preferences.cats} allText="All News" onChange={cats => onChange({ ...preferences, cats })} onSelectAll={() => onChange({ ...preferences, cats: ['All News'] })} />
      <select
        value={preferences.range}
        aria-label="Date range"
        onChange={event => onChange({ ...preferences, range: event.target.value }, { reload: true })}
      >
        <option value="latest">Latest News</option>
        <option value="24">Last 24 Hours</option>
        <option value="48">Last 48 Hours</option>
        <option value="168">Last 7 Days</option>
      </select>
      <button className="btn primary" type="button" onClick={onShow}>SHOW NEWS</button>
      <button className="btn" type="button" onClick={onClear}>Clear Filters</button>
      <button className="btn" type="button" onClick={() => onChange({ ...preferences, papers: newspapers.map(source => source.id) })}>Select All Newspapers</button>
    </div>
  );
}
