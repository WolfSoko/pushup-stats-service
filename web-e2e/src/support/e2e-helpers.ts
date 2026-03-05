import { expect, Page } from '@playwright/test';

const FIRESTORE_PROJECT_ID = 'pushup-stats';
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const FIRESTORE_EMULATOR_BASE = `http://127.0.0.1:8080/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

const TEST_USER_EMAIL = 'e2e-test@pushup-stats.dev';
const TEST_USER_PASSWORD = 'e2e-test-password-123';

type FirebaseAuthErrorResponse = {
  error?: {
    message?: string;
  };
};

type FirebaseAuthSuccessResponse = {
  localId?: string;
};

type E2EWindow = Window & {
  isAuthenticatedForE2E?: () => boolean;
  signInAnonymouslyForE2E?: () => Promise<void>;
};

export function firestoreDocUrl(path: string): string {
  return `${FIRESTORE_EMULATOR_BASE}/${path}`;
}

async function postAuthWithRetry(
  page: Page,
  path: string,
  data: object
): Promise<Awaited<ReturnType<Page['request']['post']>>> {
  let lastResp: Awaited<ReturnType<Page['request']['post']>> | null = null;

  for (let attempt = 1; attempt <= 4; attempt++) {
    const resp = await page.request.post(`${AUTH_EMULATOR_URL}/${path}`, {
      headers: { 'Content-Type': 'application/json' },
      data,
    });

    if (resp.status() !== 404) return resp;
    lastResp = resp;
    await page.waitForTimeout(250 * attempt);
  }

  if (!lastResp) {
    throw new Error(
      'Auth emulator request failed before receiving a response.'
    );
  }
  return lastResp;
}

export async function getOrCreateTestUserId(page: Page): Promise<string> {
  const signInResp = await postAuthWithRetry(
    page,
    'identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key',
    {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      returnSecureToken: true,
    }
  );

  if (signInResp.ok()) {
    const body = (await signInResp.json()) as FirebaseAuthSuccessResponse;
    if (!body.localId) {
      throw new Error('Auth sign-in succeeded but localId is missing.');
    }
    return body.localId;
  }

  const signInBodyText = await signInResp.text();
  let errorCode: string | undefined;
  try {
    const signInError = JSON.parse(signInBodyText) as FirebaseAuthErrorResponse;
    errorCode = signInError.error?.message;
  } catch {
    errorCode = signInBodyText || undefined;
  }

  if (
    errorCode !== 'EMAIL_NOT_FOUND' &&
    errorCode !== 'INVALID_LOGIN_CREDENTIALS'
  ) {
    throw new Error(
      `Auth sign-in failed unexpectedly (${signInResp.status()}): ${errorCode ?? 'unknown error'}`
    );
  }

  const signUpResp = await postAuthWithRetry(
    page,
    'identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key',
    {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      returnSecureToken: true,
    }
  );

  if (!signUpResp.ok()) {
    const signUpBodyText = await signUpResp.text();
    let signUpMessage = signUpBodyText;
    try {
      const signUpError = JSON.parse(
        signUpBodyText
      ) as FirebaseAuthErrorResponse;
      signUpMessage = signUpError.error?.message ?? signUpBodyText;
    } catch {
      // keep raw body
    }

    throw new Error(
      `Auth sign-up failed (${signUpResp.status()}): ${signUpMessage || 'unknown error'}`
    );
  }

  const body = (await signUpResp.json()) as FirebaseAuthSuccessResponse;
  if (!body.localId) {
    throw new Error('Auth sign-up succeeded but localId is missing.');
  }
  return body.localId;
}

export async function signInTestUser(page: Page): Promise<string> {
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

export async function seedPushup(
  page: Page,
  userId: string,
  data: { timestamp: string; reps: number; source: string }
): Promise<void> {
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

  if (!resp.ok()) {
    const body = await resp.text();
    throw new Error(`Failed to seed pushup (${resp.status()}): ${body}`);
  }
}

export async function cleanupPushupsBySource(
  page: Page,
  sources: Set<string>
): Promise<void> {
  try {
    const resp = await page.request.get(`${FIRESTORE_EMULATOR_BASE}/pushups`);
    if (!resp.ok()) return;
    const data = (await resp.json()) as {
      documents?: Array<{
        name: string;
        fields?: { source?: { stringValue?: string } };
      }>;
    };

    const ids = (data.documents ?? [])
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

export async function ensureAuthenticated(page: Page): Promise<void> {
  const currentUrl = page.url();
  if (!currentUrl || currentUrl === 'about:blank') {
    await page.goto('/');
    await page.waitForSelector('app-root', { timeout: 10000 });
  }

  const isAlreadyAuthenticated = await page
    .evaluate(() => {
      const e2eWindow = window as E2EWindow;
      return e2eWindow.isAuthenticatedForE2E?.() ?? false;
    })
    .catch(() => false);

  if (isAlreadyAuthenticated) return;

  await page.evaluate(async () => {
    const e2eWindow = window as E2EWindow;
    if (typeof e2eWindow.signInAnonymouslyForE2E !== 'function') {
      throw new Error(
        'signInAnonymouslyForE2E not exposed on window. Check app.config.ts'
      );
    }
    await e2eWindow.signInAnonymouslyForE2E();
  });

  await page.waitForTimeout(1000);
}

export async function ensureSourceColumnVisible(page: Page): Promise<void> {
  const header = page.getByRole('columnheader', { name: 'Quelle' });

  for (let i = 0; i < 3; i++) {
    if (await header.isVisible().catch(() => false)) return;
    await page.locator('button.toggle-source').click();
    await page.waitForTimeout(250);
  }

  await expect(header).toBeVisible();
}

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isoDateTime(date: Date, hh = 8, mm = 0): string {
  const base = new Date(date);
  base.setHours(hh, mm, 0, 0);
  return `${isoDate(base)}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfWeekMonday(date: Date): Date {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

export function parseDateInputValue(raw: string): Date {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  if (de) return new Date(Number(de[3]), Number(de[2]) - 1, Number(de[1]));

  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (us) return new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2]));

  throw new Error(`Unsupported date input format: "${raw}"`);
}
