import { defineCase } from './case-content';
const sources = [{ title: 'Kubernetes StorageClasses and binding modes', url: 'https://kubernetes.io/docs/concepts/storage/storage-classes/' }];
export const STORAGE_SCENARIO = defineCase({
  id: 'pvc-storageclass', title: 'A database waits for storage', summary: 'Use claim events to identify provisioning prerequisites.', difficulty: 'Beginner',
  context: 'A database cannot start because its required volume claim remains Pending.', initialEvidence: 'PVC database-data: Pending\nPod database-0: Pending',
  hints: ['Inspect the claim event before changing pod compute resources.', 'Compare the explicitly requested StorageClass with cluster classes.', 'The claim requests fast-ssd, but the class lookup returns NotFound.'],
  checks: [
    ['claim', 'Read claim specification', 'kubectl get pvc database-data -n practice -o yaml', 'spec:\n  storageClassName: fast-ssd\n  accessModes: [ReadWriteOnce]\n  resources: {requests: {storage: 10Gi}}\nstatus: {phase: Pending}', 'The claim explicitly requests a class; the default class does not silently replace that name.'],
    ['events', 'Read provisioning events', 'kubectl describe pvc database-data -n practice', 'Warning ProvisioningFailed: storageclass.storage.k8s.io "fast-ssd" not found', 'The reported blocker is missing class configuration.'],
    ['class', 'Check requested class', 'kubectl get storageclass fast-ssd', 'Error from server (NotFound): storageclasses.storage.k8s.io "fast-ssd" not found', 'The requested class is absent.'],
  ], choices: [
    ['missing-storageclass', 'The explicitly requested StorageClass is absent', 'The claim requests fast-ssd and both provisioning events and the class lookup report that class missing.'],
    ['disk-full', 'The physical disk is definitely full', 'No disk-capacity error is supplied; provisioning cannot resolve the requested class.'],
    ['normal-delay', 'This is confirmed normal WaitForFirstConsumer waiting', 'No existing WaitForFirstConsumer class is shown; the named class is absent and provisioning reports a failure.'],
  ], correctHypothesisId: 'missing-storageclass',
  debrief: { cause: 'The claim names fast-ssd, which does not exist in the cluster.', evidence: ['The PVC explicitly requests fast-ssd.', 'Provisioning and class lookup both report the class absent.'], counterEvidence: ['Pending alone does not distinguish an error from intentional delayed binding.'], remediation: ['Confirm the intended storage policy and provision the approved class or plan a safe claim correction before data is created. Do not delete a data-bearing claim as a generic fix.'], verification: ['Confirm appropriate binding, successful mount, and a controlled application read/write check.'], lesson: 'Investigate the claim and its provisioning policy before modifying the consumer.' }, sources,
});
export const STORAGE_VARIANT = defineCase({
  id: 'pvc-consumer-variant', variantOf: 'pvc-storageclass', title: 'A new claim stays Pending', summary: 'Interpret events before diagnosing a storage failure.', difficulty: 'Intermediate',
  context: 'A developer creates a claim before creating any consuming workload.', initialEvidence: 'PVC scratch-data: Pending; no consuming pod deployed yet.',
  hints: ['Check the binding mode and the claim event before calling Pending a failure.', 'Some storage binding waits until a pod provides placement requirements.', 'The class exists with WaitForFirstConsumer; the event is waiting for a consumer, and there is none.'],
  checks: [
    ['claim', 'Read claim and event', 'kubectl describe pvc scratch-data -n practice', 'StorageClass: topology-storage\nStatus: Pending\nUsed By: <none>\nNormal WaitForFirstConsumer: waiting for first consumer to be created before binding', 'The controller reports intentional waiting rather than a provisioning failure.'],
    ['class', 'Read binding policy', 'kubectl get storageclass topology-storage -o yaml', 'metadata: {name: topology-storage}\nprovisioner: csi.example.invalid\nvolumeBindingMode: WaitForFirstConsumer', 'Binding is delayed so consumer scheduling can inform placement; the provisioner identifier is synthetic.'],
    ['consumers', 'Check namespace workloads', 'kubectl get pods -n practice -o yaml', 'items: []', 'There is no pod using the claim in this fixture.'],
  ], choices: [
    ['missing-storageclass', 'The StorageClass is missing', 'The class object is shown with its provisioner and WaitForFirstConsumer policy.'],
    ['waiting-consumer', 'The claim is intentionally waiting for a consuming pod', 'The claim event, binding policy, and absent consumers all support expected delayed binding.'],
    ['provisioner-broken', 'The CSI provisioner has definitely failed', 'No provisioning failure is shown; the controller is waiting for the first consumer. Future provisioning success remains untested.'],
  ], correctHypothesisId: 'waiting-consumer',
  debrief: { cause: 'WaitForFirstConsumer binding has not begun because no pod consumes the claim.', evidence: ['The class uses delayed binding.', 'The claim event names the expected wait and there are no consumers.'], counterEvidence: ['Expected waiting now does not guarantee the CSI provisioner or capacity will work later.'], remediation: ['Create the intended consuming workload with its normal scheduling constraints, then inspect any new scheduling or provisioning events.'], verification: ['After a consumer is scheduled, confirm binding, volume mount, and a controlled read/write check.'], lesson: 'State must be interpreted in the context of lifecycle and configured policy.' }, sources,
});
