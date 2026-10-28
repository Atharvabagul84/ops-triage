'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { AUTH_EMAIL_UNAVAILABLE_MESSAGE } from '@/lib/cloud/emailReadiness';
import { useCloudAccount, type AccountPanelProps } from './useCloudAccount';
import styles from './account.module.css';

function AccountForm({ busy, emailEnabled, authenticate, requestReset }: { busy: boolean; emailEnabled: boolean; authenticate: (mode: 'signin' | 'signup', email: string, password: string) => Promise<boolean>; requestReset: (email: string) => Promise<void> }) {
  const id = useId();
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    if (mode === 'reset') { await requestReset(email); return; }
    if (mode === 'signup' && password !== confirmation) { setError('Passwords must match.'); return; }
    if (await authenticate(mode, email, password)) { setPassword(''); setConfirmation(''); }
  };
  return <form onSubmit={submit} className={styles.form}>
    <div className={styles.actions} aria-label="Account action">
      <button type="button" aria-pressed={mode === 'signin'} disabled={busy} onClick={() => { setMode('signin'); setError(''); }}>Sign in</button>
      {emailEnabled && <><button type="button" aria-pressed={mode === 'signup'} disabled={busy} onClick={() => { setMode('signup'); setError(''); }}>Create account</button>
      <button type="button" aria-pressed={mode === 'reset'} disabled={busy} onClick={() => { setMode('reset'); setPassword(''); setConfirmation(''); setError(''); }}>Forgot password</button></>}
    </div>
    {!emailEnabled && <p className={styles.muted}>{AUTH_EMAIL_UNAVAILABLE_MESSAGE}</p>}
    <div className={styles.fields}>
      <label htmlFor={`${id}-email`}>Email<input id={`${id}-email`} type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} /></label>
      {mode !== 'reset' && <label htmlFor={`${id}-password`}>Password<input id={`${id}-password`} type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 8 : 1} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /></label>}
      {mode === 'signup' && <label htmlFor={`${id}-confirmation`}>Confirm password<input id={`${id}-confirmation`} type="password" autoComplete="new-password" required minLength={8} maxLength={256} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} /></label>}
    </div>
    {mode === 'signup' && <p className={styles.muted}>Use at least 8 characters. You may need to confirm your email before signing in.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button type="submit" className={styles.primary} disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in to account' : mode === 'reset' ? 'Send password reset email' : 'Create account with email'}</button>
  </form>;
}

function RecoveryForm({ busy, resetPassword, signOut }: { busy: boolean; resetPassword: (password: string) => Promise<boolean>; signOut: () => Promise<void> }) {
  const id = useId();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    if (password !== confirmation) { setError('Passwords must match.'); return; }
    if (await resetPassword(password)) { setPassword(''); setConfirmation(''); }
  };
  return <form onSubmit={submit} className={styles.form}>
    <p>Your recovery link was accepted. Choose a new password.</p>
    <div className={styles.fields}>
      <label htmlFor={`${id}-new`}>New password<input id={`${id}-new`} type="password" autoComplete="new-password" required minLength={8} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /></label>
      <label htmlFor={`${id}-confirm`}>Confirm new password<input id={`${id}-confirm`} type="password" autoComplete="new-password" required minLength={8} maxLength={256} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} /></label>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}><button type="submit" className={styles.primary} disabled={busy}>Update password</button><button type="button" disabled={busy} onClick={signOut}>Cancel and sign out</button></div>
  </form>;
}

export function AccountPanel(props: AccountPanelProps & { openRequest?: number }) {
  const account = useCloudAccount(props);
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!panel.current || !(account.recovering || account.callbackIssue)) return;
    panel.current.open = true;
    panel.current.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, [account.recovering, account.callbackIssue]);
  useEffect(() => {
    const openFromLink = () => {
      if (window.location.hash !== '#account' || !panel.current) return;
      panel.current.open = true;
      panel.current.scrollIntoView({ behavior: 'instant', block: 'start' });
      const email = panel.current.querySelector<HTMLInputElement>('input[type="email"]:not(:disabled)');
      (email ?? panel.current.querySelector('summary'))?.focus({ preventScroll: true });
    };
    openFromLink();
    window.addEventListener('hashchange', openFromLink);
    return () => window.removeEventListener('hashchange', openFromLink);
  }, [account.ready, props.openRequest]);
  return <details id="account" className={styles.panel} ref={panel}>
    <summary><span>Optional account &amp; cloud notebook</span><span className={styles.badge}>{account.session ? 'Signed in' : 'No account required'}</span></summary>
    <div className={styles.body}>
      <p>Practice is saved on this device. Signing in does not upload or download your notebook. Cloud transfers happen only when you choose them.</p>
      {!account.ready ? <p role="status">Checking account availability…</p> : !account.configured ? <p className={styles.muted}>Cloud accounts are not configured for this deployment. Practice and notebook exports still work on this device.</p> : !account.session ? <AccountForm busy={account.busy} emailEnabled={account.emailEnabled} authenticate={account.authenticate} requestReset={account.requestReset} /> : account.recovering ? <RecoveryForm busy={account.busy} resetPassword={account.resetPassword} signOut={account.signOut} /> : <>
        <div className={styles.identity}><span>Signed in as <strong>{account.session.user.email ?? 'your account'}</strong></span><button type="button" disabled={account.busy} onClick={account.signOut}>Sign out on this device</button></div>
        <div className={styles.cloudState}>
          {account.cloud === undefined ? 'Cloud notebook has not been checked for this account.' : account.cloud === null ? 'This account has no cloud notebook yet.' : `${account.cloud.notebook.attempts.length} cloud session(s) · saved ${new Date(account.cloud.updatedAt).toLocaleString()}`}
        </div>
        <div className={styles.actions}>
          <button type="button" disabled={account.busy || props.blocked} onClick={account.checkCloud}>1. Check cloud notebook</button>
          <button type="button" disabled={account.busy || props.blocked || !account.cloud} onClick={account.mergeCloud}>2. Merge cloud into this device</button>
          <button type="button" className={styles.primary} disabled={account.busy || Boolean(account.uploadBlockReason)} onClick={account.upload}>3. Upload saved device notebook</button>
        </div>
        {account.uploadBlockReason && <p className={styles.muted}>{account.uploadBlockReason}</p>}
        <p className={styles.muted}>Uploading includes saved sessions, reasoning, and notes. Edits stay local until the next upload. Removing a local session does not delete its cloud copy.</p>
        {account.busy && <p role="status">Account request in progress…</p>}
      </>}
      {account.error && <p role="alert" className={styles.error}>{account.error}</p>}
      {account.callbackIssue && <p role="alert" className={styles.error}>{account.callbackIssue}</p>}
      {account.status && <p role="status" className={styles.status}>{account.status}</p>}
      <p className={styles.privacy}>Signing out keeps this device notebook. On a shared device, anyone using this browser can still see it. Cloud transfer is optional; JSON export works without an account.</p>
    </div>
  </details>;
}

export type { AccountPanelProps } from './useCloudAccount';
