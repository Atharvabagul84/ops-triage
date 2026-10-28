'use client';

import Link from 'next/link';
import { useEffect, useState, type MouseEvent } from 'react';
import { AccountPanel } from '@/components/account/AccountPanel';
import { PracticeOnboarding } from '@/components/onboarding/PracticeOnboarding';
import { MetricsPreference } from '@/components/metrics/MetricsPreference';
import { useUsageMetrics } from '@/components/metrics/useUsageMetrics';
import type { PracticeAttempt } from '@/types/practice';
import { BASE_PRACTICE_SCENARIOS, createPracticeAttempt, exportNotebookJson, exportNotebookMarkdown, getAttemptEvaluation, MAX_PRACTICE_ATTEMPTS, PRACTICE_SCENARIOS } from '@/lib/practice';
import { PracticeCase } from './PracticeCase';
import { PracticeLibrary } from './PracticeLibrary';
import { PracticeNotebook } from './PracticeNotebook';
import { NotebookExportPreview } from './NotebookExportPreview';
import { usePracticeNotebook } from './usePracticeNotebook';
import styles from './practice.module.css';

type ExportFormat = 'markdown' | 'json' | 'original';

export const PracticeWorkbench = () => {
  const { notebook, ready, storageError, saveError, deviceConflict, recoveryRaw, saving, unsavedAttempts, saveAttempt, deleteAttempt, mergeNotebook } = usePracticeNotebook();
  const [view, setView] = useState<'library' | 'notebook'>('library');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmReload, setConfirmReload] = useState(false);
  const [accountOpenRequest, setAccountOpenRequest] = useState(0);
  const [exportPreview, setExportPreview] = useState<{ content: string; format: ExportFormat; id: number } | null>(null);
  const metrics = useUsageMetrics();
  const savedAttempt = notebook.attempts.find((item) => item.id === selectedId);
  const attempt = savedAttempt ? unsavedAttempts[savedAttempt.id] ?? savedAttempt : undefined;
  const scenario = PRACTICE_SCENARIOS.find((item) => item.id === attempt?.scenarioId);
  const relatedScenario = scenario?.variantOf ? PRACTICE_SCENARIOS.find((item) => item.id === scenario.variantOf) : PRACTICE_SCENARIOS.find((item) => item.variantOf === scenario?.id);
  const canStartNew = notebook.attempts.length < MAX_PRACTICE_ATTEMPTS;
  const completed = new Set(notebook.attempts.filter((item) => {
    const savedScenario = BASE_PRACTICE_SCENARIOS.find((entry) => entry.id === item.scenarioId);
    return savedScenario && getAttemptEvaluation(savedScenario, item).complete;
  }).map((item) => item.scenarioId)).size;
  const runNumber = attempt ? notebook.attempts.filter((item) => item.scenarioId === attempt.scenarioId).sort((left, right) => left.createdAt.localeCompare(right.createdAt)).findIndex((item) => item.id === attempt.id) + 1 : 0;

  useEffect(() => { document.getElementById('practice-content')?.focus({ preventScroll: true }); }, [selectedId, view]);

  const openAttempt = (attemptId: string) => {
    setSelectedId(attemptId);
    setExportPreview(null);
    setActionError(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const startNewRun = (scenarioId: string) => {
    if (!ready) return;
    const nextScenario = PRACTICE_SCENARIOS.find((item) => item.id === scenarioId);
    if (!nextScenario) return;
    if (!canStartNew) { setActionError(`Your notebook has ${MAX_PRACTICE_ATTEMPTS} saved runs. Export a backup, then remove a run before starting another.`); return; }
    try {
      const nextAttempt = createPracticeAttempt(nextScenario, crypto.randomUUID(), new Date().toISOString());
      if (saveAttempt(nextAttempt)) { openAttempt(nextAttempt.id); metrics.track('case_started', scenarioId); }
    } catch { setActionError('A new run could not be created. Your saved runs are unchanged. Please try again.'); }
  };
  const savePracticeAttempt = (next: PracticeAttempt) => {
    const previous = notebook.attempts.find((item) => item.id === next.id);
    const saved = saveAttempt(next);
    const nextScenario = PRACTICE_SCENARIOS.find((item) => item.id === next.scenarioId);
    if (saved && previous && nextScenario && next.submissions.length > previous.submissions.length && getAttemptEvaluation(nextScenario, next).complete) {
      const alreadyPassed = previous.submissions.some((submission) => getAttemptEvaluation(nextScenario, { ...previous, submissions: [submission] }).complete);
      if (!alreadyPassed) metrics.track('case_completed', next.scenarioId);
    }
    return saved;
  };
  const openScenario = (scenarioId: string) => {
    const latest = notebook.attempts.filter((item) => item.scenarioId === scenarioId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    if (latest) openAttempt(latest.id);
    else startNewRun(scenarioId);
  };
  const navigate = (destination: 'library' | 'notebook') => {
    setSelectedId(null);
    setView(destination);
    setExportPreview(null);
    setActionError(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const openAccount = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.location.hash = 'account';
    setAccountOpenRequest((request) => request + 1);
  };
  const exportNotebook = (format: ExportFormat) => {
    let content: string;
    try { content = format === 'original' ? recoveryRaw ?? '' : format === 'json' ? exportNotebookJson(notebook) : exportNotebookMarkdown(notebook); }
    catch { setActionError('The export could not be prepared. Please try again.'); return; }
    setExportPreview({ content, format, id: Date.now() });
    setActionError(null);
    let url: string | null = null;
    try {
      const extension = format === 'original' ? 'original.txt' : format === 'json' ? 'json' : 'md';
      url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json;charset=utf-8' : format === 'original' ? 'text/plain;charset=utf-8' : 'text/markdown;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `opstriage-practice-notebook.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch { setActionError('The download could not be started. You can copy the export preview instead.'); }
    finally { if (url) URL.revokeObjectURL(url); }
  };

  return (
    <div className={styles.workbench}>
      <a href="#practice-content" className={styles.skipLink}>Skip to practice content</a>
      <header className={styles.header}><div className={styles.headerInner}><Link href="/practice" className={styles.brand}><span className={styles.brandIcon} aria-hidden="true">&gt;_</span><span>OpsTriage<span className={styles.brandSub}> / practice</span></span></Link><div className={styles.headerLinks}><a href="#account" className={styles.prototypeLink} onClick={openAccount}>Sign in</a><Link href="/beta" className={styles.prototypeLink}>Beta guide <span aria-hidden="true">↗</span></Link></div></div></header>
      <div className={styles.shell}>
        <nav className={styles.navigation} aria-label="Practice workspace">
          <div className={styles.navButtons}><button aria-pressed={view === 'library' && !selectedId} className={!selectedId && view === 'library' ? styles.activeNav : styles.navButton} onClick={() => navigate('library')}>Practice cases</button><button aria-pressed={view === 'notebook' && !selectedId} className={!selectedId && view === 'notebook' ? styles.activeNav : styles.navButton} onClick={() => navigate('notebook')}>My notebook <span className={styles.count}>{notebook.attempts.length}</span></button></div>
          <span className={styles.localStatus}><span className={storageError || saveError || deviceConflict ? styles.warningDot : styles.statusDot} aria-hidden="true" />{!ready ? 'Loading notebook…' : deviceConflict ? 'Device saving paused' : saveError ? 'Unsaved changes' : storageError ? 'Session only' : saving ? 'Saving…' : 'Saved on this device'}</span>
        </nav>
        {[storageError, saveError, actionError].filter(Boolean).map((error) => <div key={error} role="alert" className={styles.storageAlert}>{error}</div>)}
        {deviceConflict && <section className={styles.storageAlert} aria-label="Notebook recovery" role="alert"><p>{deviceConflict}</p><p className={styles.recoveryNote}>You can keep working in this tab, but these changes are not written to the device notebook.</p><div className={styles.recoveryActions}><button className={styles.secondaryButton} onClick={() => { navigate('notebook'); exportNotebook('json'); }}>Export this tab&apos;s JSON</button>{recoveryRaw !== null && <button className={styles.secondaryButton} onClick={() => { navigate('notebook'); exportNotebook('original'); }}>Export device snapshot</button>}<button className={styles.textButton} onClick={() => setConfirmReload(true)}>Reload saved notebook</button></div>{confirmReload && <div className={styles.reloadConfirm}><p>Reloading discards changes kept only in this tab. Export them first, then reload.</p><button className={styles.dangerButton} onClick={() => window.location.reload()}>I have backed up — reload</button><button className={styles.secondaryButton} onClick={() => setConfirmReload(false)}>Keep this tab</button></div>}</section>}
        <main id="practice-content" className={styles.main} tabIndex={-1}>
          <PracticeOnboarding />
          {scenario && attempt ? (
            <PracticeCase key={attempt.id} scenario={scenario} attempt={attempt} runNumber={runNumber} relatedScenario={relatedScenario} canStartNew={canStartNew} hasUnsavedDraft={Boolean(unsavedAttempts[attempt.id])} onSave={savePracticeAttempt} onBack={() => navigate('library')} onReplay={() => startNewRun(scenario.id)} onRelated={startNewRun} />
          ) : view === 'notebook' ? (
            <PracticeNotebook notebook={notebook} ready={ready} onOpen={openAttempt} onDelete={deleteAttempt} onExplore={() => navigate('library')} onExport={exportNotebook} onImport={mergeNotebook} exportPreview={exportPreview && <NotebookExportPreview key={exportPreview.id} content={exportPreview.content} format={exportPreview.format} onClose={() => setExportPreview(null)} />} />
          ) : (
            <>
              <section className={styles.hero} aria-labelledby="practice-title">
                <div className={styles.heroText}><p className={styles.eyebrow}><span className={styles.statusDot} aria-hidden="true" /> THE ON-CALL PRACTICE ROOM</p><h1 id="practice-title">Build the habit<br />of <span>evidence.</span></h1><p>Practice the first few minutes of a Kubernetes incident. Inspect the signals, cite your evidence, and explain why your diagnosis fits.</p><div className={styles.heroTags}><span>Simulated incidents</span><span>No setup</span><span>At your pace</span></div></div>
                <div className={styles.progressCard}><div className={styles.progressTop}><span>YOUR PRACTICE LOG</span><span aria-hidden="true">◇</span></div><p className={styles.progressValue}>{ready ? String(completed).padStart(2, '0') : '—'}<span> / {String(BASE_PRACTICE_SCENARIOS.length).padStart(2, '0')}</span></p><p>base cases with submitted checks passed</p><div className={styles.progressTrack} role="progressbar" aria-label="Base cases with checks passed" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={BASE_PRACTICE_SCENARIOS.length}><span style={{ width: `${BASE_PRACTICE_SCENARIOS.length ? completed / BASE_PRACTICE_SCENARIOS.length * 100 : 0}%` }} /></div><p className={styles.progressNote}>Keep the evidence. Revisit your reasoning. Try a transfer case.</p></div>
              </section>
              <PracticeLibrary notebook={notebook} ready={ready} onOpen={openScenario} />
            </>
          )}
        </main>
        <AccountPanel notebook={notebook} onImport={mergeNotebook} blocked={!ready || Boolean(deviceConflict || saveError || saving)} openRequest={accountOpenRequest} />
        <MetricsPreference metrics={metrics} />
        <footer className={styles.footer}><span>OpsTriage <span aria-hidden="true">/</span> Learn the investigation.</span><p>Practice uses authored examples, without AI or command execution. Your answers and notes stay in this browser unless you export or explicitly upload them to your cloud notebook. Written reasoning needs human review.</p></footer>
      </div>
    </div>
  );
};
