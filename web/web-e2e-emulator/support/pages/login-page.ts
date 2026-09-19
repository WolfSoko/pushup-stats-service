import { expect, type Locator, type Page } from '@playwright/test';

import type { E2eAccount } from '../backend';

import { appPath } from '../routes';

export class LoginPage {
  readonly title: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByText('Willkommen bei Pushup Tracker');
    this.emailInput = page.getByLabel(/e-mail/i);
    this.passwordInput = page.getByLabel(/passwort/i).first();
    this.submitButton = page.getByRole('button', {
      name: 'Anmelden',
      exact: true,
    });
    this.error = page.locator('.error-message');
  }

  async goto(): Promise<void> {
    await this.page.goto(appPath('/login'));
    await expect(this.title).toBeVisible();
  }

  /**
   * Fills the form and submits it, retrying the fill until the submit
   * button enables.
   *
   * The page is server-rendered and the signal form only starts taking
   * values once it has hydrated; a `fill()` that lands before that is
   * dropped and leaves the button disabled forever. Re-entering inside
   * `toPass` rides out the hydration window — the same trick the
   * register page in `web/web-e2e` needs, for the same reason.
   */
  async fillCredentials(email: string, password: string): Promise<void> {
    await expect(async () => {
      await this.emailInput.fill(email);
      await this.passwordInput.fill(password);
      await expect(this.submitButton).toBeEnabled({ timeout: 1000 });
    }).toPass({ timeout: 20_000 });
  }

  /** Signs in and waits until the app has left the login page. */
  async signIn(account: E2eAccount): Promise<void> {
    await this.goto();
    await this.fillCredentials(account.email, account.password);
    await this.submitButton.click();
    await this.page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 20_000,
    });
  }
}
