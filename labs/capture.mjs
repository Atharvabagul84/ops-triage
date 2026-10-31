#!/usr/bin/env node
// Reproduces each lab fault on a local kind cluster and records real kubectl output.
// Usage: node labs/capture.mjs [--context kind-ops-triage-labs] [--out dir] [--keep] [lab ...]
import { spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { assertLabContext, DEFAULT_CLUSTER } from './lib/guard.mjs';
import { displayCommand } from './lib/evidence.mjs';

const LABS = dirname(fileURLToPath(import.meta.url));
const NAMESPACE = 'practice';
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  context: { type: 'string', default: `kind-${DEFAULT_CLUSTER}` }, out: { type: 'string' }, keep: { type: 'boolean', default: false },
} });

const view = spawnSync('kubectl', ['config', 'view', '--minify', '--context', values.context, '-o', 'jsonpath={.clusters[0].cluster.server}'], { encoding: 'utf8' });
const cluster = assertLabContext(values.context, view.status === 0 ? view.stdout.trim() : `(context not found: ${view.stderr.trim()})`);

const scratch = mkdtempSync(join(tmpdir(), 'ops-triage-labs-'));
// stdout and stderr share one file so their order matches what a terminal shows.
const run = (args, { allowFailure = false } = {}) => {
  const file = join(scratch, 'output');
  const fd = openSync(file, 'w');
  const result = spawnSync('kubectl', ['--context', values.context, ...args], { stdio: ['ignore', fd, fd], timeout: 120_000 });
  closeSync(fd);
  const output = readFileSync(file, 'utf8');
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) throw new Error(`${displayCommand(args)} exited ${result.status}:\n${output}`);
  return output;
};
const json = (args) => JSON.parse(run([...args, '-o', 'json']));
const kube = { cluster, namespace: NAMESPACE, run, json };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (description, condition, timeoutSeconds) => {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    try {
      if (condition(kube)) return;
    } catch {
      // Objects can be briefly absent while controllers catch up; keep polling.
    }
    await sleep(3000);
  }
  throw new Error(`Timed out after ${timeoutSeconds}s waiting for ${description}.`);
};

const resetNamespace = async () => {
  run(['delete', 'namespace', NAMESPACE, '--ignore-not-found', '--wait=true', '--timeout=180s']);
  run(['create', 'namespace', NAMESPACE]);
  await waitFor('the default ServiceAccount', () => run(['get', 'serviceaccount', 'default', '-n', NAMESPACE], { allowFailure: true }).startsWith('NAME'), 60);
};

const available = readdirSync(LABS, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name !== 'lib').map((entry) => entry.name);
const selected = positionals.length ? positionals : available;
for (const name of selected) if (!available.includes(name)) throw new Error(`Unknown lab "${name}". Available: ${available.join(', ')}`);

const versions = JSON.parse(run(['version', '-o', 'json']));
const version = versions.serverVersion.gitVersion;
console.log(`Using ${values.context} (Kubernetes ${version}, kubectl ${versions.clientVersion.gitVersion}); labs: ${selected.join(', ')}`);
let failures = 0;
try {
  for (const name of selected) {
    const { lab } = await import(pathToFileURL(join(LABS, name, 'lab.mjs')).href);
    console.log(`\n[${name}] ${lab.fault}`);
    try {
      await resetNamespace();
      run(['apply', '-f', join(LABS, name, 'manifest.yaml')]);
      await waitFor(lab.ready.description, lab.ready.test, lab.ready.timeoutSeconds);
      if (lab.trigger) {
        lab.trigger.run(kube);
        await waitFor(lab.trigger.description, lab.trigger.test, lab.trigger.timeoutSeconds);
      }
      const checks = lab.checks.map((check) => {
        const args = typeof check.args === 'function' ? check.args(kube) : check.args;
        const output = run(args, { allowFailure: true }).replace(/\r\n/g, '\n');
        for (const pattern of check.expect ?? []) if (!pattern.test(output)) throw new Error(`${check.id}: expected ${pattern} in:\n${output}`);
        for (const pattern of check.reject ?? []) if (pattern.test(output)) throw new Error(`${check.id}: did not expect ${pattern} in:\n${output}`);
        return { id: check.id, command: displayCommand(args), output: output.trimEnd() };
      });
      const capture = { caseId: lab.caseId, fault: lab.fault, capturedAt: new Date().toISOString(), kubernetesVersion: version, kubectlVersion: versions.clientVersion.gitVersion, checks };
      const target = values.out ? join(values.out, `${name}.json`) : join(LABS, name, 'capture.json');
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, `${JSON.stringify(capture, null, 2)}\n`);
      console.log(`[${name}] symptom reproduced; wrote ${target}`);
    } catch (error) {
      failures += 1;
      console.error(`[${name}] FAILED: ${error.message}`);
    } finally {
      if (!values.keep) run(['delete', 'namespace', NAMESPACE, '--ignore-not-found', '--wait=false'], { allowFailure: true });
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
if (failures) {
  console.error(`\n${failures} of ${selected.length} labs failed.`);
  process.exit(1);
}
