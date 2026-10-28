# 0002: Guest-first, on-device notebooks

**Status:** Accepted

## Context
Learners write free-text reasoning that may include notes they wouldn't want uploaded, and requiring an account before the first case loses most visitors.

## Decision
Everyone starts as a guest. The notebook lives in browser storage with a versioned schema, migrations, immutable submission snapshots, size limits that fail without data loss, and Web Locks across tabs. JSON backup/import and Markdown export work offline. Signing in never uploads anything; cloud sync is an explicit check → merge → upload with revision checks, and each account reads only its own notebook (RLS).

## Consequences
- Privacy by default and no sign-up friction.
- Browser storage isn't encrypted or synced, and clearing site data removes it, so export is prominent.
- Different origins and devices have separate notebooks.
