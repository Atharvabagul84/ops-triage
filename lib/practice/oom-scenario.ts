import type { PracticeScenario } from '../../types/practice';
import { briefIntro, labCapture } from './scenarios/case-content';

const lab = labCapture('oomkilled');

export const OOM_SCENARIO: PracticeScenario = {
  id: 'oomkilled',
  version: 1,
  hints: ['A restart is a symptom. Inspect how the previous container terminated.', 'Compare the recorded termination with its memory configuration; do not infer a leak from a restart.', 'The OOMKilled reason establishes an OOM termination. The 256Mi budget does not tell you why memory was needed.'],
  title: 'The restarting report worker',
  summary: 'Distinguish a restart symptom from a confirmed termination reason.',
  difficulty: 'Beginner',
  estimatedMinutes: 6,
  lab,
  brief: `${briefIntro(lab)} The report worker restarts during batch processing and report jobs are delayed. Determine the supported failure mechanism without guessing the underlying application bug.`,
  initialEvidence: '$ kubectl get pod report-worker -n practice\nNAME            READY   STATUS             RESTARTS      AGE\nreport-worker   0/1     CrashLoopBackOff   4 (74s ago)   3m',
  diagnostics: [
    {
      id: 'termination', label: 'Inspect the previous termination',
      command: 'kubectl describe pod report-worker -n practice',
      output: 'Containers:\n  worker:\n    State:          Waiting\n      Reason:       CrashLoopBackOff\n    Last State:     Terminated\n      Reason:       OOMKilled\n      Exit Code:    137\n    Restart Count:  4\nEvents:\n  Type     Reason     Age                  From               Message\n  Warning  BackOff    4s (x5 over 2m52s)   kubelet            spec.containers{worker}: Back-off restarting failed container worker in pod report-worker_practice(821e6ffa-87de-4439-bd36-286f6bf13b86)',
      explanation: 'OOMKilled is the recorded reason in Last State. CrashLoopBackOff only describes restart backoff, exit 137 by itself would not prove an OOM kill, and the Events list shows the back-off rather than the kill.',
    },
    {
      id: 'resources', label: 'Inspect memory settings',
      command: "kubectl get pod report-worker -n practice -o 'jsonpath={.spec.containers[0].resources}'",
      output: '{"limits":{"cpu":"500m","memory":"256Mi"},"requests":{"cpu":"100m","memory":"128Mi"}}',
      explanation: 'The worker has a 256Mi memory limit. Combine this configuration with the termination reason; the limit alone does not prove a memory leak or measure the peak.',
    },
    {
      id: 'node-health', label: 'Check node pressure',
      command: 'kubectl describe node ops-triage-labs-control-plane',
      output: 'Name:               ops-triage-labs-control-plane\nConditions:\n  Type             Status  LastHeartbeatTime                 LastTransitionTime                Reason                       Message\n  ----             ------  -----------------                 ------------------                ------                       -------\n  MemoryPressure   False   Sat, 31 Oct 2026 18:08:49 +0530   Sat, 31 Oct 2026 18:07:02 +0530   KubeletHasSufficientMemory   kubelet has sufficient memory available\n  DiskPressure     False   Sat, 31 Oct 2026 18:08:49 +0530   Sat, 31 Oct 2026 18:07:02 +0530   KubeletHasNoDiskPressure     kubelet has no disk pressure\n  PIDPressure      False   Sat, 31 Oct 2026 18:08:49 +0530   Sat, 31 Oct 2026 18:07:02 +0530   KubeletHasSufficientPID      kubelet has sufficient PID available\n  Ready            True    Sat, 31 Oct 2026 18:08:49 +0530   Sat, 31 Oct 2026 18:07:49 +0530   KubeletReady                 kubelet is posting ready status',
      explanation: 'There is no current node-pressure signal in this excerpt. This weakens the node-wide pressure theory but does not rule out a transient condition at the time of the kill.',
    },
  ],
  hypotheses: [
    { id: 'probe-failure', label: 'A failing liveness probe caused the restart', feedback: 'The recorded reason is OOMKilled, and this excerpt has no liveness-failure or probe-triggered killing event.' },
    { id: 'memory-exhaustion', label: 'The container terminated because of an OOM condition', feedback: 'OOMKilled supports this mechanism; the memory budget helps frame the next investigation, but a leak remains unproven.' },
    { id: 'cpu-limit', label: 'CPU throttling directly caused this recorded termination', feedback: 'A CPU limit generally throttles work. It does not explain the explicit OOMKilled termination reason.' },
  ],
  correctHypothesisId: 'memory-exhaustion',
  requiredDiagnosticIds: ['termination', 'resources'],
  debrief: {
    cause: 'An OOM termination is recorded for a container configured with a 256Mi memory limit. The application-level reason for memory growth remains unproven.',
    evidence: ['The previous termination explicitly says OOMKilled.', 'The container has a 256Mi memory limit; memory demand and this budget need investigation.'],
    counterEvidence: ['The excerpt has no failed-liveness-probe event. A restart alone is not evidence of a probe failure.', 'CPU limits typically throttle execution; they do not establish the recorded OOM cause.', 'Current node MemoryPressure=False does not exclude past node pressure. No memory leak has been demonstrated.'],
    remediation: ['Inspect historical memory usage and reproduce the batch workload to distinguish legitimate demand from retained allocations.', 'Review batch size and concurrency. Test a measured memory-budget change or application fix, with node capacity checked before rollout.'],
    verification: ['Repeat a representative batch and confirm successful jobs with no new OOM terminations or increasing restarts.', 'Observe memory headroom over multiple batches and confirm service health; a Ready pod immediately after restart is insufficient.'],
    lesson: 'Confirm the termination reason, then separate the failure mechanism from the still-unproven application cause.',
  },
  sources: [{ title: 'Kubernetes: memory resources and OOM termination', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/' }],
};
