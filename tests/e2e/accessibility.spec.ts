import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openNotebook, openPractice, startOomCase } from './practice-helpers';

test('library, investigation and notebook have no detected WCAG A/AA violations', async ({ page }, testInfo) => {
  await openPractice(page);
  for (const view of ['library', 'investigation', 'notebook']) {
    if (view === 'investigation') await startOomCase(page);
    if (view === 'notebook') await openNotebook(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    await testInfo.attach(`axe-${view}`, { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
    expect(results.violations, `${view} accessibility violations`).toEqual([]);
  }
});

test('keyboard users can use the skip link and activate a diagnostic disclosure', async ({ page }) => {
  await openPractice(page);
  const skipLink = page.getByRole('link', { name: 'Skip to practice content', exact: true });
  await skipLink.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await startOomCase(page);
  const disclosure = page.getByRole('button', { name: 'Reveal simulated output: Inspect the previous termination', exact: true });
  await disclosure.focus();
  await page.keyboard.press('Enter');
  const citation = page.getByRole('checkbox', { name: 'Cite this check in my diagnosis — Inspect the previous termination', exact: true });
  await expect(citation).toBeEnabled();
  await page.keyboard.press('Tab');
  await expect(citation).toBeFocused();
  await page.keyboard.press('Space');
  await expect(citation).toBeChecked();
});
