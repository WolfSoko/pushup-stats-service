import { expect, test } from './fixtures/test-fixtures';

/**
 * On a wide mouse-driven viewport the strip parks below the bottom edge and
 * slides back in when the pointer approaches. Two things make this
 * untestable below the browser: the parked position is a CSS transform
 * behind a `(pointer: fine)` media query, and the reveal is driven by a
 * document-level pointermove — jsdom resolves neither the query nor the
 * geometry.
 */
test.describe('Arc nav auto-hide on a wide viewport @smoke', () => {
  test('should park the strip until the pointer comes near the bottom edge', async ({
    page,
  }) => {
    // given the nav on a desktop-width viewport
    await page.goto('/');
    const nav = page.getByTestId('arc-nav');
    await expect(nav).toBeVisible();

    const shownHeight = async (): Promise<number | null> => {
      const box = await nav.boundingBox();
      const viewport = page.viewportSize();
      if (!box || !viewport) {
        return null;
      }
      return Math.round(viewport.height - box.y);
    };

    // when the pointer sits far away from the bottom edge
    await page.mouse.move(640, 80);

    // then only the affordance sliver is left on screen
    await expect.poll(shownHeight).toBeLessThan(24);

    // and when the pointer comes down to the edge
    const viewport = page.viewportSize();
    await page.mouse.move(640, (viewport?.height ?? 720) - 8);

    // then the whole strip is back
    await expect.poll(shownHeight).toBeGreaterThan(60);
  });
});
