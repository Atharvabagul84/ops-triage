import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
registerHooks({
  resolve(specifier, context, next) { return next(specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier) ? `${specifier}.ts` : specifier, context); },
  load(url, context, next) { return url.endsWith('.ts') ? { format: 'module', shortCircuit: true, source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8')) } : next(url, context); },
});
const api = await import('../lib/cloud/notebookSync.ts');
const transport = await import('../lib/cloud/api.ts');
const authApi = await import('../lib/cloud/auth.ts');
const { createPracticeAttempt, importNotebook, PRACTICE_SCENARIOS } = await import('../lib/practice/index.ts');
const empty = { version: 2, attempts: [] };
const now = '2026-10-06T10:00:00.000Z';
const row = (overrides = {}) => ({ user_id: 'user-a', notebook: empty, revision: 1, updated_at: now, ...overrides });
const attempt = createPracticeAttempt(PRACTICE_SCENARIOS[0], 'run-a', now);

test('cloud parsing validates ownership, revision, version and every attempt without dropping data', () => {
  assert.equal(typeof api.parseCloudSnapshot, 'function');
  assert.equal(api.parseCloudSnapshot(null, 'user-a'), null);
  assert.equal(api.parseCloudSnapshot(row(), 'user-a').revision, 1);
  for (const bad of [row({ user_id: 'user-b' }), row({ revision: -1 }), row({ revision: '9007199254740993' }), row({ updated_at: 'invalid' }), row({ notebook: { version: 3, attempts: [] } }), row({ notebook: { version: 2, attempts: [{ bad: true }] } })]) {
    assert.throws(() => api.parseCloudSnapshot(bad, 'user-a'));
  }
});
test('cloud payload limits are checked before any partial import is accepted', () => {
  assert.equal(typeof api.parseCloudSnapshot, 'function');
  assert.throws(() => api.parseCloudSnapshot(row({ notebook: { version: 2, attempts: [], padding: '界'.repeat(750000) } }), 'user-a'), /large|limit|size/i);
});
test('upload requires a checked cloud revision, explicit merge and preserved remote history', () => {
  assert.equal(typeof api.getUploadBlockReason, 'function');
  const local = { version: 2, attempts: [attempt] };
  const remote = api.parseCloudSnapshot(row({ notebook: local }), 'user-a');
  assert.ok(api.getUploadBlockReason(local, undefined, null, false));
  assert.ok(api.getUploadBlockReason(local, remote, null, false));
  assert.ok(api.getUploadBlockReason(empty, remote, 1, false));
  assert.ok(api.getUploadBlockReason(local, remote, 1, true));
  assert.equal(api.getUploadBlockReason(local, remote, 1, false), null);
  assert.equal(api.getUploadBlockReason(local, null, null, false), null);
});
test('newer local sessions cannot silently discard a remote submitted snapshot', () => {
  assert.equal(typeof api.cloudHistoryIsPreserved, 'function');
  const remote = { version: 2, attempts: [{ ...attempt, submissions: [{ hypothesisId: null, diagnosticIds: [], citedDiagnosticIds: [], reasoning: '', submittedAt: now }] }] };
  const local = { version: 2, attempts: [{ ...attempt, updatedAt: '2026-10-06T11:00:00.000Z' }] };
  assert.equal(api.cloudHistoryIsPreserved(local, remote), false);
  assert.equal(api.cloudHistoryIsPreserved(remote, remote), true);
});

test('merging older or equal-time cloud history unblocks upload without discarding either branch', () => {
  const remoteCheck = { hypothesisId: null, diagnosticIds: [], citedDiagnosticIds: [], reasoning: 'remote check', submittedAt: now };
  const localCheck = { ...remoteCheck, reasoning: 'local check' };
  const cloud = api.parseCloudSnapshot(row({ notebook: { version: 2, attempts: [{ ...attempt, submissions: [remoteCheck] }] } }), 'user-a');
  for (const updatedAt of [now, '2026-10-06T11:00:00.000Z']) {
    const local = { version: 2, attempts: [{ ...attempt, updatedAt, submissions: [localCheck] }] };
    const merged = importNotebook(JSON.stringify(cloud.notebook), local).notebook;
    assert.equal(merged.attempts[0].submissions.length, 2);
    assert.equal(api.getUploadBlockReason(merged, cloud, 1, false), null);
  }
});
test('only explicit revision conflicts trigger conflict recovery and saves must advance revision', () => {
  assert.equal(typeof api.isCloudRevisionConflict, 'function');
  assert.equal(api.isCloudRevisionConflict({ code: 'P0001', details: 'revision_conflict' }), true);
  assert.equal(api.isCloudRevisionConflict({ code: '42501', message: 'permission denied' }), false);
  assert.deepEqual(api.parseSaveReceipt([{ revision: 2, updated_at: now }], 1), { revision: 2, updatedAt: now });
  assert.throws(() => api.parseSaveReceipt([{ revision: 1, updated_at: now }], 1));
  assert.throws(() => api.parseSaveReceipt([], 1));
});
test('account changes and newer operations abort requests and reject stale responses', () => {
  assert.equal(typeof api.createAccountRequestGate, 'function');
  const gate = api.createAccountRequestGate();
  gate.setAccount('user-a');
  const first = gate.begin();
  assert.equal(first.isCurrent(), true);
  const second = gate.begin();
  assert.equal(first.signal.aborted, true);
  assert.equal(first.isCurrent(), false);
  gate.setAccount('user-b');
  assert.equal(second.signal.aborted, true);
  assert.equal(second.isCurrent(), false);
  const third = gate.begin();
  gate.setAccount(null);
  assert.equal(third.isCurrent(), false);
});

test('cloud reads filter the captured owner and pass cancellation to the request', async () => {
  const signal = new AbortController().signal;
  const seen = [];
  const query = {
    select(value) { seen.push(['select', value]); return this; },
    eq(key, value) { seen.push(['eq', key, value]); return this; },
    abortSignal(value) { assert.equal(value, signal); return this; },
    async maybeSingle() { return { data: row(), error: null }; },
  };
  const client = { from(table) { assert.equal(table, 'notebooks'); return query; } };
  assert.equal((await transport.readCloudNotebook(client, 'user-a', signal)).revision, 1);
  assert.deepEqual(seen.at(-1), ['eq', 'user_id', 'user-a']);
  await assert.rejects(() => transport.readCloudNotebook(client, 'user-b', signal), /belong/);
});

test('cloud saves carry the checked revision and never swallow a server conflict', async () => {
  const signal = new AbortController().signal;
  const conflict = { code: 'P0001', details: 'revision_conflict', message: 'Changed elsewhere' };
  const client = { rpc(name, input) {
    assert.equal(name, 'save_notebook');
    assert.deepEqual(input, { p_notebook: empty, p_expected_revision: 4 });
    return { async abortSignal(value) { assert.equal(value, signal); return { data: null, error: conflict }; } };
  } };
  await assert.rejects(() => transport.saveCloudNotebook(client, empty, 4, signal), (error) => error === conflict);
});

test('password recovery binds to the initiating session and verifies ownership before updating', async () => {
  const session = { access_token: 'captured-token', refresh_token: 'captured-refresh', user: { id: 'user-a' } };
  const seen = [];
  const client = { auth: {
    async setSession(tokens) { seen.push(tokens); return { data: { user: { id: 'user-a' } }, error: null }; },
    async updateUser(input) { seen.push(input); return { data: { user: { id: 'user-a' } }, error: null }; },
  } };
  await authApi.updateRecoveredPassword(client, session, 'new-password');
  assert.deepEqual(seen, [{ access_token: 'captured-token', refresh_token: 'captured-refresh' }, { password: 'new-password' }]);
  client.auth.setSession = async () => ({ data: { user: { id: 'user-b' } }, error: null });
  await assert.rejects(() => authApi.updateRecoveredPassword(client, session, 'new-password'), /account|session/i);
  assert.equal(seen.length, 2);
  client.auth.setSession = async () => ({ data: { user: { id: 'user-a' } }, error: null });
  await assert.rejects(() => authApi.updateRecoveredPassword(client, session, 'new-password', () => false), /session/i);
  assert.equal(seen.length, 2);
});
