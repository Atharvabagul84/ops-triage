# 0001: Static export with no server or model

**Status:** Accepted

## Context
An earlier prototype generated free-text runbooks with a model behind an API route. Its output couldn't be validated, it needed a server and a provider key, and it encouraged copying answers instead of reasoning.

## Decision
OpsTriage ships as a static export (`npm run build:static` → `out/`) on Cloudflare Pages. All cases are authored data bundled into the site; evaluation runs in the browser. The only optional backend is Supabase, called directly from the browser with a publishable key.

## Consequences
- No server to run or secure, no model cost, fast global delivery.
- Answer data ships to the browser, so completion is for self-study, not assessment.
- Cloud features are optional and degrade to guest mode when unconfigured.
