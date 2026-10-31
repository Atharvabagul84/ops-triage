# Kind labs

Five core cases are reproduced on a real, disposable [kind](https://kind.sigs.k8s.io/) cluster. Their evidence in the app is copied line for line from the kubectl output captured here, instead of being written by hand.

| Lab (case id) | Fault | Symptom asserted |
|---|---|---|
| `oomkilled` | Container exceeds its 256Mi memory limit | `Last State: Terminated, Reason: OOMKilled, Exit Code: 137`, CrashLoopBackOff |
| `startup-arguments` | Misspelled startup flag (`--batch-sze`) | `Exit Code: 2`, CrashLoopBackOff, `unknown option` in previous logs |
| `dns-config` | `dnsPolicy: None` with a public nameserver | NXDOMAIN via 8.8.8.8; the same name resolves via cluster DNS 10.96.0.10 |
| `readiness-port` | Readiness probes port 9090; server listens on 8080 | `Readiness probe failed ... :9090 ... connection refused`, 0 restarts, only 8080 listening |
| `rollout-quota` | `maxSurge: 1`, `maxUnavailable: 0` under a `pods: "2"` quota | `FailedCreate ... exceeded quota: pod-budget` on the new ReplicaSet |

Each lab is namespace-scoped (`practice`) and uses one image, `busybox:1.37.0` pinned by digest. The workloads are small busybox stand-ins (a shell "worker", `httpd`), so the application is synthetic but every Kubernetes object, event, status and log line is real.

## Files

- `<lab>/manifest.yaml`: the broken workload.
- `<lab>/lab.mjs`: when the fault is ready, an optional trigger (the rollout lab changes the pod template), the kubectl checks and the symptom each must show.
- `<lab>/capture.json`: the committed capture (Kubernetes and kubectl versions, time, every command and its full output). The app quotes it.
- `capture.mjs`: runs the labs. `lib/guard.mjs` refuses any context other than `kind-ops-triage[-name]` whose API server is a loopback address, and every kubectl call passes `--context` explicitly.

## Run

Needs Docker, kind v0.33.0 and kubectl. The cluster uses about 1.3 GB for the node image.

```bash
npm run labs:up                      # kind cluster "ops-triage-labs" (switches your current context)
npm run labs:capture                 # all labs; rewrites labs/<lab>/capture.json
node labs/capture.mjs oomkilled      # one lab
node labs/capture.mjs --out /tmp/x   # write captures elsewhere (used by CI)
npm run labs:down
```

To leave your current kubectl context alone, create the cluster with a separate kubeconfig and point the script at it:

```bash
kind create cluster --name ops-triage-labs --kubeconfig ./labs.kubeconfig
KUBECONFIG=./labs.kubeconfig node labs/capture.mjs
```

## How the app stays in sync

- `npm test` (`tests/labs.test.mjs`, runs in the Validate workflow) fails if any command, initial-evidence line or output line of a lab-backed case does not appear, in order, in its `capture.json`. Excerpts may skip lines; they may not change one.
- The Labs workflow (`.github/workflows/labs.yml`) creates a fresh pinned kind cluster on pull requests that touch `labs/`, weekly and on demand, reproduces every fault and asserts its symptom. Fresh captures are uploaded as an artifact. Pod IPs, names and ages change between runs, so CI checks symptoms, not bytes.
- After re-capturing, update the case excerpts in `lib/practice/` until `npm test` passes. Keep diagnostic and hypothesis IDs unchanged, or bump the scenario version (see ADR 0004).

The ten transfer cases and the other five core cases are still authored by hand and say so in the app.
