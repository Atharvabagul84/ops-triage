# Release validation

The `Validate` workflow runs lint, the Node unit/content tests, a production build, and Playwright against Chromium and Firefox for pushes and pull requests. It uses synthetic data and no Supabase or other cloud secrets. The configured cloud host is reserved for tests, and the cloud suite intercepts every external request. It does not deploy. A committed workflow is not evidence of a successful GitHub run: require a green run for the actual release commit.

A separate job applies the migrations to a disposable PostgreSQL 16 service and runs ownership, row-access, revision conflict, input validation and usage-event boundary assertions. Its database password is a test-only value for that temporary service. `supabase/tests/local-bootstrap.sql` creates a minimal Auth/role fixture solely for plain PostgreSQL tests: never apply it to a Supabase project. These SQL checks exercise real PostgreSQL permissions but do not validate Supabase Auth, PostgREST, email delivery or project configuration.

After the browser checks, CI builds a guest static export with the cloud values explicitly empty and checks the compressed initial JavaScript and HTML budgets for the landing, practice and beta pages. This establishes export compatibility and asset-size bounds; it does not measure real-device responsiveness or production Core Web Vitals.

## Run locally

Use the Node version declared by CI, then run:

```sh
npm ci
npm run lint
npm test
npm run build
npx playwright install chromium firefox
npx playwright test
```

Playwright starts the existing production build at `http://127.0.0.1:3100`. Set `PLAYWRIGHT_BASE_URL` only to a test server you control to reuse it; in that mode Playwright does not start or stop the server. Use a fresh test environment rather than real learner accounts. Linux machines may need `npx playwright install --with-deps chromium firefox`.

The guest browser suite verifies the landing entry, evidence gate, submitted answers after reload, transfer-case access, real JSON and Markdown downloads, JSON restoration after deletion, invalid-import preservation, and stale-tab recovery. It also checks keyboard activation and scans the library, investigation and notebook with axe. Unit tests provide the broader catalogue, migration, validation and storage coverage.

To include the cloud mock suite locally, set `NEXT_PUBLIC_SUPABASE_URL=https://cloud-test.invalid` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_only` in the build process environment, rebuild, and run Playwright with `PLAYWRIGHT_MOCK_CLOUD=1`. Next embeds these public values at build time. The cloud suite is skipped unless this explicit test flag is present; CI supplies all three values. It verifies that sign-in does not automatically sync, merging precedes uploads, conflicts preserve local work, optional counts require consent, event payloads omit private fields, and the browser privacy signal is respected. It rejects unhandled external requests. Mock responses do not validate a deployed database or prove that server authorization policies work.

## Before publishing a release

- Require both validation jobs to pass on the release commit. Inspect retries and attached traces instead of ignoring intermittent failures.
- Review case evidence, alternatives, sources and transfer pairs. Automated checks do not establish Kubernetes content correctness or learner competence.
- Test at narrow mobile width and 200% zoom, and perform a screen-reader pass. Axe and the keyboard smoke test do not certify accessibility.
- Download a backup, import it into a separate browser profile, and verify notes, hints and submitted answers. Check blocked storage, the recovery notice, and the export fallback on supported mobile browsers.
- Confirm the production URL serves HTTPS, the intended headers and metadata, and that the old prototype/API routes cannot be mistaken for the supported product.
- If enabling an optional cloud integration, separately verify its configuration, access policies, consent behavior, export/delete behavior and cross-device recovery with test accounts. The credential-free CI suite does not validate deployed Supabase policies or email delivery.
- Record the release commit, validation run URL, tested browsers and any accepted limitations. Keep a previous deployment available for rollback; export a notebook before testing migrations on real data.

## Workflow maintenance

The workflow grants only `contents: read` and does not persist checkout credentials. It uses `pull_request`, not a privileged fork-code trigger, and passes no deployment credentials. Official actions are pinned to reviewed commit SHAs; periodically review upstream releases and update pins through normal review. Their Node 24 action runtime requires a current runner; the configured GitHub-hosted Ubuntu runner supplies it. The application test runtime is Node 22.

Browser artifacts are retained for seven days and contain only synthetic test data. Do not run this suite with production credentials or paste real logs into test fixtures. Workflow permissions and full-SHA pins reduce exposure but do not make dependency install scripts or repository changes trustworthy; review third-party dependencies and workflow changes.

References, checked 6 October 2026: [Playwright CI](https://playwright.dev/docs/ci), [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing), and [GitHub secure workflow guidance](https://docs.github.com/en/actions/reference/security/secure-use).
