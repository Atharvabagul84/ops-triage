const replicaSets = (kube) => kube.json(['get', 'replicasets', '-n', kube.namespace, '-l', 'app=api']).items;
const newReplicaSet = (kube) => replicaSets(kube).find((item) => item.metadata.annotations?.['deployment.kubernetes.io/revision'] === '2')?.metadata.name;

export const lab = {
  caseId: 'rollout-quota',
  fault: 'A rollout with maxSurge 1 and maxUnavailable 0 cannot create its surge pod under a full pods quota.',
  ready: {
    description: 'two available replicas of release 42',
    timeoutSeconds: 180,
    test: (kube) => kube.json(['get', 'deployment', 'api', '-n', kube.namespace]).status.availableReplicas === 2,
  },
  trigger: {
    description: 'FailedCreate on the release 43 ReplicaSet',
    timeoutSeconds: 120,
    run: (kube) => kube.run(['set', 'env', 'deployment/api', '-n', kube.namespace, 'RELEASE=43']),
    test: (kube) => {
      const name = newReplicaSet(kube);
      if (!name) return false;
      const events = kube.json(['get', 'events', '-n', kube.namespace, '--field-selector', `involvedObject.name=${name},reason=FailedCreate`]).items;
      const deployment = kube.json(['get', 'deployment', 'api', '-n', kube.namespace]);
      return events.length > 0 && deployment.status.conditions?.some((condition) => condition.type === 'ReplicaFailure' && condition.status === 'True');
    },
  },
  checks: [
    { id: 'status', args: ['get', 'deployment', 'api', '-n', 'practice'], expect: [/2\/2/] },
    { id: 'strategy', args: ['get', 'deployment', 'api', '-n', 'practice', '-o', 'yaml'], expect: [/maxSurge: 1/, /maxUnavailable: 0/] },
    { id: 'replicaset', args: (kube) => ['describe', 'replicaset', newReplicaSet(kube), '-n', 'practice'], expect: [/exceeded quota: pod-budget/] },
    { id: 'quota', args: ['get', 'resourcequota', 'pod-budget', '-n', 'practice', '-o', 'yaml'], expect: [/pods: "2"/] },
  ],
};
