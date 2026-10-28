'use client';

import type { useUsageMetrics } from './useUsageMetrics';
import styles from './metrics.module.css';

export function MetricsPreference({ metrics }: { metrics: ReturnType<typeof useUsageMetrics> }) {
  return <details className={styles.panel}>
    <summary>Optional usage counts <span>{metrics.consent ? 'On' : 'Off'}</span></summary>
    <p>Help improve practice by counting case starts, passed checks, and visits on a later day. Off by default. Counts contain a case ID and random event ID, never your notes, reasoning, email, or account ID. No visitor profile is created.</p>
    <p>Changing this preference affects future events. Hosting and database providers still process ordinary network requests. Counts are approximate; they do not measure learning outcomes.</p>
    {!metrics.configured ? <p>Usage collection is not configured on this deployment.</p> : <div className={styles.actions}>
      <button onClick={() => metrics.chooseConsent(true)} disabled={!metrics.ready || metrics.consent}>Allow optional counts</button>
      <button onClick={() => metrics.chooseConsent(false)} disabled={!metrics.ready}>Keep counts off</button>
    </div>}
    {metrics.notice && <p role="status">{metrics.notice}</p>}
  </details>;
}
