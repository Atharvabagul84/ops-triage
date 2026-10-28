import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

const moduleUrl = new URL('./notebookImportFile.ts', import.meta.url);

test('an oversized notebook is rejected before a file reader can allocate its contents', async () => {
  assert.ok(existsSync(moduleUrl), 'Notebook imports need a size check before reading the file');
  const { readNotebookImport } = await import(moduleUrl.href);
  let reads = 0;
  await assert.rejects(() => readNotebookImport(2_097_153, 2_097_152, async () => { reads += 1; return '{}'; }), /2 MB/i);
  assert.equal(reads, 0);
});

test('a notebook at the size limit is read without alteration', async () => {
  assert.ok(existsSync(moduleUrl), 'Notebook imports need a size check before reading the file');
  const { readNotebookImport } = await import(moduleUrl.href);
  const backup = '{"version":2,"attempts":[]}';
  assert.equal(await readNotebookImport(2_097_152, 2_097_152, async () => backup), backup);
});

test('an unreadable file rejects without inventing an empty notebook', async () => {
  assert.ok(existsSync(moduleUrl), 'Notebook imports need a size check before reading the file');
  const { readNotebookImport } = await import(moduleUrl.href);
  await assert.rejects(() => readNotebookImport(25, 2_097_152, async () => { throw new Error('File could not be read'); }), /could not be read/);
});
