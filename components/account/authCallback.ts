import type { Session } from '@supabase/supabase-js';

export const AUTH_CALLBACK_ISSUE = 'This email link could not be opened. It may be invalid, expired, or already used. Try a fresh link or sign in. Guest practice is still available.';
const callbackKeys = ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'type', 'provider_token', 'provider_refresh_token', 'code', 'error', 'error_code', 'error_description'];
const callbackSignals = ['access_token', 'refresh_token', 'code', 'error', 'error_code', 'error_description'];

export const inspectAuthCallback = (href: string) => {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const sources = [url.searchParams, hash];
  const isCallback = sources.some((source) => callbackSignals.some((key) => source.has(key)));
  const hasError = sources.some((source) => ['error', 'error_code', 'error_description'].some((key) => source.has(key)));
  if (isCallback) {
    for (const source of sources) for (const key of callbackKeys) source.delete(key);
    url.hash = hash.toString();
  }
  return { isCallback, issue: hasError ? AUTH_CALLBACK_ISSUE : '', cleanUrl: url.toString() };
};

export const RECOVERY_CONTEXT_KEY = 'opstriage.auth.recovery.v1';
const MAX_RECOVERY_AGE = 60 * 60 * 1000;
type RecoverySession = Pick<Session, 'user' | 'access_token' | 'expires_at'>;
type RecoveryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const sessionId = (session: RecoverySession): string | null => {
  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.session_id === 'string' && payload.session_id.length > 0 && payload.session_id.length <= 128 ? payload.session_id : null;
  } catch { return null; }
};

// This tab-local marker restores UI only. Password updates still use the
// authenticated SDK session and server-verified account; no credentials persist here.
export const createRecoveryContext = (getStorage: () => RecoveryStorage, now = Date.now) => {
  const clear = () => { try { getStorage().removeItem(RECOVERY_CONTEXT_KEY); } catch { /* Storage can be unavailable. */ } };
  return {
    clear,
    remember: (session: RecoverySession): boolean => {
      const id = sessionId(session);
      const expiresAt = Math.min((session.expires_at ?? now() / 1000) * 1000, now() + MAX_RECOVERY_AGE);
      if (!id || !Number.isFinite(expiresAt) || expiresAt <= now()) return false;
      try {
        getStorage().setItem(RECOVERY_CONTEXT_KEY, JSON.stringify({ version: 1, userId: session.user.id, sessionId: id, expiresAt }));
        return true;
      } catch { return false; }
    },
    restore: (session: RecoverySession | null): boolean => {
      try {
        const raw = getStorage().getItem(RECOVERY_CONTEXT_KEY);
        const marker = raw && raw.length <= 512 ? JSON.parse(raw) : null;
        const id = session ? sessionId(session) : null;
        const valid = Boolean(session && id && marker?.version === 1 && marker.userId === session.user.id && marker.sessionId === id &&
          typeof marker.expiresAt === 'number' && Number.isFinite(marker.expiresAt) && marker.expiresAt > now() && marker.expiresAt <= now() + MAX_RECOVERY_AGE);
        if (!valid) clear();
        return valid;
      } catch { clear(); return false; }
    },
  };
};
