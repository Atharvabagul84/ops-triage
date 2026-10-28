# Product Requirements Document

## 01 Product Overview
- **Product Name:** OpsTriage
- **Tagline:** Read the signals. Explain the cause.
- **Description:** A browser-based practice room for the first minutes of a Kubernetes incident. Learners inspect authored evidence, cite the facts that support a diagnosis, explain the connection in writing, then compare with a debrief and a transfer case with a different root cause. No cluster, account or install needed.

## 02 Problem
- Most troubleshooting practice checks whether you typed the right command, not whether you can reason from evidence.
- Real incidents are a poor place to learn; cluster labs are slow to set up and easy to break.

## 03 Goal
- A learner can complete a case in under 15 minutes and explain, with cited evidence, why the cause fits and the alternatives don't.

## 04 Target Users
- Junior SREs and platform engineers learning Kubernetes troubleshooting
- On-call engineers refreshing incident reasoning
- Mentors who want shared, self-paced practice cases

## 05 Core Features (Version 1)
- **Cases:** ten core incidents plus ten transfer cases (OOMKilled, Service routing, image pulls, restarts, scheduling, readiness, DNS, ConfigMaps, storage, rollout admission).
- **Investigate and cite:** reveal `kubectl describe`, events and logs; mark the evidence that supports a diagnosis.
- **Explain:** pick a cause and write the reasoning (40–4,000 characters), with progressive hints.
- **Debrief:** option-specific feedback, counter-evidence, remediation, verification steps and Kubernetes docs.
- **Notebook:** multiple runs, answer history, search, JSON backup/import, Markdown export, all on-device.
- **Optional accounts:** Supabase email sign-in and explicit cloud notebook sync.

## 06 Out of Scope (for now)
- Automatic grading of written reasoning, certification
- Live clusters or labs, AWS practice
- AI assistance or own-incident triage
- Payments

## 07 Success Metrics
- In a learner pilot, most participants cite the required evidence on a transfer case they haven't seen.
- A practitioner review finds no case whose supported answer contradicts its evidence.
- Lighthouse-style budgets met: the CI performance budget passes for landing, practice and beta pages.
