export const NOTEBOOK_STORAGE_KEY = 'opstriage.practice.notebook.v1';

type NotebookStorage = Pick<Storage, 'getItem' | 'setItem'>;
type StorageProvider = () => NotebookStorage;

export interface StorageWriteResult {
  written: boolean;
  conflict: boolean;
  error: string | null;
}

type NotebookWriteLock = (write: () => StorageWriteResult) => Promise<StorageWriteResult>;

export const readNotebookValue = (getStorage: StorageProvider) => {
  try {
    return { raw: getStorage().getItem(NOTEBOOK_STORAGE_KEY), error: null };
  } catch {
    return {
      raw: null,
      error: 'Browser storage is unavailable. You can practice in this tab and export your notebook before leaving.',
    };
  }
};

export const writeNotebookValue = (getStorage: StorageProvider, value: string): string | null => {
  try {
    getStorage().setItem(NOTEBOOK_STORAGE_KEY, value);
    return null;
  } catch {
    return 'Progress is not saved on this device. You can keep practicing and export your notebook before leaving.';
  }
};

export const writeNotebookSnapshot = async (
  getStorage: StorageProvider,
  expectedRaw: string | null,
  value: string,
  withLock?: NotebookWriteLock,
): Promise<StorageWriteResult> => {
  const write = (): StorageWriteResult => {
    let storage: NotebookStorage;
    let current: string | null;
    try {
      storage = getStorage();
      current = storage.getItem(NOTEBOOK_STORAGE_KEY);
    } catch {
      return { written: false, conflict: false, error: 'Progress is not saved because browser storage could not be checked. Export this tab before leaving.' };
    }
    if (current !== expectedRaw) {
      return { written: false, conflict: true, error: 'The saved notebook changed in another tab. This tab did not overwrite it. Export this tab before reloading.' };
    }
    try {
      storage.setItem(NOTEBOOK_STORAGE_KEY, value);
      return { written: true, conflict: false, error: null };
    } catch {
      return { written: false, conflict: false, error: 'Progress is not saved on this device. Export this tab before leaving.' };
    }
  };
  try {
    // The caller supplies a same-origin Web Lock where supported. Without it,
    // comparison protects against stale snapshots but is not a cross-tab mutex.
    return withLock ? await withLock(write) : write();
  } catch {
    return { written: false, conflict: false, error: 'Progress is not saved because the notebook write lock could not be acquired. Export this tab before leaving.' };
  }
};
