# Project notes

## What the beta includes

- Ten core incidents plus ten transfer cases with a different cause: memory termination, Service routing, image pulls, application restarts, scheduling, readiness, DNS, ConfigMaps, storage, and rollout admission.
- Diagnostic evidence, explicit citations, written reasoning, progressive hints, and feedback for each hypothesis.
- Submitted answer snapshots. Editing a draft does not change the last assessed result.
- Debriefs with supporting facts, counter-evidence, remediation, verification, and Kubernetes documentation.
- Multiple runs per case, personal notes, answer history, and notebook search.
- JSON backup/import from a file or pasted text with version validation and non-destructive merge; readable Markdown export; selectable previews for browsers that restrict downloads or clipboard access.
- A beta guide at `/beta` explaining storage, privacy, limitations, and the pilot.
- A public landing page and dismissible first-visit guide.
- Optional Supabase email accounts, password recovery, and explicit check → merge → upload for cloud notebooks on configured deployments. Signing in never uploads a notebook.
- Optional usage counts, disabled until consent. Counts exclude written answers, notes, emails, account IDs and visitor profiles.
- GitHub validation with domain tests, Chromium/Firefox journeys, actual backup download/restore, keyboard checks and axe accessibility scans.

Completion requires the authored supported answer, required inspected and cited evidence, and 40–4,000 characters of reasoning. **Reasoning length is checked; its meaning is not automatically graded.** These are guided case studies, not live labs or certification assessments. Answer data ships to the browser, so completion is for self-study.


## Run locally

Use Node.js 22.23.3, pinned in `.node-version`, and npm. The lockfile fixes dependency versions for `npm ci`.

```bash
npm ci
npm run dev
```

Open the landing page at `http://localhost:3000`. No API key is required for guest practice. The application can run on Next.js or as a static export; offline/PWA installation is not implemented.

```bash
npm test
npm run lint
npm run build
npm start
```

With a Next.js server running on port 3000, use `npm run test:beta` to verify the landing page and the practice/guide routes. Set `BETA_TEST_ORIGIN` to test another local port. Do not run two servers on the same port. The HTTP checks use synthetic/malformed input only.

For browser checks, install test browsers once with `npx playwright install chromium firefox`, then run `npm run test:e2e` after building. The runner starts production on port 3100, or uses `PLAYWRIGHT_BASE_URL`. See `docs/guides/release-checklist.md` for the release procedure and test scope.


## Deploy to Cloudflare Pages

Production is [opstriage-practice.pages.dev](https://opstriage-practice.pages.dev), served by Cloudflare Pages from production branch `main`. Automatic preview deployments are disabled. The configured build uses the repository root, command `npm run build:static`, and output directory `out`. The `.node-version` file selects Node.js 22.23.3. When recreating the deployment, override any framework preset that uses a different build command: the repository's script enables static export and writes the deployment's Supabase origin into `out/_headers`.

Set production build variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_AUTH_EMAIL_ENABLED` from the configured deployment. The key must be a publishable key; these values are public browser configuration. Set the email flag to `true` only for a deployment with tested confirmation and recovery delivery. Leave cloud values unset and the email flag `false` for guest-only deployments. Rebuild after changing them. If previews are enabled later, keep them guest-only unless a separate staging backend and redirect policy are deliberately configured.

To produce the same static directory locally, run `npm ci`, `npm run build:static`, and `npm run test:performance`. Publish the complete `out/`, including `_headers` and `404.html`. Cloud calls go directly to Supabase and need no Next server.

Supabase Site URL is `https://opstriage-practice.pages.dev`, with the exact `/practice` redirect configured. Cloud setup, email delivery and acceptance checks are in [cloud setup](../guides/cloud-setup.md).

## Notebook and data boundaries

Notebook version 2 stores multiple runs and immutable submitted snapshots. Existing version 1 progress migrates as a draft because old records did not capture citations or reasoning. Import preserves supported history and reports unsupported, duplicate, or invalid records.

Limits: 200 runs, 100 submissions per run, 10,000 characters per note, 4,000 characters per explanation, and 2 MiB of notebook JSON. Capacity errors preserve existing records; export a backup before removing runs. Import/export is local. Optional cloud upload sends the saved notebook, including notes and reasoning, only after an explicit action.

Browser storage is not encrypted or automatically synced. Clearing site data can remove it. Different origins (including localhost versus 127.0.0.1), profiles, and devices have separate notebooks. Use synthetic notes only. Sign-out leaves the local notebook on the device, so export/remove local runs on shared computers. Ordinary network logs are controlled by hosting/database providers.

Usage counts require a separate opt-in and send a named event, optional case ID, and random event ID through an anonymous request, without the signed-in token. Return visits are approximated from a consented local UTC-day marker. Disabling counts stops future sends; already anonymous events cannot be mapped back to a person. These counts can be inflated by automated clients and do not establish learning gains or product demand.

## Optional cloud setup

Copy `.env.example` to `.env.local` and set the Supabase project URL and **publishable** key. Never use a service-role or secret key. Keep `NEXT_PUBLIC_AUTH_EMAIL_ENABLED=false` until confirmation and recovery email delivery are tested; only the exact value `true` enables those requests. Existing account sign-in and cloud transfers can work while new signup is unavailable. Also disable public signup in Supabase while email is unavailable. These public values are fixed at build time, so rebuild after changing them. Apply the versioned migration in `supabase/migrations` and configure the site's exact `/practice` auth redirect. Details and rollback-only database checks are in `docs/guides/cloud-setup.md` and `supabase/tests/`.

Each account can read only its own cloud notebook. Writes use an expected revision; a competing update fails and requires another check and merge. Account changes invalidate in-flight UI operations and uploads keep the initiating token. Cloud account deletion is not yet available from this interface; an administrator must handle it in Supabase. Without project configuration, cloud controls explain their unavailability and guest practice remains functional.

Saving pauses if another tab changes the stored notebook or saved data cannot be fully restored. The app preserves the current tab for export and offers the original device snapshot for recovery. Export before reloading. Writes use a shared Web Lock when supported; older browsers without Web Locks use a best-effort comparison guard, so keep one active editing tab there.

## Architecture

- Next.js 16.3.8 App Router, React 19, TypeScript, Tailwind CSS 4.
- `app/practice/` and `app/beta/`: learner routes.
- `components/practice/`: investigations, notebook, storage/import boundary, accessible interface.
- `types/practice.ts`: domain contracts.
- `lib/practice/`: versioned synthetic scenarios, evaluation, validated notebook handling, export.
- `components/account/`, `lib/cloud/`: optional authentication and explicit notebook sync.
- `components/metrics/`, `lib/metrics/`: consent and allowlisted event payloads.
- `supabase/`: versioned schema and authorization checks.
- `tests/`: domain behavior, catalogue invariants and HTTP smoke checks.

## Release and content review

Every scenario carries a version, diagnostic IDs, required evidence, three hints, option-specific feedback, and official source links. Source alignment and invariant tests do not replace a practitioner review or learner study. If evidence/answers change, increment the scenario version deliberately and plan a historical-notebook migration before release; unsupported versions are skipped on import.

Before inviting learners: run automated checks, verify the main workflow and JSON restore in supported browsers, have a Kubernetes practitioner review assigned cases, and prepare pilot consent and scheduling.

## Remaining product work

No learner pilot has run yet. This is an engineering beta, not a validated learning product. Payments, live environments, AWS practice, AI assistance, and own-incident triage remain outside this beta. No real learner outcomes or willingness to pay have been measured.

