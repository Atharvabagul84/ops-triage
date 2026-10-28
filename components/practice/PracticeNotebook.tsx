import { useState, type ReactNode } from 'react';
import { getAttemptEvaluation, PRACTICE_SCENARIOS, type PracticeImportResult, type PracticeNotebook as Notebook } from '@/lib/practice';
import { NotebookImport } from './NotebookImport';
import styles from './practice.module.css';

interface PracticeNotebookProps {
  notebook: Notebook;
  ready: boolean;
  onOpen: (attemptId: string) => void;
  onDelete: (attemptId: string) => void;
  onExplore: () => void;
  onExport: (format: 'markdown' | 'json') => void;
  onImport: (raw: string) => PracticeImportResult;
  exportPreview?: ReactNode;
}

export const PracticeNotebook = ({ notebook, ready, onOpen, onDelete, onExplore, onExport, onImport, exportPreview }: PracticeNotebookProps) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const search = query.trim().toLowerCase();
  const visibleAttempts = notebook.attempts.filter((attempt) => {
    const scenario = PRACTICE_SCENARIOS.find((item) => item.id === attempt.scenarioId);
    return [scenario?.title, attempt.notes, attempt.reasoning, ...attempt.submissions.map((submission) => submission.reasoning)].join(' ').toLowerCase().includes(search);
  }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return (
    <section aria-labelledby="notebook-title">
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>YOUR FIELD NOTES</p><h1 id="notebook-title" className={styles.notebookTitle}>A notebook that grows with you.</h1></div>
        <div className={styles.exportButtons}><button className={styles.secondaryButton} disabled={!ready || !notebook.attempts.length} onClick={() => onExport('markdown')}>Export Markdown <span aria-hidden="true">↓</span></button><button className={styles.secondaryButton} disabled={!ready || !notebook.attempts.length} onClick={() => onExport('json')}>Export JSON backup <span aria-hidden="true">↓</span></button></div>
      </div>
      <p className={styles.muted}>Every run keeps its own notes, hints, and submitted answers. Progress is stored in this browser; JSON backups let you restore it elsewhere.</p>
      {exportPreview}
      <NotebookImport ready={ready} onImport={onImport} />
      {!ready ? <p className={styles.muted} role="status">Loading your saved runs…</p> : !notebook.attempts.length ? (
        <div className={styles.emptyNotebook}><span className={styles.emptyGlyph} aria-hidden="true">[ &nbsp; ]</span><h2>Your first investigation belongs here.</h2><p>Start a practice case and save a record of what you inspected, what you thought, and how your answer changed.</p><button className={styles.primaryButton} onClick={onExplore}>Explore practice cases <span aria-hidden="true">→</span></button></div>
      ) : (
        <>
          <div className={styles.notebookSearch}><label htmlFor="notebook-search">Search your notebook</label><input id="notebook-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search case titles, notes, or written reasoning" /><span role="status">{visibleAttempts.length} of {notebook.attempts.length} saved runs</span></div>
          {!visibleAttempts.length && <div className={styles.noMatches}><h2>No matching runs</h2><p>Try a different case name or a phrase from your notes.</p><button className={styles.textButton} onClick={() => setQuery('')}>Clear search</button></div>}
          <div className={styles.notebookList}>{visibleAttempts.map((attempt) => {
            const scenario = PRACTICE_SCENARIOS.find((item) => item.id === attempt.scenarioId);
            if (!scenario) return null;
            const complete = getAttemptEvaluation(scenario, attempt).complete;
            const runNumber = notebook.attempts.filter((item) => item.scenarioId === scenario.id).sort((left, right) => left.createdAt.localeCompare(right.createdAt)).findIndex((item) => item.id === attempt.id) + 1;
            return (
              <article className={styles.notebookEntry} key={attempt.id}>
                <div className={styles.notebookInfo}>
                  <div className={styles.entryTags}><span className={complete ? styles.successTag : styles.tag}>{complete ? 'Checks passed' : attempt.submissions.length ? 'In progress' : 'Draft'}</span><span className={styles.small}>Run {runNumber}{scenario.variantOf ? ' · Transfer case' : ''}</span></div>
                  <h2 className={styles.notebookEntryTitle}>{scenario.title}</h2>
                  <p>{attempt.diagnosticIds.length}/{scenario.diagnostics.length} checks inspected <span aria-hidden="true">·</span> {attempt.submissions.length} submitted <span aria-hidden="true">·</span> {attempt.hintCount} hints</p>
                  <p>Updated <time dateTime={attempt.updatedAt}>{new Date(attempt.updatedAt).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></p>
                  {attempt.notes && <p className={styles.savedNotes}><strong>Notes:</strong> {attempt.notes}</p>}
                  {complete && <p className={styles.savedLesson}>{scenario.debrief.lesson}</p>}
                </div>
                <div className={styles.entryActions}><button className={styles.secondaryButton} onClick={() => onOpen(attempt.id)}>{complete ? 'Review run' : 'Resume run'} <span aria-hidden="true">→</span></button><button className={styles.deleteButton} onClick={() => setDeleteId(attempt.id)} aria-label={`Delete run ${runNumber}: ${scenario.title}`}>Delete saved run</button></div>
                {deleteId === attempt.id && <div className={styles.deleteConfirm} role="group" aria-label="Confirm removal of saved run"><p>Remove this run and its notes and answer history? Other runs for this case will stay in your notebook.</p><div><button className={styles.dangerButton} onClick={() => { onDelete(attempt.id); setDeleteId(null); }}>Remove run</button><button className={styles.secondaryButton} onClick={() => setDeleteId(null)}>Keep it</button></div></div>}
              </article>
            );
          })}</div>
        </>
      )}
    </section>
  );
};
