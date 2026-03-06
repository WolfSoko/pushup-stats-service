import { expect, test } from '@playwright/test';
import {
  ensureAuthenticated,
  firestoreDocUrl,
  signInTestUser,
} from './support/e2e-helpers';

test('settings page is reachable from navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await signInTestUser(page);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Liegestütze Statistik' })
  ).toBeVisible();

  await page.getByRole('button', { name: /menü öffnen|open menu/i }).click();

  const settingsLink = page
    .locator('a[routerlink="/settings"], a[href$="/settings"]')
    .first();

  await settingsLink.scrollIntoViewIfNeeded();
  await expect(settingsLink).toBeVisible();
  await settingsLink.click({ force: true });

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText('User-Profil & Tagesziel')).toBeVisible();
});

test('settings persist user config in firestore emulator', async ({ page }) => {
  await ensureAuthenticated(page);

  const runId = Date.now().toString(36);
  const displayName = `Wolf-${runId}`;
  const dailyGoal = 137;

  const userId = await signInTestUser(page);
  await page.goto('/settings');

  await page.getByLabel('Anzeigename').fill(displayName);
  await page.getByLabel('Tagesziel (Reps)').fill(String(dailyGoal));
  await page.getByLabel('In Bestenliste anzeigen').uncheck();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Gespeichert.')).toBeVisible();

  const emulatorDoc = await page.request.get(
    firestoreDocUrl(`userConfigs/${userId}`)
  );
  expect(emulatorDoc.ok()).toBeTruthy();

  const payload = (await emulatorDoc.json()) as {
    fields?: {
      displayName?: { stringValue?: string };
      dailyGoal?: { integerValue?: string };
      ui?: {
        mapValue?: {
          fields?: {
            hideFromLeaderboard?: { booleanValue?: boolean };
          };
        };
      };
    };
  };

  expect(payload.fields?.displayName?.stringValue).toBe(displayName);
  expect(Number(payload.fields?.dailyGoal?.integerValue ?? '0')).toBe(
    dailyGoal
  );
  expect(
    payload.fields?.ui?.mapValue?.fields?.hideFromLeaderboard?.booleanValue
  ).toBe(true);
});
