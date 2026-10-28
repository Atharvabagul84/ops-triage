# Architecture

## 01 System Overview
- Static site: Next.js App Router built with `npm run build:static` into `out/`, served by Cloudflare Pages
- All practice logic runs in the browser: scenarios, evaluation, notebook storage (localStorage, versioned schema)
- Optional cloud: the browser talks directly to Supabase (Auth + RPCs) with a publishable key; no app server
- Optional usage counts: consented, allowlisted anonymous events

## 02 Tech Stack
| Area | Tool |
|---|---|
| Frontend | Next.js 16.3.8 (App Router, static export), React 19.2.8, TypeScript, CSS modules, Tailwind CSS 4 |
| Fonts | Geist and Geist Mono via `next/font` |
| Storage | Browser localStorage (notebook v2), Web Locks for multi-tab safety |
| Cloud (optional) | Supabase Auth + PostgreSQL with RLS and RPCs (`@supabase/supabase-js` 2.117.2) |
| Email (optional) | Supabase Auth via custom SMTP (Brevo) |
| Hosting | Cloudflare Pages, production branch `main`, output `out/`, static `_headers` |
| Tests | `node --test` unit/content tests, Playwright (Chromium + Firefox) with axe, performance budget, SQL ownership tests on PostgreSQL 16 |
| CI | GitHub Actions `Validate` workflow |
| Runtime | Node.js 22.23.3 (`.node-version`) |

## 03 Project Structure
```
ops-triage/
├ app/                 # Routes: landing, practice/, beta/
├ components/          # practice/, account/, metrics/, onboarding/, landing/
├ lib/
│ ├ practice/          # Versioned scenarios, evaluation, notebook, export
│ ├ cloud/             # Supabase auth and explicit notebook sync
│ └ metrics/           # Consent and allowlisted events
├ types/               # Domain contracts
├ supabase/            # Migrations and SQL tests
├ scripts/             # Static build, headers, performance budget
├ tests/               # Unit, content, HTTP smoke and e2e (Playwright) tests
└ docs/                # PRD, architecture, design; guides/, reference/, decisions/
```

## 04 Data Flow
1. The learner opens a case; evidence, hints and feedback come from the bundled scenario data
2. Revealing, citing and writing update a draft in the on-device notebook
3. Submitting stores an immutable answer snapshot and shows option-specific feedback and the debrief
4. Export/import moves the notebook as JSON; nothing leaves the device unless the learner signs in and chooses to upload
5. Cloud upload checks the expected revision; a competing update is rejected and must be merged first

## 05 Scalability
- Static hosting scales without servers; the only backend is optional Supabase
- New scenarios need a version, diagnostics, required evidence, three hints, per-option feedback and sources, plus tests
- Don't add services or dependencies without updating this file and an ADR in `docs/decisions/`
