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

  /**
   * Enter a valid email into step 1 and wait until the signal form registers
   * it (the "Weiter" button enabling is the observable proof).
   *
   * The register form is server-rendered and hydrates after load; a `.fill()`
   * that lands before hydration is dropped by the signal form, leaving the
   * next button stuck disabled. Re-entering the value inside `toPass` retries
   * across the hydration window, so the flow is robust on slow CI runners.
   * Only call with a valid email — an invalid one never enables the button.
   */
  async fillEmail(email: string): Promise<void> {
    await expect(async () => {
      await this.emailInput.fill('');
      await this.emailInput.fill(email);
      await expect(this.emailInput).toHaveValue(email);
      await expect(this.nextButton).toBeEnabled({ timeout: 750 });
    }).toPass({ timeout: 15_000 });
  }

  /** Fill step 1: enter email, then advance to the password step. */
  async fillStep1(email: string): Promise<void> {
    await this.fillEmail(email);
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
