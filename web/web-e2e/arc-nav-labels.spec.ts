import { expect, test } from './fixtures/test-fixtures';

/**
 * The arc nav's labels sat in a box exactly one font-size tall
 * (`line-height: 1`) with `overflow: hidden` for the ellipsis. Horizontal
 * clipping is wanted; vertical clipping is not — the dots of a capital
 * umlaut sit above the cap height, so „Übungen" rendered as „Ubungen"
 * while the lowercase „ü" in „Liegestütztypen" right next to it survived.
 *
 * Only real layout can see this: the glyphs overflow their box as ink, not
 * as a scrollable area, so no DOM-level assertion in jsdom would catch it.
 */
test.describe('Arc nav labels @smoke', () => {
  test.use({ viewport: { width: 412, height: 850 } });

  test('gives every label room for the glyphs it renders', async ({ page }) => {
    // given the nav, which every visitor sees
    await page.goto('/');
    const nav = page.getByTestId('arc-nav');
    await expect(nav).toBeVisible();

    // when each label's box is compared with the height its own font needs
    // for a capital umlaut — measured in the label's own computed font, so
    // the check survives a font or size change
    const measured = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.textContent = 'ÜÄÖ';
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.lineHeight = 'normal';
      probe.style.whiteSpace = 'nowrap';
      document.body.append(probe);

      const labels = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="arc-nav"] .label'
        ),
      ];
      const clipped: string[] = [];
      for (const label of labels) {
        const style = getComputedStyle(label);
        // Set the parts, never the `font` shorthand — it carries a
        // line-height and would overwrite the `normal` that makes the probe
        // measure what the glyphs need rather than what the label allows.
        probe.style.fontFamily = style.fontFamily;
        probe.style.fontSize = style.fontSize;
        probe.style.fontWeight = style.fontWeight;
        if (label.clientHeight < probe.offsetHeight) {
          clipped.push(
            `${label.textContent?.trim()}: ${label.clientHeight}px box, ${probe.offsetHeight}px needed`
          );
        }
      }
      probe.remove();
      return { count: labels.length, clipped };
    });

    // then labels were actually measured — an empty set must not pass …
    expect(measured.count).toBeGreaterThan(0);
    // … and none of them crops its own ascenders
    expect(measured.clipped).toEqual([]);
  });

  test('keeps every item inside the strip it is clipped to', async ({
    page,
  }) => {
    // given the nav, with the strip out
    await page.goto('/');
    await expect(page.getByTestId('arc-nav')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    // A click, not a tap: this project drives a mouse, and it doubles as
    // the hover that holds the strip out.
    await page.getByTestId('arc-nav-grip').click();
    await page.waitForTimeout(500);

    // when each item is measured against the strip it is clipped to — the
    // top edge is an ellipse the items ride (`arcDrop`), so an item's room
    // above itself is measured against that curve, not against the box
    const overrun = await page.evaluate(() => {
      const nav = document.querySelector('[data-testid="arc-nav"]');
      if (!nav) {
        return null;
      }
      const box = nav.getBoundingClientRect();
      const rise = 28; // the border-radius' vertical radius
      const half = box.width / 2;
      const items = [...nav.querySelectorAll<HTMLElement>('.track a')];
      const tight: string[] = [];
      for (const item of items) {
        const rect = item.getBoundingClientRect();
        const centre = rect.left + rect.width / 2 - box.left;
        if (centre < 0 || centre > box.width) {
          continue; // a wrap clone, parked off to the side
        }
        const disc = item.querySelector('.disc')?.getBoundingClientRect();
        const label = item.querySelector('.label')?.getBoundingClientRect();
        if (!disc || !label) {
          continue;
        }
        const u = Math.min(1, Math.abs(centre - half) / half);
        const edge = rise * (1 - Math.sqrt(1 - u * u));
        const above = disc.top - box.top - edge;
        const below = box.bottom - label.bottom;
        // 7px and 0px: the strip that was too short left 5px above the
        // curve and put the label 5px past the bottom edge.
        if (above < 7 || below < 0) {
          tight.push(
            `${item.textContent?.trim()}: ${Math.round(above)}px above the edge, ${Math.round(below)}px below the label`
          );
        }
      }
      return { count: items.length, tight };
    });

    // then items were measured at all …
    expect(overrun).not.toBeNull();
    expect(overrun?.count).toBeGreaterThan(0);
    // … and none of them is grazed by the curved edge or runs out the
    // bottom, which is what a strip too short for its own scaled items did
    expect(overrun?.tight).toEqual([]);
  });
});
