import { useEffect, useRef, useState } from 'react';

function ActionIcon({ type }) {
  const paths = {
    account: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-1.5a7 7 0 0 1 14 0V21" /></>,
    appearance: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
    install: <path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4" />,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.7 10.6 6.6-4.2m-6.6 9 6.6 4.2" /></>
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>;
}

export default function ToolsPage({ authUser, theme, onThemeChange, installAvailable, onInstall, onSignOut, onRequireLogin }) {
  const [shareFeedback, setShareFeedback] = useState('');
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const feedbackTimer = useRef(null);
  const cancelSignOutRef = useRef(null);

  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);

  useEffect(() => {
    if (!signOutOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => cancelSignOutRef.current?.focus());
    const closeOnEscape = event => {
      if (event.key === 'Escape' && !signingOut) setSignOutOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [signOutOpen, signingOut]);

  async function confirmSignOut() {
    setSigningOut(true);
    try {
      await onSignOut?.();
      setSignOutOpen(false);
    } finally {
      setSigningOut(false);
    }
  }

  async function copyAppUrl(url) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return;
    }
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

  async function shareApp() {
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const appUrl = import.meta.env.VITE_PUBLIC_SITE_URL?.trim()
      || (isLocal ? 'https://newshub-delta-nine.vercel.app/' : `${window.location.origin}/`);
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'One News Hub', text: 'A clearer view of the stories shaping today.', url: appUrl });
          setShareFeedback('Thanks for sharing One News Hub.');
        } catch (error) {
          if (error?.name === 'AbortError') return;
          await copyAppUrl(appUrl);
          setShareFeedback('App link copied.');
        }
      } else {
        await copyAppUrl(appUrl);
        setShareFeedback('App link copied.');
      }
    } catch {
      setShareFeedback('Could not share the app link.');
    }
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setShareFeedback(''), 2600);
  }

  return (
    <section className="tools-page ui" aria-labelledby="toolsPageTitle">
      <header className="tools-page-header">
        <h1 id="toolsPageTitle">Account</h1>
        <p>Manage your profile and app preferences.</p>
      </header>
      <section className="tools-page-account" aria-label="Account">
        <div className="tools-page-account-profile">
          <span className="tools-page-account-avatar"><ActionIcon type="account" /></span>
          <div className="tools-page-account-details">
            <h2>Your account</h2>
            <p>{authUser?.email || 'You are not signed in'}</p>
          </div>
          {authUser
            ? <button className="tools-page-secondary" type="button" onClick={() => setSignOutOpen(true)}>Sign out</button>
            : <button className="tools-page-secondary" type="button" onClick={() => onRequireLogin?.()}>Sign in</button>}
        </div>
      </section>
      <h2 className="tools-page-group-heading">Preferences</h2>
      <div className="tools-page-appearance">
        <span className="tools-page-icon"><ActionIcon type="appearance" /></span>
        <span className="tools-page-appearance-copy"><strong>Appearance</strong><small>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</small></span>
        <button
          className={`tools-page-theme-switch${theme === 'dark' ? ' is-on' : ''}`}
          type="button"
          role="switch"
          aria-checked={theme === 'dark'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => onThemeChange?.(theme === 'dark' ? 'light' : 'dark')}
        ><span /></button>
      </div>
      <h2 className="tools-page-group-heading">App</h2>
      <div className="tools-page-actions" aria-label="App tools">
        {installAvailable && <button className="tools-page-action" type="button" onClick={onInstall}>
          <span className="tools-page-icon"><ActionIcon type="install" /></span><span><strong>Install app</strong><small>Add One News Hub to your device</small></span><span className="tools-page-chevron" aria-hidden="true">›</span>
        </button>}
        <button className="tools-page-action" type="button" onClick={shareApp}>
          <span className="tools-page-icon"><ActionIcon type="share" /></span><span><strong>Share this app</strong><small>Send One News Hub to someone</small></span><span className="tools-page-chevron" aria-hidden="true">›</span>
        </button>
        {shareFeedback && <p className="tools-page-feedback" role="status" aria-live="polite">{shareFeedback}</p>}
      </div>
      {signOutOpen && (
        <div className="auth-overlay account-confirm-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !signingOut) setSignOutOpen(false); }}>
          <section className="auth-dialog account-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="signOutTitle" aria-describedby="signOutDescription">
            <button className="auth-close" type="button" aria-label="Close confirmation" onClick={() => setSignOutOpen(false)} disabled={signingOut}>×</button>
            <div className="account-confirm-heading">
              <div className="account-confirm-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></svg>
              </div>
              <h2 id="signOutTitle">Sign out?</h2>
            </div>
            <p className="auth-intro" id="signOutDescription">Are you sure you want to sign out of One News Hub?</p>
            <div className="account-confirm-actions">
              <button ref={cancelSignOutRef} className="btn" type="button" onClick={() => setSignOutOpen(false)} disabled={signingOut}>Cancel</button>
              <button className="btn primary" type="button" onClick={confirmSignOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
