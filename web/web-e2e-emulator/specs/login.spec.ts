import { accountExists, createAccount } from '../support/emulator';
import { expect, test } from '../support/test-fixtures';

test.describe('Login', () => {
  test('should sign an existing account in and land on the dashboard', async ({
    loginPage,
    dashboardPage,
    page,
  }) => {
    // given
    const user = await createAccount('login');

    // when
    await loginPage.signIn(user);

    // then
    await expect(page).toHaveURL(/\/app$/);
    await dashboardPage.expectLoaded();
  });

  test('should refuse a wrong password and stay on the login page', async ({
    loginPage,
    page,
  }) => {
    // given
    const user = await createAccount('login-wrong');
    await loginPage.goto();

    // when
    await loginPage.fillCredentials(user.email, 'Wrong!Password1');
    await loginPage.submitButton.click();

    // then
    await expect(loginPage.error).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('should refuse an address that has no account', async ({
    loginPage,
    page,
  }) => {
    // given
    const email = 'nobody-here@e2e.test';
    expect(await accountExists(email)).toBe(false);
    await loginPage.goto();

    // when
    await loginPage.fillCredentials(email, 'Whatever!123');
    await loginPage.submitButton.click();

    // then
    await expect(loginPage.error).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('should sign out again and lock the dashboard behind the guard', async ({
    loginPage,
    dashboardPage,
    page,
  }) => {
    // given
    await loginPage.signIn(await createAccount('logout'));
    await dashboardPage.expectLoaded();

    // when
    await dashboardPage.signOut();

    // then — the auth guard sends a signed-out visitor to the login page
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  });
});
