# Optional Supabase setup

Guest practice, local notebooks, and manual JSON/Markdown backups work without a cloud project. This repository contains the database migration, local verification, and hosted acceptance procedure. Local tests alone do not verify hosted Auth, PostgREST, or email delivery.

The reference deployment uses a Free-plan Supabase project with email confirmation on and anonymous Auth off. Confirmation and recovery email go through Brevo Free SMTP (see below). Keep public signup disabled until confirmation and password recovery pass acceptance, and allow the exact `/practice` Auth redirect for your origin (the live site is https://opstriage-practice.pages.dev). Free-plan limits apply; don't enable paid upgrades without the owner's authorization.

## Provision and configure

1. Choose the intended Supabase organization, project, and region. Use a dedicated staging project first. Do not reuse a production database without reviewing the migration and a recovery plan.
2. Apply `supabase/migrations/20261006094843_cloud_notebooks_and_usage_counts.sql` as the migration owner (`postgres`) through the project's migration workflow. It creates `public.notebooks`, the two public RPCs, and `opstriage_private`. Keep `opstriage_private` **out of the Data API exposed schemas**; expose the intended `public` objects only. The SQL already grants the exact client permissions needed. Never add broad table write grants to make a client error disappear.
3. Configure Supabase email/password Auth. Set the site URL to the real deployment origin and allow the exact `/practice` recovery/confirmation redirect. Configure and test production SMTP and sender settings; enabling email Auth alone does not prove email delivery. Disable anonymous Auth sign-ins unless intentionally supported; guest practice does not need an Auth user.
4. Set the deployment's `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from that project. These are public browser configuration; **never** place a secret or service-role key in a `NEXT_PUBLIC_` variable. Keep `NEXT_PUBLIC_AUTH_EMAIL_ENABLED=false` until a sender is configured and confirmation/recovery delivery is verified. Only the exact value `true` enables signup and reset-email requests in the app. Also disable new signups in Supabase while email is unavailable; the UI flag is not an authorization boundary. Existing account sign-in, explicit notebook sync, and already-issued valid recovery links remain supported. Rebuild the app after changing public values; static exports embed these at build time, so changing runtime environment variables alone is insufficient. Guest access stays free of account requirements. Optional usage collection remains off until each browser explicitly allows it.
5. Run Supabase security/performance advisors for the selected project and review the functions and policies. The two private definer writers are intentional: one enforces the only revision-checked notebook write path; the other accepts restricted anonymous counters. Neither is an exposed public definer RPC.

The installed CLI must be consulted with `--help` before running commands; command layouts can change. The hosted migration is applied separately from local verification. Supabase's default SMTP sender only delivers to organization team members; it cannot support public signup and reset emails. Configure a custom sender before enabling those actions.

### Hosted email rollout

Brevo uses `smtp-relay.brevo.com:587`, the account's exact SMTP Login, and a dedicated standard SMTP key stored only in Supabase's encrypted SMTP settings. The verified sender name is **OpsTriage**. No SMTP credential belongs in this repository or the frontend. The selected Brevo Free allowance is 300 emails/day; Supabase's initial custom-SMTP limit is separately 30 emails/hour, with a 60-second per-user cooldown. Brevo may replace a free-provider From address with its own sending domain; an authenticated domain is still preferable for delivery.

In the reference Brevo account, per-contact tracking consent is enabled and tracking of unknown consent is disabled. Anonymous tracking is also enabled. These settings should not be described as proof that all links remain unchanged: test the actual delivered confirmation and recovery links. Preserve Supabase's `{{ .ConfirmationURL }}` template variable.

An operator can create one unconfirmed account in a controlled inbox and call `auth.resend({ type: 'signup', ... })` while public signup remains disabled. On 6 October 2026, this path was accepted, Brevo reported delivery, the recipient confirmed receipt and opened the link, and Supabase confirmed the account. The app opened `/practice`, removed URL tokens, and signed in without creating a cloud notebook. This does not by itself test the initial public `signUp()` request or password recovery. Keep both signup gates closed until the remaining checks pass.

Recovery callbacks should retain their password form across a reload in the same tab and show useful feedback for failed or reused links. The tab-local recovery marker contains account/session identifiers and an expiry, not credentials; it restores UI only. Authenticated server verification still controls password changes. Browsers that block session storage need to keep the recovery page open until the password update completes.

Provider references: [Brevo SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP), [Free plan](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan), [tracking consent](https://help.brevo.com/hc/en-us/articles/37114679474706-About-email-tracking-pixels-and-the-CNIL-recommendation-in-Brevo), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Database contract and permissions

- `public.notebooks`: one row per `auth.users.id`, cascading account deletion, a version-2 JSON object with an `attempts` array of at most 200 entries, a positive revision, and a server timestamp. Authenticated clients can SELECT only their own row under RLS. Anonymous clients cannot read it; neither client role can directly insert, update, or delete rows.
- `public.save_notebook(p_notebook jsonb, p_expected_revision bigint)`: SECURITY INVOKER wrapper. The private writer derives `auth.uid()` itself, accepts no owner/timestamp, and atomically creates with expected revision `0` or updates a matching existing revision. It returns one `{ revision, updated_at }` row. A mismatch raises SQLSTATE `P0001` with detail `revision_conflict`; the client must check and merge before retrying. Concurrent successful saves cannot both consume the same revision.
- Notebook JSON is capped at **2 MiB of UTF-8 database-normalized JSON**. PostgreSQL adds formatting when rendering `jsonb::text`, so a compact client backup close to 2 MiB may be rejected by the server even though it fits locally. The database checks this envelope and size; the app validates full attempt/scenario structure. It is not an immutable evidence archive: the account owner can deliberately replace their own bounded notebook through the RPC.
- `public.record_practice_event(p_event_id uuid, p_event_type text, p_case_id text)`: SECURITY INVOKER wrapper over a private writer. Only `case_started`, `case_completed`, and `return_visit` are accepted. Case events require one of the exact 20 authored case IDs; return visits require a null case ID. Invalid/null required arguments are rejected. Random event UUIDs deduplicate retries while retained.
- `opstriage_private.practice_events` stores only the event UUID, allowed type/case ID, and server timestamp. There are no account, email, notes, reasoning, IP, cookie, or visitor-profile columns. Anonymous and authenticated roles cannot read or write the table directly. The function does not inspect account identity. Provider network logs may separately contain IP addresses.
- A transaction advisory lock serializes metrics writes around a **10,000-row global UTC-day cap**. Further events are silently dropped for the day. Each valid request opportunistically removes events older than 90 days. If requests stop, cleanup waits for the next valid request; add a separately reviewed scheduled cleanup if strict wall-clock deletion is required. This migration does not install a scheduler.

Counts are approximate and untrusted. Anyone with the public endpoint can submit fabricated allowed events or exhaust the shared daily budget; the cap bounds stored growth, not request traffic, unique people, or learning. No identity is available to reconstruct individual visits or delete a person's old anonymous counts. Do not use these counts as outcome validation. Monitor provider limits and add reviewed gateway abuse controls if needed before a broad launch.

## Verify locally

For a disposable plain PostgreSQL 16 database with a privileged test connection, run in this order:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/local-bootstrap.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261006094843_cloud_notebooks_and_usage_counts.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/cloud_notebooks_and_usage_counts.sql
node --test supabase/tests/allowlist.test.mjs
```

`local-bootstrap.sql` is a **test-only** minimal Auth/role shim for plain PostgreSQL. Never apply it to Supabase. On a disposable Supabase staging database with the migration already applied, run only `cloud_notebooks_and_usage_counts.sql` as `postgres`.

The verification file starts a transaction, tests two temporary Auth users, and rolls everything back. Its metrics-cap test temporarily clears the private event table under the same advisory lock before restoring it through rollback; use a disposable/staging database, not an active production instance. Use `ON_ERROR_STOP=1` so failures abort immediately. Checks cover owner separation, missing identity, denied direct/anonymous writes, successful create/update, stale revisions, malformed and oversized envelopes including UTF-8 text, 200/201 attempt boundaries, account deletion cascade, event validation, retry deduplication, old-row cleanup, and the daily cap. The Node test detects drift between SQL and the authored scenario IDs.

Local validation used an isolated container with no published ports and the existing image `postgres:16` / `postgres@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94`. This validates real PostgreSQL permissions and function behavior with a simulated Auth context. It does not validate Supabase's token verification, PostgREST schema exposure, email delivery, hosted quotas, or simultaneous client requests.

## Hosted acceptance checks before enabling the feature

- Test registration, confirmation where enabled, login, password-reset delivery and `/practice` recovery, expired sessions, and logout with real test accounts. Sign-in alone must neither upload nor import a notebook. Logout must retain the local notebook and clearly communicate that fact on shared devices.
- With account A, explicitly check cloud, merge an existing cloud notebook, then upload. With account B and with no session, verify A's row is unreadable and unwritable through the Data API. Send direct table writes and confirm rejection.
- Issue two saves with the same expected revision from independent clients. Exactly one may succeed; the other must receive `revision_conflict`, and a recheck must preserve the winning history. Repeat for simultaneous first saves with expected revision `0`.
- Verify the private schema is not exposed and the public functions have no inherited PUBLIC execute permission. Confirm the browser only uses the publishable key and real authenticated requests for notebook access.
- Verify metrics send nothing before consent, omit notebook text and signed-in credentials, and stop after disabling consent. Confirm event schema and counts in privileged operator access; there is intentionally no public counter reader.
- Re-run the selected project's advisors and review provider logs/retention and abuse limits. Record the actual project, migration result, and hosted outcomes; do not mark these complete from the local test.

Deleting a local run does not remove a cloud snapshot or exported backup. There is no in-app cloud/account deletion in this slice. An operator can remove a verified account's cloud notebook or account using trusted administrative access; account deletion cascades the notebook, but existing Auth tokens need the provider's revocation/session handling. Backups and provider logs follow their separately configured retention. Do not request database credentials or secret keys through the app.

References checked for this migration: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database functions](https://supabase.com/docs/guides/database/functions), [PostgreSQL function security](https://www.postgresql.org/docs/current/sql-createfunction.html), and [Supabase changelog](https://supabase.com/changelog). No relevant breaking SQL/RLS change was identified in the current changelog review.
