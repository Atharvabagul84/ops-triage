import { getAttemptEvaluation, MAX_SUBMISSIONS, REASONING_MAX_LENGTH, REASONING_MIN_LENGTH, type PracticeAttempt, type PracticeScenario } from '@/lib/practice';
import styles from './practice.module.css';

interface PracticeDiagnosisProps {
  scenario: PracticeScenario;
  attempt: PracticeAttempt;
  onUpdate: (patch: Partial<PracticeAttempt>) => void;
  onSubmit: () => void;
}

export const PracticeDiagnosis = ({ scenario, attempt, onUpdate, onSubmit }: PracticeDiagnosisProps) => {
  const result = getAttemptEvaluation(scenario, attempt);
  const hasSubmission = attempt.submissions.length > 0;
  return (
    <section className={styles.panel} aria-labelledby="diagnosis-title">
      <p className={styles.eyebrow}>03 / REASON</p><h2 id="diagnosis-title">Your working diagnosis</h2>
      <p className={styles.muted}>Choose a cause, cite supporting checks, and explain the connection in your own words.</p>
      <fieldset className={styles.hypotheses}>
        <legend>Which cause best explains this incident?</legend>
        {scenario.hypotheses.map((hypothesis) => <label key={hypothesis.id} className={`${styles.hypothesis} ${attempt.hypothesisId === hypothesis.id ? styles.selectedHypothesis : ''}`}><input type="radio" name={`hypothesis-${scenario.id}`} value={hypothesis.id} checked={attempt.hypothesisId === hypothesis.id} onChange={() => onUpdate({ hypothesisId: hypothesis.id })} /><span>{hypothesis.label}</span></label>)}
      </fieldset>
      <p className={styles.citedCount}>{attempt.citedDiagnosticIds.length} diagnostic {attempt.citedDiagnosticIds.length === 1 ? 'check cited' : 'checks cited'}</p>
      <label className={styles.fieldLabel} htmlFor="diagnosis-reasoning">Why does the evidence support this cause?</label>
      <textarea id="diagnosis-reasoning" className={styles.writingArea} value={attempt.reasoning} onChange={(event) => onUpdate({ reasoning: event.target.value })} minLength={REASONING_MIN_LENGTH} maxLength={REASONING_MAX_LENGTH} rows={5} placeholder="Name the signal, explain what it implies, and consider an alternative." aria-describedby="reasoning-help reasoning-limit" />
      <p id="reasoning-limit" className={styles.fieldHelp}>{attempt.reasoning.trim().length}/{REASONING_MIN_LENGTH} minimum characters · maximum {REASONING_MAX_LENGTH.toLocaleString()}</p>
      <p id="reasoning-help" className={styles.assessmentNote}>Checks cover your selected diagnosis and cited evidence; written reasoning needs human review.</p>
      <button className={styles.primaryButton} disabled={!attempt.hypothesisId || attempt.submissions.length >= MAX_SUBMISSIONS} onClick={onSubmit}>Check diagnosis <span aria-hidden="true">→</span></button>
      <p className={styles.fieldHelp}>Draft changes are saved. Check diagnosis saves a new answer snapshot.</p>
      {hasSubmission && <div role="status" className={result.complete ? styles.positiveFeedback : styles.feedback}><strong>{result.complete ? 'Last submission: checks passed.' : 'Last submission: keep investigating.'}</strong><p>{result.feedback}</p><ul className={styles.checklist}>{result.checks.map((check) => <li key={check.label}><span aria-hidden="true">{check.passed ? '✓' : '○'}</span><span>{check.label}: {check.passed ? 'passed' : 'needed'}</span></li>)}</ul></div>}
    </section>
  );
};
