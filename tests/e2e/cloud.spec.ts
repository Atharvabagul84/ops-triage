import { expect, remoteNotebook, signInToMockAccount, test } from './cloud-fixture';
import { completeOomCase, NOTE, openNotebook, openPractice, startOomCase } from './practice-helpers';

test.skip(process.env.PLAYWRIGHT_MOCK_CLOUD !== '1', 'Requires a production build with the documented fake cloud URL/key; all cloud requests are intercepted.');

test('account email options require explicit availability while existing sign-in remains available', async ({ page, cloudMock }) => {
  await openPractice(page);
  await page.locator('summary').filter({ hasText: 'Optional account & cloud notebook' }).click();
  await expect(page.getByRole('button', { name: 'Sign in to account', exact: true })).toBeVisible();
  if (process.env.NEXT_PUBLIC_AUTH_EMAIL_ENABLED !== 'true') {
    await expect(page.getByText('New accounts and password-reset emails are not available yet. Guest practice and notebook exports still work. Existing account holders can sign in.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create account', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Forgot password', exact: true })).toHaveCount(0);
    expect(cloudMock.authEmailRequests).toEqual([]);
    return;
  }
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('learner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-new-password');
  await page.getByLabel('Confirm password', { exact: true }).fill('synthetic-new-password');
  await page.getByRole('button', { name: 'Create account with email', exact: true }).click();
  await expect(page.getByText('Check your email to confirm your account, then sign in. No notebook data has been uploaded.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Forgot password', exact: true }).click();
  await page.getByRole('button', { name: 'Send password reset email', exact: true }).click();
  await expect(page.getByText('If this address has an account, check its email for a password reset link. The link returns to this practice page.', { exact: true })).toBeVisible();
  expect(cloudMock.authEmailRequests).toEqual(['signup', 'reset']);
  expect(cloudMock.reads).toBe(0);
  expect(cloudMock.uploads).toHaveLength(0);
});

test('sign-in keeps the notebook local until an explicit check, merge and upload', async ({ page, cloudMock }) => {
  cloudMock.notebook = remoteNotebook();
  cloudMock.revision = 1;
  await openPractice(page);
  await startOomCase(page);
  await page.getByLabel('Personal notes', { exact: true }).fill(NOTE);
  await signInToMockAccount(page);
  expect(cloudMock.reads).toBe(0);
  expect(cloudMock.uploads).toHaveLength(0);
  const upload = page.getByRole('button', { name: '3. Upload saved device notebook', exact: true });
  await expect(upload).toBeDisabled();
  await page.getByRole('button', { name: '1. Check cloud notebook', exact: true }).click();
  await expect(page.getByText('Cloud notebook checked. Merge it into this device before uploading.', { exact: true })).toBeVisible();
  await expect(upload).toBeDisabled();
  await page.getByRole('button', { name: '2. Merge cloud into this device', exact: true }).click();
  await expect(upload).toBeEnabled();
  expect(cloudMock.uploads).toHaveLength(0);
  await upload.click();
  await expect(page.getByText('Uploaded the saved device notebook, including notes, to this account. Later edits stay on this device until you upload again.', { exact: true })).toBeVisible();
  expect(cloudMock.uploads).toHaveLength(1);
  expect(cloudMock.uploads[0].p_expected_revision).toBe(1);
  expect(cloudMock.uploads[0].p_notebook.attempts.map((attempt) => attempt.notes).sort()).toEqual(['A saved cloud field note.', NOTE].sort());
  await page.getByRole('button', { name: 'Sign out on this device', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in to account', exact: true })).toBeVisible();
  await openNotebook(page);
  await expect(page.getByText('2 of 2 saved runs', { exact: true })).toBeVisible();
  await expect(page.getByText(NOTE, { exact: false })).toBeVisible();
});

test('a cloud revision conflict preserves local notes and requires a fresh check', async ({ page, cloudMock }) => {
  cloudMock.rejectSave = true;
  await openPractice(page);
  await startOomCase(page);
  await page.getByLabel('Personal notes', { exact: true }).fill(NOTE);
  await signInToMockAccount(page);
  await page.getByRole('button', { name: '1. Check cloud notebook', exact: true }).click();
  const upload = page.getByRole('button', { name: '3. Upload saved device notebook', exact: true });
  await expect(upload).toBeEnabled();
  await upload.click();
  await expect(page.getByRole('alert').filter({ hasText: 'The cloud notebook changed on another device.' })).toBeVisible();
  await expect(upload).toBeDisabled();
  expect(cloudMock.uploads).toHaveLength(1);
  expect(cloudMock.notebook).toBeNull();
  await expect(page.getByLabel('Personal notes', { exact: true })).toHaveValue(NOTE);
});

test('optional counts need consent and contain only the allowlisted event fields', async ({ page, cloudMock }) => {
  await openPractice(page);
  await startOomCase(page);
  expect(cloudMock.metrics).toHaveLength(0);
  await page.locator('summary').filter({ hasText: 'Optional usage counts' }).click();
  await page.getByRole('button', { name: 'Allow optional counts', exact: true }).click();
  await expect(page.getByText('Optional counts enabled for future activity on this device.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start a new run', exact: true }).click();
  await completeOomCase(page);
  await expect.poll(() => cloudMock.metrics.length).toBe(2);
  expect(cloudMock.metrics.map((item) => item.payload.p_event_type)).toEqual(['case_started', 'case_completed']);
  for (const { payload, headers } of cloudMock.metrics) {
    expect(Object.keys(payload).sort()).toEqual(['p_case_id', 'p_event_id', 'p_event_type']);
    expect(payload.p_case_id).toBe('oomkilled');
    expect(payload.p_event_id).toMatch(/^[\da-f-]{36}$/i);
    expect(headers.authorization).toBeUndefined();
    expect(headers.cookie).toBeUndefined();
    expect(headers.referer).toBeUndefined();
  }
  await page.getByRole('button', { name: 'Keep counts off', exact: true }).click();
  await expect(page.getByText('Optional counts are off. Previously sent event counts are not deleted.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start a new run', exact: true }).click();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  expect(cloudMock.metrics).toHaveLength(2);
});

test('the browser privacy signal keeps optional counts off', async ({ page, cloudMock }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { value: true }));
  await openPractice(page);
  await page.locator('summary').filter({ hasText: 'Optional usage counts' }).click();
  await page.getByRole('button', { name: 'Allow optional counts', exact: true }).click();
  await expect(page.getByText('Your browser privacy signal keeps optional counts off.', { exact: true })).toBeVisible();
  await startOomCase(page);
  await completeOomCase(page);
  expect(cloudMock.metrics).toHaveLength(0);
});

test('withdrawing consent stops future counts even when the preference cannot be saved', async ({ page, cloudMock }) => {
  await openPractice(page);
  await page.locator('summary').filter({ hasText: 'Optional usage counts' }).click();
  await page.getByRole('button', { name: 'Allow optional counts', exact: true }).click();
  await startOomCase(page);
  await expect.poll(() => cloudMock.metrics.length).toBe(1);
  await page.evaluate(() => {
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'opstriage:metrics-consent:v1') throw new DOMException('Simulated blocked preference write', 'QuotaExceededError');
      originalSet.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Keep counts off', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Allow optional counts', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Start a new run', exact: true }).click();
  await completeOomCase(page);
  expect(cloudMock.metrics).toHaveLength(1);
});
