import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { missingExcerptLines } from '../labs/lib/evidence.mjs';
import { assertLabContext } from '../labs/lib/guard.mjs';

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
  load(url, context, nextLoad) {
    return url.endsWith('.ts') ? { format: 'module', shortCircuit: true, source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8')) } : nextLoad(url, context);
  },
});

const { PRACTICE_SCENARIOS: cases } = await import('../lib/practice/scenarios.ts');
const labsRoot = new URL('../labs/', import.meta.url);
const labNames = readdirSync(labsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name !== 'lib').map((entry) => entry.name);
const readCapture = (name) => JSON.parse(readFileSync(new URL(`${name}/capture.json`, labsRoot), 'utf8'));

test('five core cases are backed by a kind lab with a committed capture', () => {
  assert.deepEqual([...labNames].sort(), ['dns-config', 'oomkilled', 'readiness-port', 'rollout-quota', 'startup-arguments']);
  for (const name of labNames) {
    for (const file of ['manifest.yaml', 'lab.mjs', 'capture.json']) assert.ok(existsSync(new URL(`${name}/${file}`, labsRoot)), `${name}/${file}`);
    const scenario = cases.find((item) => item.id === name);
    assert.ok(scenario && !scenario.variantOf, `${name} is a core case`);
    assert.equal(readCapture(name).caseId, name);
  }
  assert.deepEqual(cases.filter((item) => item.lab).map((item) => item.id).sort(), [...labNames].sort());
});

test('lab case evidence is copied verbatim from the captured kubectl output', () => {
  for (const name of labNames) {
    const scenario = cases.find((item) => item.id === name);
    const capture = readCapture(name);
    assert.deepEqual(scenario.lab, { path: `labs/${name}`, kubernetesVersion: capture.kubernetesVersion }, name);
    assert.match(scenario.brief, /kind cluster/);
    for (const diagnostic of scenario.diagnostics) {
      const captured = capture.checks.find((item) => item.id === diagnostic.id);
      assert.ok(captured, `${name}/${diagnostic.id} has a capture`);
      assert.equal(diagnostic.command, captured.command, `${name}/${diagnostic.id} command`);
      assert.deepEqual(missingExcerptLines(diagnostic.output, captured.output), [], `${name}/${diagnostic.id} output`);
    }
    const [prompt, ...initial] = scenario.initialEvidence.split('\n');
    const source = capture.checks.find((item) => `$ ${item.command}` === prompt);
    assert.ok(source, `${name} initial evidence starts with a captured command`);
    assert.deepEqual(missingExcerptLines(initial.join('\n'), source.output), [], `${name} initial evidence`);
  }
});

test('excerpt matching rejects edited, reordered or invented lines', () => {
  const captured = 'Name: api\n  Reason:  OOMKilled   \n  Exit Code:  137\nEvents:  <none>';
  assert.deepEqual(missingExcerptLines('  Reason:  OOMKilled\n  Exit Code:  137', captured), []);
  assert.deepEqual(missingExcerptLines('Name: api\nEvents:  <none>', captured), []);
  assert.deepEqual(missingExcerptLines('  Reason: OOMKilled', captured), ['  Reason: OOMKilled']);
  assert.deepEqual(missingExcerptLines('Events:  <none>\nName: api', captured), ['Name: api']);
  assert.deepEqual(missingExcerptLines('Restart Count: 5', captured), ['Restart Count: 5']);
});

test('labs refuse every context except a local kind-ops-triage cluster', () => {
  assert.equal(assertLabContext('kind-ops-triage-labs', 'https://127.0.0.1:52144'), 'ops-triage-labs');
  assert.equal(assertLabContext('kind-ops-triage', 'https://[::1]:6443'), 'ops-triage');
  for (const context of ['prod', 'kind-restoreproof', 'kind-ops-triage-labs ', 'ops-triage-labs', 'arn:aws:eks:ap-south-1:123456789012:cluster/kind-ops-triage', '', undefined]) {
    assert.throws(() => assertLabContext(context, 'https://127.0.0.1:6443'), /Refusing/, String(context));
  }
  for (const server of ['https://10.0.0.5:6443', 'https://my-cluster.example.com', 'http://127.0.0.1:6443', 'https://127.0.0.1.evil.example:6443', '']) {
    assert.throws(() => assertLabContext('kind-ops-triage-labs', server), /not a local kind endpoint/, server);
  }
});
