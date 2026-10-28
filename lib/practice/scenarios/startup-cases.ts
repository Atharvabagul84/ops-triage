import { defineCase } from './case-content';

const sources = [{ title: 'Kubernetes debugging Pods', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/' }];
export const STARTUP_SCENARIO = defineCase({
  id: 'startup-arguments', title: 'A worker exits before serving', summary: 'Use previous logs to investigate a crash loop.', difficulty: 'Beginner',
  context: 'A new worker release repeatedly exits during startup.', initialEvidence: 'Namespace practice; pod queue-worker: CrashLoopBackOff, 6 restarts.',
  hints: ['Check the previous process output and recorded exit, not only the current waiting state.', 'Compare the rejected startup option with the deployed arguments.', 'The program rejects --batch-sze, and the pod manifest contains that misspelling.'],
  checks: [
    ['termination', 'Inspect previous exit', 'kubectl describe pod queue-worker -n practice', 'Last State: Terminated; Reason: Error; Exit Code: 2\nState: Waiting; Reason: CrashLoopBackOff', 'Exit 2 is application-specific; its logs establish what it means here.'],
    ['logs', 'Read previous process logs', 'kubectl logs queue-worker -n practice --previous', 'error: unknown option --batch-sze\nusage: worker --batch-size <integer>\nExiting before initialization.', 'The startup parser rejects an option before initialization.'],
    ['arguments', 'Inspect deployed arguments', 'kubectl get pod queue-worker -n practice -o yaml', 'containers:\n- name: worker\n  args: [--batch-sze, "100"]', 'The actual configuration contains the rejected option.'],
  ], choices: [
    ['bad-argument', 'A misspelled startup argument makes the application exit', 'The previous logs reject --batch-sze and the deployed arguments contain that exact option.'],
    ['oom', 'The memory limit killed the worker', 'The recorded reason is Error with a parser message, not OOMKilled; no memory exhaustion is shown.'],
    ['image', 'The image could not be pulled', 'The application produced startup logs and exited, demonstrating that the image ran.'],
  ], correctHypothesisId: 'bad-argument',
  debrief: { cause: 'The worker rejects --batch-sze and exits before initialization.', evidence: ['Previous logs report an unknown option.', 'The deployed arguments contain the same misspelling.'], counterEvidence: ['CrashLoopBackOff and exit 2 alone do not identify a particular application error.'], remediation: ['Confirm the supported argument for this image version, correct the version-controlled configuration, and roll out the fix.'], verification: ['Check startup completion, stable restart count, and successful representative queue processing.'], lesson: 'Application logs connect a generic process exit to a specific configuration fault.' }, sources,
});

export const STARTUP_VARIANT = defineCase({
  id: 'startup-permissions-variant', variantOf: 'startup-arguments', title: 'The worker fails after initialization begins', summary: 'Inspect the first concrete startup error.', difficulty: 'Intermediate',
  context: 'The worker now runs as an unprivileged user against a mounted directory.', initialEvidence: 'queue-worker-v2: CrashLoopBackOff; startup arguments have not changed.',
  hints: ['Read the error emitted by the previous process before changing its arguments.', 'Compare the runtime user with the directory owner and mode.', 'UID 1000 cannot write a root-owned 0700 directory in the supplied permission record.'],
  checks: [
    ['logs', 'Read previous process logs', 'kubectl logs queue-worker-v2 -n practice --previous', 'Options accepted: batch-size=100\nopen /data/checkpoint: permission denied\nExiting with code 1.', 'Startup parsing succeeds; access to the checkpoint fails.'],
    ['security-context', 'Read runtime identity', 'kubectl get pod queue-worker-v2 -n practice -o yaml', 'securityContext: {runAsUser: 1000, runAsGroup: 1000}\nvolumeMounts: [{name: data, mountPath: /data}]\n# No supplemental groups or fsGroup configured.', 'The configured process identity is not root.'],
    ['permissions', 'Read reviewed mount inspection', 'Review preflight volume-permission record (not a shell command)', '/data: owner uid=0 gid=0; mode=0700\nNo ACL entries; write test as uid=1000: EACCES', 'The actual access check corroborates the permission failure without broadening access.'],
  ], choices: [
    ['bad-argument', 'A startup option is misspelled', 'The process explicitly accepts its options; the next error is EACCES while opening its checkpoint.'],
    ['directory-permission', 'The configured user cannot write the mounted directory', 'UID 1000 receives EACCES against a root-owned 0700 directory with no granting ACL.'],
    ['oom', 'The process was OOM-killed', 'The process logs an explicit permission failure and exits with code 1; no OOM event is supplied.'],
  ], correctHypothesisId: 'directory-permission',
  debrief: { cause: 'The runtime user lacks write access to /data in the supplied mount record.', evidence: ['The previous logs report permission denied.', 'A matching-identity write test fails on the root-owned 0700 directory.'], counterEvidence: ['Container arguments are accepted; increasing memory cannot grant filesystem access.'], remediation: ['Use the supported storage ownership or security-context configuration to grant only the intended service identity access; avoid chmod 777 or running as root as a blanket fix.'], verification: ['Repeat the access check with the service identity and verify checkpoint creation and restart stability.'], lesson: 'Follow the first concrete failure after successful initialization steps.' }, sources: [...sources, { title: 'Kubernetes security contexts', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/security-context/' }],
});
