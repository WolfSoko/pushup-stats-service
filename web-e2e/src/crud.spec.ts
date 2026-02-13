import { expect, Page, test } from '@playwright/test';

async function createEntry(page: Page, timestamp: string, reps: string, source: string) {
  await page.getByRole('button', { name: /neu/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type="datetime-local"]').fill(timestamp);
  await dialog.locator('input[type="number"]').fill(reps);
  await dialog.locator('input[type="text"]').last().fill(source);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isoDateTime(date: Date, hh = 8, mm = 0): string {
  const base = new Date(date);
  base.setHours(hh, mm, 0, 0);
  return `${isoDate(base)}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
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

test('settings page is reachable from navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Liegestütze Statistik' })).toBeVisible();

  // On desktop viewport the sidenav is open; click the list item.
  await page.getByRole('link', { name: 'Einstellungen' }).first().click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText('User-Profil & Tagesziel')).toBeVisible();
});

test('dashboard period controls (Tag/Woche + Heute/Vor/Zurück) filter table rows', async ({ page }) => {
  const now = new Date();
  const today = new Date(now);

  const day = (now.getDay() + 6) % 7; // Monday=0
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - day);

  const previousWeekDate = new Date(startOfWeek);
  previousWeekDate.setDate(startOfWeek.getDate() - 2);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  await page.request.post('/api/pushups', {
    data: { timestamp: isoDateTime(today, 9, 0), reps: 11, source: 'e2e-today', type: 'Standard' },
  });
  await page.request.post('/api/pushups', {
    data: { timestamp: isoDateTime(yesterday, 9, 5), reps: 8, source: 'e2e-yday', type: 'Standard' },
  });
  await page.request.post('/api/pushups', {
    data: { timestamp: isoDateTime(previousWeekDate, 9, 10), reps: 14, source: 'e2e-prev-week', type: 'Standard' },
  });

  await page.goto('/');

  const table = page.locator('app-stats-table');

  await page.getByRole('radio', { name: 'Tag' }).click();
  await page.getByRole('button', { name: 'Heute' }).click();

  await expect(table.locator('mat-row').filter({ hasText: 'e2e-today' }).first()).toBeVisible();
  await expect(table.locator('mat-row').filter({ hasText: 'e2e-prev-week' })).toHaveCount(0);

  await page.getByRole('radio', { name: 'Woche' }).click();
  await page.getByRole('button', { name: 'Heute' }).click();

  await expect(table.locator('mat-row').filter({ hasText: 'e2e-today' }).first()).toBeVisible();
  await expect(table.locator('mat-row').filter({ hasText: 'e2e-yday' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Zurück' }).click();

  await expect(table.locator('mat-row').filter({ hasText: 'e2e-prev-week' }).first()).toBeVisible();
  await expect(table.locator('mat-row').filter({ hasText: 'e2e-today' })).toHaveCount(0);
});
