import { useEffect, useRef, useState } from 'react';

const TAB_ICONS = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  library: <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75Z" />,
  ask: <><path d="M5 5.75A2.75 2.75 0 0 1 7.75 3h8.5A2.75 2.75 0 0 1 19 5.75v7.5A2.75 2.75 0 0 1 16.25 16H10l-5 4v-6.5A2.75 2.75 0 0 1 5 13V5.75Z" /><path d="M8 8h8M8 11.5h5" /></>,
  tools: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-1.5a7 7 0 0 1 14 0V21" /></>
};

function Icon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TAB_ICONS[name]}</svg>;
}

function readSeenSavedCount(userId) {
  try {
    const value = window.localStorage.getItem(`onh_library_seen_${userId || 'guest'}`);
    if (value === null) return null;
    const count = Number(value);
    return Number.isFinite(count) && count >= 0 ? count : null;
  } catch {
    return null;
  }
}

function writeSeenSavedCount(userId, count) {
  try {
    window.localStorage.setItem(`onh_library_seen_${userId || 'guest'}`, String(count));
  } catch {
    // Keep the tab badge functional for this session if storage is unavailable.
  }
}

export default function BottomNavigation({ activeTab, savedCount, authUser, savedCountReady, onTabChange }) {
  const currentUserId = authUser?.id || null;
  const userIdRef = useRef(currentUserId);
  const [seenSavedCount, setSeenSavedCount] = useState(() => readSeenSavedCount(currentUserId));

  useEffect(() => {
    if (userIdRef.current !== currentUserId) {
      userIdRef.current = currentUserId;
      setSeenSavedCount(readSeenSavedCount(currentUserId));
      return;
    }
    if (!savedCountReady) return;
    if (seenSavedCount === null) {
      setSeenSavedCount(savedCount);
      writeSeenSavedCount(currentUserId, savedCount);
      return;
    }
    if (activeTab === 'library' || savedCount < seenSavedCount) {
      setSeenSavedCount(savedCount);
      writeSeenSavedCount(currentUserId, savedCount);
    }
  }, [activeTab, currentUserId, savedCount, savedCountReady, seenSavedCount]);

  const unseenSavedCount = Math.max(0, savedCount - (seenSavedCount ?? savedCount));

  return (
    <nav className="bottom-navigation-shell ui" aria-label="Main navigation">
      <div className="bottom-navigation">
        {[
          ['home', 'Home'], ['ask', 'Ask News'], ['library', 'Library'], ['tools', 'Account']
        ].map(([tab, label]) => <button
          className={`bottom-tab${activeTab === tab ? ' is-active' : ''}`}
          type="button"
          key={tab}
          aria-current={activeTab === tab ? 'page' : undefined}
          onClick={() => onTabChange(tab)}
        >
          <Icon name={tab} />
          <span>{label}</span>
          {tab === 'library' && unseenSavedCount > 0 && activeTab !== 'library' && <small>{unseenSavedCount}</small>}
        </button>)}
      </div>
    </nav>
  );
}
