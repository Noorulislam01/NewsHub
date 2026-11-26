import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../shared/supabase/client.js';

const QUERY_STOP_WORDS = new Set('about after all and are can did does for from have how into its main news of on tell that the their them these this today was were what when where which who why with'.split(' '));

function tokens(value) {
  return new Set(String(value || '').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []);
}

function selectAskGroups(groups, question) {
  const queryTokens = [...tokens(question)].filter(token => !QUERY_STOP_WORDS.has(token));
  if (queryTokens.includes('ai')) queryTokens.push('artificial', 'intelligence');
  if (!queryTokens.length) return groups.slice(0, 30);

  const ranked = groups.map(group => {
    const articles = [group.main, ...group.others];
    const titleTokens = tokens(articles.map(article => article.title).join(' '));
    const categoryTokens = tokens(articles.flatMap(article => article.cats || []).join(' '));
    const excerptTokens = tokens(articles.map(article => article.summary).join(' '));
    const score = queryTokens.reduce((total, token) => total
      + (titleTokens.has(token) ? 5 : 0)
      + (categoryTokens.has(token) ? 4 : 0)
      + (excerptTokens.has(token) ? 2 : 0), 0);
    return { group, score };
  });
  const matches = ranked.filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || (right.group.main.date || 0) - (left.group.main.date || 0))
    .slice(0, 24);
  const selected = matches.map(item => item.group);
  const selectedSet = new Set(selected);
  return [...selected, ...groups.filter(group => !selectedSet.has(group)).slice(0, 30 - selected.length)];
}

function toNewsSources(groups, question) {
  return selectAskGroups(groups, question).flatMap(({ main, others }) => {
    const coverage = [main, ...others];
    return coverage.map(article => ({
      title: article.title,
      publisher: article.pub,
      category: (article.cats || []).join(', '),
      date: article.date ? new Date(article.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable',
      excerpt: article.summary || 'No excerpt provided by the publisher.',
      url: article.link,
      alsoCoveredBy: coverage.filter(other => other.pub !== article.pub).slice(0, 5).map(other => other.pub)
    }));
  }).slice(0, 30);
}

function normalizeAnswer(text) {
  return String(text || '')
    .replace(/\\\r?\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\([*_#[\]])/g, '$1')
    .replace(/\r\n?/g, '\n');
}

function newChatId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.random() * 16 | 0;
    return (char === 'x' ? random : (random & 0x3 | 0x8)).toString(16);
  });
}

function renderInline(text, keyPrefix) {
  const parts = String(text).split(/(\*\*[^*]+?\*\*|__[^_]+?__)/g).filter(Boolean);
  return parts.map((part, index) => {
    const bold = (part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'));
    return bold
      ? <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>
      : <span key={`${keyPrefix}-${index}`}>{part}</span>;
  });
}

function AnswerText({ text }) {
  const lines = normalizeAnswer(text).split('\n');
  return (
    <div className="briefing-answer-text">
      {lines.map((line, index) => {
        if (!line.trim()) return <div className="briefing-answer-space" key={`space-${index}`} />;
        const heading = line.match(/^\s*#{1,3}\s+(.+)$/);
        if (heading) return <h4 key={`heading-${index}`}>{renderInline(heading[1], `heading-${index}`)}</h4>;
        const bullet = line.match(/^\s*[-*+•]\s+(.+)$/);
        if (bullet) {
          return <p className="briefing-answer-bullet" key={`bullet-${index}`}><span aria-hidden="true">•</span><span>{renderInline(bullet[1], `bullet-${index}`)}</span></p>;
        }
        const numbered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
        if (numbered) {
          return <p className="briefing-answer-bullet" key={`number-${index}`}><span aria-hidden="true">{numbered[1]}.</span><span>{renderInline(numbered[2], `number-${index}`)}</span></p>;
        }
        return <p key={`paragraph-${index}`}>{renderInline(line, `paragraph-${index}`)}</p>;
      })}
    </div>
  );
}

export default function BriefingAsk({ groups, canAsk, onRequireLogin, savedChat, onSaveChat, onOpenSource, onNewChat, onClearStoryGroup, storyGroup, pageMode = false }) {
  const [question, setQuestion] = useState(storyGroup ? 'Compare coverage of this story: what do publishers agree on, what differs, and what is still unclear?' : '');
  const [status, setStatus] = useState('idle');
  const [messages, setMessages] = useState(() => Array.isArray(savedChat?.messages)
    ? savedChat.messages.map(message => ({ ...message, sourceNavigation: 'publisher' }))
    : []);
  const [chatId, setChatId] = useState(() => savedChat?.id || null);
  const [minimized, setMinimized] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const requestController = useRef(null);
  const answerCardRef = useRef(null);
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    if (!savedChat?.id) return;
    const historicalMessages = (Array.isArray(savedChat.messages) ? savedChat.messages : [])
      .map(message => ({ ...message, sourceNavigation: 'publisher' }));
    setMessages(historicalMessages);
    setChatId(savedChat.id);
    setQuestion('');
    setStatus('idle');
    setSaveState('saved');
    setMinimized(false);
  }, [savedChat?.id, savedChat?.updated_at]);

  useEffect(() => {
    const card = answerCardRef.current;
    if (card && messages.length) card.scrollTo({ top: card.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  function updateMessage(id, update) {
    setMessages(current => current.map(message => message.id === id ? { ...message, ...update } : message));
  }

  function clearSearch() {
    requestController.current?.abort();
    requestController.current = null;
    setQuestion('');
    setStatus('idle');
    setMessages([]);
    setChatId(null);
    setMinimized(false);
    setSaveState('idle');
    onNewChat?.();
  }

  function saveConversation(conversation = messages, id = chatId) {
    if (!canAsk || !conversation.length || !onSaveChat || !id) return Promise.resolve(null);
    setSaveState('saving');
    const snapshot = conversation.map(message => ({ ...message, sourceNavigation: 'publisher' }));
    saveQueueRef.current = saveQueueRef.current
      .catch(() => null)
      .then(() => onSaveChat({ id, title: conversation[0]?.question || 'News chat', messages: snapshot }))
      .then(saved => {
        setSaveState(saved ? 'saved' : 'error');
        return saved;
      });
    return saveQueueRef.current;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (trimmedQuestion.length < 3 || status === 'loading') return;
    if (!canAsk) {
      onRequireLogin?.('Sign in to ask questions about the briefing.');
      return;
    }
    const turnId = `${Date.now()}-${Math.random()}`;
    const pendingMessage = { id: turnId, question: trimmedQuestion, status: 'loading', answer: '', sources: [], error: '' };
    const pendingMessages = [...messages, pendingMessage];
    let currentChatId = chatId;
    setMessages(pendingMessages);
    setQuestion('');
    setMinimized(false);
    setStatus('loading');
    if (!supabase) {
      updateMessage(turnId, { status: 'error', error: 'Sign-in is not configured, so Ask News is unavailable.' });
      setStatus('done');
      return;
    }

    const controller = new AbortController();
    requestController.current = controller;
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (controller.signal.aborted) return;
      if (sessionError) throw sessionError;
      const token = data.session?.access_token;
      if (!token) {
        onRequireLogin?.('Sign in to ask questions about the briefing.');
        setMessages(current => current.filter(message => message.id !== turnId));
        setQuestion(trimmedQuestion);
        setStatus('idle');
        return;
      }

      currentChatId ||= newChatId();
      setChatId(currentChatId);
      void saveConversation(pendingMessages, currentChatId);

      const response = await fetch('/api/ask-news', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          history: messages.filter(message => message.status === 'done').slice(-4).map(({ question: previousQuestion, answer }) => ({ question: previousQuestion, answer })),
          stories: toNewsSources(groups, trimmedQuestion)
        })
      });
      let result = {};
      try { result = await response.json(); } catch {}
      if (!response.ok || !result.answer) {
        if (response.status === 404) throw new Error('Ask News is not available on this deployment yet.');
        throw new Error(result.error || 'Could not answer from the briefing.');
      }
      const completed = { id: turnId, question: trimmedQuestion, status: 'done', answer: result.answer, sources: Array.isArray(result.sources) ? result.sources : [], sourceNavigation: 'card', error: '' };
      const nextMessages = pendingMessages.map(message => message.id === turnId ? completed : message);
      setMessages(nextMessages);
      void saveConversation(nextMessages, currentChatId);
      setStatus('done');
    } catch (requestError) {
      if (requestError?.name === 'AbortError') return;
      const failedMessages = pendingMessages.map(message => message.id === turnId
        ? { ...message, status: 'error', error: requestError?.message || 'Could not answer from the briefing.' }
        : message);
      setMessages(failedMessages);
      setStatus('done');
      if (currentChatId) void saveConversation(failedMessages, currentChatId);
    } finally {
      if (requestController.current === controller) requestController.current = null;
    }
  }

  return (
    <section className={`briefing-ask ui${pageMode ? ' briefing-ask-page' : ''}`} aria-labelledby="briefingAskTitle">
      {!pageMode && <div className="briefing-ask-heading">
        <div>
          <h3 id="briefingAskTitle">{storyGroup ? 'Compare story coverage' : 'Ask about these stories'}</h3>
          <p>{storyGroup ? storyGroup.main.title : 'Answers use the briefing excerpts and link back to publishers.'}</p>
        </div>
        {storyGroup && <button className="briefing-ask-clear-scope" type="button" onClick={onClearStoryGroup}>Ask across current feed</button>}
      </div>}
      {pageMode && messages.length === 0 && <div className="briefing-ask-welcome">
        <h2>What would you like to know?</h2>
        <p>Ask a question about the latest stories in your feed.</p>
      </div>}
      {messages.length > 0 && (
        <div className={`briefing-answer${minimized ? ' is-minimized' : ''}${pageMode ? ' briefing-answer-inline' : ''}`} aria-live="polite" ref={answerCardRef}>
          {!pageMode ? <div className="briefing-answer-toolbar">
            <strong>News chat</strong>
            <div className="briefing-answer-toolbar-actions">
              {messages.length > 0 && <button className="briefing-answer-save-retry" type="button" onClick={() => saveConversation()} disabled={!canAsk || status === 'loading' || saveState === 'saving' || saveState === 'saved'} title={saveState === 'error' ? 'Retry saving this conversation' : 'Save this conversation'}>{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Retry save' : 'Save chat'}</button>}
              {saveState === 'error' && <span className="briefing-chat-save-state is-error" role="status">Couldn’t save</span>}
              <button className="briefing-answer-tool" type="button" onClick={() => setMinimized(value => !value)} aria-label={minimized ? 'Expand chat' : 'Minimize chat'} title={minimized ? 'Expand chat' : 'Minimize chat'} aria-expanded={!minimized}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{minimized ? <path d="m6 14 6-6 6 6" /> : <path d="M6 10h12" />}</svg>
              </button>
              <button className="briefing-answer-tool" type="button" onClick={clearSearch} aria-label="Close chat and clear conversation" title="Close chat">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
          </div> : saveState === 'error' && <div className="briefing-chat-save-error" role="status">Chat couldn’t save. <button type="button" onClick={() => saveConversation()} disabled={status === 'loading'}>Retry</button></div>}
          {!minimized && messages.map(message => (
            <section className="briefing-chat-turn" key={message.id}>
              <p className="briefing-chat-question">{message.question}</p>
              <div className="briefing-chat-response">
                {message.status === 'loading' && <p className="briefing-ask-state" role="status">Searching the news and preparing an answer…</p>}
                {message.status === 'error' && <p className="briefing-ask-error" role="alert">{message.error}</p>}
                {message.answer && <AnswerText text={message.answer} />}
                {message.sources.length > 0 && (
                  <div className="briefing-answer-sources">
                    <strong>Sources</strong>
                    <ol>
                      {message.sources.map((source, index) => (
                        <li key={`${source.url}-${index}`} value={source.id || index + 1}>
                          <a href={source.url} target="_blank" rel="noopener noreferrer" onClick={event => { if (message.sourceNavigation === 'card' && onOpenSource?.(source.url)) event.preventDefault(); }}>{source.title}</a>
                          <span> — {source.publisher}{source.alsoCoveredBy?.length ? `; also covered by ${source.alsoCoveredBy.join(', ')}` : ''}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
      <form className="briefing-ask-form" onSubmit={handleSubmit}>
        <div className="ask-news-composer-row">
          <div className="briefing-composer">
            <label className="sr-only" htmlFor="briefingQuestion">Your question about the news</label>
            <input
              type="text"
              id="briefingQuestion"
              value={question}
              onChange={event => setQuestion(event.target.value)}
              maxLength={500}
              autoComplete="off"
              enterKeyHint="send"
              placeholder="Ask about news in your current feed..."
            />
            <button className={`briefing-ask-submit${status === 'loading' ? ' is-loading' : ''}`} type="submit" aria-label={status === 'loading' ? 'Preparing answer' : 'Ask about the briefing'} title={status === 'loading' ? 'Preparing answer' : canAsk && !groups.length ? 'Load news before asking' : 'Ask about the briefing'} aria-busy={status === 'loading'} disabled={status === 'loading' || question.trim().length < 3 || (canAsk && !groups.length)}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />
              </svg>
            </button>
          </div>
          <button className="ask-news-new-chat-button" type="button" onClick={() => onNewChat?.()} aria-label="Start a new chat" title="New chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </form>
      {!pageMode && <p className="briefing-ask-disclaimer">Answers are based on RSS headlines and excerpts, which may not include the full articles.</p>}
    </section>
  );
}
