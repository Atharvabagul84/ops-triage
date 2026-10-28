import { useEffect, useRef, useState } from 'react';
import { MAX_IMPORT_BYTES } from '@/lib/practice';
import styles from './practice.module.css';

interface NotebookExportPreviewProps {
  content: string;
  format: 'markdown' | 'json' | 'original';
  onClose: () => void;
}

export const NotebookExportPreview = ({ content, format, onClose }: NotebookExportPreviewProps) => {
  const label = format === 'original' ? 'Original saved data' : format === 'json' ? 'JSON' : 'Markdown';
  const extension = format === 'original' ? 'txt' : format === 'json' ? 'json' : 'md';
  const exceedsImportLimit = format === 'json' && new TextEncoder().encode(content).length > MAX_IMPORT_BYTES;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const selectMarkdown = () => {
    textRef.current?.focus();
    textRef.current?.select();
  };

  const copyMarkdown = async () => {
    setCopyStatus('copying');
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
      selectMarkdown();
    }
  };

  return (
    <section className={`${styles.panel} ${styles.exportPreview}`} aria-labelledby="export-preview-title">
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>YOUR EXPORT IS READY</p><h2 ref={headingRef} tabIndex={-1} id="export-preview-title">{label} export preview</h2></div>
        <button className={styles.textButton} onClick={onClose}>Close preview <span aria-hidden="true">×</span></button>
      </div>
      <p className={styles.muted} id="export-preview-help">{format === 'original' ? 'This preserves the device snapshot exactly as it was read. Keep it for recovery; damaged or incompatible data may not be importable. ' : 'Your notebook is ready below. ' }If your browser does not download the file, copy this {label} into a text editor and save it as a .{extension} file.{format === 'json' ? ' JSON preserves your runs, notes, hints, and answer history for import.' : format === 'markdown' ? ' Use JSON when you want a restorable backup.' : ''}</p>
      {exceedsImportLimit && <p role="alert" className={styles.storageAlert}>This complete backup exceeds the current 2 MB import limit. Nothing has been removed from your export. It can be kept as an archive, but cannot be imported into this beta in one file.</p>}
      <label htmlFor="notebook-export-content" className={styles.exportLabel}>Notebook {label}</label>
      <textarea ref={textRef} id="notebook-export-content" className={styles.exportTextarea} value={content} readOnly rows={12} spellCheck={false} aria-describedby="export-preview-help" />
      <div className={styles.exportActions}>
        <button className={styles.primaryButton} disabled={copyStatus === 'copying'} onClick={copyMarkdown}>{copyStatus === 'copying' ? 'Copying…' : `Copy ${label}`}</button>
        <button className={styles.secondaryButton} onClick={selectMarkdown}>Select all</button>
        <p role="status" className={copyStatus === 'failed' ? styles.copyError : styles.copyStatus}>
          {copyStatus === 'copied' && 'Copy requested. If your clipboard is empty, use Select all and copy manually.'}
          {copyStatus === 'failed' && `Automatic copying is unavailable. The ${label} is selected; copy it manually with your keyboard or browser menu.`}
        </p>
      </div>
    </section>
  );
};
