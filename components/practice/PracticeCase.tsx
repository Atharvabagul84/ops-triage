import { getAttemptEvaluation, MAX_NOTES_LENGTH, MAX_SUBMISSIONS, submitPracticeAttempt, type PracticeAttempt, type PracticeScenario } from '@/lib/practice';
import { PracticeDebrief } from './PracticeDebrief';
import { PracticeDiagnostics } from './PracticeDiagnostics';
import { PracticeDiagnosis } from './PracticeDiagnosis';
import { PracticeSubmissionHistory } from './PracticeSubmissionHistory';
import styles from './practice.module.css';

interface PracticeCaseProps {
  scenario: PracticeScenario;
  attempt: PracticeAttempt;
  runNumber: number;
  relatedScenario?: PracticeScenario;
  canStartNew: boolean;
  hasUnsavedDraft: boolean;
  onSave: (attempt: PracticeAttempt) => void;
  onBack: () => void;
  onReplay: () => void;
  onRelated: (scenarioId: string) => void;
}

export const PracticeCase = ({ scenario, attempt, runNumber, relatedScenario, canStartNew, hasUnsavedDraft, onSave, onBack, onReplay, onRelated }: PracticeCaseProps) => {
  const result = getAttemptEvaluation(scenario, attempt);
  const updateDraft = (patch: Partial<PracticeAttempt>) => onSave({ ...attempt, ...patch, updatedAt: new Date().toISOString() });
  const submit = () => onSave(submitPracticeAttempt(attempt, new Date().toISOString()));
  return (
    <div className={styles.investigation}>
      <button className={styles.textButton} onClick={onBack}><span aria-hidden="true">←</span> Back to case library</button>
      <div className={styles.caseHeading}>
        <div><p className={styles.eyebrow}>{scenario.variantOf ? 'TRANSFER PRACTICE' : 'GUIDED INVESTIGATION'} / RUN {runNumber}</p><h1>{scenario.title}</h1></div>
        <span className={styles.tag}>Simulated case <span aria-hidden="true">·</span> {scenario.estimatedMinutes} min</span>
      </div>
      {hasUnsavedDraft && <div className={styles.unsavedDraft}><p>These draft edits are kept in this tab only. Saved answer history has not changed.</p><button className={styles.secondaryButton} onClick={() => onSave(attempt)}>Retry saving draft</button></div>}
      <div className={styles.caseLayout}>
        <div className={styles.evidenceColumn}>
          <section className={styles.panel} aria-labelledby="incident-brief-title">
            <p className={styles.eyebrow}>01 / ORIENT</p><h2 id="incident-brief-title">The incident brief</h2>
            <p className={styles.brief}>{scenario.brief}</p>
            <div className={styles.terminalHeader}><span>Initial evidence</span><span>SIMULATED</span></div>
            <pre className={styles.terminal}>{scenario.initialEvidence}</pre>
          </section>
          <PracticeDiagnostics scenario={scenario} attempt={attempt} onUpdate={updateDraft} />
          <section className={styles.panel} aria-labelledby="hints-title">
            <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>WHEN YOU NEED A NUDGE</p><h2 id="hints-title">Progressive hints</h2></div><span className={styles.small}>{attempt.hintCount}/{scenario.hints.length} revealed</span></div>
            <p className={styles.muted}>Start with a small clue. Each hint is saved with this run, so you can reflect on what helped.</p>
            {attempt.hintCount > 0 && <ol className={styles.hintList}>{scenario.hints.slice(0, attempt.hintCount).map((hint, index) => <li key={index}><strong>Hint {index + 1}</strong><p>{hint}</p></li>)}</ol>}
            <button className={styles.secondaryButton} disabled={attempt.hintCount >= scenario.hints.length} onClick={() => updateDraft({ hintCount: attempt.hintCount + 1 })}>{attempt.hintCount >= scenario.hints.length ? 'All hints revealed' : `Reveal hint ${attempt.hintCount + 1}`}</button>
          </section>
          <section className={styles.panel} aria-labelledby="notes-title">
            <p className={styles.eyebrow}>YOUR FIELD NOTES</p><h2 id="notes-title">What would you notice next time?</h2>
            <label className={styles.fieldLabel} htmlFor="practice-notes">Personal notes</label>
            <textarea id="practice-notes" className={styles.writingArea} value={attempt.notes} maxLength={MAX_NOTES_LENGTH} rows={4} onChange={(event) => updateDraft({ notes: event.target.value })} placeholder="Capture a useful signal, an alternative you ruled out, or a question to revisit." aria-describedby="notes-help" />
            <p id="notes-help" className={styles.fieldHelp}>Saved locally; included when you choose to upload your notebook. Avoid credentials or sensitive logs. {attempt.notes.length.toLocaleString()}/{MAX_NOTES_LENGTH.toLocaleString()} characters.</p>
          </section>
        </div>
        <aside className={styles.diagnosisColumn}>
          <PracticeDiagnosis scenario={scenario} attempt={attempt} onUpdate={updateDraft} onSubmit={submit} />
          <div className={styles.caseNote}><span aria-hidden="true">◇</span><p><strong>Your draft stays yours.</strong> A check saves a snapshot of your answer. Later edits do not change earlier results.</p></div>
        </aside>
      </div>
      {result.complete && <><p className={styles.submittedDebriefNote}>Debrief for your latest submitted diagnosis. Draft edits are assessed only when you check again.</p><PracticeDebrief scenario={scenario} /></>}
      <PracticeSubmissionHistory scenario={scenario} attempt={attempt} />
      <section className={styles.nextPractice} aria-label="Continue practicing">
        <div><h2>Keep the lesson. Try again.</h2><p>Each new run preserves this run, its notes, and its answer history.</p></div>
        <div className={styles.nextActions}><button className={styles.secondaryButton} disabled={!canStartNew} onClick={onReplay}>Start a new run</button>{relatedScenario && <button className={styles.primaryButton} disabled={!canStartNew} onClick={() => onRelated(relatedScenario.id)}>{scenario.variantOf ? 'Practice the base case' : 'Try the transfer case'} <span aria-hidden="true">→</span></button>}</div>
        {!canStartNew && <p className={styles.fieldHelp}>Your notebook is full. Export a backup, then remove a saved run to make room.</p>}
        {attempt.submissions.length >= MAX_SUBMISSIONS && <p className={styles.fieldHelp}>This run has reached {MAX_SUBMISSIONS} submitted checks. Start a new run to keep practicing.</p>}
      </section>
    </div>
  );
};
