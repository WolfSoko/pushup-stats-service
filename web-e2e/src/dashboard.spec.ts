import { expect, Page, test } from '@playwright/test';

const firestoreProjectId = 'pushup-stats';
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const FIRESTORE_EMULATOR_BASE = `http://127.0.0.1:8080/v1/projects/${firestoreProjectId}/databases/(default)/documents`;

const TEST_USER_EMAIL = 'e2e-test@pushup-stats.dev';
const TEST_USER_PASSWORD = 'e2e-test-password-123';

async function getOrCreateTestUserId(page: Page): Promise<string> {
  const signInResp = await page.request.post(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithEmailAndPassword?key=fake-api-key`,
    {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        returnSecureToken: true,
      },
    }
  );

  if (signInResp.ok()) {
    const body = await signInResp.json();
    return body.localId as string;
  }

  const signUpResp = await page.request.post(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        returnSecureToken: true,
      },
    }
  );
  const body = await signUpResp.json();
  return body.localId as string;
}

async function signInTestUser(page: Page): Promise<string> {
  const uid = await getOrCreateTestUserId(page);
  await page.goto('/login');

  await page.waitForSelector('input[type="email"]', {
    state: 'visible',
    timeout: 30000,
  });

  await page.getByLabel('Email').fill(TEST_USER_EMAIL);
  const passwordInput = page.getByLabel('Passwort');
  await passwordInput.fill(TEST_USER_PASSWORD);
  await passwordInput.press('Tab');
  await page.waitForTimeout(2000);

  const loginButton = page.getByRole('button', {
    name: 'Anmelden',
    exact: true,
  });
  await expect(loginButton).toBeEnabled({ timeout: 20000 });

  await loginButton.click();
  await page.waitForURL('/');
  return uid;
}

async function seedPushup(
  page: Page,
  userId: string,
  data: { timestamp: string; reps: number; source: string }
): Promise<string> {
  const resp = await page.request.post(`${FIRESTORE_EMULATOR_BASE}/pushups`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      fields: {
        timestamp: { stringValue: `${data.timestamp}:00.000Z` },
        reps: { integerValue: String(data.reps) },
        source: { stringValue: data.source },
        type: { stringValue: 'Standard' },
        userId: { stringValue: userId },
        createdAt: { stringValue: new Date().toISOString() },
        updatedAt: { stringValue: new Date().toISOString() },
      },
    },
  });
  const doc = await resp.json();
  return (doc.name as string).split('/').pop() as string;
}

async function cleanupPushupsBySource(
  page: Page,
  sources: Set<string>
): Promise<void> {
  try {
    const resp = await page.request.get(`${FIRESTORE_EMULATOR_BASE}/pushups`);
    if (!resp.ok()) return;
    const data = await resp.json();
    type FirestoreDoc = {
      name: string;
      fields?: { source?: { stringValue?: string } };
    };
    const ids = ((data.documents ?? []) as FirestoreDoc[])
      .filter((doc) => {
        const src = doc.fields?.source?.stringValue;
        return src !== undefined && sources.has(src);
      })
      .map((doc) => doc.name.split('/').pop() as string);
    await Promise.all(
      ids.map((id) =>
        page.request.delete(`${FIRESTORE_EMULATOR_BASE}/pushups/${id}`)
      )
    );
  } catch {
    // ignore cleanup errors
  }
}

async function ensureAuthenticated(page: Page): Promise<void> {
  const currentUrl = page.url();
  if (!currentUrl || currentUrl === 'about:blank') {
    await page.goto('/');
    await page.waitForSelector('app-root', { timeout: 10000 });
  }

  const isAlreadyAuthenticated = await page
    .evaluate(() => {
      if (typeof (window as any).isAuthenticatedForE2E === 'function') {
        return (window as any).isAuthenticatedForE2E() as boolean;
      }
      return false;
    })
    .catch(() => false);

  if (isAlreadyAuthenticated) return;

  await page.evaluate(async () => {
    if (typeof (window as any).signInAnonymouslyForE2E !== 'function') {
      throw new Error(
        'signInAnonymouslyForE2E not exposed on window. Check app.config.ts'
      );
    }
    await (window as any).signInAnonymouslyForE2E();
  });

  await page.waitForTimeout(1000);
}

async function ensureSourceColumnVisible(page: Page): Promise<void> {
  const header = page.getByRole('columnheader', { name: 'Quelle' });

  for (let i = 0; i < 3; i++) {
    if (await header.isVisible().catch(() => false)) return;
    await page.locator('button.toggle-source').click();
    await page.waitForTimeout(250);
  }

  await expect(header).toBeVisible();
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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeekMonday(date: Date): Date {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function parseDateInputValue(raw: string): Date {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  if (de) return new Date(Number(de[3]), Number(de[2]) - 1, Number(de[1]));

  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (us) return new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2]));

  throw new Error(`Unsupported date input format: "${raw}"`);
}

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
