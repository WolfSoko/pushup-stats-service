import { type Locator, type Page, expect } from '@playwright/test';

export class RegisterPage {
  readonly title: Locator;
  readonly emailInput: Locator;
  readonly nextButton: Locator;
  readonly googleButton: Locator;
  readonly successMessage: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByText('Registrierung');
    // The stepper email step uses matInput inside a mat-form-field
    this.emailInput = page.locator('input[type="email"]').first();
    this.nextButton = page.getByRole('button', { name: /weiter/i }).first();
    this.googleButton = page.getByRole('button', {
      name: /mit google registrieren/i,
    });
    this.successMessage = page.locator('pus-register-success');
  }

  async goto(): Promise<void> {
    await this.page.goto('/register');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.title).toBeVisible();
    await expect(this.nextButton).toBeVisible();
  }

  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  /** Fill step 1: enter email, then advance to the password step. */
  async fillStep1(email: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.nextButton.click();
  }

  /** Fill step 2: enter matching passwords, then advance. */
  async fillStep2(password: string, repeatPassword: string): Promise<void> {
    await this.page.getByLabel(/^Passwort$/i).fill(password);
    await this.page.getByLabel(/passwort wiederholen/i).fill(repeatPassword);
    await this.nextButton.click();
  }

  async expectSuccess(): Promise<void> {
    await expect(this.successMessage).toBeVisible();
  }
}
