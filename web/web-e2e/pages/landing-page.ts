import { type Locator, type Page, expect } from '@playwright/test';

export class LandingPage {
  readonly heading: Locator;
  readonly signupCta: Locator;
  readonly loginCta: Locator;
  readonly guestCta: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {
      level: 1,
      name: /dein training\. klar visualisiert\./i,
    });
    this.signupCta = page.getByRole('link', { name: /jetzt registrieren/i });
    this.loginCta = page.getByRole('link', { name: /einloggen/i });
    this.guestCta = page.getByRole('button', {
      name: /als gast ausprobieren/i,
    });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.signupCta).toBeVisible();
    await expect(this.loginCta).toBeVisible();
    await expect(this.guestCta).toBeVisible();
  }
}
