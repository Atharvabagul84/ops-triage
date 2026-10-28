import { importNotebook, MAX_IMPORT_BYTES, type PracticeNotebook } from '../practice/index';

export interface CloudSnapshot { notebook: PracticeNotebook; revision: number; updatedAt: string }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const fingerprint = (value: unknown): string => JSON.stringify(value, (_key, current: unknown) =>
  record(current) ? Object.fromEntries(Object.entries(current).sort(([left], [right]) => left.localeCompare(right))) : current);
const revisionNumber = (value: unknown): number => {
  const revision = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value;
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1) throw new Error('Cloud revision is invalid. Recheck before saving.');
  return revision;
};
const timestamp = (value: unknown): string => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Cloud save timestamp is invalid.');
  return value;
};

export const parseCloudSnapshot = (value: unknown, expectedUserId: string): CloudSnapshot | null => {
  if (value === null) return null;
  if (!record(value) || value.user_id !== expectedUserId) throw new Error('The cloud notebook does not belong to the current account.');
  if (!record(value.notebook) || value.notebook.version !== 2) throw new Error('This cloud notebook version is not supported. Cloud data was left unchanged.');
  const raw = JSON.stringify(value.notebook);
  if (new TextEncoder().encode(raw).byteLength > MAX_IMPORT_BYTES) throw new Error('Cloud notebook exceeds the 2 MB size limit.');
  const restored = importNotebook(raw, { version: 2, attempts: [] });
  if (restored.error || restored.skippedCount) throw new Error('Some cloud records could not be read safely. Upload is blocked to preserve them.');
  return { notebook: restored.notebook, revision: revisionNumber(value.revision), updatedAt: timestamp(value.updated_at) };
};

export const cloudHistoryIsPreserved = (local: PracticeNotebook, cloud: PracticeNotebook): boolean => cloud.attempts.every((remote) => {
  const current = local.attempts.find((item) => item.id === remote.id);
  if (!current || current.scenarioId !== remote.scenarioId || current.scenarioVersion !== remote.scenarioVersion || current.createdAt !== remote.createdAt || current.updatedAt < remote.updatedAt) return false;
  // Equal-time drafts must agree, but the merged history may be a strict
  // superset of the remote branch. History preservation is checked below.
  if (current.updatedAt === remote.updatedAt && fingerprint({ ...current, submissions: [] }) !== fingerprint({ ...remote, submissions: [] })) return false;
  const snapshots = new Set(current.submissions.map(fingerprint));
  return remote.submissions.every((item) => snapshots.has(fingerprint(item)));
});

export const getUploadBlockReason = (local: PracticeNotebook, cloud: CloudSnapshot | null | undefined, mergedRevision: number | null, blocked: boolean): string | null => {
  if (blocked) return 'Resolve notebook recovery or unsaved edits before transferring cloud data.';
  if (cloud === undefined) return 'Check the cloud notebook before uploading.';
  if (cloud === null) return null;
  if (mergedRevision !== cloud.revision) return 'Merge the checked cloud notebook into this device before uploading.';
  if (!cloudHistoryIsPreserved(local, cloud.notebook)) return 'Some cloud runs or submitted history are missing locally. Merge them before uploading; no cloud data will be removed.';
  return null;
};

export const isCloudRevisionConflict = (error: unknown): boolean => record(error) && error.code === 'P0001' &&
  [error.details, error.message].some((value) => typeof value === 'string' && value.includes('revision_conflict'));

export const parseSaveReceipt = (value: unknown, expectedRevision: number): { revision: number; updatedAt: string } => {
  if (!Array.isArray(value) || value.length !== 1 || !record(value[0])) throw new Error('Cloud save confirmation was not recognized. Check the cloud before retrying.');
  const revision = revisionNumber(value[0].revision);
  if (revision !== expectedRevision + 1) throw new Error('Cloud revision changed unexpectedly. Check the cloud before retrying.');
  return { revision, updatedAt: timestamp(value[0].updated_at) };
};

export const createAccountRequestGate = () => {
  let account: string | null = null;
  let generation = 0;
  let controller: AbortController | null = null;
  const cancel = () => { generation++; controller?.abort(); controller = null; };
  return {
    cancel,
    setAccount: (id: string | null) => { if (id !== account) { cancel(); account = id; } },
    begin: () => {
      cancel();
      controller = new AbortController();
      const current = generation;
      const currentAccount = account;
      return { signal: controller.signal, isCurrent: () => current === generation && currentAccount === account };
    },
  };
};
