'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { importNotebook, serializeNotebook, upsertAttemptWithResult, type PracticeAttempt, type PracticeNotebook } from '@/lib/practice';
import { NOTEBOOK_STORAGE_KEY, readNotebookValue, writeNotebookSnapshot, type StorageWriteResult } from './notebookStorage';

export const usePracticeNotebook = () => {
  const [notebook, setNotebook] = useState<PracticeNotebook>({ version: 2, attempts: [] });
  const notebookRef = useRef<PracticeNotebook>({ version: 2, attempts: [] });
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [unsavedAttempts, setUnsavedAttempts] = useState<Record<string, PracticeAttempt>>({});
  const [deviceConflict, setDeviceConflict] = useState<string | null>(null);
  const [recoveryRaw, setRecoveryRaw] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const expectedRawRef = useRef<string | null>(null);
  const writesBlockedRef = useRef(false);
  const hydratedRef = useRef(false);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWritesRef = useRef(0);
  const pauseDeviceWrites = useCallback((message: string, raw: string | null) => {
    writesBlockedRef.current = true;
    setDeviceConflict(message);
    setRecoveryRaw(raw);
  }, []);

  useEffect(() => {
    let active = true;
    const handleStorage = (event: StorageEvent) => {
      if (!hydratedRef.current || (event.key !== NOTEBOOK_STORAGE_KEY && event.key !== null)) return;
      const stored = readNotebookValue(() => window.localStorage);
      if (stored.error) { writesBlockedRef.current = true; setStorageError(stored.error); return; }
      if (stored.raw !== expectedRawRef.current) pauseDeviceWrites('The device notebook changed in another tab. Automatic saving is paused so neither tab overwrites the other. Export this tab before reloading the saved notebook.', stored.raw);
    };
    window.addEventListener('storage', handleStorage);
    Promise.resolve().then(() => {
      const stored = readNotebookValue(() => window.localStorage);
      if (!active) return;
      expectedRawRef.current = stored.raw;
      const restored = importNotebook(stored.raw ?? '{"version":2,"attempts":[]}', { version: 2, attempts: [] });
      notebookRef.current = restored.notebook;
      setNotebook(restored.notebook);
      setStorageError(stored.error);
      if (stored.error) writesBlockedRef.current = true;
      if (restored.error || restored.skippedCount > 0) pauseDeviceWrites('Some saved browser data could not be restored safely. Device saving is paused to preserve the original data. Export the original snapshot before making recovery changes.', stored.raw);
      hydratedRef.current = true;
      setReady(true);
    });
    return () => { active = false; window.removeEventListener('storage', handleStorage); };
  }, [pauseDeviceWrites]);

  const persist = (next: PracticeNotebook) => {
    if (!ready) return;
    notebookRef.current = next;
    setNotebook(next);
    if (writesBlockedRef.current) return;
    const serialized = serializeNotebook(next);
    pendingWritesRef.current += 1;
    setSaving(true);
    writeQueueRef.current = writeQueueRef.current.then(async () => {
      if (writesBlockedRef.current) return;
      const withLock = navigator.locks
        ? (write: () => StorageWriteResult) => navigator.locks.request(NOTEBOOK_STORAGE_KEY, { mode: 'exclusive' }, () => writesBlockedRef.current
          ? { written: false, conflict: true, error: 'Device saving remains paused. Export this tab before reloading.' }
          : write())
        : undefined;
      const result = await writeNotebookSnapshot(() => window.localStorage, expectedRawRef.current, serialized, withLock);
      if (result.written) { expectedRawRef.current = serialized; setStorageError(null); }
      else if (result.conflict) pauseDeviceWrites(result.error ?? 'The saved notebook changed. Export this tab before reloading.', readNotebookValue(() => window.localStorage).raw);
      else setStorageError(result.error);
    }).catch(() => {
      setStorageError('The device save could not finish. Export this tab before leaving.');
    }).finally(() => {
      pendingWritesRef.current -= 1;
      setSaving(pendingWritesRef.current > 0);
    });
  };

  const clearUnsaved = (attemptId: string) => setUnsavedAttempts((previous) => {
    const next = { ...previous };
    delete next[attemptId];
    return next;
  });
  const saveAttempt = (attempt: PracticeAttempt) => {
    if (!ready) return false;
    const result = upsertAttemptWithResult(notebookRef.current, attempt);
    if (!result.accepted) {
      const existing = notebookRef.current.attempts.find((item) => item.id === attempt.id);
      if (existing) setUnsavedAttempts((previous) => ({ ...previous, [attempt.id]: { ...attempt, submissions: existing.submissions } }));
      setCapacityError(result.error ?? 'This change could not be saved. Saved history is unchanged.');
      return false;
    }
    persist(result.notebook);
    clearUnsaved(attempt.id);
    setCapacityError(null);
    return true;
  };
  const deleteAttempt = (attemptId: string) => {
    persist({ version: 2, attempts: notebookRef.current.attempts.filter((attempt) => attempt.id !== attemptId) });
    clearUnsaved(attemptId);
    setCapacityError(null);
  };
  const mergeNotebook = (raw: string) => {
    const result = importNotebook(raw, notebookRef.current);
    if (!result.error) persist(result.notebook);
    return result;
  };

  const saveError = Object.keys(unsavedAttempts).length > 0
    ? 'Some draft edits are not saved because a notebook limit was reached. They remain in this tab; saved history is unchanged. Shorten the draft, or export a backup and remove old runs, then retry saving. Unsaved edits are excluded from exports.'
    : capacityError;
  return { notebook, ready, storageError, saveError, deviceConflict, recoveryRaw, saving, unsavedAttempts, saveAttempt, deleteAttempt, mergeNotebook };
};
