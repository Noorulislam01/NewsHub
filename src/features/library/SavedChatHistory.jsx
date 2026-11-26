import { useEffect } from 'react';

export default function SavedChatHistory({ open, authUser, chats = [], loading, onOpenChat, onRequireLogin, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ask-history-layer">
      <button className="ask-history-backdrop" type="button" aria-label="Close chat history" onClick={onClose} />
      <aside className="ask-chat-history ui" aria-labelledby="askChatHistoryTitle" role="dialog" aria-modal="true">
        <div className="ask-chat-history-heading">
          <h2 id="askChatHistoryTitle">Chat history</h2>
          <button className="ask-chat-history-close" type="button" aria-label="Close chat history" onClick={onClose}>×</button>
        </div>
        {!authUser ? (
          <button className="ask-chat-history-empty ask-chat-history-signin" type="button" onClick={() => { onClose?.(); onRequireLogin?.('Sign in to save and view your chat history.'); }}>Sign in to view saved conversations.</button>
        ) : loading ? (
          <p className="ask-chat-history-empty" role="status">Loading conversations…</p>
        ) : chats.length === 0 ? (
          <p className="ask-chat-history-empty">No saved chats yet. Ask a question to start one.</p>
        ) : (
          <div className="ask-chat-history-list" aria-label="Saved conversations">
            {chats.map(chat => (
              <button className="ask-chat-history-item" type="button" key={chat.id} onClick={() => onOpenChat?.(chat)}>
                <span>{chat.title || 'News chat'}</span>
                <small>{new Date(chat.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small>
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
