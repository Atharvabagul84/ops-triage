import { expect, type Page } from '@playwright/test';

export const OOM_TITLE = 'The restarting report worker';
export const OOM_ANSWER = 'The container terminated because of an OOM condition';
export const REASONING = 'The previous termination explicitly records OOMKilled. The memory budget is 256Mi, but these signals do not establish an application memory leak.';
export const NOTE = 'Review memory across representative batch runs before changing the budget.';

export const openPractice = async (page: Page) => {
  await page.goto('/practice');
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
};

export const startOomCase = async (page: Page) => {
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: OOM_TITLE, exact: true }) });
  await card.getByRole('button', { name: 'Start case', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: OOM_TITLE })).toBeVisible();
};

export const citeOomEvidence = async (page: Page) => {
  for (const label of ['Inspect the previous termination', 'Inspect memory settings']) {
    await page.getByRole('button', { name: `Reveal simulated output: ${label}`, exact: true }).click();
    await page.getByRole('checkbox', { name: `Cite this check in my diagnosis — ${label}`, exact: true }).check();
  }
};

export const completeOomCase = async (page: Page) => {
  await citeOomEvidence(page);
  await page.getByRole('radio', { name: OOM_ANSWER, exact: true }).check();
  await page.getByLabel('Why does the evidence support this cause?', { exact: true }).fill(REASONING);
  await page.getByLabel('Personal notes', { exact: true }).fill(NOTE);
  await page.getByRole('button', { name: 'Check diagnosis', exact: true }).click();
  await expect(page.getByText('Last submission: checks passed.', { exact: true })).toBeVisible();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
};

export const openNotebook = async (page: Page) => {
  await page.getByRole('button', { name: /^My notebook/ }).click();
  await expect(page.getByRole('heading', { name: 'A notebook that grows with you.', exact: true })).toBeVisible();
};
