import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
registerHooks({ load(url, context, next) {
  return url.endsWith('/lib/cloud/emailReadiness.ts')
    ? { format: 'module', shortCircuit: true, source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8')) }
    : next(url, context);
} });
const { isAuthEmailEnabled, runAuthEmailAction } = await import('../lib/cloud/emailReadiness.ts');

test('public auth email requires the exact true flag and defaults to unavailable', () => {
  for (const value of [undefined, null, '', false, true, 'false', 'TRUE', 'True', ' true', 'true ', '1', 1]) {
    assert.equal(isAuthEmailEnabled(value), false);
  }
  assert.equal(isAuthEmailEnabled('true'), true);
});

test('unavailable email never invokes signup or reset requests', async () => {
  let requests = 0;
  const request = async () => { requests++; return { accepted: true }; };
  await assert.rejects(() => runAuthEmailAction(isAuthEmailEnabled(undefined), request), /not available yet/i);
  assert.equal(requests, 0);
});

test('explicitly available email invokes the request once and preserves its result or error', async () => {
  let requests = 0;
  const result = await runAuthEmailAction(isAuthEmailEnabled('true'), async () => { requests++; return { accepted: true }; });
  assert.deepEqual(result, { accepted: true });
  assert.equal(requests, 1);
  const failure = new Error('Provider rejected the request');
  await assert.rejects(() => runAuthEmailAction(true, async () => { throw failure; }), (error) => error === failure);
});
