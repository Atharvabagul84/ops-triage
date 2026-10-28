import { defineCase } from './case-content';
const sources = [{ title: 'Kubernetes ConfigMaps', url: 'https://kubernetes.io/docs/concepts/configuration/configmap/' }];
export const CONFIG_SCENARIO = defineCase({
  id: 'missing-configmap', title: 'Configuration prevents container creation', summary: 'Differentiate startup configuration failure from a crash loop.', difficulty: 'Beginner',
  context: 'A frontend is deployed into a fresh namespace with a required ConfigMap reference.', initialEvidence: 'frontend-config: CreateContainerConfigError; restart count 0',
  hints: ['Read the exact container-creation error before looking for application logs.', 'Check the required configuration reference in the pod namespace.', 'The non-optional frontend-settings ConfigMap reference has no matching object in practice.'],
  checks: [
    ['events', 'Read container creation error', 'kubectl describe pod frontend-config -n practice', 'State: Waiting; Reason: CreateContainerConfigError\nError: configmap "frontend-settings" not found\nRestart Count: 0', 'The required configuration cannot be resolved before this container starts.'],
    ['reference', 'Read configuration reference', 'kubectl get pod frontend-config -n practice -o yaml', 'envFrom:\n- configMapRef:\n    name: frontend-settings\n    optional: false', 'This is a required ConfigMap in the pod namespace.'],
    ['exists', 'Check ConfigMap existence', 'kubectl get configmap frontend-settings -n practice', 'Error from server (NotFound): configmaps "frontend-settings" not found', 'The expected object is absent from the relevant namespace.'],
  ], choices: [
    ['absent-configmap', 'A required ConfigMap is missing in the pod namespace', 'The required reference names frontend-settings and both the event and object lookup report it missing.'],
    ['app-crash', 'Application code keeps crashing', 'The container cannot be created and has zero restarts; no running application crash is evidenced.'],
    ['missing-key', 'The ConfigMap exists but one key is absent', 'The lookup reports the whole ConfigMap absent, not an existing map missing a particular key.'],
  ], correctHypothesisId: 'absent-configmap',
  debrief: { cause: 'A required frontend-settings ConfigMap does not exist in namespace practice.', evidence: ['The required envFrom reference names frontend-settings.', 'Both the creation error and namespace lookup report NotFound.'], counterEvidence: ['This pre-start configuration error is different from an application process that starts and exits.'], remediation: ['Deploy the approved configuration into the correct namespace or correct the reference. Keep the requirement unless the application safely supports an absent configuration.'], verification: ['Confirm container creation, expected configuration behavior, readiness, and a representative request.'], lesson: 'Identify the lifecycle stage before choosing diagnostics.' }, sources,
});
export const CONFIG_VARIANT = defineCase({
  id: 'configmap-key-variant', variantOf: 'missing-configmap', title: 'Existing configuration still blocks startup', summary: 'An object existence check is only one validation step.', difficulty: 'Intermediate',
  context: 'Configuration deployment succeeds but the application still cannot start.', initialEvidence: 'frontend-key: CreateContainerConfigError; frontend-settings exists.',
  hints: ['Read whether the error names an absent object or a missing field inside it.', 'Compare the exact key reference with the available keys, including case.', 'The pod requests LOG_LEVEL, but the ConfigMap only contains log_level.'],
  checks: [
    ['events', 'Read the exact error', 'kubectl describe pod frontend-key -n practice', 'CreateContainerConfigError\nError: could not find key LOG_LEVEL in ConfigMap practice/frontend-settings', 'The error identifies a key lookup, not a missing ConfigMap.'],
    ['reference', 'Read environment reference', 'kubectl get pod frontend-key -n practice -o yaml', 'env:\n- name: LOG_LEVEL\n  valueFrom:\n    configMapKeyRef: {name: frontend-settings, key: LOG_LEVEL, optional: false}', 'The required key is case-sensitive.'],
    ['keys', 'Inspect non-secret configuration', 'kubectl get configmap frontend-settings -n practice -o yaml', 'metadata: {name: frontend-settings, namespace: practice}\ndata:\n  log_level: info', 'The map exists but supplies a different key. ConfigMaps must not hold secrets.'],
  ], choices: [
    ['absent-configmap', 'The entire ConfigMap is absent', 'The ConfigMap content is present; its lower-case key differs from the requested upper-case key.'],
    ['absent-key', 'The required ConfigMap key does not match the available key', 'The reference requires LOG_LEVEL, the object provides log_level, and the event identifies this missing key.'],
    ['probe', 'A readiness probe stops the container from being created', 'The pre-start error is an unresolved configuration key; a readiness probe runs only after the container starts.'],
  ], correctHypothesisId: 'absent-key',
  debrief: { cause: 'The non-optional reference requires LOG_LEVEL, but frontend-settings only provides log_level.', evidence: ['The error names the missing LOG_LEVEL key.', 'Reference and available key differ in case.'], counterEvidence: ['Finding the ConfigMap object does not prove its required entries exist.'], remediation: ['Align the reviewed key contract between the workload and ConfigMap, then apply the corrected configuration.'], verification: ['Confirm container creation and the intended log-level behavior without exposing sensitive configuration.'], lesson: 'Validate both object identity and the referenced data contract.' }, sources,
});
