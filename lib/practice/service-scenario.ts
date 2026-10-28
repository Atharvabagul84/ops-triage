import type { PracticeScenario } from '../../types/practice';

export const SERVICE_SCENARIO: PracticeScenario = {
  id: 'service-selector',
  version: 1,
  hints: ['Trace how the Service discovers its backends before guessing at network causes.', 'Compare the selector and pod labels in the same namespace, then inspect EndpointSlices.', 'The Service asks for inventory-v1, but the ready pod has inventory-v2. The empty backend list corroborates the mismatch.'],
  title: 'Healthy pods, unreachable service',
  summary: 'Trace how a Service selects its backend pods.',
  difficulty: 'Beginner',
  estimatedMinutes: 7,
  brief: 'Synthetic practice case. A rollout finishes and the inventory pods report Ready, but clients cannot reach inventory through its Service. All outputs are simulated excerpts. Find the configuration mismatch before proposing a change.',
  initialEvidence: 'Namespace: practice\nService: inventory\nPod: inventory-6bd4f\nREADY  STATUS   RESTARTS\n1/1    Running  0\nClient requests to inventory:8080 fail.',
  diagnostics: [
    {
      id: 'service-selector', label: 'Read the Service selector',
      command: 'kubectl get service inventory -n practice -o yaml',
      output: 'spec:\n  selector:\n    app: inventory-v1\n  ports:\n    - port: 8080\n      targetPort: 8080',
      explanation: 'The Service selects app=inventory-v1. This is a configuration fact; it is not yet proof that any intended pod matches.',
    },
    {
      id: 'pod-labels', label: 'Compare pod labels',
      command: 'kubectl get pods -n practice --show-labels',
      output: 'NAME               READY  STATUS   LABELS\ninventory-6bd4f     1/1    Running  app=inventory-v2,pod-template-hash=6bd4f',
      explanation: 'The ready inventory pod has app=inventory-v2, so it does not match the Service selector. Ready pods are not automatically Service backends.',
    },
    {
      id: 'endpoints', label: 'Inspect discovered backends',
      command: 'kubectl get endpointslices -n practice -l kubernetes.io/service-name=inventory -o yaml',
      output: 'items:\n  - metadata:\n      labels:\n        kubernetes.io/service-name: inventory\n    addressType: IPv4\n    ports:\n      - port: 8080\n    endpoints: []',
      explanation: 'No backend addresses are listed. This corroborates the selector mismatch. An empty list alone can also reflect no eligible matching pods or an endpoint-controller reconciliation issue; unready endpoints normally remain listed with ready=false.',
    },
  ],
  hypotheses: [
    { id: 'selector-mismatch', label: 'The Service selector does not match the intended pod labels', feedback: 'The Service selects inventory-v1 while the ready pod is inventory-v2, and no backend addresses were discovered.' },
    { id: 'crashing-app', label: 'The inventory pod is repeatedly crashing', feedback: 'The pod is Running and Ready with zero restarts. Its label mismatch explains why it is not selected.' },
    { id: 'dns-cause', label: 'A DNS outage explains the empty backend list', feedback: 'DNS has not been checked, but a DNS failure does not cause the observed Service selector and pod labels to differ.' },
  ],
  correctHypothesisId: 'selector-mismatch',
  requiredDiagnosticIds: ['service-selector', 'pod-labels', 'endpoints'],
  debrief: {
    cause: 'The Service selects app=inventory-v1, but the intended pod is labeled app=inventory-v2. No pod matches, leaving the Service without backends in this case.',
    evidence: ['The Service selector and pod label differ.', 'The EndpointSlice has no backend addresses.'],
    counterEvidence: ['The pod is Running and Ready with zero restarts, which weakens a crash-loop explanation.', 'DNS has not been tested, but DNS failure does not explain the observed selector mismatch or empty backend list.'],
    remediation: ['Confirm which workload should receive traffic, then align its stable labels and the Service selector in the version-controlled manifests.', 'Review the selected pod set before applying the change; an overly broad selector could send traffic to unintended pods.'],
    verification: ['Check that EndpointSlices contain the intended ready pod addresses and expected port.', 'From an existing client, verify a request through the Service returns the expected application response, then monitor failures and latency.'],
    lesson: 'Follow the path from selector to labels to discovered endpoints before debugging the network.',
  },
  sources: [{ title: 'Kubernetes: debugging Services', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/' }],
};
