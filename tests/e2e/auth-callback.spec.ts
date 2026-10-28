import { expect, MOCK_EMAIL, mockSession, signInToMockAccount, test } from './cloud-fixture';
import { openPractice } from './practice-helpers';

test.skip(process.env.PLAYWRIGHT_MOCK_CLOUD !== '1', 'Requires intercepted fake-cloud configuration.');

const recoveryPath = () => {
  const session = mockSession();
  return `/practice#${new URLSearchParams({ access_token: session.access_token, refresh_token: session.refresh_token,
    expires_in: String(session.expires_in), expires_at: String(session.expires_at), token_type: session.token_type, type: 'recovery' })}`;
};

test('the practice header opens sign in with keyboard focus and can reopen a collapsed panel', async ({ page, cloudMock }) => {
  await openPractice(page);
  const signIn = page.getByRole('banner').getByRole('link', { name: 'Sign in', exact: true });
  await expect(signIn).toBeInViewport();
  await signIn.focus();
  await page.keyboard.press('Enter');
  const email = page.getByLabel('Email', { exact: true });
  await expect(email).toBeInViewport();
  await expect(email).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
  await page.locator('#account > summary').click();
  await signIn.click();
  await expect(email).toBeFocused();
  expect(cloudMock.authEmailRequests).toEqual([]);
  expect(cloudMock.uploads).toEqual([]);
});

test('a direct account link and the landing sign-in link open the account form', async ({ page, cloudMock }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/practice#account');
  await expect(page.getByLabel('Email', { exact: true })).toBeInViewport();
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  await page.goto('/');
  const signIn = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Sign in', exact: true });
  await expect(signIn).toBeInViewport();
  await signIn.click();
  await expect(page.getByLabel('Email', { exact: true })).toBeInViewport();
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  expect(cloudMock.authEmailRequests).toEqual([]);
  expect(cloudMock.uploads).toEqual([]);
});

test('an expired or reused email link shows an actionable error without losing guest practice', async ({ page, cloudMock }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/practice#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await expect(page.getByRole('alert').filter({ hasText: /link.*expired|link.*already.*used/i })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: /link.*expired|link.*already.*used/i })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Sign in to account', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start case', exact: true }).first()).toBeVisible();
  await expect.poll(() => new URL(page.url()).hash).toBe('');
  expect(cloudMock.authEmailRequests).toEqual([]);
  expect(cloudMock.uploads).toEqual([]);
});

test('verified recovery survives reload after the SDK clears the link and ends after password update', async ({ page, cloudMock }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(recoveryPath());
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await expect(page.getByText('Your recovery link was accepted. Choose a new password.', { exact: true })).toBeInViewport();
  await expect.poll(() => new URL(page.url()).hash).toBe('');
  await page.reload();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await page.getByLabel('New password', { exact: true }).fill('synthetic-recovered-password');
  await page.getByLabel('Confirm new password', { exact: true }).fill('synthetic-recovered-password');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Password updated. Your notebook was not transferred.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0);
  expect(cloudMock.authEmailRequests).toEqual([]);
  expect(cloudMock.uploads).toEqual([]);
});

test('a reused link keeps an existing signed-in account and cancellation ends recovery', async ({ page, cloudMock }) => {
  await openPractice(page);
  await signInToMockAccount(page);
  await page.goto('/practice?error_code=otp_expired&error_description=already+used');
  await expect(page.getByRole('alert').filter({ hasText: /link.*expired/ })).toBeVisible();
  await expect(page.getByText(`Signed in as ${MOCK_EMAIL}`, { exact: true })).toBeVisible();
  // An email link loads a new document; a hash-only goto on /practice does not.
  await page.goto('/');
  await page.goto(recoveryPath());
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel and sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in to account', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0);
  expect(cloudMock.authEmailRequests).toEqual([]);
});
