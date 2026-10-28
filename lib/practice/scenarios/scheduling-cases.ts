import { defineCase } from './case-content';
const sources = [{ title: 'Kubernetes debugging Pending Pods', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/' }];
export const SCHEDULING_SCENARIO = defineCase({
  id: 'pending-capacity', title: 'A Pending pod on a quiet node', summary: 'Scheduling uses requested capacity, not current CPU usage.', difficulty: 'Beginner',
  context: 'The only eligible node has low observed CPU usage but cannot schedule a new worker.', initialEvidence: 'compute-worker: Pending\nNode: <none>\nOne eligible node: node-a',
  hints: ['Start with the scheduler event rather than the utilization graph.', 'Compare the pod request with allocatable capacity minus existing requests.', 'The node has 4 CPU allocatable and 3 CPU already requested; the new pod requests 2 CPU.'],
  checks: [
    ['scheduler', 'Read scheduling events', 'kubectl describe pod compute-worker -n practice', 'PodScheduled: False\nFailedScheduling: 0/1 nodes are available: 1 Insufficient cpu.', 'The scheduler names CPU capacity as the unsatisfied constraint.'],
    ['request', 'Read requested resources', 'kubectl get pod compute-worker -n practice -o yaml', 'containers: [{name: worker, resources: {requests: {cpu: "2", memory: 256Mi}}}]\nNo init containers; overhead absent.', 'This pod needs 2 CPU of schedulable request capacity.'],
    ['allocated', 'Inspect node allocation', 'kubectl describe node node-a', 'Allocatable cpu: 4\nAllocated resources: CPU Requests 3 (75%)\nReady=True; no taints', 'Only 1 CPU remains unrequested, below the new request.'],
  ], choices: [
    ['request-capacity', 'CPU requests exceed the eligible node capacity remaining', 'The scheduler reports Insufficient cpu and only 1 CPU remains for a 2 CPU request.'],
    ['cpu-usage', 'Low live CPU usage guarantees it should schedule', 'Scheduling accounts for requests; low live usage does not free already reserved request capacity.'],
    ['image-pull', 'Registry authentication blocks scheduling', 'The pod has no assigned node and the scheduler names CPU; image pulling has not begun.'],
  ], correctHypothesisId: 'request-capacity',
  debrief: { cause: 'The new 2 CPU request cannot fit into 1 CPU of remaining eligible request capacity.', evidence: ['FailedScheduling reports Insufficient cpu.', 'Allocatable minus existing CPU requests is less than the new request.'], counterEvidence: ['Low utilization is not evidence of unreserved scheduling capacity.'], remediation: ['Validate resource sizing, then add eligible capacity or safely adjust workload placement or requests based on measurements.'], verification: ['Confirm node assignment, container startup, and acceptable runtime behavior after the scheduling change.'], lesson: 'Separate reservations used for scheduling from actual consumption.' }, sources,
});
export const SCHEDULING_VARIANT = defineCase({
  id: 'pending-taint-variant', variantOf: 'pending-capacity', title: 'A small pod still waits', summary: 'Evaluate scheduling constraints beyond requested capacity.', difficulty: 'Intermediate',
  context: 'A small worker is Pending although the only node has ample request capacity.', initialEvidence: 'compute-small: Pending; node assignment absent.',
  hints: ['Identify the constraint named by the scheduler.', 'Compare node taints with the pod tolerations before changing resource requests.', 'The node has dedicated=gpu:NoSchedule and the pod has no matching toleration.'],
  checks: [
    ['events', 'Read scheduler rejection', 'kubectl describe pod compute-small -n practice', 'FailedScheduling: 0/1 nodes are available: 1 node(s) had untolerated taint {dedicated: gpu}.', 'The reported blocker is a taint, not resource capacity.'],
    ['node', 'Inspect node constraints', 'kubectl describe node gpu-a', 'Taints: dedicated=gpu:NoSchedule\nAllocatable cpu: 8\nCPU Requests: 1\nReady=True', 'Spare CPU does not override NoSchedule.'],
    ['pod', 'Inspect tolerations and requests', 'kubectl get pod compute-small -n practice -o yaml', 'resources: {requests: {cpu: 100m}}\ntolerations: []', 'The pod fits capacity but does not tolerate this node restriction.'],
  ], choices: [
    ['request-capacity', 'The 100m request exceeds available CPU', 'The node has 7 CPU unrequested, and the scheduling event reports an untolerated taint.'],
    ['untolerated-taint', 'A node taint excludes this pod', 'The node has a NoSchedule taint and the pod lacks a matching toleration.'],
    ['dns', 'CoreDNS prevents node assignment', 'DNS resolution is not the constraint reported by the scheduler; the taint mismatch is explicit.'],
  ], correctHypothesisId: 'untolerated-taint',
  debrief: { cause: 'The only node is reserved with a NoSchedule taint that this pod does not tolerate.', evidence: ['FailedScheduling names the untolerated taint.', 'The pod has no matching toleration.'], counterEvidence: ['The requested CPU fits the supplied capacity figures.'], remediation: ['Confirm placement policy; provide a suitable untainted node or deliberately grant a narrowly scoped toleration if this workload belongs on the reserved node.'], verification: ['Confirm scheduling onto an intended node and that reserved workloads retain required capacity.'], lesson: 'Capacity and placement permission are independent constraints.' }, sources: [{ title: 'Kubernetes taints and tolerations', url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/' }],
});
