import { useEffect, useRef, useState } from 'react';

const TITLES = {
  signin: 'Welcome back',
  signup: 'Create your account',
  reset: 'Reset your password',
  recovery: 'Choose a new password'
};

export default function AuthDialog({
  open,
  initialMode = 'signin',
  configured,
  onClose,
  onSignIn,
  onSignUp,
  onSendPasswordReset,
  onUpdatePassword,
  onSuccess
}) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const firstField = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setMode(initialMode);
    setMessage('');
    setError('');
    setPassword('');
    setConfirmPassword('');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => firstField.current?.focus());
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, initialMode, onClose]);

  if (!open) return null;

  function switchMode(nextMode) {
    setMode(nextMode);
    setMessage('');
    setError('');
    setPassword('');
    setConfirmPassword('');
  }

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!configured) {
      setError('Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable accounts.');
      return;
    }

    if ((mode === 'signup' || mode === 'recovery') && password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        await onSignIn(email.trim(), password);
        onSuccess();
      } else if (mode === 'signup') {
        const result = await onSignUp(email.trim(), password);
        if (result.session) onSuccess();
        else setMessage('Account created. Check your email for a confirmation link, then sign in.');
      } else if (mode === 'reset') {
        await onSendPasswordReset(email.trim());
        setMessage('If an account uses that email, password reset instructions have been sent.');
      } else {
        await onUpdatePassword(password);
        setMessage('Your password has been updated.');
        window.setTimeout(onSuccess, 900);
      }
    } catch (requestError) {
      setError(requestError?.message || 'Account request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const needsPassword = mode === 'signin' || mode === 'signup';
  const needsNewPassword = mode === 'signup' || mode === 'recovery';
  const needsEmail = mode !== 'recovery';

  return (
    <div className="auth-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="auth-dialog ui" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <button className="auth-close" type="button" aria-label="Close account dialog" onClick={onClose} disabled={busy}>×</button>
        <div className="auth-brand-mark" aria-hidden="true">ON</div>
        <h2 id="authTitle">{TITLES[mode]}</h2>
        <p className="auth-intro">Sign in or create a One News Hub account. You can continue reading news without signing in.</p>

        {!configured && <div className="auth-setup-note">Supabase is not connected yet. Add the project URL and publishable key to the app environment to enable account actions.</div>}

        <form onSubmit={submit}>
          {needsEmail && (
            <label className="auth-field">
              <span>Email</span>
              <input
                ref={firstField}
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                disabled={busy}
              />
            </label>
          )}
          {needsPassword && (
            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                name="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={8}
                required
                value={password}
                onChange={event => setPassword(event.target.value)}
                disabled={busy}
              />
            </label>
          )}
          {mode === 'recovery' && (
            <label className="auth-field">
              <span>New password</span>
              <input ref={firstField} type="password" name="new-password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
            </label>
          )}
          {needsNewPassword && (
            <label className="auth-field">
              <span>Confirm password</span>
              <input type="password" name="confirm-password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} disabled={busy} />
            </label>
          )}

          {error && <div className="auth-message auth-error" role="alert">{error}</div>}
          {message && <div className="auth-message auth-success" role="status">{message}</div>}
          <button className="btn primary auth-submit" type="submit" disabled={busy || !configured}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Update password'}
          </button>
        </form>

        {mode === 'signin' && (
          <div className="auth-links">
            <button type="button" onClick={() => switchMode('reset')}>Forgot password?</button>
            <span>New here? <button type="button" onClick={() => switchMode('signup')}>Create an account</button></span>
          </div>
        )}
        {mode === 'signup' && <p className="auth-switch">Already have an account? <button type="button" onClick={() => switchMode('signin')}>Sign in</button></p>}
        {mode === 'reset' && <p className="auth-switch"><button type="button" onClick={() => switchMode('signin')}>Back to sign in</button></p>}
      </section>
    </div>
  );
}
