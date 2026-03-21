import { expect, test } from './fixtures/test-fixtures';

test.describe('Login page', () => {
  test('renders essential structure @smoke', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.expectLoaded();
  });

  test('shows Google sign-in button', async ({ loginPage }) => {
    await loginPage.goto();
    await expect(loginPage.googleButton).toBeVisible();
  });

  test('submit button is disabled with empty fields', async ({ loginPage }) => {
    await loginPage.goto();
    await expect(loginPage.submitButton).toBeDisabled();
  });

  test('submit button is disabled with invalid email', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.fillEmail('not-an-email');
    await loginPage.fillPassword('password123');
    await expect(loginPage.submitButton).toBeDisabled();
  });

  test('register link is visible', async ({ loginPage }) => {
    await loginPage.goto();
    await expect(loginPage.registerLink).toBeVisible();
  });
});

test.describe('Register page', () => {
  test('renders essential structure @smoke', async ({ registerPage }) => {
    await registerPage.goto();
    await registerPage.expectLoaded();
  });

  test('shows Google registration button', async ({ registerPage }) => {
    await registerPage.goto();
    await expect(registerPage.googleButton).toBeVisible();
  });

  test('email input is visible and accepts input', async ({ registerPage }) => {
    await registerPage.goto();
    await expect(registerPage.emailInput).toBeVisible();
    await registerPage.fillEmail('test@example.com');
    await expect(registerPage.emailInput).toHaveValue('test@example.com');
  });

  test('next button advances stepper with valid email', async ({
    registerPage,
    page,
  }) => {
    await registerPage.goto();
    await registerPage.fillEmail('test@example.com');
    await registerPage.nextButton.click();
    // After advancing, password step should appear
    await expect(page.getByLabel(/^Passwort$/i)).toBeVisible();
  });
});
