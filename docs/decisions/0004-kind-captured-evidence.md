# 0004: Real kind captures for five core cases

**Status:** Accepted (2026-10-31)

## Context
Every case's kubectl output was written by hand. Hand-written output drifts from what Kubernetes really prints (field layout, event wording, the missing `OOMKilled` event, NXDOMAIN reported once per query type), and a reviewer cannot tell an authored excerpt from a real one. A full "live labs" mode was ruled out: similar products exist, and the app is a static export with no cluster.

## Decision
- Five namespace-scoped core cases (`oomkilled`, `startup-arguments`, `dns-config`, `readiness-port`, `rollout-quota`) get a lab in `labs/<case-id>/`: a manifest that reproduces the fault on kind, the checks to run, and a committed `capture.json` of the real output.
- The app quotes those captures. An excerpt may skip lines but every displayed line, the command and the initial evidence must appear verbatim and in order (`tests/labs.test.mjs`). The UI marks these cases "KIND CAPTURE"; all others stay "SIMULATED".
- Lab scripts run only against `kind-ops-triage[-name]` contexts with a loopback API server, and pass `--context` on every call.
- CI reproduces the faults on a pinned kind cluster for lab changes, weekly and on demand, and asserts each symptom. It does not compare bytes, because names, IPs and ages change per run.
- Scenario versions stay at 1. Diagnostic IDs, hypotheses, the supported answer and required evidence are unchanged; only excerpt text changed. Saved notebooks store IDs, so existing runs stay valid. A future change to IDs or answers must bump the version.

## Consequences
- Five of twenty cases are now backed by reproducible evidence; fifteen remain authored. Node-level and cluster-wide faults (node pressure, CoreDNS config) are out of scope because they would contaminate a shared cluster.
- Re-capturing changes volatile values, so the case excerpts must be updated in the same change.
- The DNS lab needs outbound DNS to 8.8.8.8 to reproduce its NXDOMAIN.
