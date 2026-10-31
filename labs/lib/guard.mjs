// Labs create and delete namespaces, so they only run against this project's local kind
// clusters: the context must be kind-ops-triage[-suffix] and its API server a loopback address.
export const DEFAULT_CLUSTER = 'ops-triage-labs';
const LAB_CONTEXT = /^kind-ops-triage(-[a-z0-9]([a-z0-9-]*[a-z0-9])?)?$/;
const LOOPBACK_SERVER = /^https:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d{1,5}$/;

export const assertLabContext = (context, server) => {
  if (typeof context !== 'string' || !LAB_CONTEXT.test(context)) {
    throw new Error(`Refusing to run labs against context "${context}": only kind-ops-triage[-name] contexts are allowed.`);
  }
  if (typeof server !== 'string' || !LOOPBACK_SERVER.test(server)) {
    throw new Error(`Refusing to run labs against context "${context}": its API server "${server}" is not a local kind endpoint.`);
  }
  return context.slice('kind-'.length);
};
