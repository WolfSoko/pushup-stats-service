import { expect, type Page } from '@playwright/test';

/**
 * Closes whatever is laid over the page, the way a user would.
 *
 * A Material dialog covers everything with a full-screen backdrop, so a
 * click on the toolbar or on the page behind it never lands — in CI that
 * showed up as a click waiting out its whole budget against
 * `cdk-overlay-dark-backdrop`. Which dialog it is does not matter to the
 * specs here; that it is in the way does.
 */
export async function dismissOverlay(page: Page): Promise<void> {
  const backdrop = page.locator('.cdk-overlay-backdrop-showing');
  if ((await backdrop.count()) === 0) return;
  await page.keyboard.press('Escape');
  await expect(backdrop).toHaveCount(0, { timeout: 10_000 });
}
