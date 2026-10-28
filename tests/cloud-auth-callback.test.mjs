import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
registerHooks({ load(url, context, next) {
  return url.endsWith('/components/account/authCallback.ts')
    ? { format: 'module', shortCircuit: true, source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8')) }
    : next(url, context);
} });
const api = await import('../components/account/authCallback.ts');
const now = 1791280800000;
const session = (user = 'user-a', sid = 'session-a') => ({ user: { id: user }, expires_at: now / 1000 + 3600,
  access_token: `header.${Buffer.from(JSON.stringify({ session_id: sid })).toString('base64url')}.signature`, refresh_token: 'never-store-this' });
const memory = () => {
  const values = new Map();
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};

test('auth callback inspection uses fixed errors and removes only callback parameters', () => {
  assert.equal(typeof api.inspectAuthCallback, 'function');
  const result = api.inspectAuthCallback('https://example.test/practice?view=notebook#error=access_denied&error_code=otp_expired&error_description=PRIVATE+UNTRUSTED&access_token=secret');
  assert.equal(result.isCallback, true);
  assert.match(result.issue, /expired|already used/);
  assert.ok(!result.issue.includes('PRIVATE'));
  assert.equal(result.cleanUrl, 'https://example.test/practice?view=notebook');
  assert.equal(api.inspectAuthCallback('https://example.test/practice#practice-content').isCallback, false);
  assert.equal(api.inspectAuthCallback('https://example.test/practice#type=recovery').isCallback, false);
  assert.match(api.inspectAuthCallback('https://example.test/practice?error_code=otp_expired').issue, /expired/);
});

test('a verified recovery marker survives reload only for the same account and session', () => {
  assert.equal(typeof api.createRecoveryContext, 'function');
  const storage = memory();
  const first = api.createRecoveryContext(() => storage, () => now);
  assert.equal(first.remember(session()), true);
  const raw = [...storage.values.values()][0];
  assert.ok(!raw.includes('never-store-this'));
  assert.ok(!raw.includes(session().access_token));
  const reloaded = api.createRecoveryContext(() => storage, () => now + 1000);
  assert.equal(reloaded.restore(session()), true);
  assert.equal(reloaded.restore(session('user-a', 'different-session')), false);
  first.remember(session());
  assert.equal(reloaded.restore(session('user-b')), false);
});

test('recovery context expires, rejects corrupt data, and clears after completion or cancellation', () => {
  assert.equal(typeof api.createRecoveryContext, 'function');
  const storage = memory();
  const context = api.createRecoveryContext(() => storage, () => now);
  context.remember(session());
  assert.equal(api.createRecoveryContext(() => storage, () => now + 3600001).restore(session()), false);
  context.remember(session());
  context.clear();
  assert.equal(context.restore(session()), false);
  storage.setItem(api.RECOVERY_CONTEXT_KEY, '{bad');
  assert.equal(context.restore(session()), false);
  storage.setItem(api.RECOVERY_CONTEXT_KEY, JSON.stringify({ version: 1, userId: 'user-a', sessionId: null, expiresAt: now + 1000 }));
  assert.equal(context.restore({ ...session(), access_token: 'invalid' }), false);
  const blocked = api.createRecoveryContext(() => { throw new Error('Storage blocked'); }, () => now);
  assert.equal(blocked.remember(session()), false);
  assert.equal(blocked.restore(session()), false);
  assert.doesNotThrow(() => blocked.clear());
});
