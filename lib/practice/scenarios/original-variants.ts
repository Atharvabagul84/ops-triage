import { defineCase } from './case-content';

export const OOM_VARIANT = defineCase({
  id: 'restart-probe-variant', variantOf: 'oomkilled', title: 'Another restart after a release',
  summary: 'A restart and exit 137 need the surrounding events.', difficulty: 'Intermediate',
  context: 'A worker now listens on 8081 after a release, while its health configuration was copied from an older release.',
  initialEvidence: 'Namespace: practice\nPod: worker-v2\n0/1 CrashLoopBackOff; restarts: 4',
  hints: ['Inspect both the termination and the event that preceded it.', 'A signal exit code alone does not identify who killed the process.', 'Repeated liveness failures target 8080, but startup logs report 8081. The Killing event names liveness failure.'],
  checks: [
    ['events', 'Inspect termination and events', 'kubectl describe pod worker-v2 -n practice', 'Last State: Terminated; Reason: Error; Exit Code: 137\nWarning Unhealthy: Liveness probe failed: dial tcp 10.0.0.20:8080: connection refused\nNormal Killing: Container failed liveness probe, will be restarted', 'The explicit restart-trigger event matters more than interpreting 137 in isolation.'],
    ['startup', 'Read previous startup output', 'kubectl logs worker-v2 -n practice --previous', 'HTTP server listening on 0.0.0.0:8081\nReady to accept requests', 'Startup output identifies the actual listener.'],
    ['probe', 'Read probe configuration', 'kubectl get pod worker-v2 -n practice -o yaml', 'livenessProbe:\n  httpGet: {path: /healthz, port: 8080}\n  failureThreshold: 3', 'The probe port disagrees with the listener.'],
  ],
  choices: [
    ['probe-restart', 'Liveness checks target the wrong port and trigger restarts', 'The 8080 probe fails while the process listens on 8081, and a Killing event explicitly names the probe.'],
    ['memory-exhaustion', 'Exit 137 proves another OOM kill', 'The reason is Error, not OOMKilled, and the recorded Killing event attributes this restart to liveness failure.'],
    ['image-pull', 'The image was never pulled', 'Previous container logs show an HTTP server started, so image pulling is not the evidenced blocker.'],
  ], correctHypothesisId: 'probe-restart',
  debrief: { cause: 'A liveness probe on 8080 repeatedly fails against a server listening on 8081 and triggers restarts.', evidence: ['The probe and listener ports differ.', 'The Killing event explicitly attributes the restart to liveness failure.'], counterEvidence: ['Exit 137 is not proof of OOM; no OOMKilled reason appears.'], remediation: ['Align the probe with the intended health listener in the workload manifest; verify the endpoint semantics before rollout.'], verification: ['Observe successful probes and stable restarts across several probe windows, then verify application requests.'], lesson: 'Re-evaluate a familiar symptom using its current evidence.' },
  sources: [{ title: 'Kubernetes probe behavior', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/' }],
});

export const SERVICE_VARIANT = defineCase({
  id: 'service-port-variant', variantOf: 'service-selector', title: 'Ready backends, refused connections',
  summary: 'Matching selectors do not guarantee a working Service.', difficulty: 'Intermediate',
  context: 'Inventory has ready backends but connections through its Service are refused.',
  initialEvidence: 'Service inventory:8080 fails; inventory-v3 is Running and Ready.',
  hints: ['Follow selection, discovered addresses, then the destination listener.', 'A backend address can exist even if the Service sends traffic to the wrong port.', 'EndpointSlices target 9090 while the process listens on 8080; labels match.'],
  checks: [
    ['selection', 'Compare labels and selector', 'kubectl get service inventory -n practice -o yaml\nkubectl get pods -n practice --show-labels', 'Service excerpt:\nselector: {app: inventory}\nports: [{port: 8080, targetPort: 9090}]\nPod-label excerpt:\ninventory-v3 app=inventory', 'Selection matches; inspect the resolved backend port.'],
    ['endpoints', 'Inspect EndpointSlice', 'kubectl get endpointslices -n practice -l kubernetes.io/service-name=inventory -o yaml', 'ports: [{port: 9090}]\nendpoints: [{addresses: [10.0.0.31], conditions: {ready: true}}]', 'The Service is sending traffic to a ready address on port 9090.'],
    ['listener', 'Read startup log', 'kubectl logs inventory-v3 -n practice', 'HTTP listener bound on 0.0.0.0:8080; no listener configured on 9090', 'The configured target port differs from the reported listener.'],
  ],
  choices: [
    ['selector-mismatch', 'The Service does not select these pods', 'The app labels match and a ready address appears in EndpointSlices; selection is working in this fixture.'],
    ['target-port', 'The Service sends traffic to the wrong backend port', 'The Service and EndpointSlice select port 9090 while the server reports only port 8080.'],
    ['no-pods', 'No inventory pod is running', 'The ready EndpointSlice and server startup output contradict the absence of running backends.'],
  ], correctHypothesisId: 'target-port',
  debrief: { cause: 'The Service targetPort is 9090 while the intended server listens on 8080.', evidence: ['Matching selectors discover a ready address.', 'The backend port and listener differ.'], counterEvidence: ['A ready endpoint does not verify that every configured port accepts connections.'], remediation: ['Confirm the intended application port and correct targetPort in the Service manifest.'], verification: ['Verify the EndpointSlice port and a request through the Service from the affected client.'], lesson: 'Treat selection and port routing as separate checks.' },
  sources: [{ title: 'Kubernetes Service debugging', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/' }],
});

export const IMAGE_VARIANT = defineCase({
  id: 'image-tag-variant', variantOf: 'image-pull-auth', title: 'The next image pull failure',
  summary: 'Do not reuse the previous registry diagnosis automatically.', difficulty: 'Intermediate',
  context: 'All registry identifiers are fictional. A reviewed release-system record includes an authenticated manifest lookup.',
  initialEvidence: 'Pod billing-v2: ImagePullBackOff\nImage: registry.example.invalid/billing:release-42',
  hints: ['Inspect the concrete registry response rather than only the backoff status.', 'Secret existence alone would not prove authentication; find an authenticated lookup result.', 'The authenticated lookup returns MANIFEST_UNKNOWN for release-42 while the published release uses release-41.'],
  checks: [
    ['events', 'Read the pull failure', 'kubectl describe pod billing-v2 -n practice', 'Failed to resolve image registry.example.invalid/billing:release-42: manifest unknown\nBack-off pulling image', 'This error identifies a manifest lookup failure rather than proving a credential failure.'],
    ['release-record', 'Read sanitized release verification record', 'Review release-system record (not a shell command)', 'Authenticated registry identity: release-reader\nGET /v2/billing/manifests/release-42 -> 404 MANIFEST_UNKNOWN\nPublished tag: release-41 -> digest sha256:1111111111111111111111111111111111111111111111111111111111111111', 'A successful authenticated session and exact missing-manifest response support the tag diagnosis.'],
    ['image', 'Read requested image', 'kubectl get pod billing-v2 -n practice -o yaml', 'containers:\n  - name: billing\n    image: registry.example.invalid/billing:release-42\nimagePullSecrets: [{name: regcred}]', 'The workload requests the same absent tag verified by the release record.'],
  ],
  choices: [
    ['registry-auth', 'The pull Secret is necessarily missing', 'The supplied authenticated lookup identifies MANIFEST_UNKNOWN; there is no missing-Secret event in this case.'],
    ['missing-tag', 'The requested tag has no manifest in the verified repository', 'The workload requests release-42 and an authenticated lookup of that exact manifest returns MANIFEST_UNKNOWN.'],
    ['app-crash', 'Application code crashed', 'The container is still awaiting its image, so no running application crash is evidenced.'],
  ], correctHypothesisId: 'missing-tag',
  debrief: { cause: 'The manifest for the requested release-42 tag is absent in the authenticated lookup of this repository.', evidence: ['The workload requests release-42.', 'A sanitized authenticated lookup returns MANIFEST_UNKNOWN for that exact reference.'], counterEvidence: ['Secret existence alone would not prove authentication; the release-system record supplies that missing context.'], remediation: ['Verify the intended release, then publish the correct image or select the approved existing digest in the deployment manifest.'], verification: ['Confirm the intended digest is pulled and application readiness and a functional request succeed.'], lesson: 'Similar pull symptoms can require different recovery actions.' },
  sources: [{ title: 'Kubernetes image pull behavior', url: 'https://kubernetes.io/docs/concepts/containers/images/' }],
});
