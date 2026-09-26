import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/test-fixtures';

/** How much of the strip is on screen: its top edge, from the bottom up. */
async function shownHeight(page: Page): Promise<number | null> {
  const box = await page.getByTestId('arc-nav').boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) {
    return null;
  }
  return Math.round(viewport.height - box.y);
}

/**
 * The strip parks below the bottom edge once the grace period it gets on
 * startup has run out, and comes back on a mouse near the edge or — where
 * there is no hover — an upward drag from it. Little of that is testable
 * below the browser: the parked position is a CSS transform, the reveal is
 * driven by document-level pointer and touch events, and jsdom resolves
 * neither the geometry nor a real touch.
 */
test.describe('Arc nav auto-hide on a wide viewport @smoke', () => {
  test('should park the strip until the pointer comes near the bottom edge', async ({
    page,
  }) => {
    // given the nav on a desktop-width viewport
    await page.goto('/');
    const nav = page.getByTestId('arc-nav');
    await expect(nav).toBeVisible();

    // when the pointer sits far away from the bottom edge
    await page.mouse.move(640, 80);

    // then the strip parks once its startup grace period is over, leaving
    // only the affordance sliver on screen
    await expect
      .poll(() => shownHeight(page), { timeout: 15_000 })
      .toBeLessThan(24);

    // and when the pointer comes down to the edge
    const viewport = page.viewportSize();
    await page.mouse.move(640, (viewport?.height ?? 720) - 8);

    // then the whole strip is back
    await expect.poll(() => shownHeight(page)).toBeGreaterThan(60);
  });
});

test.describe('Arc nav auto-hide on a phone @smoke', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('should park the strip and bring it back on an upward drag from the bottom edge', async ({
    page,
  }) => {
    // given the nav on a touch viewport
    await page.goto('/');
    const nav = page.getByTestId('arc-nav');
    await expect(nav).toBeVisible();

    // then it parks once the startup grace period is over — Regression: a
    // phone used to keep the strip pinned, spending a row of a small screen
    // on navigation for the whole session
    await expect
      .poll(() => shownHeight(page), { timeout: 15_000 })
      .toBeLessThan(24);

    // when a finger lands on the bottom edge and pulls upward. Playwright
    // drives taps, not drags, so the gesture is dispatched in the page.
    const pullUp = async (): Promise<number | null> => {
      await page.evaluate(() => {
        const startY = window.innerHeight - 4;
        const gesture = (type: string, clientY: number): TouchEvent => {
          const point = new Touch({
            identifier: 1,
            target: document.body,
            clientX: 40,
            clientY,
          });
          return new TouchEvent(type, {
            touches: type === 'touchend' ? [] : [point],
            changedTouches: [point],
            bubbles: true,
            cancelable: true,
          });
        };
        document.body.dispatchEvent(gesture('touchstart', startY));
        document.body.dispatchEvent(gesture('touchmove', startY - 60));
        document.body.dispatchEvent(gesture('touchend', startY - 60));
      });
      return shownHeight(page);
    };

    // then the whole strip is back. The pull is repeated on every attempt:
    // what it buys expires after AUTO_HIDE_DELAY_MS, so a runner that
    // stalls once would otherwise measure a strip that has parked again.
    await expect.poll(pullUp, { timeout: 15_000 }).toBeGreaterThan(60);
  });

  test('should not scroll the strip vertically when it is pulled back up', async ({
    page,
    context,
  }) => {
    // given the parked strip on a touch viewport
    await page.goto('/');
    await expect(page.getByTestId('arc-nav')).toBeVisible();
    await expect
      .poll(() => shownHeight(page), { timeout: 15_000 })
      .toBeLessThan(24);

    // when a real finger pulls it up from the bottom edge. Dispatched
    // TouchEvents never scroll anything, so the drag goes through CDP.
    const height = page.viewportSize()?.height ?? 844;
    const cdp = await context.newCDPSession(page);
    const touch = (type: string, y: number | null) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: y === null ? [] : [{ x: 200, y }],
      });
    await touch('touchStart', height - 4);
    for (let step = 1; step <= 10; step++) {
      await touch('touchMove', height - 4 - step * 8);
    }
    await touch('touchEnd', null);
    await expect.poll(() => shownHeight(page)).toBeGreaterThan(60);

    // then the track has not moved vertically — Regression: the items
    // overflow its bottom, `overflow-y: visible` computed to `auto`, and the
    // pull scrolled the track up and cut the items off at the curved edge
    const scrollTop = await page
      .getByTestId('arc-nav')
      .locator('.track')
      .evaluate((track) => track.scrollTop);
    expect(scrollTop).toBe(0);
  });

  test('should leave a grip standing above the parked strip, and come back on a tap', async ({
    page,
  }) => {
    // given the parked nav
    await page.goto('/');
    await expect(page.getByTestId('arc-nav')).toBeVisible();
    await expect
      .poll(() => shownHeight(page), { timeout: 15_000 })
      .toBeLessThan(24);

    // then the grip is still on screen, standing on the sliver rather than
    // parking with the rest of the strip
    const grip = page.getByTestId('arc-nav-grip');
    const box = await grip.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) {
      throw new Error('the grip was not laid out');
    }
    expect(Math.round(viewport.height - box.y)).toBeGreaterThan(20);
    expect(Math.round(viewport.height - box.y)).toBeLessThan(40);

    // and when it is taken hold of — once. The grip stops taking pointer
    // events the moment the strip is out, so a second tap would wait for
    // it to become actionable again, which only happens once the strip has
    // parked: tapping per attempt, the way the pull above is repeated,
    // would measure a parked strip forever.
    await grip.tap();

    // then the strip comes in. It slides, so the height is polled rather
    // than read: it passes 57px at 100ms and is whole at 200ms.
    await expect
      .poll(() => shownHeight(page), { timeout: 15_000 })
      .toBeGreaterThan(60);
  });
});
