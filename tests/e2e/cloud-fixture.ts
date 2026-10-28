import { expect, test as base, type Page } from '@playwright/test';
import type { PracticeNotebook } from '../../types/practice';

export const MOCK_CLOUD_URL = 'https://cloud-test.invalid';
export const MOCK_EMAIL = 'learner@example.test';
export const MOCK_USER_ID = '33333333-3333-4333-8333-333333333333';

interface UploadPayload { p_notebook: PracticeNotebook; p_expected_revision: number }
interface MetricRequest { payload: Record<string, unknown>; headers: Record<string, string> }
interface CloudMock {
  notebook: PracticeNotebook | null;
  revision: number;
  reads: number;
  uploads: UploadPayload[];
  metrics: MetricRequest[];
  authEmailRequests: string[];
  rejectSave: boolean;
}

export const mockSession = () => {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: MOCK_USER_ID, session_id: '44444444-4444-4444-8444-444444444444', aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600 })}.test-signature`;
  return {
    access_token: token, refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
    user: { id: MOCK_USER_ID, aud: 'authenticated', role: 'authenticated', email: MOCK_EMAIL, email_confirmed_at: '2026-10-01T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' },
  };
};

export const test = base.extend<{ cloudMock: CloudMock }>({
  cloudMock: async ({ context, baseURL }, provide) => {
    const backend: CloudMock = { notebook: null, revision: 0, reads: 0, uploads: [], metrics: [], authEmailRequests: [], rejectSave: false };
    const unexpected: string[] = [];
    const localOrigin = new URL(baseURL!).origin;
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === localOrigin) { await route.continue(); return; }
      if (url.origin !== MOCK_CLOUD_URL) {
        unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
        await route.abort('blockedbyclient');
        return;
      }
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'content-type': 'application/json' };
      const reply = (body: unknown, status = 200) => route.fulfill({ status, headers, body: JSON.stringify(body) });
      if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
      if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') { await reply(mockSession()); return; }
      if (url.pathname === '/auth/v1/signup' && request.method() === 'POST') {
        backend.authEmailRequests.push('signup');
        await reply({ user: mockSession().user, session: null });
        return;
      }
      if (url.pathname === '/auth/v1/recover' && request.method() === 'POST') {
        backend.authEmailRequests.push('reset');
        await reply({});
        return;
      }
      if (url.pathname === '/auth/v1/user') { await reply(mockSession().user); return; }
      if (url.pathname === '/auth/v1/logout') { await route.fulfill({ status: 204, headers }); return; }
      if (url.pathname === '/rest/v1/notebooks' && request.method() === 'GET') {
        backend.reads += 1;
        expect(url.searchParams.get('user_id')).toBe(`eq.${MOCK_USER_ID}`);
        await reply(backend.notebook ? [{ user_id: MOCK_USER_ID, notebook: backend.notebook, revision: backend.revision, updated_at: '2026-10-01T00:00:00Z' }] : []);
        return;
      }
      if (url.pathname === '/rest/v1/rpc/save_notebook' && request.method() === 'POST') {
        const payload = request.postDataJSON() as UploadPayload;
        backend.uploads.push(payload);
        if (backend.rejectSave || payload.p_expected_revision !== backend.revision) {
          await reply({ code: 'P0001', message: 'revision_conflict', details: 'revision_conflict' }, 409);
          return;
        }
        backend.notebook = structuredClone(payload.p_notebook);
        backend.revision += 1;
        await reply([{ revision: backend.revision, updated_at: new Date().toISOString() }]);
        return;
      }
      if (url.pathname === '/rest/v1/rpc/record_practice_event' && request.method() === 'POST') {
        backend.metrics.push({ payload: request.postDataJSON(), headers: request.headers() });
        await reply(null);
        return;
      }
      unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
      await route.abort('blockedbyclient');
    });
    await provide(backend);
    expect(unexpected, 'Mock cloud tests must never reach an unhandled or real external service').toEqual([]);
  },
});

export const signInToMockAccount = async (page: Page) => {
  await page.locator('summary').filter({ hasText: 'Optional account & cloud notebook' }).click();
  await page.getByLabel('Email', { exact: true }).fill(MOCK_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Sign in to account', exact: true }).click();
  await expect(page.getByText(`Signed in as ${MOCK_EMAIL}`, { exact: true })).toBeVisible();
};

export const remoteNotebook = (): PracticeNotebook => ({
  version: 2,
  attempts: [{ id: '55555555-5555-4555-8555-555555555555', scenarioId: 'oomkilled', scenarioVersion: 1, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', hypothesisId: null, diagnosticIds: [], citedDiagnosticIds: [], reasoning: '', notes: 'A saved cloud field note.', hintCount: 0, submissions: [] }],
});

export { expect };
