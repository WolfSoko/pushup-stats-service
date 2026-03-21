import { type Locator, type Page, expect } from '@playwright/test';

export class LoginPage {
  readonly title: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly googleButton: Locator;
  readonly registerLink: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByText('Willkommen bei PushUp Stats');
    this.emailInput = page.getByLabel(/e-mail/i);
    this.passwordInput = page.getByLabel(/passwort/i).first();
    this.submitButton = page.getByRole('button', { name: /anmelden/i });
    this.googleButton = page.getByRole('button', {
      name: /mit google anmelden/i,
    });
    this.registerLink = page.getByRole('button', { name: /registrieren/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.title).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.googleButton).toBeVisible();
  }

  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async expectError(): Promise<void> {
    await expect(this.page.locator('.error-message')).toBeVisible();
  }
}
