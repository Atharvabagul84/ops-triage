import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
registerHooks({load(url, context, next) {
  return url.endsWith('/lib/metrics/events.ts') ? {format:'module',shortCircuit:true,source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'))} : next(url,context);
}});
const { buildEvent, readConsent, isReturnVisit, createConsentGuard, saveConsentChoice } = await import('../lib/metrics/events.ts');
const id = '3394a4ef-d7cc-4d5c-8bc3-f2ab8d8340cb';
test('metrics are disabled unless consent was explicitly granted', () => {
  for (const value of [null,'','true','unknown','disabled','{}']) assert.equal(readConsent(value),false);
  assert.equal(readConsent('enabled'),true);
});
test('event payload allows only named events and case IDs; never notes or account data', () => {
  const event = buildEvent('case_started','pod-oom-loop',id,['pod-oom-loop']);
  assert.deepEqual(event,{p_event_id:id,p_event_type:'case_started',p_case_id:'pod-oom-loop'});
  assert.equal(buildEvent('notes_changed','private notes',id,['pod-oom-loop']),null);
  assert.equal(buildEvent('case_completed','unknown',id,['pod-oom-loop']),null);
  assert.equal(buildEvent('case_started','pod-oom-loop','not-a-uuid',['pod-oom-loop']),null);
  assert.deepEqual(buildEvent('return_visit',null,id,[]),{p_event_id:id,p_event_type:'return_visit',p_case_id:null});
  assert.equal(buildEvent('return_visit','pod-oom-loop',id,['pod-oom-loop']),null);
});
test('return visits count only a later UTC date after a consented visit', () => {
  assert.equal(isReturnVisit(null,'2026-10-06'),false);
  assert.equal(isReturnVisit('2026-10-06','2026-10-06'),false);
  assert.equal(isReturnVisit('2026-10-05','2026-10-06'),true);
  assert.equal(isReturnVisit('2026-10-07','2026-10-06'),false);
  assert.equal(isReturnVisit('garbage','2026-10-06'),false);
});

test('a failed persisted opt-out immediately blocks tracking and later storage events cannot quietly re-enable it', () => {
  assert.equal(typeof createConsentGuard, 'function');
  const guard = createConsentGuard();
  const stored = 'enabled';
  assert.equal(guard.allows(stored), true);
  const storage = { setItem() { throw new Error('Quota exceeded'); }, removeItem() {} };
  const result = saveConsentChoice(false, () => storage, guard, '2026-10-06');
  assert.equal(result.consent, false);
  assert.match(result.notice, /not.*saved|could not.*saved/i);
  assert.equal(guard.allows(stored), false);
  assert.equal(guard.allows('enabled'), false);
  const successfulStorage = { setItem() {}, removeItem() {} };
  const allowed = saveConsentChoice(true, () => successfulStorage, guard, '2026-10-06');
  assert.equal(allowed.consent, true);
  assert.equal(guard.allows('enabled'), true);
});

test('a failed opt-in also stays disabled until a later explicit successful choice', () => {
  assert.equal(typeof createConsentGuard, 'function');
  const guard = createConsentGuard();
  const result = saveConsentChoice(true, () => ({ setItem() { throw new Error('No storage'); }, removeItem() {} }), guard, '2026-10-06');
  assert.equal(result.consent, false);
  assert.equal(guard.allows('enabled'), false);
});
