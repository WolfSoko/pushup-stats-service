import { expect, type Locator, type Page } from '@playwright/test';

import { dismissOverlay } from '../overlay';

import { appPath } from '../routes';

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
    await this.page.goto(appPath('/app'));
  }

  /**
   * Waits until the dashboard is the page in front of the user.
   *
   * The "what's new" walkthrough (`FeatureAnnouncementService`) opens
   * over the dashboard for an account that has not seen it yet, and
   * Material marks everything behind a dialog `aria-hidden` — which is
   * the tree a role locator reads, so the heading is simply gone while
   * the dialog is up. It opens once the user config has arrived, which
   * against a real backend can be after the first look: dismissing and
   * checking is therefore retried instead of done once.
   */
  async expectLoaded(): Promise<void> {
    await expect(async () => {
      await dismissOverlay(this.page);
      await expect(this.heading).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
  }

  /**
   * Signs out and waits until the session is really gone.
   *
   * Opening the menu is retried because the toolbar is only reachable
   * while nothing is laid over it: a Material dialog covers the page
   * with a full-screen backdrop, and in CI a click on the user menu
   * waited out its whole budget against `cdk-overlay-dark-backdrop`
   * instead of ever landing. Signing out does not navigate, so the nav
   * menu swapping to its anonymous form is the first observable sign
   * that auth has cleared — without waiting for it the next sign-in can
   * race the old session.
   */
  async signOut(): Promise<void> {
    await expect(async () => {
      await dismissOverlay(this.page);
      await this.userMenuTrigger.click({ timeout: 5_000 });
      await expect(this.signOutItem).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    await this.signOutItem.click();
    await expect(this.anonMenuTrigger).toBeVisible({ timeout: 20_000 });
  }
}
