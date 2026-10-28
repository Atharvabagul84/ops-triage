'use client';

import { useEffect, useRef, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { serializeNotebook, type PracticeImportResult, type PracticeNotebook } from '@/lib/practice';
import { createCloudRecoveryClient, createCloudTransferClient } from '@/lib/cloud/browserClient';
import { updateRecoveredPassword } from '@/lib/cloud/auth';
import { AUTH_EMAIL_ENABLED, runAuthEmailAction } from '@/lib/cloud/emailReadiness';
import { readCloudNotebook, saveCloudNotebook } from '@/lib/cloud/api';
import { createAccountRequestGate, getUploadBlockReason, isCloudRevisionConflict, type CloudSnapshot } from '@/lib/cloud/notebookSync';
import { AUTH_CALLBACK_ISSUE, createRecoveryContext, inspectAuthCallback } from './authCallback';

export interface AccountPanelProps {
  notebook: PracticeNotebook;
  onImport: (raw: string) => PracticeImportResult | void;
  blocked?: boolean;
}
const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return 'The cloud request could not be completed. Please try again.';
};

export function useCloudAccount({ notebook, onImport, blocked = false }: AccountPanelProps) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [cloud, setCloud] = useState<CloudSnapshot | null | undefined>(undefined);
  const [mergedRevision, setMergedRevision] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [callbackIssue, setCallbackIssue] = useState('');
  const clientRef = useRef<SupabaseClient | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const cloudOwner = useRef<string | null>(null);
  const mounted = useRef(false);
  const authOperation = useRef(0);
  const gate = useRef(createAccountRequestGate());
  const recoveryContext = useRef(createRecoveryContext(() => window.sessionStorage));

  useEffect(() => {
    mounted.current = true;
    let subscription: { unsubscribe: () => void } | undefined;
    let cancelled = false;
    const operations = authOperation;
    const initialize = async () => {
      try {
        const { getBrowserCloudClient } = await import('@/lib/cloud/browserClient');
        if (cancelled) return;
        const callback = inspectAuthCallback(window.location.href);
        if (callback.issue) setCallbackIssue(callback.issue);
        const client = getBrowserCloudClient();
        clientRef.current = client;
        setConfigured(Boolean(client));
        if (!client) setReady(true);
        else {
          subscription = client.auth.onAuthStateChange((event, nextSession) => {
            if (!mounted.current) return;
            if (sessionRef.current?.user.id !== nextSession?.user.id) {
              authOperation.current++;
              gate.current.setAccount(nextSession?.user.id ?? null);
              cloudOwner.current = null;
              setCloud(undefined);
              setMergedRevision(null);
              setRecovering(false);
              setBusy(false);
              setStatus('');
              setError('');
            }
            if (event === 'PASSWORD_RECOVERY' && nextSession) {
              if (!recoveryContext.current.remember(nextSession)) setStatus('Keep this page open until you update your password. This browser cannot restore the recovery form after a reload.');
              setRecovering(true);
              setCallbackIssue('');
            } else setRecovering(recoveryContext.current.restore(nextSession));
            sessionRef.current = nextSession;
            setSession(nextSession);
            setReady(true);
          }).data.subscription;
          if (callback.isCallback) {
            // Observe the SDK's already-running initialization after subscribing,
            // including failures that do not emit an auth-state error event.
            const result = await client.auth.initialize();
            if (cancelled) return;
            if (result.error || callback.issue) {
              setCallbackIssue(AUTH_CALLBACK_ISSUE);
              try { window.history.replaceState(window.history.state, '', callback.cleanUrl); } catch { /* The visible error still explains the failed link. */ }
            }
          }
        }
      } catch {
        if (cancelled) return;
        setConfigured(false);
        setReady(true);
        setError('Cloud accounts are unavailable because this deployment is not configured correctly.');
      }
    };
    void initialize();
    const currentGate = gate.current;
    return () => { cancelled = true; mounted.current = false; operations.current++; subscription?.unsubscribe(); currentGate.cancel(); };
  }, []);

  const authenticate = async (mode: 'signin' | 'signup', email: string, password: string): Promise<boolean> => {
    const client = clientRef.current;
    if (!client || busy || sessionRef.current) return false;
    const operation = ++authOperation.current;
    setBusy(true); setError(''); setStatus('');
    try {
      const result = mode === 'signup'
        ? await runAuthEmailAction(AUTH_EMAIL_ENABLED, () => client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/practice` } }))
        : await client.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (mounted.current) setCallbackIssue('');
      if (mounted.current && operation === authOperation.current) {
        setStatus(mode === 'signup' && !result.data.session ? 'Check your email to confirm your account, then sign in. No notebook data has been uploaded.' : 'Signed in. Your device notebook stays local until you choose Upload.');
      }
      return true;
    } catch (caught) {
      if (mounted.current && operation === authOperation.current) setError(errorMessage(caught));
      return false;
    } finally {
      if (mounted.current && operation === authOperation.current) setBusy(false);
    }
  };

  const signOut = async () => {
    if (!clientRef.current || busy || session?.user.id !== sessionRef.current?.user.id) return;
    const operation = ++authOperation.current;
    gate.current.cancel(); cloudOwner.current = null; setCloud(undefined); setMergedRevision(null);
    setBusy(true); setError(''); setStatus('');
    try {
      const result = await clientRef.current.auth.signOut({ scope: 'local' });
      if (result.error) throw result.error;
    } catch (caught) {
      if (mounted.current && operation === authOperation.current) setError(errorMessage(caught));
    } finally {
      if (mounted.current && operation === authOperation.current) setBusy(false);
    }
  };

  const requestReset = async (email: string) => {
    if (!clientRef.current || busy) return;
    const operation = ++authOperation.current;
    setBusy(true); setError(''); setStatus('');
    try {
      const client = clientRef.current;
      const result = await runAuthEmailAction(AUTH_EMAIL_ENABLED, () => client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/practice` }));
      if (result.error) throw result.error;
      if (mounted.current && operation === authOperation.current) setStatus('If this address has an account, check its email for a password reset link. The link returns to this practice page.');
    } catch (caught) {
      if (mounted.current && operation === authOperation.current) setError(errorMessage(caught));
    } finally {
      if (mounted.current && operation === authOperation.current) setBusy(false);
    }
  };

  const resetPassword = async (password: string): Promise<boolean> => {
    const current = sessionRef.current;
    if (!current || !recovering || busy || session?.user.id !== current.user.id) return false;
    const operation = ++authOperation.current;
    const isCurrent = () => mounted.current && operation === authOperation.current && sessionRef.current?.user.id === current.user.id;
    setBusy(true); setError(''); setStatus('');
    try {
      await updateRecoveredPassword(createCloudRecoveryClient(), current, password, isCurrent);
      if (!isCurrent()) return false;
      recoveryContext.current.clear();
      setRecovering(false);
      setStatus('Password updated. Your notebook was not transferred.');
      return true;
    } catch (caught) {
      if (isCurrent()) setError(errorMessage(caught));
      return false;
    } finally {
      if (isCurrent()) setBusy(false);
    }
  };

  const checkCloud = async () => {
    const current = sessionRef.current;
    if (!current || busy || blocked || session?.user.id !== current.user.id) return;
    const request = gate.current.begin();
    cloudOwner.current = null;
    setBusy(true); setError(''); setStatus(''); setCloud(undefined); setMergedRevision(null);
    try {
      const result = await readCloudNotebook(createCloudTransferClient(current.access_token), current.user.id,
        AbortSignal.any([request.signal, AbortSignal.timeout(20000)]));
      if (!request.isCurrent() || !mounted.current) return;
      cloudOwner.current = current.user.id;
      setCloud(result);
      setStatus(result ? 'Cloud notebook checked. Merge it into this device before uploading.' : 'No cloud notebook exists for this account. You can upload your saved device notebook.');
    } catch (caught) {
      if (request.isCurrent() && mounted.current) setError(`Cloud check failed: ${errorMessage(caught)}`);
    } finally {
      if (request.isCurrent() && mounted.current) setBusy(false);
    }
  };

  const mergeCloud = () => {
    if (!cloud || busy || blocked || !sessionRef.current || cloudOwner.current !== sessionRef.current.user.id || session?.user.id !== sessionRef.current.user.id) return;
    setError(''); setStatus('');
    try {
      const result = onImport(JSON.stringify(cloud.notebook));
      if (result?.error) { setError(result.error); return; }
      setMergedRevision(cloud.revision);
      setStatus(result ? `Cloud merge checked: ${result.importedCount} session(s) imported; ${result.skippedCount} unchanged or skipped. Upload stays blocked if cloud history is missing locally.` : 'Cloud merge requested. Upload is available when the saved device notebook preserves cloud history.');
    } catch (caught) { setError(errorMessage(caught)); }
  };

  const uploadBlockReason = getUploadBlockReason(notebook, cloud, mergedRevision, blocked);
  const upload = async () => {
    const current = sessionRef.current;
    if (!current || busy || uploadBlockReason || cloudOwner.current !== current.user.id || session?.user.id !== current.user.id) return;
    const request = gate.current.begin();
    const snapshot: PracticeNotebook = JSON.parse(serializeNotebook(notebook));
    const expectedRevision = cloud?.revision ?? 0;
    setBusy(true); setError(''); setStatus('');
    try {
      const receipt = await saveCloudNotebook(createCloudTransferClient(current.access_token), snapshot, expectedRevision,
        AbortSignal.any([request.signal, AbortSignal.timeout(20000)]));
      if (!request.isCurrent() || !mounted.current) return;
      setCloud({ notebook: snapshot, ...receipt });
      setMergedRevision(receipt.revision);
      setStatus('Uploaded the saved device notebook, including notes, to this account. Later edits stay on this device until you upload again.');
    } catch (caught) {
      if (!request.isCurrent() || !mounted.current) return;
      cloudOwner.current = null;
      setCloud(undefined); setMergedRevision(null);
      setError(isCloudRevisionConflict(caught)
        ? 'The cloud notebook changed on another device. Check it again and merge before uploading. No overwrite was made.'
        : `Upload could not be confirmed: ${errorMessage(caught)} Check the cloud notebook before trying again.`);
    } finally {
      if (request.isCurrent() && mounted.current) setBusy(false);
    }
  };

  return { configured, emailEnabled: AUTH_EMAIL_ENABLED, ready, session, recovering, cloud, busy, status, error, callbackIssue, uploadBlockReason, authenticate, signOut, requestReset, resetPassword, checkCloud, mergeCloud, upload };
}
