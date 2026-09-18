import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/test-fixtures';

/**
 * The arc nav's ends run out into nothing over `--edge-fade`, a share of
 * the strip's own width. A flat share made a phone, where the strip is the
 * viewport, fade over nearly half an item at each end.
 *
 * Only a browser can answer what that share comes out as. The value is a
 * `clamp()` over a percentage, so it means nothing without a strip to
 * resolve against, and the compiled stylesheet is no help either: the
 * build inlines the custom property into the mask that uses it, so there
 * is no declaration left to read. A probe that inherits the property turns
 * it into a width, and a width can be measured.
 */
async function edgeFade(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const nav = document.querySelector('[data-testid="arc-nav"]');
    if (!nav) {
      return null;
    }
    const probe = document.createElement('div');
    // Static, so the percentage resolves against the strip itself — the
    // same box the mask's percentage does. Absolute would resolve against
    // the host, which spans the viewport.
    probe.style.cssText =
      'width: var(--edge-fade); height: 0; overflow: hidden';
    nav.append(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return Math.round(width);
  });
}

test.describe('Arc nav edge fade on a phone @smoke', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('should fade the ends over about a quarter of an item', async ({
    page,
  }) => {
    // given the nav on a phone-width viewport
    await page.goto('/');
    await expect(page.getByTestId('arc-nav')).toBeVisible();

    // then the ends run out well short of the 39px — nearly half an item
    // — that a flat 10% of the strip used to take
    const fade = await edgeFade(page);
    expect(fade).not.toBeNull();
    expect(fade).toBeGreaterThan(14);
    expect(fade).toBeLessThan(26);
  });
});

test.describe('Arc nav edge fade on a desktop window @smoke', () => {
  test('should fade the ends over three quarters of an item, as before', async ({
    page,
  }) => {
    // given the nav on the default desktop viewport, where the strip is at
    // its full width
    await page.goto('/');
    await expect(page.getByTestId('arc-nav')).toBeVisible();

    // then the fade is the one it always was — this end was not the one
    // that was wrong
    expect(await edgeFade(page)).toBe(66);
  });
});
