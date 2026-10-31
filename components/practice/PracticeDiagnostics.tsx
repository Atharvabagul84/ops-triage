import type { PracticeAttempt, PracticeScenario } from '@/lib/practice';
import styles from './practice.module.css';

interface PracticeDiagnosticsProps {
  scenario: PracticeScenario;
  attempt: PracticeAttempt;
  onUpdate: (patch: Partial<PracticeAttempt>) => void;
}

export const PracticeDiagnostics = ({ scenario, attempt, onUpdate }: PracticeDiagnosticsProps) => {
  const reveal = (id: string) => {
    if (!attempt.diagnosticIds.includes(id)) onUpdate({ diagnosticIds: [...attempt.diagnosticIds, id] });
  };
  const cite = (id: string, checked: boolean) => onUpdate({
    citedDiagnosticIds: checked ? [...new Set([...attempt.citedDiagnosticIds, id])] : attempt.citedDiagnosticIds.filter((item) => item !== id),
  });
  const { lab } = scenario;
  const revealLabel = lab ? 'Reveal captured output' : 'Reveal simulated output';
  return (
    <section className={styles.panel} aria-labelledby="diagnostics-title">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>02 / INVESTIGATE</p><h2 id="diagnostics-title">Follow the evidence</h2></div><span className={styles.small}>{attempt.diagnosticIds.length}/{scenario.diagnostics.length} inspected</span></div>
      <p className={styles.muted}>{lab
        ? `Inspect a check captured from a kind cluster (${lab.path}, Kubernetes ${lab.kubernetesVersion}), then cite the evidence that supports your diagnosis. Outputs are real excerpts; nothing runs from this page.`
        : 'Inspect a simulated check, then cite the evidence that supports your diagnosis. No commands run and no infrastructure is connected.'}</p>
      <div className={styles.diagnosticList}>
        {scenario.diagnostics.map((diagnostic, index) => {
          const revealed = attempt.diagnosticIds.includes(diagnostic.id);
          return (
            <article className={styles.diagnostic} key={diagnostic.id}>
              <div className={styles.diagnosticHeading}><h3><span className={styles.stepNumber}>{index + 1}</span>{diagnostic.label}</h3><span className={styles.small}>{lab ? 'Read-only capture' : 'Read-only example'}</span></div>
              <pre className={styles.command}><code>{diagnostic.command}</code></pre>
              <button className={styles.secondaryButton} onClick={() => reveal(diagnostic.id)} aria-expanded={revealed} aria-controls={`output-${diagnostic.id}`} aria-disabled={revealed} aria-label={`${revealed ? 'Output revealed' : revealLabel}: ${diagnostic.label}`}>{revealed ? 'Output revealed' : revealLabel} <span aria-hidden="true">{revealed ? '✓' : '↓'}</span></button>
              {revealed && <div className={styles.revealed} id={`output-${diagnostic.id}`}><div className={styles.terminalHeader}><span>Diagnostic output</span><span>{lab ? 'KIND CAPTURE' : 'SIMULATED'}</span></div><pre className={styles.terminal}>{diagnostic.output}</pre><p className={styles.explanation}><strong>How to read this:</strong> {diagnostic.explanation}</p></div>}
              <label className={`${styles.citationToggle} ${!revealed ? styles.unavailableCitation : ''}`}><input type="checkbox" checked={attempt.citedDiagnosticIds.includes(diagnostic.id)} disabled={!revealed} onChange={(event) => cite(diagnostic.id, event.target.checked)} /><span>Cite this check in my diagnosis<span className={styles.citationName}> — {diagnostic.label}</span></span></label>
              {!revealed && <p className={styles.fieldHelp}>Reveal the output before citing this check.</p>}
            </article>
          );
        })}
      </div>
      <a className={styles.textButton} href="#diagnosis-reasoning">Explain your diagnosis <span aria-hidden="true">↗</span></a>
    </section>
  );
};
