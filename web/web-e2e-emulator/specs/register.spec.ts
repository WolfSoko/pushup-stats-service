import {
  accountExists,
  E2E_PASSWORD,
  uniqueIdentity,
} from '../support/backend';
import { DashboardPage } from '../support/pages/dashboard-page';
import { LoginPage } from '../support/pages/login-page';
import { expect, test } from '../support/test-fixtures';

test.describe('Registration', () => {
  test('should create an account through the stepper and open the dashboard', async ({
    registerPage,
    dashboardPage,
    page,
  }) => {
    // given
    const { email, displayName } = uniqueIdentity('register');
    await registerPage.goto();

    // when
    await registerPage.register(email, E2E_PASSWORD, displayName);

    // then
    await expect(registerPage.successPanel).toBeVisible({ timeout: 20_000 });
    expect(await accountExists(email)).toBe(true);

    await registerPage.toDashboardButton.click();
    await expect(page).toHaveURL(/\/app$/);
    await dashboardPage.expectLoaded();
  });

  test('should produce credentials that work on the login page', async ({
    registerPage,
    dashboardPage,
    browser,
  }) => {
    // given — a brand new account, registered in this browser
    const { email, displayName } = uniqueIdentity('register-login');
    await registerPage.goto();
    await registerPage.register(email, E2E_PASSWORD, displayName);
    await expect(registerPage.successPanel).toBeVisible({ timeout: 20_000 });
    await registerPage.toDashboardButton.click();
    await dashboardPage.expectLoaded();

    // when — someone signs in with them from a session that never saw
    // the registration (a second device, in effect)
    const otherDevice = await browser.newContext({ locale: 'de-DE' });
    try {
      const page = await otherDevice.newPage();
      await new LoginPage(page).signIn({
        uid: '',
        email,
        password: E2E_PASSWORD,
        displayName,
      });

      // then
      await expect(page).toHaveURL(/\/app$/);
      await new DashboardPage(page).expectLoaded();
    } finally {
      await otherDevice.close();
    }
  });

  test('should refuse to submit while the username is too short', async ({
    registerPage,
  }) => {
    // given
    const { email } = uniqueIdentity('register-invalid');
    await registerPage.goto();
    await registerPage.fillCredentials(email, E2E_PASSWORD);

    // when
    await registerPage.usernameInput.fill('x');

    // then
    await expect(registerPage.usernameError).toBeVisible();
    await expect(registerPage.submitButton).toBeDisabled();
    expect(await accountExists(email)).toBe(false);
  });
});
