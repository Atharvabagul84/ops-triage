# Security policy

## Supported versions
Only the latest release on `main` is supported.

## Reporting a vulnerability
Please **don't open a public issue**. Use GitHub's [private vulnerability reporting](https://github.com/Atharvabagul84/ops-triage/security/advisories/new). Include what you found, how to reproduce it and the expected impact. You'll get a reply within 7 days.

## Scope
- In scope: the static site, its response headers (`scripts/static-headers.mjs`), notebook storage and import, cloud sync, and the Supabase migrations (RLS policies and RPCs).
- Please don't load-test the live site, create bulk accounts, or try to access other users' notebooks.

## Handling secrets
- The app uses only a publishable Supabase key; a service-role or secret key must never appear in code, env files or the browser.
- SMTP credentials live only in Supabase's settings, never in this repository.
- Secret scanning and push protection are enabled on this repository.
