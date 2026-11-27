import { useState } from 'react';
import SavedChatHistory from '../../library/SavedChatHistory.jsx';

export default function AskNewsPage({ hidden = false, authUser, chats, chatsLoading, onOpenChat, onRequireLogin, children }) {
  const [historyOpen, setHistoryOpen] = useState(false);

  function openSavedChat(chat) {
    setHistoryOpen(false);
    onOpenChat?.(chat);
  }

  return (
    <section className="ask-news-page ui" aria-labelledby="askNewsPageTitle" hidden={hidden}>
      <header className="ask-news-header">
        <div className="ask-news-title-group">
          <button className="ask-news-icon-button" type="button" onClick={() => setHistoryOpen(true)} aria-label="Open chat history" title="Chat history" aria-expanded={historyOpen}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div>
          <h1 id="askNewsPageTitle">Ask Me</h1>
          <p>Ask about news and research papers.</p>
          </div>
        </div>
      </header>
      <div className="ask-news-conversation">{children}</div>
      <SavedChatHistory
        open={historyOpen}
        authUser={authUser}
        chats={chats}
        loading={chatsLoading}
        onOpenChat={openSavedChat}
        onRequireLogin={onRequireLogin}
        onClose={() => setHistoryOpen(false)}
      />
    </section>
  );
}
