# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-10-28

First public release. Earlier development history is kept in a private archive.

### Added
- Ten core Kubernetes incident cases plus ten transfer cases, each with diagnostics, required evidence, progressive hints, option-specific feedback, debriefs and Kubernetes documentation links.
- Evidence citation and written reasoning workflow with immutable submission snapshots.
- On-device notebook (versioned schema, multi-tab safety, JSON backup/import, Markdown export).
- Optional Supabase accounts and explicit cloud notebook sync with RLS and revision checks; opt-in anonymous usage counts.
- Static export on Cloudflare Pages with strict response headers.
- CI: unit and content tests, Playwright in Chromium and Firefox with axe, performance budget, SQL ownership tests.
- Documentation: PRD, architecture, design system, guides, reference, decision records; security and contributing guides.

### Removed
- The retired free-text runbook prototype and its API route.

[Unreleased]: https://github.com/Atharvabagul84/ops-triage/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Atharvabagul84/ops-triage/releases/tag/v1.0.0
