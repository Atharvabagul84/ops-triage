import type { PracticeScenario } from '@/lib/practice';
import styles from './practice.module.css';

export const PracticeDebrief = ({ scenario }: { scenario: PracticeScenario }) => (
  <section className={`${styles.panel} ${styles.debrief}`} aria-labelledby="debrief-title">
    <p className={styles.eyebrow}>CASE COMPLETE</p>
    <h2 id="debrief-title">The evidence behind the answer</h2>
    <p className={styles.cause}>{scenario.debrief.cause}</p>
    <div className={styles.debriefGrid}>
      <div><h3>What confirms it</h3><ul>{scenario.debrief.evidence.map((item) => <li key={item}>{item}</li>)}</ul></div>
      <div><h3>Alternatives and remaining uncertainty</h3><ul>{scenario.debrief.counterEvidence.map((item) => <li key={item}>{item}</li>)}</ul></div>
      <div><h3>Recovery considerations</h3><ul>{scenario.debrief.remediation.map((item) => <li key={item}>{item}</li>)}</ul></div>
      <div><h3>Verify recovery</h3><ul>{scenario.debrief.verification.map((item) => <li key={item}>{item}</li>)}</ul></div>
    </div>
    <div className={styles.lesson}><strong>Take this with you</strong><p>{scenario.debrief.lesson}</p></div>
    <div className={styles.sources}>
      <h3>Keep learning from the official docs</h3>
      <ul>{scenario.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} <span aria-label="opens in a new tab">↗</span></a></li>)}</ul>
    </div>
  </section>
);
