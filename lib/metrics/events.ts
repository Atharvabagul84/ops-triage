export type PracticeEvent = 'case_started' | 'case_completed' | 'return_visit';
export const METRICS_CONSENT_KEY = 'opstriage:metrics-consent:v1';
export const METRICS_VISIT_KEY = 'opstriage:metrics-visit:v1';
export const readConsent = (value: string | null) => value === 'enabled';
export const isReturnVisit = (previous: string | null, today: string) => Boolean(previous && /^\d{4}-\d{2}-\d{2}$/.test(previous) && previous < today);

export const createConsentGuard = () => {
  let deniedInThisTab = false;
  return {
    revoke: () => { deniedInThisTab = true; },
    enableAfterPersist: () => { deniedInThisTab = false; },
    allows: (storedValue: string | null) => !deniedInThisTab && readConsent(storedValue),
  };
};

export const saveConsentChoice = (enabled: boolean, getStorage: () => Pick<Storage, 'setItem' | 'removeItem'>,
  guard: ReturnType<typeof createConsentGuard>, today: string): { consent: boolean; notice: string } => {
  // Revoke before touching browser storage. A failed write must never leave an
  // old persisted opt-in active, even when another storage event is received.
  guard.revoke();
  try {
    const storage = getStorage();
    if (enabled) storage.setItem(METRICS_VISIT_KEY, today);
    storage.setItem(METRICS_CONSENT_KEY, enabled ? 'enabled' : 'disabled');
    if (!enabled) storage.removeItem(METRICS_VISIT_KEY);
    if (enabled) guard.enableAfterPersist();
    return { consent: enabled, notice: enabled ? 'Optional counts enabled for future activity on this device.' : 'Optional counts are off. Previously sent event counts are not deleted.' };
  } catch {
    return { consent: false, notice: 'The preference could not be saved. Counts are off in this tab; other tabs or a later visit may still use the previously saved choice.' };
  }
};

export function buildEvent(type: string, caseId: string | null, eventId: string, allowedCases: readonly string[]) {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(eventId)) return null;
  if (!['case_started', 'case_completed', 'return_visit'].includes(type)) return null;
  if (type === 'return_visit' ? caseId !== null : !caseId || !allowedCases.includes(caseId)) return null;
  // Construct an allowlisted payload. Never serialize an attempt, a notebook or an account.
  return { p_event_id: eventId, p_event_type: type as PracticeEvent, p_case_id: caseId };
}
