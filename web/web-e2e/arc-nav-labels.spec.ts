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
    // given the nav, held out by a pointer resting at the bottom edge —
    // not by its grip, which stops taking pointer events the moment the
    // strip is out and would hand the click a moving target
    await page.goto('/');
    await expect(page.getByTestId('arc-nav')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(206, 845);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const strip = document.querySelector('[data-testid="arc-nav"]');
          return strip
            ? Math.round(window.innerHeight - strip.getBoundingClientRect().y)
            : 0;
        })
      )
      .toBeGreaterThan(60);

    // when each item is measured against the strip it is clipped to. The
    // top edge is an ellipse the items ride (`arcDrop`), so the room an
    // item keeps above itself is measured against that curve rather than
    // against the box — and from the same untransformed offsets the
    // component measures, since the tilt swings a transformed rect sideways.
    const fit = await page.evaluate(() => {
      const strip = document.querySelector('[data-testid="arc-nav"]');
      const track = strip?.querySelector<HTMLElement>('.track');
      if (!strip || !track) {
        return null;
      }
      const box = strip.getBoundingClientRect();
      const rise = Number.parseFloat(
        getComputedStyle(strip).getPropertyValue('--arc-rise')
      );
      const half = track.clientWidth / 2;
      // The curve climbs across an item, so the tightest point of a disc is
      // its inner side, not its middle.
      const edgeAt = (offset: number) => {
        const u = Math.min(1, Math.abs(offset) / half);
        return rise * (1 - Math.sqrt(1 - u * u));
      };
      const middle = track.scrollLeft + half;
      const tight: string[] = [];
      let measured = 0;
      for (const item of track.querySelectorAll<HTMLElement>('a')) {
        const dx = item.offsetLeft + item.offsetWidth / 2 - middle;
        if (Math.abs(dx) > half) {
          continue; // a wrap clone, waiting off to the side
        }
        const disc = item.querySelector('.disc')?.getBoundingClientRect();
        const label = item.querySelector('.label')?.getBoundingClientRect();
        if (!disc || !label) {
          continue;
        }
        measured += 1;
        const reach = (disc.width / 2) * Math.sign(dx || 1);
        const edge = Math.min(edgeAt(dx - reach), edgeAt(dx + reach));
        const above = disc.top - box.top - edge;
        const below = box.bottom - label.bottom;
        // Measured on the strip that was too short, the tightest item had
        // about 2px over the curve and put its label 5px past the bottom
        // edge; with room it keeps over 6px and stays inside.
        if (above < 5 || below < 0) {
          tight.push(
            `${item.textContent?.trim()}: ${Math.round(above)}px above the edge, ${Math.round(below)}px below the label`
          );
        }
      }
      return { measured, tight };
    });

    // then items were actually measured — an empty set must not pass …
    expect(fit).not.toBeNull();
    expect(fit?.measured).toBeGreaterThan(2);
    // … and none of them is grazed by the curved edge or runs out the
    // bottom, which is what a strip too short for its own scaled items did
    expect(fit?.tight).toEqual([]);
  });
});
