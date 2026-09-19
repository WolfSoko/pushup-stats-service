import { expect, type Locator, type Page } from '@playwright/test';

import { appPath } from '../routes';

/** The three-step registration stepper: e-mail, password, username. */
export class RegisterPage {
  readonly title: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly repeatPasswordInput: Locator;
  readonly usernameInput: Locator;
  readonly usernameError: Locator;
  readonly nextButton: Locator;
  readonly submitButton: Locator;
  readonly successPanel: Locator;
  readonly toDashboardButton: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByText('Registrierung', { exact: true });
    this.emailInput = page.locator('input[type="email"]').first();
    this.passwordInput = page.getByLabel(/^Passwort$/i);
    this.repeatPasswordInput = page.getByLabel(/passwort wiederholen/i);
    this.usernameInput = page.getByRole('textbox', {
      name: 'Benutzername',
      exact: true,
    });
    this.usernameError = page.getByTestId('register-displayname-error');
    this.nextButton = page.getByRole('button', { name: /weiter/i }).first();
    this.submitButton = page.getByRole('button', {
      name: 'Registrieren',
      exact: true,
    });
    this.successPanel = page.locator('pus-register-success');
    this.toDashboardButton = page.getByTestId('register-success-dashboard');
  }

  async goto(): Promise<void> {
    await this.page.goto(appPath('/register'));
    await expect(this.title).toBeVisible();
  }

  /**
   * Types the address and waits for the signal form to acknowledge it.
   * The page is server-rendered and the form only takes values once it
   * has hydrated; a `fill()` that lands before that is dropped and the
   * "Weiter" button stays disabled. Its enabling is the observable proof
   * the value arrived, so the fill is retried until then.
   */
  async fillEmail(email: string): Promise<void> {
    await expect(async () => {
      await this.emailInput.fill('');
      await this.emailInput.fill(email);
      await expect(this.emailInput).toHaveValue(email);
      await expect(this.nextButton).toBeEnabled({ timeout: 1000 });
    }).toPass({ timeout: 20_000 });
  }

  /** Walks the first two steps, stopping on the username step. */
  async fillCredentials(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.nextButton.click();

    await expect(this.passwordInput).toBeVisible();
    await this.passwordInput.fill(password);
    await this.repeatPasswordInput.fill(password);
    // The password step's own "Weiter" — the e-mail step's is still in
    // the DOM behind the stepper, and `.first()` would hit that one.
    await this.page
      .getByRole('button', { name: /weiter/i })
      .last()
      .click();
    await expect(this.usernameInput).toBeVisible();
  }

  /** Walks all three steps and submits. */
  async register(
    email: string,
    password: string,
    username: string
  ): Promise<void> {
    await this.fillCredentials(email, password);
    await this.usernameInput.fill(username);
    await expect(this.submitButton).toBeEnabled();
    await this.submitButton.click();
  }
}
