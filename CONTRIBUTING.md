# Contributing

Issues and pull requests are welcome, especially reviews of the cases by people who run Kubernetes.

## Setup
- Node.js 22.23.3 (`.node-version`) and npm. No API key or account is needed for guest practice.

```sh
npm ci
npm run dev   # http://localhost:3000
```

## Checks (run before every pull request)
```sh
npm run lint
npm test
npm run build
npx playwright install chromium firefox && npm run test:e2e
npm run build:static && npm run test:performance
```
CI also runs SQL ownership and revision tests against PostgreSQL 16. See the [release checklist](docs/guides/release-checklist.md).

## Adding or changing a case
- Cases live in `lib/practice/scenarios/`. Each needs a version, diagnostic IDs, required evidence, three hints, option-specific feedback, official source links and a transfer case with a different root cause. Lab-backed cases must quote `labs/<case-id>/capture.json` verbatim (see `labs/README.md`).
- Every supported answer must be backed by evidence the learner can inspect and cite.
- If evidence or answers change, bump the scenario version and plan the notebook migration.

## Pull requests
1. Branch from `main`; one change per PR.
2. Add or update tests. Database changes need a new migration in `supabase/migrations/` and checks in `supabase/tests/`.
3. Update the matching doc (and an ADR in `docs/decisions/` for a design change).
4. Add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).
5. `main` is protected: changes land by squash-merging a PR with green CI.

## Never commit
- `.env*` files (except `.env.example`), keys or tokens
- Real learner notes or answers
