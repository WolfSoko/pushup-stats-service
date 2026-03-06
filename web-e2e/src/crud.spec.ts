import { expect, Page, test } from '@playwright/test';
import {
  ensureAuthenticated,
  ensureSourceColumnVisible,
  isoDateTime,
  signInTestUser,
} from './support/e2e-helpers';

async function createEntry(
  page: Page,
  timestamp: string,
  reps: string,
  source: string
) {
  await page.getByRole('button', { name: /neu/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type="datetime-local"]').fill(timestamp);
  await dialog.locator('input[type="number"]').first().fill(reps);
  await dialog.locator('input[type="text"]').last().fill(source);
  await dialog.getByRole('button', { name: /speichern/i }).click();
}

test('CRUD table works on isolated e2e database', async ({ page }) => {
  await signInTestUser(page);

  await page.goto('/');
  await ensureAuthenticated(page);
  await expect(
    page.getByRole('heading', { name: 'Liegestütze Statistik' })
  ).toBeVisible();

  const now = new Date();
  await createEntry(page, isoDateTime(now, 23, 59), '15', 'entry-a');

  // The source column is hidden by default; enable it for assertions.
  await ensureSourceColumnVisible(page);

  const e2eRow = page.locator('mat-row').filter({ hasText: 'entry-a' }).first();
  await expect(e2eRow).toBeVisible();
  await expect(e2eRow).toContainText('15');

  // Delete the entry and wait for the row to disappear via Firestore real-time.
  await e2eRow.getByRole('button', { name: 'Löschen' }).click();
  await expect(e2eRow).not.toBeVisible({ timeout: 10000 });
});
