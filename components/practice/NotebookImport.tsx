import { useState, type ChangeEvent } from 'react';
import { MAX_IMPORT_BYTES, type PracticeImportResult } from '@/lib/practice';
import { readNotebookImport } from './notebookImportFile';
import styles from './practice.module.css';

interface NotebookImportProps {
  ready: boolean;
  onImport: (raw: string) => PracticeImportResult;
}

export const NotebookImport = ({ ready, onImport }: NotebookImportProps) => {
  const [pending, setPending] = useState(false);
  const [report, setReport] = useState<{ text: string; error: boolean } | null>(null);
  const [pastedJson, setPastedJson] = useState('');
  const applyImport = (raw: string) => {
    const result = onImport(raw);
    setReport(result.error ? { text: result.error, error: true } : {
      text: `Import complete: ${result.importedCount} ${result.importedCount === 1 ? 'run merged' : 'runs merged'}, ${result.skippedCount} skipped. Existing runs are preserved.`,
      error: false,
    });
  };
  const importPastedJson = () => {
    setReport(null);
    if (new TextEncoder().encode(pastedJson).byteLength > MAX_IMPORT_BYTES) {
      setReport({ text: 'Paste a JSON backup of 2 MB or less. Your current notebook is unchanged.', error: true });
      return;
    }
    try { applyImport(pastedJson); }
    catch { setReport({ text: 'The pasted backup could not be imported. Your current notebook is unchanged.', error: true }); }
  };
  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setPending(true);
    setReport(null);
    try {
      const raw = await readNotebookImport(file.size, MAX_IMPORT_BYTES, () => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('The file could not be read. Your current notebook is unchanged.'));
        reader.onabort = () => reject(new Error('Reading was canceled. Your current notebook is unchanged.'));
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Choose a readable JSON file.'));
        reader.readAsText(file);
      }));
      applyImport(raw);
    } catch (error) {
      setReport({ text: error instanceof Error ? error.message : 'The file could not be imported. Your current notebook is unchanged.', error: true });
    } finally {
      input.value = '';
      setPending(false);
    }
  };
  return (
    <section className={styles.importBox} aria-labelledby="import-title">
      <div><h2 id="import-title">Bring your notebook with you</h2><p>Import a JSON backup up to 2 MB. Valid saved runs merge into this notebook; your current runs stay here.</p></div>
      <div className={styles.importInput}><label htmlFor="notebook-import">Import notebook JSON</label><input id="notebook-import" type="file" accept=".json,application/json" disabled={!ready || pending} onChange={handleImport} /></div>
      <details className={styles.pasteImport}>
        <summary>Paste a JSON backup instead</summary>
        <label htmlFor="notebook-pasted-json" className={styles.fieldLabel}>Pasted JSON backup</label>
        <textarea id="notebook-pasted-json" className={styles.exportTextarea} rows={6} value={pastedJson} onChange={(event) => setPastedJson(event.target.value)} spellCheck={false} placeholder='{"version":2,"attempts":[...]}' aria-describedby="paste-import-help" />
        <p id="paste-import-help">Paste the complete JSON export, up to 2 MB. It is checked and merged only when you choose Import pasted JSON.</p>
        <button className={styles.secondaryButton} disabled={!ready || pending || !pastedJson.trim()} onClick={importPastedJson}>Import pasted JSON</button>
      </details>
      {pending && <p role="status" className={styles.fieldHelp}>Checking your backup…</p>}
      {report && <p role={report.error ? 'alert' : 'status'} className={report.error ? styles.importError : styles.importSuccess}>{report.text}</p>}
    </section>
  );
};
