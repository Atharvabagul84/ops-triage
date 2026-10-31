const NAME = 'inventory.practice.svc.cluster.local';
const ready = (pod) => pod.status.conditions?.some((condition) => condition.type === 'Ready' && condition.status === 'True');

export const lab = {
  caseId: 'dns-config',
  fault: 'A client with dnsPolicy: None and a public nameserver cannot resolve a cluster Service name.',
  ready: {
    description: 'inventory and both clients Ready',
    timeoutSeconds: 180,
    test: (kube) => {
      const pods = kube.json(['get', 'pods', '-n', kube.namespace]).items;
      return pods.length === 3 && pods.every(ready);
    },
  },
  checks: [
    { id: 'pod-dns', args: ['get', 'pod', 'client-custom', '-n', 'practice', '-o', 'yaml'], expect: [/dnsPolicy: None/, /- 8\.8\.8\.8/] },
    // One shell runs both lookups so the default path and the direct query come from the same client.
    { id: 'lookup', args: ['exec', 'client-custom', '-n', 'practice', '--', 'sh', '-c', `nslookup ${NAME}; nslookup ${NAME} 10.96.0.10`], expect: [/NXDOMAIN/, /Server:\s+10\.96\.0\.10/, new RegExp(`Name:\\s+${NAME.replace(/\./g, '\\.')}`)] },
    { id: 'dns-service', args: ['get', 'service', 'kube-dns', '-n', 'kube-system'], expect: [/10\.96\.0\.10/] },
    { id: 'client-default', args: ['exec', 'client-default', '-n', 'practice', '--', 'nslookup', NAME], expect: [/Server:\s+10\.96\.0\.10/, /Address: 10\.96\./] },
  ],
};
