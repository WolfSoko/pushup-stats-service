import { expect, test } from '@playwright/test';
import {
  cleanupPushupsBySource,
  ensureAuthenticated,
  ensureSourceColumnVisible,
  isoDateTime,
  parseDateInputValue,
  seedPushup,
  signInTestUser,
  startOfDay,
  startOfWeekMonday,
} from './support/e2e-helpers';

test('dashboard period controls (Tag/Woche + Heute/Vor/Zurück) filter table rows', async ({
  page,
}) => {
  await ensureAuthenticated(page);

  const runId = Date.now().toString(36);
  const srcToday = `e2e-today-${runId}`;
  const srcYday = `e2e-yday-${runId}`;
  const srcPrevWeek = `e2e-prev-week-${runId}`;

  const userId = await signInTestUser(page);

  const now = new Date();
  const today = new Date(now);

  const day = (now.getDay() + 6) % 7;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - day);

  const previousWeekDate = new Date(startOfWeek);
  previousWeekDate.setDate(startOfWeek.getDate() - 2);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  try {
    await seedPushup(page, userId, {
      timestamp: isoDateTime(today, 12, 0),
      reps: 11,
      source: srcToday,
    });
    await seedPushup(page, userId, {
      timestamp: isoDateTime(yesterday, 12, 1),
      reps: 8,
      source: srcYday,
    });
    await seedPushup(page, userId, {
      timestamp: isoDateTime(previousWeekDate, 12, 2),
      reps: 14,
      source: srcPrevWeek,
    });

    await page.goto('/');

    const table = page.locator('app-stats-table');

    await expect(
      table.locator('mat-row').filter({ hasText: srcToday }).first()
    ).toBeVisible({ timeout: 15000 });

    await ensureSourceColumnVisible(page);

    await page.getByRole('radio', { name: 'Tag' }).click();
    await page.getByRole('button', { name: 'Heute' }).click();

    await expect(
      table.locator('mat-row').filter({ hasText: srcToday }).first()
    ).toBeVisible();
    await expect(
      table.locator('mat-row').filter({ hasText: srcPrevWeek }).first()
    ).not.toBeVisible();

    await page.getByRole('radio', { name: 'Woche' }).click();
    await page.getByRole('button', { name: 'Heute' }).click();

    await expect(
      table.locator('mat-row').filter({ hasText: srcToday }).first()
    ).toBeVisible();

    const fromInput = page.getByRole('textbox', { name: 'Von' });
    const fromBefore = await fromInput.inputValue().catch(() => '');

    await page.getByRole('button', { name: 'Zurück' }).click();

    await expect
      .poll(async () => fromInput.inputValue(), { timeout: 8000 })
      .not.toBe(fromBefore);

    await expect(
      table.locator('mat-row').filter({ hasText: srcPrevWeek }).first()
    ).toBeVisible();
  } finally {
    await cleanupPushupsBySource(
      page,
      new Set([srcToday, srcYday, srcPrevWeek])
    );
  }
});

test('month navigation keeps month mode (vor/zurück)', async ({ page }) => {
  await ensureAuthenticated(page);
  await page.goto('/');

  const filterBar = page.locator('app-filter-bar');
  const monthRadio = filterBar.getByRole('radio', { name: 'Monat' });
  const weekRadio = filterBar.getByRole('radio', { name: 'Woche' });
  const dayRadio = filterBar.getByRole('radio', { name: 'Tag' });

  await monthRadio.click();
  await expect(monthRadio).toBeChecked();

  await filterBar.getByRole('button', { name: 'Vor' }).click();
  await expect(monthRadio).toBeChecked();
  await expect(weekRadio).not.toBeChecked();
  await expect(dayRadio).not.toBeChecked();

  await filterBar.getByRole('button', { name: 'Zurück' }).click();
  await expect(monthRadio).toBeChecked();
  await expect(weekRadio).not.toBeChecked();
  await expect(dayRadio).not.toBeChecked();
});

test('range mode transitions keep correct anchor (month→week, week→day)', async ({
  page,
}) => {
  await ensureAuthenticated(page);
  await page.goto('/');

  const filterBar = page.locator('app-filter-bar');
  const fromInput = filterBar.getByRole('textbox', { name: 'Von' });
  const toInput = filterBar.getByRole('textbox', { name: 'Bis' });

  await filterBar.getByRole('radio', { name: 'Monat' }).click();
  await filterBar.getByRole('button', { name: 'Heute' }).click();
  await filterBar.getByRole('radio', { name: 'Woche' }).click();

  const today = startOfDay(new Date());
  const expectedTodayWeekStart = startOfWeekMonday(today);
  const expectedTodayWeekEnd = new Date(expectedTodayWeekStart);
  expectedTodayWeekEnd.setDate(expectedTodayWeekStart.getDate() + 6);

  await expect
    .poll(async () =>
      parseDateInputValue(await fromInput.inputValue()).getTime()
    )
    .toBe(expectedTodayWeekStart.getTime());
  await expect
    .poll(async () => parseDateInputValue(await toInput.inputValue()).getTime())
    .toBe(expectedTodayWeekEnd.getTime());

  await filterBar.getByRole('radio', { name: 'Tag' }).click();
  await expect
    .poll(async () =>
      parseDateInputValue(await fromInput.inputValue()).getTime()
    )
    .toBe(today.getTime());
  await expect
    .poll(async () => parseDateInputValue(await toInput.inputValue()).getTime())
    .toBe(today.getTime());

  await filterBar.getByRole('radio', { name: 'Woche' }).click();
  await filterBar.getByRole('button', { name: 'Heute' }).click();

  const weekFromBeforeBack = parseDateInputValue(await fromInput.inputValue());
  await filterBar.getByRole('button', { name: 'Zurück' }).click();

  await expect
    .poll(async () =>
      parseDateInputValue(await fromInput.inputValue()).getTime()
    )
    .not.toBe(weekFromBeforeBack.getTime());

  const weekStartBeforeDaySwitch = parseDateInputValue(
    await fromInput.inputValue()
  );
  await filterBar.getByRole('radio', { name: 'Tag' }).click();

  await expect
    .poll(async () =>
      parseDateInputValue(await fromInput.inputValue()).getTime()
    )
    .toBe(weekStartBeforeDaySwitch.getTime());
  await expect
    .poll(async () => parseDateInputValue(await toInput.inputValue()).getTime())
    .toBe(weekStartBeforeDaySwitch.getTime());
});
