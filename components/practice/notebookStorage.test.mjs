import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

const moduleUrl = new URL('./notebookStorage.ts', import.meta.url);

test('a blocked browser store is reported without throwing or pretending to save', async () => {
  assert.ok(existsSync(moduleUrl), 'The notebook needs a resilient storage boundary');
  const { readNotebookValue, writeNotebookValue } = await import(moduleUrl.href);
  const blocked = () => { throw new Error('Storage is blocked'); };
  assert.equal(readNotebookValue(blocked).raw, null);
  assert.match(readNotebookValue(blocked).error, /unavailable/i);
  assert.match(writeNotebookValue(blocked, '{"version":1}'), /not saved/i);
});

test('a saved notebook can be read again using the same versioned key', async () => {
  assert.ok(existsSync(moduleUrl), 'The notebook needs a resilient storage boundary');
  const { readNotebookValue, writeNotebookValue, NOTEBOOK_STORAGE_KEY } = await import(moduleUrl.href);
  const entries = new Map();
  const storage = () => ({
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  });
  const notebook = '{"version":1,"attempts":[]}';
  assert.equal(writeNotebookValue(storage, notebook), null);
  assert.equal(entries.get(NOTEBOOK_STORAGE_KEY), notebook);
  assert.deepEqual(readNotebookValue(storage), { raw: notebook, error: null });
});

test('a stale second tab cannot replace the first tab notebook', async () => {
  const { writeNotebookSnapshot } = await import(moduleUrl.href);
  assert.equal(typeof writeNotebookSnapshot, 'function');
  let stored = null;
  let writes = 0;
  const provider = () => ({ getItem: () => stored, setItem: (_key, value) => { stored = value; writes++; } });
  const first = await writeNotebookSnapshot(provider, null, 'tab-A');
  const stale = await writeNotebookSnapshot(provider, null, 'tab-B');
  assert.deepEqual(first, { written: true, conflict: false, error: null });
  assert.equal(stale.written, false);
  assert.equal(stale.conflict, true);
  assert.match(stale.error, /another tab|changed/i);
  assert.equal(stored, 'tab-A');
  assert.equal(writes, 1);
});

test('snapshot writes proceed only from the expected persisted value', async () => {
  const { writeNotebookSnapshot } = await import(moduleUrl.href);
  assert.equal(typeof writeNotebookSnapshot, 'function');
  let stored = 'old';
  const provider = () => ({ getItem: () => stored, setItem: (_key, value) => { stored = value; } });
  assert.equal((await writeNotebookSnapshot(provider, 'old', 'new')).written, true);
  assert.equal(stored, 'new');
  assert.equal((await writeNotebookSnapshot(provider, 'new', '')).written, true);
  assert.equal(stored, '');
  assert.equal((await writeNotebookSnapshot(provider, null, 'wrong')).conflict, true);
  assert.equal(stored, '');
});

test('read failures never reach setItem and write failures are reported', async () => {
  const { writeNotebookSnapshot } = await import(moduleUrl.href);
  assert.equal(typeof writeNotebookSnapshot, 'function');
  let writes = 0;
  const inaccessible = () => { throw new Error('blocked storage getter'); };
  const unreadable = () => ({ getItem: () => { throw new Error('read denied'); }, setItem: () => { writes++; } });
  const unwritable = () => ({ getItem: () => 'old', setItem: () => { writes++; throw new Error('quota'); } });
  for (const provider of [inaccessible, unreadable]) {
    const result = await writeNotebookSnapshot(provider, 'old', 'new');
    assert.equal(result.written, false);
    assert.equal(result.conflict, false);
    assert.match(result.error, /not saved|unavailable|could not/i);
  }
  assert.equal(writes, 0);
  const result = await writeNotebookSnapshot(unwritable, 'old', 'new');
  assert.equal(result.written, false);
  assert.equal(result.conflict, false);
  assert.match(result.error, /not saved/i);
  assert.equal(writes, 1);
});

test('a supplied lock encloses the snapshot read and write and serializes competing writers', async () => {
  const { writeNotebookSnapshot } = await import(moduleUrl.href);
  assert.equal(typeof writeNotebookSnapshot, 'function');
  let stored = null;
  const events = [];
  let queue = Promise.resolve();
  const lock = (write) => {
    const current = queue.then(() => {
      events.push('enter');
      const result = write();
      events.push('leave');
      return result;
    });
    queue = current.then(() => undefined);
    return current;
  };
  const provider = () => ({
    getItem: () => { events.push('read'); return stored; },
    setItem: (_key, value) => { events.push('write'); stored = value; },
  });
  const [first, second] = await Promise.all([
    writeNotebookSnapshot(provider, null, 'A', lock),
    writeNotebookSnapshot(provider, null, 'B', lock),
  ]);
  assert.equal(first.written, true);
  assert.equal(second.conflict, true);
  assert.equal(stored, 'A');
  assert.deepEqual(events, ['enter', 'read', 'write', 'leave', 'enter', 'read', 'leave']);
});

test('a rejected lock request reports failure without touching storage', async () => {
  const { writeNotebookSnapshot } = await import(moduleUrl.href);
  assert.equal(typeof writeNotebookSnapshot, 'function');
  let accessed = false;
  const provider = () => { accessed = true; throw new Error('unexpected'); };
  const result = await writeNotebookSnapshot(provider, null, 'new', async () => { throw new Error('lock denied'); });
  assert.equal(result.written, false);
  assert.equal(result.conflict, false);
  assert.ok(result.error);
  assert.equal(accessed, false);
});
