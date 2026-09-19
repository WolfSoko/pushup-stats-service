import { expect, type Locator, type Page } from '@playwright/test';

export class DashboardPage {
  readonly heading: Locator;
  readonly userMenuTrigger: Locator;
  readonly signOutItem: Locator;
  /** The menu an anonymous visitor gets — how a sign-out becomes visible. */
  readonly anonMenuTrigger: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {
      level: 1,
      name: 'Meine Trainingsübersicht',
    });
    this.userMenuTrigger = page.getByRole('button', {
      name: 'Nutzerkonto-Menü',
    });
    this.signOutItem = page.getByRole('menuitem', { name: /abmelden/i });
    this.anonMenuTrigger = page.getByRole('button', { name: 'Anmelde-Menü' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/app');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Signs out and waits until the session is really gone. Logging out
   * does not navigate — the nav menu swapping to its anonymous form is
   * the first observable sign that auth has cleared, and without waiting
   * for it the next sign-in can race the old session.
   */
  async signOut(): Promise<void> {
    await this.userMenuTrigger.click();
    await this.signOutItem.click();
    await expect(this.anonMenuTrigger).toBeVisible({ timeout: 30_000 });
  }
}
