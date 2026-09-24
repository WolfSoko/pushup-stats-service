import { expect, type Page } from '@playwright/test';

/** A queued celebration opens right after the one in front of it closes. */
const QUEUED_DIALOG_GRACE_MS = 800;

/**
 * Closes whatever is laid over the page, the way a user would.
 *
 * A Material dialog covers everything with a full-screen backdrop, so a
 * click on the toolbar or on the page behind it never lands — in CI that
 * showed up as a click waiting out its whole budget against
 * `cdk-overlay-dark-backdrop`. Which dialog it is does not matter to the
 * specs here; that it is in the way does.
 *
 * Celebrations queue (the XP dialog first, a goal reached right after),
 * so the page only counts as clear once no backdrop comes back within a
 * short grace period.
 */
export async function dismissOverlay(page: Page): Promise<void> {
  const backdrop = page.locator('.cdk-overlay-backdrop-showing');
  await expect(async () => {
    if ((await backdrop.count()) > 0) await page.keyboard.press('Escape');
    await expect(backdrop).toHaveCount(0, { timeout: 2_000 });
    await page.waitForTimeout(QUEUED_DIALOG_GRACE_MS);
    await expect(backdrop).toHaveCount(0, { timeout: 100 });
  }).toPass({ timeout: 20_000 });
}
