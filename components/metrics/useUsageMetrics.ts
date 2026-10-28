'use client';

import { useCallback, useEffect, useState } from 'react';
import { PRACTICE_SCENARIOS } from '@/lib/practice';
import { buildEvent, createConsentGuard, isReturnVisit, METRICS_CONSENT_KEY, METRICS_VISIT_KEY, saveConsentChoice, type PracticeEvent } from '@/lib/metrics/events';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const configured = Boolean(url && key);
const caseIds = PRACTICE_SCENARIOS.map((scenario) => scenario.id);
const privacySignal = () => Boolean((navigator as Navigator & {globalPrivacyControl?: boolean}).globalPrivacyControl);
// Keep an in-memory opt-out across client-side navigation and hook remounts.
const consentGuard = createConsentGuard();

export function useUsageMetrics() {
  const [consent, setConsent] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const track = useCallback((type: PracticeEvent, caseId: string | null = null) => {
    try {
      if (!configured || privacySignal() || !consentGuard.allows(localStorage.getItem(METRICS_CONSENT_KEY))) return;
      const payload = buildEvent(type, caseId, crypto.randomUUID(), caseIds);
      if (!payload) return;
      // Use the public API key without the signed-in user's token or browser cookies.
      void fetch(`${url}/rest/v1/rpc/record_practice_event`, {
        method: 'POST', headers: { apikey: key!, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), credentials: 'omit', referrerPolicy: 'no-referrer',
        signal: AbortSignal.timeout(5000),
      }).catch(() => { /* Optional counts never interrupt practice or get retried with private data. */ });
    } catch { /* Disabled when storage or browser APIs are unavailable. */ }
  }, []);
  useEffect(() => {
    const read = () => {
      try { setConsent(!privacySignal() && consentGuard.allows(localStorage.getItem(METRICS_CONSENT_KEY))); }
      catch { setConsent(false); }
      setReady(true);
    };
    const visit = () => {
      read();
      try {
        if (!configured || privacySignal() || !consentGuard.allows(localStorage.getItem(METRICS_CONSENT_KEY))) return;
        const today = new Date().toISOString().slice(0, 10);
        const previous = localStorage.getItem(METRICS_VISIT_KEY);
        localStorage.setItem(METRICS_VISIT_KEY, today);
        if (isReturnVisit(previous, today)) track('return_visit');
      } catch { /* No storage means no return-visit tracking. */ }
    };
    // Defer hydration reads and make Strict Mode cleanup cancel the first invocation.
    const timer = window.setTimeout(visit, 0);
    const handleStorage = (event: StorageEvent) => { if (event.key === METRICS_CONSENT_KEY || event.key === null) read(); };
    window.addEventListener('storage', handleStorage);
    return () => { clearTimeout(timer); window.removeEventListener('storage', handleStorage); };
  }, [track]);
  const chooseConsent = (enabled: boolean) => {
    if (enabled && privacySignal()) { consentGuard.revoke(); setConsent(false); setNotice('Your browser privacy signal keeps optional counts off.'); return; }
    const result = saveConsentChoice(enabled, () => localStorage, consentGuard, new Date().toISOString().slice(0, 10));
    setConsent(result.consent);
    setNotice(result.notice);
  };
  return { configured, consent, ready, notice, chooseConsent, track };
}
