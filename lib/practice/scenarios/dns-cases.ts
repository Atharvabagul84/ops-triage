import { defineCase } from './case-content';
const sources = [{ title: 'Kubernetes DNS troubleshooting', url: 'https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/' }];
export const DNS_SCENARIO = defineCase({
  id: 'dns-config', title: 'Only one client cannot resolve Services', summary: 'Check the client resolver before blaming CoreDNS.', difficulty: 'Intermediate',
  context: 'A reviewed diagnostic capture contains lookups from the affected client and a known-good client. The workload uses a custom DNS policy.',
  initialEvidence: 'client-custom cannot resolve inventory.practice.svc.cluster.local; client-default succeeds.',
  hints: ['Compare the same lookup from an affected and unaffected client.', 'Read the affected pod DNS policy and resolver configuration.', 'dnsPolicy=None sends the client to 192.0.2.53; the supplied direct query to cluster DNS succeeds.'],
  checks: [
    ['pod-dns', 'Inspect pod DNS configuration', 'kubectl get pod client-custom -n practice -o yaml', 'dnsPolicy: None\ndnsConfig:\n  nameservers: [192.0.2.53]', 'A custom nameserver replaces normal cluster resolver configuration in this case.'],
    ['lookup', 'Read sanitized DNS diagnostic capture', 'Review client DNS diagnostic capture (not a shell command)', 'Affected client default lookup: inventory.practice.svc.cluster.local -> NXDOMAIN\nSame client querying 10.96.0.10 directly -> 10.96.20.15\nKnown-good client default lookup -> 10.96.20.15', 'The same name resolves using cluster DNS, narrowing the fault to the affected resolver path.'],
    ['dns-service', 'Read cluster DNS Service address', 'kubectl get service kube-dns -n kube-system', 'NAME kube-dns\nCLUSTER-IP 10.96.0.10\nPORTS 53/UDP,53/TCP', 'The successful direct query used the actual cluster DNS address.'],
  ], choices: [
    ['wrong-resolver', 'The custom client resolver does not resolve cluster names', 'The custom resolver fails the name while querying cluster DNS from the same client succeeds.'],
    ['coredns-down', 'CoreDNS is unavailable cluster-wide', 'Direct queries to cluster DNS succeed from the affected client and normal resolution works from another pod.'],
    ['service-absent', 'The inventory Service is definitely absent', 'Cluster DNS returns its address for the exact fully qualified name in the supplied capture.'],
  ], correctHypothesisId: 'wrong-resolver',
  debrief: { cause: 'The affected pod uses a custom resolver that cannot resolve this cluster Service name.', evidence: ['dnsPolicy=None configures a non-cluster resolver.', 'The same client resolves the exact name when querying the cluster DNS Service.'], counterEvidence: ['A successful DNS lookup does not establish application reachability.'], remediation: ['Restore the intended cluster DNS policy or configure the custom resolver to forward the cluster zone appropriately.'], verification: ['Repeat resolution using the pod default resolver and then verify an actual request to the Service.'], lesson: 'Compare scope and resolver path before diagnosing a cluster-wide outage.' }, sources,
});
export const DNS_VARIANT = defineCase({
  id: 'dns-name-variant', variantOf: 'dns-config', title: 'One name fails while others resolve', summary: 'Compare resolver scope and the requested name.', difficulty: 'Beginner',
  context: 'A client deployment points at a Service name from an old release.', initialEvidence: 'Lookup of inventories.practice.svc.cluster.local returns NXDOMAIN.',
  hints: ['Test a known existing cluster name through the same resolver.', 'Compare the configured name with the actual Service names in the namespace.', 'The client asks for inventories, but the Service is inventory; the exact valid name resolves.'],
  checks: [
    ['lookup', 'Read lookup comparison', 'Review DNS diagnostic capture (not a shell command)', 'kubernetes.default.svc.cluster.local -> 10.96.0.1\ninventory.practice.svc.cluster.local -> 10.96.20.15\ninventories.practice.svc.cluster.local -> NXDOMAIN\nAll via nameserver 10.96.0.10', 'The same resolver handles existing names successfully.'],
    ['services', 'List Services', 'kubectl get services -n practice', 'NAME        TYPE       CLUSTER-IP\ninventory   ClusterIP  10.96.20.15\n# Complete namespace listing; no inventories Service.', 'The requested plural name is not present.'],
    ['client', 'Read configured endpoint', 'kubectl get deployment client -n practice -o yaml', 'env:\n- name: INVENTORY_HOST\n  value: inventories.practice.svc.cluster.local', 'The client configuration contains the name that fails.'],
  ], choices: [
    ['wrong-resolver', 'The client uses a resolver with no cluster DNS support', 'The same resolver successfully resolves two existing cluster names, including inventory.'],
    ['wrong-service-name', 'The configured Service name does not exist', 'The client requests inventories while the namespace contains inventory, and only the nonexistent name returns NXDOMAIN.'],
    ['backend-crash', 'A crashing backend causes this name to be absent', 'The evidence establishes a name mismatch; a normal ClusterIP Service DNS record is not removed just because a backend crashes.'],
  ], correctHypothesisId: 'wrong-service-name',
  debrief: { cause: 'The client uses inventories instead of the existing inventory Service name.', evidence: ['The configured hostname does not match the Service list.', 'The exact existing name resolves through the same nameserver.'], counterEvidence: ['NXDOMAIN for one name is not evidence of a general CoreDNS failure.'], remediation: ['Correct the application endpoint configuration to the intended namespace and Service name.'], verification: ['Confirm resolution of the configured name and a successful application request.'], lesson: 'A resolver can correctly report that the requested name does not exist.' }, sources,
});
