import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
  load(url, context, nextLoad) {
    return url.endsWith('.ts') ? { format: 'module', shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8')) } : nextLoad(url, context);
  },
});
const api = await import('../lib/practice/index.ts');
const scenario = api.PRACTICE_SCENARIOS[0];
const now = '2026-10-06T10:00:00.000Z';
const later = '2026-10-06T11:00:00.000Z';
const empty = () => ({ version: 2, attempts: [] });
const input = (overrides = {}) => ({ hypothesisId: scenario.correctHypothesisId,
  diagnosticIds: [...scenario.requiredDiagnosticIds], citedDiagnosticIds: [...scenario.requiredDiagnosticIds],
  reasoning: 'The observed termination and resource settings support this diagnosis; a memory leak is still unproven.', ...overrides });
const attempt = (overrides = {}) => ({ ...input(), id: 'attempt-1', scenarioId: scenario.id,
  scenarioVersion: scenario.version ?? 1, createdAt: now, updatedAt: now, notes: '', hintCount: 0, submissions: [], ...overrides });
const submitted = (overrides = {}) => attempt({ submissions: [{ ...input(), submittedAt: now }], ...overrides });
const rawNotebook = (...attempts) => JSON.stringify({ version: 2, attempts });

test('completion requires diagnosis, inspected evidence, citations and written reasoning', () => {
  const result = api.evaluateAttempt(scenario, input());
  assert.equal(result.complete, true);
  assert.equal(result.checks.length, 4);
  for (const patch of [{ hypothesisId: null }, { diagnosticIds: [] }, { citedDiagnosticIds: [] }, { reasoning: 'Too brief' }]) {
    assert.equal(api.evaluateAttempt(scenario, input(patch)).complete, false);
  }
  assert.match(result.feedback, /not.*semantic|not.*evaluat.*meaning|presence/i);
});
test('citations must be known inspected diagnostics, not duplicate or invented evidence', () => {
  for (const patch of [
    { citedDiagnosticIds: [scenario.requiredDiagnosticIds[0], scenario.requiredDiagnosticIds[0]] },
    { citedDiagnosticIds: [...scenario.requiredDiagnosticIds, 'invented'] },
    { diagnosticIds: [], citedDiagnosticIds: [...scenario.requiredDiagnosticIds] },
  ]) assert.equal(api.evaluateAttempt(scenario, input(patch)).hasCitedEvidence, false);
});
test('reasoning bounds use trimmed length and wrong diagnoses receive scenario feedback', () => {
  assert.equal(api.evaluateAttempt(scenario, input({ reasoning: ' '.repeat(40) })).hasReasoning, false);
  assert.equal(api.evaluateAttempt(scenario, input({ reasoning: 'x'.repeat(40) })).hasReasoning, true);
  assert.equal(api.evaluateAttempt(scenario, input({ reasoning: 'x'.repeat(4001) })).hasReasoning, false);
  const wrong = { ...scenario, hypotheses: scenario.hypotheses.map((item) => ({ ...item, feedback: 'Look at the recorded termination, not only the restart count.' })) };
  const id = wrong.hypotheses.find((item) => item.id !== wrong.correctHypothesisId).id;
  assert.match(api.evaluateAttempt(wrong, input({ hypothesisId: id })).feedback, /recorded termination/);
});
test('new sessions are unassessed drafts and submissions take immutable snapshots', () => {
  assert.equal(typeof api.createPracticeAttempt, 'function');
  const draft = api.createPracticeAttempt(scenario, 'fresh-id', now);
  assert.equal(draft.id, 'fresh-id');
  assert.deepEqual(draft.submissions, []);
  assert.equal(api.getAttemptEvaluation(scenario, draft).complete, false);
  const filled = { ...draft, ...input() };
  assert.equal(api.getAttemptEvaluation(scenario, filled).complete, false);
  const checked = api.submitPracticeAttempt(filled, later);
  assert.equal(checked.submissions.length, 1);
  assert.equal(api.getAttemptEvaluation(scenario, checked).complete, true);
  assert.deepEqual(filled.submissions, []);
  filled.diagnosticIds.push('later-change');
  assert.ok(!checked.submissions[0].diagnosticIds.includes('later-change'));
  assert.equal(api.getAttemptEvaluation(scenario, { ...checked, ...input({ hypothesisId: null, citedDiagnosticIds: [] }) }).complete, true);
});
test('latest submitted result governs completion, never an earlier pass or current draft', () => {
  assert.equal(typeof api.getAttemptEvaluation, 'function');
  const history = submitted({ updatedAt: later, submissions: [{ ...input(), submittedAt: now }, { ...input({ hypothesisId: null }), submittedAt: later }] });
  assert.equal(api.getAttemptEvaluation(scenario, history).complete, false);
});
test('v1 migrates evidence and diagnosis into a draft without awarding completion', () => {
  const raw = JSON.stringify({ version: 1, attempts: [{ scenarioId: scenario.id, hypothesisId: scenario.correctHypothesisId, diagnosticIds: scenario.requiredDiagnosticIds, updatedAt: now }] });
  const migrated = api.parseNotebook(raw);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.attempts.length, 1);
  assert.deepEqual(migrated.attempts[0].diagnosticIds, scenario.requiredDiagnosticIds);
  assert.equal(migrated.attempts[0].hypothesisId, scenario.correctHypothesisId);
  assert.deepEqual(migrated.attempts[0].submissions, []);
  assert.equal(api.getAttemptEvaluation(scenario, migrated.attempts[0]).complete, false);
  assert.ok(!api.exportNotebookMarkdown(migrated).includes(scenario.debrief.cause));
  assert.deepEqual(api.parseNotebook(raw), migrated);
});
test('independent sessions for one scenario survive immutable JSON round-trip', () => {
  const initial = api.upsertAttempt(empty(), attempt());
  const result = api.upsertAttempt(initial, attempt({ id: 'attempt-2' }));
  assert.equal(result.attempts.length, 2);
  assert.equal(initial.attempts.length, 1);
  assert.deepEqual(api.parseNotebook(api.serializeNotebook(result)), result);
  assert.deepEqual(api.parseNotebook(api.exportNotebookJson(result)), result);
});
test('corrupt and unsupported imports report errors without altering existing records', () => {
  assert.equal(typeof api.importNotebook, 'function');
  const current = { version: 2, attempts: [submitted()] };
  for (const raw of ['{', 'null', '[]', '{"version":3,"attempts":[]}', '{"version":2,"attempts":{}}']) {
    const result = api.importNotebook(raw, current);
    assert.ok(result.error);
    assert.deepEqual(result.notebook, current);
    assert.equal(result.importedCount, 0);
  }
});
test('imports report invalid entries and validate every historical snapshot', () => {
  assert.equal(typeof api.importNotebook, 'function');
  const invalid = [
    attempt({ id: '__bad space' }), attempt({ scenarioId: 'unknown' }), attempt({ scenarioVersion: 999 }),
    attempt({ diagnosticIds: ['invented'] }), attempt({ citedDiagnosticIds: ['invented'] }),
    attempt({ reasoning: 'x'.repeat(4001) }), attempt({ notes: 'x'.repeat(10001) }),
    attempt({ hintCount: -1 }), attempt({ hintCount: 999 }), attempt({ updatedAt: '2026-02-30T10:00:00.000Z' }),
    attempt({ updatedAt: '2026-10-05T10:00:00.000Z' }),
    submitted({ submissions: [{ ...input({ citedDiagnosticIds: ['invented'] }), submittedAt: now }, { ...input(), submittedAt: now }] }),
    submitted({ submissions: [{ ...input(), submittedAt: later }] }),
    submitted({ submissions: [{ ...input(), reasoning: 32, submittedAt: now }] }),
  ];
  const result = api.importNotebook(rawNotebook(...invalid, submitted({ id: 'valid' })), empty());
  assert.equal(result.skippedCount, invalid.length);
  assert.equal(result.importedCount, 1);
  assert.deepEqual(result.notebook.attempts.map((item) => item.id), ['valid']);
});
test('uninspected citations and non-array histories are rejected', () => {
  assert.equal(typeof api.importNotebook, 'function');
  const result = api.importNotebook(rawNotebook(attempt({ diagnosticIds: [] }), attempt({ submissions: {} })), empty());
  assert.equal(result.skippedCount, 2);
  assert.equal(result.notebook.attempts.length, 0);
});
test('merge cannot replace newer progress, change identity or erase submitted history', () => {
  assert.equal(typeof api.importNotebook, 'function');
  const current = { version: 2, attempts: [submitted({ updatedAt: later, notes: 'keep me' })] };
  assert.deepEqual(api.importNotebook(rawNotebook(attempt()), current).notebook, current);
  assert.deepEqual(api.importNotebook(rawNotebook(attempt({ createdAt: later, updatedAt: later })), current).notebook, current);
  const newer = api.importNotebook(rawNotebook(attempt({ updatedAt: '2026-10-06T12:00:00.000Z', notes: 'new note' })), current);
  assert.equal(newer.notebook.attempts[0].submissions.length, 1);
  assert.equal(newer.notebook.attempts[0].notes, 'new note');
});

test('an older device branch contributes immutable history while the newer local draft stays intact', () => {
  const oldSubmission = { ...input({ hypothesisId: null }), submittedAt: now };
  const newSubmission = { ...input(), submittedAt: later };
  const local = submitted({ updatedAt: later, notes: 'newer local note', reasoning: 'current local draft', submissions: [newSubmission] });
  const remote = submitted({ notes: 'older remote note', submissions: [oldSubmission] });
  const result = api.importNotebook(rawNotebook(remote), { version: 2, attempts: [local] });
  assert.equal(result.importedCount, 1);
  const merged = result.notebook.attempts[0];
  assert.deepEqual(merged.submissions, [oldSubmission, newSubmission]);
  assert.equal(merged.updatedAt, later);
  assert.equal(merged.notes, local.notes);
  assert.equal(merged.reasoning, local.reasoning);
  assert.equal(api.getAttemptEvaluation(scenario, merged).complete, true);
  assert.equal(api.importNotebook(rawNotebook(remote), result.notebook).importedCount, 0);
  assert.deepEqual(local.submissions, [newSubmission]);
});

test('conflicting equal-time branch checks merge deterministically without an unearned pass', () => {
  const passed = { ...input(), submittedAt: now };
  const incomplete = { ...input({ hypothesisId: null }), submittedAt: now };
  const left = submitted({ submissions: [passed] });
  const right = submitted({ submissions: [incomplete] });
  const forward = api.importNotebook(rawNotebook(right), { version: 2, attempts: [left] }).notebook.attempts[0];
  const backward = api.importNotebook(rawNotebook(left), { version: 2, attempts: [right] }).notebook.attempts[0];
  assert.deepEqual(forward.submissions, backward.submissions);
  assert.equal(forward.submissions.length, 2);
  assert.equal(api.getAttemptEvaluation(scenario, forward).complete, false);
  assert.equal(api.getAttemptEvaluation(scenario, backward).complete, false);
  assert.deepEqual(api.parseNotebook(api.serializeNotebook({ version: 2, attempts: [forward] })).attempts[0].submissions, forward.submissions);
});

test('history union rejects the whole incoming branch when distinct snapshots exceed the cap', () => {
  const local = submitted({ updatedAt: later, notes: 'preserved', submissions: Array.from({ length: 100 }, (_, i) => ({ ...input({ reasoning: `local-${i}` }), submittedAt: later })) });
  const remote = submitted({ submissions: [{ ...input({ reasoning: 'distinct remote check' }), submittedAt: now }] });
  const result = api.importNotebook(rawNotebook(remote), { version: 2, attempts: [local] });
  assert.equal(result.importedCount, 0);
  assert.equal(result.skippedCount, 1);
  assert.deepEqual(result.notebook.attempts[0], local);
});
test('capacity preserves existing attempts and oversize UTF-8 imports are rejected', () => {
  assert.equal(typeof api.importNotebook, 'function');
  const current = { version: 2, attempts: Array.from({ length: 200 }, (_, i) => attempt({ id: `id-${i}` })) };
  const full = api.importNotebook(rawNotebook(attempt({ id: 'extra' })), current);
  assert.deepEqual(full.notebook, current);
  assert.equal(full.skippedCount, 1);
  const huge = api.importNotebook('界'.repeat(750000), current);
  assert.match(huge.error, /2|size|large/i);
  assert.deepEqual(huge.notebook, current);
});
test('histories over the cap are rejected and submit never drops prior snapshots', () => {
  assert.equal(typeof api.submitPracticeAttempt, 'function');
  const full = submitted({ submissions: Array.from({ length: 100 }, () => ({ ...input(), submittedAt: now })) });
  assert.deepEqual(api.submitPracticeAttempt(full, later), full);
  const result = api.importNotebook(rawNotebook({ ...full, submissions: [...full.submissions, { ...input(), submittedAt: now }] }), empty());
  assert.equal(result.skippedCount, 1);
});
test('evidence normalizes and learner text stays intact in JSON but safe in Markdown', () => {
  const record = submitted({ diagnosticIds: [...scenario.requiredDiagnosticIds, ...scenario.requiredDiagnosticIds], notes: '<script>hello</script>\n```\n# note', hintCount: 1 });
  const restored = api.parseNotebook(rawNotebook(record));
  assert.equal(restored.attempts.length, 1);
  assert.deepEqual(restored.attempts[0].diagnosticIds, scenario.requiredDiagnosticIds);
  assert.equal(restored.attempts[0].notes, record.notes);
  const markdown = api.exportNotebookMarkdown(restored);
  assert.ok(markdown.includes(scenario.debrief.cause));
  assert.match(markdown, /Cited|citations/i);
  assert.match(markdown, /Hints revealed: 1/);
  assert.match(markdown, /Submission 1/);
  assert.ok(markdown.includes(input().reasoning));
  assert.ok(markdown.includes('````text\n<script>hello</script>\n```\n# note\n````'));
});
test('Markdown labels draft edits and cannot award a debrief after a failed submission', () => {
  assert.equal(typeof api.getAttemptEvaluation, 'function');
  const fail = submitted({ ...input(), submissions: [{ ...input({ hypothesisId: null }), submittedAt: now }] });
  const markdown = api.exportNotebookMarkdown({ version: 2, attempts: [fail] });
  assert.match(markdown, /not completed|in progress/i);
  assert.match(markdown, /Draft/);
  assert.ok(!markdown.includes(scenario.debrief.cause));
});

test('Markdown retains submitted diagnostic output even if the later draft changes its evidence', () => {
  const record = submitted({ diagnosticIds: [], citedDiagnosticIds: [], reasoning: '', hypothesisId: null });
  const markdown = api.exportNotebookMarkdown({ version: 2, attempts: [record] });
  const diagnostic = scenario.diagnostics.find((item) => item.id === scenario.requiredDiagnosticIds[0]);
  assert.ok(markdown.includes(diagnostic.output));
  assert.ok(markdown.includes(scenario.debrief.cause));
});

test('rejected edits expose validation and byte-limit failures without discarding saved history', () => {
  assert.equal(typeof api.upsertAttemptWithResult, 'function');
  const current = { version: 2, attempts: Array.from({ length: 180 }, (_, i) => attempt({ id: `sized-${i}`, notes: 'n'.repeat(9000) })) };
  const large = submitted({ id: 'large', submissions: Array.from({ length: 100 }, () => ({ ...input({ reasoning: 'x'.repeat(4000) }), submittedAt: now })) });
  const result = api.upsertAttemptWithResult(current, large);
  assert.equal(result.accepted, false);
  assert.match(result.error, /2 MB/);
  assert.deepEqual(result.notebook, current);
  const invalid = api.upsertAttemptWithResult(current, attempt({ id: 'invalid', notes: 'x'.repeat(10001) }));
  assert.equal(invalid.accepted, false);
  assert.match(invalid.error, /invalid|limit/i);
  const saved = api.upsertAttemptWithResult(empty(), attempt());
  assert.equal(saved.accepted, true);
  assert.equal(saved.notebook.attempts.length, 1);
});
