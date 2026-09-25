import React, { useState } from 'react';
import { accessConfig } from './access-config';

const storageKey = 'ppl-access-version';

export default function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return Boolean(accessConfig.password) && localStorage.getItem(storageKey) === accessConfig.version;
    } catch {
      return false;
    }
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function signIn(event) {
    event.preventDefault();
    if (!accessConfig.password || password !== accessConfig.password) {
      setError('That password isn’t right. Please try again.');
      return;
    }
    try {
      localStorage.setItem(storageKey, accessConfig.version);
    } catch {
      // Access still works for this visit if browser storage is unavailable.
    }
    setPassword('');
    setError('');
    setUnlocked(true);
  }

  function signOut() {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Always lock the current view, even if browser storage is unavailable.
    }
    setUnlocked(false);
  }

  if (unlocked) return children(signOut);

  return (
    <div className="shell">
      <header>
        <div className="brand"><span className="mark">✦</span><div><strong>PPL Question Bank</strong><small>Private pilot practice</small></div></div>
      </header>
      <main className="login-main">
        <section className="panel login-panel" aria-labelledby="login-title">
          <span className="eyebrow">WELCOME ABOARD</span>
          <h1 id="login-title">Sign in to practise</h1>
          <p>Enter the shared password to open the question bank.</p>
          <form onSubmit={signIn}>
            <label htmlFor="shared-password">Password</label>
            <input id="shared-password" type="password" autoComplete="current-password" autoFocus required value={password} aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined} onChange={event => { setPassword(event.target.value); setError(''); }} />
            {error && <p id="login-error" className="login-error" role="alert">{error}</p>}
            <button className="primary" type="submit">Sign in <span aria-hidden="true">→</span></button>
          </form>
          <p className="fine">You’ll stay signed in on this browser until you sign out.</p>
        </section>
      </main>
      <footer>Based on the supplied PPL question PDFs · Study aid</footer>
    </div>
  );
}
