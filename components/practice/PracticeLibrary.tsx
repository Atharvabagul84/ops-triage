import { useState } from 'react';
import { BASE_PRACTICE_SCENARIOS, getAttemptEvaluation, PRACTICE_SCENARIOS, type PracticeNotebook } from '@/lib/practice';
import styles from './practice.module.css';

interface PracticeLibraryProps {
  notebook: PracticeNotebook;
  ready: boolean;
  onOpen: (scenarioId: string) => void;
}

export const PracticeLibrary = ({ notebook, ready, onOpen }: PracticeLibraryProps) => {
  const [includeVariants, setIncludeVariants] = useState(false);
  const scenarios = includeVariants ? PRACTICE_SCENARIOS : BASE_PRACTICE_SCENARIOS;
  return (
  <section aria-labelledby="case-library-title">
    <div className={styles.sectionHeading}>
      <div>
        <p className={styles.eyebrow}>THE PRACTICE LIBRARY</p>
        <h2 id="case-library-title">Small incidents. Better instincts.</h2>
      </div>
      <p className={styles.muted}>{BASE_PRACTICE_SCENARIOS.length} base cases + {PRACTICE_SCENARIOS.length - BASE_PRACTICE_SCENARIOS.length} transfer cases</p>
    </div>
    <label className={styles.libraryFilter}><input type="checkbox" checked={includeVariants} onChange={(event) => setIncludeVariants(event.target.checked)} /><span>Include transfer cases</span><small>Apply the same investigation skills to a different failure.</small></label>
    <div className={styles.caseGrid}>
      {scenarios.map((scenario, index) => {
        const runs = notebook.attempts.filter((item) => item.scenarioId === scenario.id).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        const attempt = runs[0];
        const complete = attempt ? getAttemptEvaluation(scenario, attempt).complete : false;
        return (
          <article className={styles.caseCard} key={scenario.id}>
            <div className={styles.cardMeta}>
              <span className={styles.caseNumber}>{scenario.variantOf ? 'TRANSFER' : `CASE ${String(index + 1).padStart(2, '0')}`}</span>
              {complete && <span className={styles.successTag}>Completed</span>}
              {attempt && !complete && <span className={styles.tag}>In progress</span>}
            </div>
            <div className={styles.caseGlyph} aria-hidden="true">{['>_', '{ }', '↗'][index % 3]}</div>
            <h3>{scenario.title}</h3>
            <p className={styles.cardSummary}>{scenario.summary}</p>
            <div className={styles.cardFooter}>
              <span>{scenario.difficulty} <span aria-hidden="true">·</span> {scenario.estimatedMinutes} min{runs.length > 0 ? ` · ${runs.length} ${runs.length === 1 ? 'run' : 'runs'}` : ''}</span>
              <button className={styles.textButton} disabled={!ready} onClick={() => onOpen(scenario.id)}>
                {complete ? 'Review case' : attempt ? 'Resume case' : 'Start case'} <span aria-hidden="true">→</span>
              </button>
            </div>
          </article>
        );
      })}
    </div>
    <div className={styles.methodStrip}>
      <div><span>01</span><strong>Read the incident</strong><p>Separate what you know from what you suspect.</p></div>
      <div><span>02</span><strong>Collect evidence</strong><p>Inspect simulated diagnostic results at your own pace.</p></div>
      <div><span>03</span><strong>Explain the cause</strong><p>Check your diagnosis and keep the lesson in your notebook.</p></div>
    </div>
  </section>
  );
};
