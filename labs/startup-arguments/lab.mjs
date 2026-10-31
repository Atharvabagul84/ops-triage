const pod = (kube) => kube.json(['get', 'pod', 'queue-worker', '-n', kube.namespace]).status.containerStatuses?.[0];

export const lab = {
  caseId: 'startup-arguments',
  fault: 'A misspelled startup flag makes the process exit 2, so the pod enters CrashLoopBackOff.',
  ready: {
    description: 'three exits with code 2 and CrashLoopBackOff',
    timeoutSeconds: 300,
    test: (kube) => {
      const status = pod(kube);
      return status?.restartCount >= 3 && status.lastState?.terminated?.exitCode === 2 && status.state?.waiting?.reason === 'CrashLoopBackOff';
    },
  },
  checks: [
    { id: 'status', args: ['get', 'pod', 'queue-worker', '-n', 'practice'], expect: [/CrashLoopBackOff/] },
    { id: 'termination', args: ['describe', 'pod', 'queue-worker', '-n', 'practice'], expect: [/Reason:\s+Error/, /Exit Code:\s+2/, /Reason:\s+CrashLoopBackOff/] },
    { id: 'logs', args: ['logs', 'queue-worker', '-n', 'practice', '--previous'], expect: [/unknown option --batch-sze/] },
    { id: 'arguments', args: ['get', 'pod', 'queue-worker', '-n', 'practice', '-o', 'yaml'], expect: [/- --batch-sze/] },
  ],
};
