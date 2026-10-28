import type { PracticeScenario } from '../../types/practice';

export const IMAGE_SCENARIO: PracticeScenario = {
  id: 'image-pull-auth',
  version: 1,
  hints: ['Look past the backoff status to the concrete pull error.', 'Check the referenced credential object in the same namespace without printing secret values.', 'regcred is absent and the registry reports authentication required. A tag lookup has not succeeded yet.'],
  title: 'A release that never starts',
  summary: 'Separate registry authentication failures from missing image tags.',
  difficulty: 'Intermediate',
  estimatedMinutes: 8,
  brief: 'Synthetic practice case. The billing image lives in a private registry. Its pod starts failing after deployment to a new namespace. All outputs are simulated excerpts and registry.example.invalid is fictional. Decide which blocker is supported, and what remains unknown.',
  initialEvidence: 'Namespace: practice\nPod: billing-85fc2\nREADY  STATUS            RESTARTS\n0/1    ImagePullBackOff  0\nImage: registry.example.invalid/billing:2026.10.06',
  diagnostics: [
    {
      id: 'pull-events', label: 'Inspect image pull errors',
      command: 'kubectl describe pod billing-85fc2 -n practice',
      output: 'State: Waiting\n  Reason: ImagePullBackOff\nEvents:\n  Warning FailedToRetrieveImagePullSecret  Unable to retrieve image pull secret regcred\n  Warning Failed  Failed to pull image "registry.example.invalid/billing:2026.10.06": unauthorized: authentication required\n  Normal BackOff  Back-off pulling image',
      explanation: 'The concrete errors concern credentials and authentication. ImagePullBackOff is a retry symptom and does not by itself distinguish an invalid image name from failed authentication.',
    },
    {
      id: 'credential-reference', label: 'Inspect the credential reference',
      command: "kubectl get pod billing-85fc2 -n practice -o jsonpath='{.spec.imagePullSecrets}'",
      output: '[{"name":"regcred"}]',
      explanation: 'This pod references a Secret named regcred. The reference alone does not prove the Secret exists or its credentials are usable.',
    },
    {
      id: 'secret-exists', label: 'Check Secret metadata in this namespace',
      command: 'kubectl get secret regcred -n practice',
      output: 'Error from server (NotFound): secrets "regcred" not found',
      explanation: 'The referenced Secret is absent in the pod namespace. This command checks existence without printing credential values.',
    },
  ],
  hypotheses: [
    { id: 'missing-tag', label: 'The image tag is definitely missing from the registry', feedback: 'The error is authentication required; there is no authenticated manifest lookup proving the tag is absent.' },
    { id: 'registry-auth', label: 'Missing pull credentials are blocking registry authentication', feedback: 'The pod references regcred, the Secret is absent in its namespace, and the pull is rejected for authentication.' },
    { id: 'application-crash', label: 'Application code crashed after the image started', feedback: 'The image has not been pulled and the container has not started. No application crash is evidenced.' },
  ],
  correctHypothesisId: 'registry-auth',
  requiredDiagnosticIds: ['pull-events', 'credential-reference', 'secret-exists'],
  debrief: {
    cause: 'The pod references an absent image-pull Secret, and the registry rejects unauthenticated access. Restore authorized image-pull credentials first; the requested tag has not yet been verified.',
    evidence: ['Pull events report both a missing pull Secret and an authentication error.', 'The pod references regcred, but that Secret does not exist in its namespace.'],
    counterEvidence: ['There is no authenticated manifest lookup showing a missing tag. Some registries conceal image existence until authentication succeeds.', 'The image has not started; an application crash is not supported by these pull errors.'],
    remediation: ['Provision the authorized pull Secret in the pod namespace through the approved secret-management workflow, and check the pod or ServiceAccount reference.', 'After authentication succeeds, verify the image repository and tag or digest. Do not expose credentials in diagnostic logs or notebooks.'],
    verification: ['Confirm a new pull succeeds and no fresh authentication errors appear in pod events.', 'Confirm the intended image digest runs, the pod becomes Ready, and an application health check succeeds. Investigate a new manifest-not-found error separately if one appears.'],
    lesson: 'Use the specific registry error to choose the next check. Fixing one evidenced blocker does not prove that every subsequent stage will succeed.',
  },
  sources: [{ title: 'Kubernetes: image pull behavior and private registries', url: 'https://kubernetes.io/docs/concepts/containers/images/' }],
};
