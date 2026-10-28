import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { cloudConnectSource } from '../scripts/static-headers.mjs';
test('static CSP uses only the configured cloud origin and rejects secret keys or insecure destinations', () => {
  assert.equal(cloudConnectSource(undefined, undefined), "'self'");
  assert.equal(cloudConnectSource('https://project.supabase.co', 'sb_publishable_test'), "'self' https://project.supabase.co");
  assert.equal(cloudConnectSource('https://auth.example.com/', 'sb_publishable_test'), "'self' https://auth.example.com");
  assert.equal(cloudConnectSource('http://127.0.0.1:54321', 'sb_publishable_test'), "'self' http://127.0.0.1:54321");
  for (const [url, key] of [['https://project.supabase.co','sb_secret_test'],['https://user:password@project.supabase.co','sb_publishable_test'],['http://untrusted.example','sb_publishable_test'],['https://project.supabase.co',undefined]]) {
    assert.throws(() => cloudConnectSource(url,key), /configuration/);
  }
});

const frameAncestors = (policy) => policy.split(';').map((directive) => directive.trim())
  .find((directive) => directive.startsWith('frame-ancestors '));

test('static hosting permits framing only by the same origin', () => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  const policy = headers.split('\n').find((line) => line.trimStart().startsWith('Content-Security-Policy:'));
  assert.ok(policy, 'Static host must receive the security policy');
  assert.equal(frameAncestors(policy), "frame-ancestors 'self'");
});

test('Next server and static hosting have the same framing boundary', async () => {
  const source = stripTypeScriptTypes(readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8'));
  const { default: config } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const rules = await config.headers();
  const policy = rules[0].headers.find((header) => header.key === 'Content-Security-Policy');
  assert.ok(policy, 'Next server must send the security policy');
  assert.equal(frameAncestors(policy.value), "frame-ancestors 'self'");
});
