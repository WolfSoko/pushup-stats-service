import { expect, test } from './fixtures/test-fixtures';

test.describe('Auth pages smoke', () => {
  test('login page renders essentials', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('Willkommen bei PushUp Stats')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /mit google anmelden/i })
    ).toBeVisible();
  });

  test('register page renders essentials', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByText('Registrierung')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Weiter' }).first()
    ).toBeVisible();
  });
});
