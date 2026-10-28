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
const { PRACTICE_SCENARIOS } = await import('../../lib/practice/index.ts');
const migration = readFileSync(new URL('../migrations/20261006094843_cloud_notebooks_and_usage_counts.sql', import.meta.url), 'utf8');

test('database event case allowlist matches every authored base and transfer scenario exactly', () => {
  const list = migration.match(/p_case_id = any\(array\[([\s\S]*?)\]::text\[\]\)/)?.[1];
  assert.ok(list, 'could not locate the SQL event case allowlist');
  const actual = [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.equal(new Set(actual).size, actual.length, 'duplicate SQL case IDs');
  assert.deepEqual(actual.sort(), PRACTICE_SCENARIOS.map(({ id }) => id).sort());
});
