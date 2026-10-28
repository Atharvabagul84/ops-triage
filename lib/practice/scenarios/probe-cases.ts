import { defineCase } from './case-content';
const sources = [{ title: 'Kubernetes liveness and readiness probes', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/' }];
export const PROBE_SCENARIO = defineCase({
  id: 'readiness-port', title: 'Running but never Ready', summary: 'Readiness failure can exclude a healthy process from traffic.', difficulty: 'Beginner',
  context: 'A frontend process stays running but never becomes Ready after its listener changed.', initialEvidence: 'frontend: Running, READY 0/1, RESTARTS 0',
  hints: ['Distinguish readiness failure from process termination.', 'Compare the probe destination with the actual listener.', 'Readiness targets 9090 while the server listens on 8080; no liveness failure or restart is recorded.'],
  checks: [
    ['events', 'Read readiness events', 'kubectl describe pod frontend -n practice', 'Ready=False\nWarning Unhealthy: Readiness probe failed: dial tcp 10.0.0.50:9090: connection refused\nRestart Count: 0', 'A readiness failure affects traffic eligibility; it does not itself restart the container.'],
    ['probe', 'Inspect readiness configuration', 'kubectl get pod frontend -n practice -o yaml', 'readinessProbe: {httpGet: {path: /ready, port: 9090}}\nlivenessProbe: {httpGet: {path: /live, port: 8080}}', 'Readiness and liveness can check different ports and have different consequences.'],
    ['listener', 'Read server startup log', 'kubectl logs frontend -n practice', 'Listening on 0.0.0.0:8080; /ready and /live enabled\nNo listener on 9090.', 'The readiness destination does not match the configured listener.'],
  ], choices: [
    ['readiness-port-mismatch', 'The readiness probe checks the wrong port', 'The event shows refusal on 9090 while startup output identifies only listener 8080.'],
    ['liveness-restart', 'Liveness is repeatedly restarting the process', 'The event names readiness and the restart count is zero; no liveness-triggered restart is shown.'],
    ['oom', 'The process has been OOM-killed', 'The process remains Running with no restart and the observed error is a failed readiness connection.'],
  ], correctHypothesisId: 'readiness-port-mismatch',
  debrief: { cause: 'Readiness probes target 9090, but the server exposes /ready on 8080.', evidence: ['Readiness connection to 9090 is refused.', 'Startup logs report the listener and health endpoints on 8080.'], counterEvidence: ['Not Ready is not synonymous with a crash or a liveness restart.'], remediation: ['Align readiness with the intended endpoint and retain a check that genuinely represents ability to serve traffic.'], verification: ['Observe Ready=True, expected ready EndpointSlice conditions, and successful Service requests.'], lesson: 'Probe type determines the operational consequence of failure.' }, sources,
});
export const PROBE_VARIANT = defineCase({
  id: 'readiness-dependency-variant', variantOf: 'readiness-port', title: 'Readiness still fails on a new release', summary: 'Distinguish an unreachable URL from a failing health response.', difficulty: 'Intermediate',
  context: 'The frontend readiness URL is reachable but returns a failing health status.', initialEvidence: 'frontend-v2: Running, READY 0/1, RESTARTS 0',
  hints: ['Compare a refused TCP connection with an HTTP failure response.', 'An HTTP 503 means the probe reached a server; inspect its health explanation.', 'The server listens on the configured port and reports an unavailable database. Fixing the probe port would not address that result.'],
  checks: [
    ['event', 'Read probe response', 'kubectl describe pod frontend-v2 -n practice', 'Readiness probe failed: HTTP probe failed with statuscode: 503\nRestart Count: 0', 'This is an application HTTP response, not a refused connection.'],
    ['config', 'Read readiness configuration', 'kubectl get pod frontend-v2 -n practice -o yaml', 'readinessProbe: {httpGet: {path: /ready, port: 8080}}', 'The configured destination must be compared with server logs.'],
    ['health', 'Read health log', 'kubectl logs frontend-v2 -n practice', 'Listening on 0.0.0.0:8080\nGET /ready -> 503; check database: connection timeout\nGET /live -> 200', 'The readiness handler reports a database connection failure; its underlying cause is still unknown.'],
  ], choices: [
    ['readiness-port-mismatch', 'The readiness probe targets a non-listening port', 'The server logs the readiness request on 8080 and returns 503; the probe reaches the intended listener.'],
    ['dependency-unavailable', 'Readiness reports a database connection failure', 'The reachable readiness handler returns 503 and specifically records a database connection timeout.'],
    ['database-deleted', 'The database has definitely been deleted', 'A connection timeout does not distinguish server loss from routing, policy, overload, or another connectivity problem.'],
  ], correctHypothesisId: 'dependency-unavailable',
  debrief: { cause: 'The readiness handler is reachable and reports failure to connect to its database.', evidence: ['The probe receives HTTP 503.', 'The application logs tie that response to a database timeout.'], counterEvidence: ['The port matches; a timeout does not establish why the database is unreachable.'], remediation: ['Investigate the configured database endpoint, network path, credentials and database health; preserve the meaningful readiness gate.'], verification: ['Confirm the dependency check succeeds, Ready becomes true, and an application request requiring the database succeeds.'], lesson: 'A failed check can correctly protect users from an unready service.' }, sources,
});
