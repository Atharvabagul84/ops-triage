<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# OpsTriage agent rules

## What this is
Browser-based Kubernetes incident practice: learners inspect authored evidence, cite it, explain the cause in writing, then read a debrief and a transfer case. Next.js 16 static export on Cloudflare Pages (https://opstriage-practice.pages.dev), guest mode on-device, optional Supabase accounts and notebook sync. Learner beta; outcomes not established yet.

## Before you start
- Read docs/HANDOFF.md first (local only, never commit it), then README.md, docs/README.md (index) and docs/reference/project-notes.md. Record design changes as an ADR in docs/decisions/
- Cloud or auth work: read docs/guides/cloud-setup.md. Releases: follow docs/guides/release-checklist.md step by step
- Practice content lives in `lib/practice/` (cases in `lib/practice/scenarios/`).

## Data and production boundaries (never break these)
- Supabase: publishable key only (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Never a service-role or secret key, in code, env files or chat
- Keep `NEXT_PUBLIC_AUTH_EMAIL_ENABLED=false` until confirmation and recovery email delivery are tested; only the exact value `true` enables it
- Guest data stays on the device. Never upload a notebook without an explicit user action; signing in never uploads
- Usage counts stay opt-in and never include written answers, notes, emails or account IDs
- Database changes go in a new file under `supabase/migrations/`, with checks in `supabase/tests/`. Never edit an applied migration
- Don't deploy to Cloudflare, change the live Supabase project, or touch its auth settings without the owner's explicit OK

## Content rules
- Cases are synthetic and authored. Every supported answer must be backed by evidence the learner can inspect and cite, and each core case keeps a transfer case with a different root cause
- Completion checks reasoning length, not meaning. Never claim automatic grading, certification or live-cluster labs

## Commands
```
npm ci
npm run dev                  # http://localhost:3000
npm test && npm run lint && npm run build
npx playwright install chromium firefox && npm run test:e2e   # after a build
npm run build:static && npm run test:performance
```
