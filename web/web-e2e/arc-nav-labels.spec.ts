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
});
