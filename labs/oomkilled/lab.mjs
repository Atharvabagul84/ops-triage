const pod = (kube) => kube.json(['get', 'pod', 'report-worker', '-n', kube.namespace]).status.containerStatuses?.[0];

export const lab = {
  caseId: 'oomkilled',
  fault: 'Container exceeds its 256Mi memory limit and restarts in CrashLoopBackOff.',
  ready: {
    description: 'three OOM kills and CrashLoopBackOff',
    timeoutSeconds: 300,
    test: (kube) => {
      const status = pod(kube);
      return status?.restartCount >= 3 && status.lastState?.terminated?.reason === 'OOMKilled' && status.state?.waiting?.reason === 'CrashLoopBackOff';
    },
  },
  checks: [
    { id: 'status', args: ['get', 'pod', 'report-worker', '-n', 'practice'], expect: [/CrashLoopBackOff/] },
    { id: 'termination', args: ['describe', 'pod', 'report-worker', '-n', 'practice'], expect: [/Reason:\s+OOMKilled/, /Exit Code:\s+137/, /Reason:\s+CrashLoopBackOff/] },
    { id: 'resources', args: ['get', 'pod', 'report-worker', '-n', 'practice', '-o', 'jsonpath={.spec.containers[0].resources}'], expect: [/"memory":"256Mi"/] },
    { id: 'node-health', args: (kube) => ['describe', 'node', `${kube.cluster}-control-plane`], expect: [/MemoryPressure\s+False/] },
  ],
};
