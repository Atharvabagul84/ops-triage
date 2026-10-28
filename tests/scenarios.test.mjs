import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
  load(url, context, nextLoad) {
    return url.endsWith('.ts') ? { format: 'module', shortCircuit: true, source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8')) } : nextLoad(url, context);
  },
});

const { PRACTICE_SCENARIOS: cases } = await import('../lib/practice/scenarios.ts');

test('library contains ten base incidents and one causally different transfer case for each', () => {
  const base = cases.filter((item) => !item.variantOf);
  assert.equal(base.length, 10);
  assert.equal(cases.length, 20);
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
  for (const scenario of base) {
    const variants = cases.filter((item) => item.variantOf === scenario.id);
    assert.equal(variants.length, 1, scenario.id);
    assert.notEqual(variants[0].correctHypothesisId, scenario.correctHypothesisId);
    assert.notEqual(variants[0].debrief.cause, scenario.debrief.cause);
    assert.notDeepEqual(variants[0].diagnostics.map((item) => item.output), scenario.diagnostics.map((item) => item.output));
  }
});

test('each synthetic case has a resolvable evidence gate, feedback and official documentation', () => {
  for (const scenario of cases) {
    assert.ok(Number.isInteger(scenario.version) && scenario.version > 0, scenario.id);
    assert.match(scenario.brief, /synthetic|simulated/i);
    assert.equal(scenario.hints.length, 3);
    assert.equal(new Set(scenario.hints).size, 3);
    assert.ok(scenario.hints.every((hint) => hint.length >= 20));
    const diagnostics = new Set(scenario.diagnostics.map((item) => item.id));
    assert.equal(diagnostics.size, scenario.diagnostics.length);
    assert.ok(scenario.requiredDiagnosticIds.length >= 2);
    assert.ok(scenario.requiredDiagnosticIds.every((id) => diagnostics.has(id)), scenario.id);
    assert.equal(scenario.hypotheses.filter((item) => item.id === scenario.correctHypothesisId).length, 1);
    assert.equal(new Set(scenario.hypotheses.map((item) => item.id)).size, scenario.hypotheses.length);
    assert.ok(scenario.hypotheses.every((item) => item.feedback.length >= 30));
    assert.ok(scenario.sources.length > 0 && scenario.sources.every((source) => new URL(source.url).hostname === 'kubernetes.io'));
    for (const key of ['evidence', 'counterEvidence', 'remediation', 'verification']) assert.ok(scenario.debrief[key].length, `${scenario.id}: ${key}`);
  }
});

test('original bookmarked case identifiers remain present and base-only export agrees', async () => {
  for (const id of ['oomkilled', 'service-selector', 'image-pull-auth']) assert.ok(cases.some((item) => item.id === id && !item.variantOf));
  const { BASE_PRACTICE_SCENARIOS } = await import('../lib/practice/scenarios.ts');
  assert.deepEqual(BASE_PRACTICE_SCENARIOS, cases.filter((item) => !item.variantOf));
});
