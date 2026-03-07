import { type Locator, type Page, expect } from '@playwright/test';

export class LandingPage {
  readonly heading: Locator;
  readonly signupCta: Locator;
  readonly loginCta: Locator;
  readonly dashboardCta: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {
      level: 1,
      name: /dein training\. klar visualisiert\./i,
    });
    this.signupCta = page.getByRole('link', { name: /jetzt registrieren/i });
    this.loginCta = page.getByRole('link', { name: /einloggen/i });
    this.dashboardCta = page.getByRole('link', { name: /zum dashboard/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.signupCta).toBeVisible();
    await expect(this.loginCta).toBeVisible();
    await expect(this.dashboardCta).toBeVisible();
  }
}
