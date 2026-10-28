import assert from 'node:assert/strict';
import test from 'node:test';

const origin = process.env.BETA_TEST_ORIGIN || 'http://127.0.0.1:3000';

test('the beta entry point explains the app and offers guest practice', async () => {
  const response = await fetch(origin, { redirect: 'manual' });
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes('Start free as a guest'), 'Landing page should offer guest practice');
});

test('practice and beta guide render successfully', async () => {
  for (const path of ['/practice', '/beta']) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), /synthetic|simulated/i, path);
  }
});
