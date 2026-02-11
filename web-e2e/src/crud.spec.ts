import { expect, Page, test } from '@playwright/test';

async function createEntry(page: Page, timestamp: string, reps: string, source: string) {
  await page.getByRole('button', { name: /neu/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type="datetime-local"]').fill(timestamp);
  await dialog.locator('input[type="number"]').fill(reps);
  await dialog.locator('input[type="text"]').last().fill(source);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
}

test('CRUD table works on isolated e2e database', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Liegestütze Statistik' })).toBeVisible();

  await createEntry(page, '2026-02-11T07:30', '15', 'entry-a');

  const e2eRow = page.locator('mat-row').filter({ hasText: 'entry-a' }).first();
  await expect(e2eRow).toBeVisible();
  await expect(e2eRow).toContainText('15');

  await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes('/api/pushups/') && resp.request().method() === 'DELETE' && resp.status() === 200,
    ),
    e2eRow.getByRole('button', { name: 'Löschen' }).click(),
  ]);
});

test('websocket pushes updates to other open clients', async ({ browser }) => {
  const pageA = await browser.newPage();
  const pageB = await browser.newPage();

  try {
    await pageA.goto('/');
    await pageB.goto('/');

    await createEntry(pageA, '2026-02-11T07:45', '9', 'ws-e2e');

    const rowOnB = pageB.locator('mat-row').filter({ hasText: 'ws-e2e' }).first();
    await expect(rowOnB).toBeVisible({ timeout: 10000 });
    await expect(rowOnB).toContainText('9');
  } finally {
    await pageA.close();
    await pageB.close();
  }
});
