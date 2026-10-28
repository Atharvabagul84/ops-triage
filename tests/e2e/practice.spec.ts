import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { citeOomEvidence, completeOomCase, NOTE, OOM_ANSWER, OOM_TITLE, openNotebook, openPractice, REASONING, startOomCase } from './practice-helpers';

test('the public landing page opens practice without an account', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Start free as a guest', exact: true }).first().click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByRole('button', { name: 'Start case', exact: true })).toHaveCount(10);
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
});

test('a guest must inspect and cite evidence, then keeps submitted checks after reload', async ({ page }) => {
  await openPractice(page);
  await expect(page.getByRole('button', { name: 'Start case', exact: true })).toHaveCount(10);
  await page.getByRole('checkbox', { name: /Include transfer cases/ }).check();
  await expect(page.getByRole('button', { name: 'Start case', exact: true })).toHaveCount(20);
  await startOomCase(page);
  await expect(page.getByRole('checkbox', { name: /Cite this check in my diagnosis — Inspect the previous termination/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Check diagnosis', exact: true })).toBeDisabled();
  await page.getByRole('radio', { name: OOM_ANSWER, exact: true }).check();
  await page.getByLabel('Why does the evidence support this cause?', { exact: true }).fill(REASONING);
  await page.getByRole('button', { name: 'Check diagnosis', exact: true }).click();
  await expect(page.getByText('Last submission: keep investigating.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The evidence behind the answer', exact: true })).toHaveCount(0);
  await citeOomEvidence(page);
  await page.getByRole('button', { name: 'Reveal hint 1', exact: true }).click();
  await page.getByLabel('Personal notes', { exact: true }).fill(NOTE);
  await page.getByRole('button', { name: 'Check diagnosis', exact: true }).click();
  await expect(page.getByText('Last submission: checks passed.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The evidence behind the answer', exact: true })).toBeVisible();
  // Draft edits cannot silently re-grade or overwrite the last submitted answer.
  await page.getByLabel('Why does the evidence support this cause?', { exact: true }).fill('Too short');
  await expect(page.getByText('Last submission: checks passed.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check diagnosis', exact: true }).click();
  await expect(page.getByText('Last submission: keep investigating.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The evidence behind the answer', exact: true })).toHaveCount(0);
  await page.getByLabel('Why does the evidence support this cause?', { exact: true }).fill(REASONING);
  await page.getByRole('button', { name: 'Check diagnosis', exact: true }).click();
  await expect(page.getByText('Last submission: checks passed.', { exact: true })).toBeVisible();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.reload();
  await openNotebook(page);
  await expect(page.getByText('Checks passed', { exact: true })).toBeVisible();
  await expect(page.getByText(NOTE, { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Review run', exact: true }).click();
  await expect(page.getByLabel('Why does the evidence support this cause?', { exact: true })).toHaveValue(REASONING);
  await expect(page.getByText('Last submission: checks passed.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try the transfer case', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: OOM_TITLE })).toHaveCount(0);
  await openNotebook(page);
  await expect(page.getByText('2 of 2 saved runs', { exact: true })).toBeVisible();
});

test('real JSON and Markdown downloads preserve a run that can be deleted and restored', async ({ page }, testInfo) => {
  await openPractice(page);
  await startOomCase(page);
  await completeOomCase(page);
  await openNotebook(page);

  const jsonDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON backup', exact: true }).click();
  const jsonDownload = await jsonDownloadPromise;
  expect(jsonDownload.suggestedFilename()).toBe('opstriage-practice-notebook.json');
  const backupPath = testInfo.outputPath('guest-backup.json');
  await jsonDownload.saveAs(backupPath);
  expect(await jsonDownload.failure()).toBeNull();
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  expect(backup.version).toBe(2);
  expect(backup.attempts).toHaveLength(1);
  expect(backup.attempts[0]).toMatchObject({ scenarioId: 'oomkilled', notes: NOTE, reasoning: REASONING });
  expect(backup.attempts[0].submissions).toHaveLength(1);

  const markdownDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Markdown', exact: true }).click();
  const markdownDownload = await markdownDownloadPromise;
  expect(markdownDownload.suggestedFilename()).toBe('opstriage-practice-notebook.md');
  const markdownPath = testInfo.outputPath('guest-notebook.md');
  await markdownDownload.saveAs(markdownPath);
  expect(await markdownDownload.failure()).toBeNull();
  const markdown = await readFile(markdownPath, 'utf8');
  expect(markdown).toContain(OOM_TITLE);
  expect(markdown).toContain(REASONING);
  expect(markdown).toContain(NOTE);

  await page.getByRole('button', { name: `Delete run 1: ${OOM_TITLE}`, exact: true }).click();
  await page.getByRole('button', { name: 'Remove run', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your first investigation belongs here.', exact: true })).toBeVisible();
  await page.getByLabel('Import notebook JSON', { exact: true }).setInputFiles(backupPath);
  await expect(page.getByText('Import complete: 1 run merged, 0 skipped. Existing runs are preserved.', { exact: true })).toBeVisible();
  await expect(page.getByText('1 of 1 saved runs', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review run', exact: true }).click();
  await expect(page.getByLabel('Personal notes', { exact: true })).toHaveValue(NOTE);
  await expect(page.getByText('Last submission: checks passed.', { exact: true })).toBeVisible();
});

test('an invalid backup cannot replace the current notebook', async ({ page }) => {
  await openPractice(page);
  await startOomCase(page);
  await page.getByLabel('Personal notes', { exact: true }).fill(NOTE);
  await openNotebook(page);
  await page.getByLabel('Import notebook JSON', { exact: true }).setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await expect(page.getByRole('alert').filter({ hasText: 'This file is not valid JSON.' })).toBeVisible();
  await expect(page.getByText('1 of 1 saved runs', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume run', exact: true }).click();
  await expect(page.getByLabel('Personal notes', { exact: true })).toHaveValue(NOTE);
});

test('a stale tab pauses device saves and can export its own edits', async ({ page, context }, testInfo) => {
  await openPractice(page);
  const staleTab = await context.newPage();
  await openPractice(staleTab);
  await startOomCase(page);
  await page.getByLabel('Personal notes', { exact: true }).fill('The first tab owns the saved notebook.');
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await expect(staleTab.getByText('Device saving paused', { exact: true })).toBeVisible();
  await startOomCase(staleTab);
  await staleTab.getByLabel('Personal notes', { exact: true }).fill('These second-tab notes need a separate backup.');
  const downloadPromise = staleTab.waitForEvent('download');
  await staleTab.getByRole('button', { name: "Export this tab's JSON", exact: true }).click();
  const download = await downloadPromise;
  const backupPath = testInfo.outputPath('conflict-backup.json');
  await download.saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  expect(backup.attempts[0].notes).toBe('These second-tab notes need a separate backup.');
  await staleTab.close();
  await page.reload();
  await openNotebook(page);
  await page.getByRole('button', { name: 'Resume run', exact: true }).click();
  await expect(page.getByLabel('Personal notes', { exact: true })).toHaveValue('The first tab owns the saved notebook.');
});
