import { expect, test } from '@playwright/test';

test('CRUD table works on isolated e2e database', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Liegestütze Statistik' })).toBeVisible();

  const tsInput = page.locator('input[type="datetime-local"]').first();
  const repsInput = page.getByPlaceholder('Reps');
  const sourceInput = page.getByPlaceholder('Quelle');

  await tsInput.fill('2026-02-11T07:30');
  await repsInput.fill('15');
  await sourceInput.fill('e2e');
  await page.getByRole('button', { name: 'Neu' }).click();

  const e2eRow = page.locator('tbody tr').filter({ hasText: 'e2e' }).first();
  await expect(e2eRow).toBeVisible();
  await expect(e2eRow).toContainText('15');

  await Promise.all([
    page.waitForResponse((resp) =>
      resp.url().includes('/api/pushups/') && resp.request().method() === 'DELETE' && resp.status() === 200,
    ),
    e2eRow.getByRole('button', { name: 'Löschen' }).click(),
  ]);
});
