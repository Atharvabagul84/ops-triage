export const lab = {
  caseId: 'readiness-port',
  fault: 'The readiness probe targets 9090 while the server listens on 8080, so the pod stays Running but not Ready.',
  ready: {
    description: 'repeated readiness failures with no restart',
    timeoutSeconds: 180,
    test: (kube) => {
      const pod = kube.json(['get', 'pod', 'frontend', '-n', kube.namespace]);
      const status = pod.status.containerStatuses?.[0];
      if (!status?.state?.running || status.ready || status.restartCount !== 0) return false;
      const events = kube.json(['get', 'events', '-n', kube.namespace, '--field-selector', 'involvedObject.name=frontend,reason=Unhealthy']).items;
      return events.some((event) => event.message.startsWith('Readiness probe failed') && (event.count ?? event.series?.count ?? 1) >= 3);
    },
  },
  checks: [
    { id: 'status', args: ['get', 'pod', 'frontend', '-n', 'practice'], expect: [/0\/1\s+Running\s+0/] },
    { id: 'events', args: ['describe', 'pod', 'frontend', '-n', 'practice'], expect: [/Readiness probe failed: .*:9090.*connection refused/, /Restart Count:\s+0/] },
    { id: 'probe', args: ['get', 'pod', 'frontend', '-n', 'practice', '-o', 'yaml'], expect: [/port: 9090/] },
    { id: 'listener', args: ['exec', 'frontend', '-n', 'practice', '--', 'netstat', '-tln'], expect: [/:8080\s/], reject: [/:9090\s/] },
  ],
};
