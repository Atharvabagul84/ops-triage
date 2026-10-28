import { evaluateAttempt, type PracticeAttempt, type PracticeScenario } from '@/lib/practice';
import styles from './practice.module.css';

export const PracticeSubmissionHistory = ({ scenario, attempt }: { scenario: PracticeScenario; attempt: PracticeAttempt }) => (
  <section className={`${styles.panel} ${styles.historyPanel}`} aria-labelledby="history-title">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>THE PATH YOU TOOK</p><h2 id="history-title">Answer history</h2></div><span className={styles.small}>{attempt.submissions.length} submitted {attempt.submissions.length === 1 ? 'check' : 'checks'}</span></div>
    {!attempt.submissions.length ? <p className={styles.muted}>Your first submitted diagnosis will appear here. Changes to your draft do not count as a submission.</p> : <div className={styles.historyList}>{attempt.submissions.slice().reverse().map((submission, reverseIndex) => {
      const result = evaluateAttempt(scenario, submission);
      const hypothesis = scenario.hypotheses.find((item) => item.id === submission.hypothesisId);
      return <details className={styles.historyEntry} key={`${submission.submittedAt}-${reverseIndex}`}><summary><span>Check {attempt.submissions.length - reverseIndex} <span className={styles.small}>· {new Date(submission.submittedAt).toLocaleString()}</span></span><span className={result.complete ? styles.successTag : styles.tag}>{result.complete ? 'Checks passed' : 'Needs evidence or revision'}</span></summary><div><h3>{hypothesis?.label ?? 'No diagnosis selected'}</h3><p className={styles.historyReasoning}>{submission.reasoning || 'No written reasoning submitted.'}</p><p className={styles.muted}>Cited checks: {submission.citedDiagnosticIds.map((id) => scenario.diagnostics.find((diagnostic) => diagnostic.id === id)?.label).filter(Boolean).join(', ') || 'None'}</p><p className={styles.historyFeedback}>{result.feedback}</p></div></details>;
    })}</div>}
  </section>
);
