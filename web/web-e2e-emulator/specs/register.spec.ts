import {
  accountExists,
  E2E_PASSWORD,
  uniqueIdentity,
} from '../support/emulator';
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
    loginPage,
    dashboardPage,
    page,
  }) => {
    // given — a brand new account, registered and then signed out
    const { email, displayName } = uniqueIdentity('register-login');
    await registerPage.goto();
    await registerPage.register(email, E2E_PASSWORD, displayName);
    await expect(registerPage.successPanel).toBeVisible({ timeout: 20_000 });
    await registerPage.toDashboardButton.click();
    await dashboardPage.expectLoaded();
    await dashboardPage.signOut();

    // when
    await loginPage.signIn({
      uid: '',
      email,
      password: E2E_PASSWORD,
      displayName,
    });

    // then
    await expect(page).toHaveURL(/\/app$/);
    await dashboardPage.expectLoaded();
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
