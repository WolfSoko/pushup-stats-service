import { expect, test } from './fixtures/test-fixtures';

/**
 * A quick add used to confirm with a snackbar, which was lifted clear of the arc nav by a `max-width: 767px` rule,
 * written as if the strip were a mobile-only bottom nav. It is not — it is
 * fixed to the bottom edge on every viewport, and a landscape phone is wide
 * enough to fall outside that breakpoint while still being short enough for
 * the strip to eat a quarter of the screen. Dropping the TWA's portrait lock
 * is what made that viewport reachable.
 *
 * Only real layout can see this: both elements are `position: fixed`, so the
 * overlap exists in geometry, not anywhere in the DOM tree.
 */
test.describe('App shell on a landscape phone @smoke', () => {
  test.use({ viewport: { width: 850, height: 412 } });

  test('should keep a quick-add confirmation clear of the arc nav', async ({
    landingPage,
    page,
  }) => {
    // given a guest on a landscape phone
    await landingPage.goto();
    await landingPage.guestCta.click();

    // The CTA navigates to /app whether or not the anonymous sign-in behind
    // it succeeded, and the route guard bounces a signed-out visitor back to
    // /login. Skip rather than fail there: this suite gates the production
    // deploy, and a Firebase auth outage says nothing about the layout.
    await page.waitForURL(/(\/app|\/login)/, { timeout: 30_000 });

    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
      /\/login/.test(page.url()),
      'guest sign-in unavailable — cannot reach the quick add'
    );

    // when the speed dial opens, every one of its buttons is reachable —
    // the stack grows upward from the bottom edge and used to run off the
    // top of a 412px-tall viewport
    await page
      .getByRole('button', { name: /schnellerfassung öffnen/i })
      .click();

    const offscreen = await page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll('.dial-actions > *')
      );
      return buttons
        .map((el) => ({
          label: el.getAttribute('aria-label') ?? '',
          top: Math.round(el.getBoundingClientRect().top),
        }))
        .filter((b) => b.top < 0);
    });
    expect(offscreen).toEqual([]);

    // and a quick add reports back with the XP dialog
    await page.locator('.quick-fab').first().click();

    const dialog = page.locator('.xp-gained-dialog-panel');
    await expect(dialog).toBeVisible();

    // then the dialog fits the short landscape viewport — its CTA must not
    // end up below the fold where the arc nav sits
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
      viewport?.height ?? 0
    );
  });
});
