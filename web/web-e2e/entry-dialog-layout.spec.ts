import { expect, test } from './fixtures/test-fixtures';

/**
 * The entry dialog is used on a phone far more than on a desktop, and its
 * rows are built from several form fields plus icon buttons. Squeezing them
 * onto one line was what left the fields at different widths and heights,
 * cut labels down to "Distan…", and scrolled the dialog sideways — none of
 * which a DOM-level unit test can see, since it takes real layout.
 */
test.describe('Training entry dialog on a phone @smoke', () => {
  test.use({ viewport: { width: 412, height: 850 } });

  test('lays every field out at the same height without sideways scroll', async ({
    landingPage,
    page,
  }) => {
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
      'guest sign-in unavailable — cannot reach the entry dialog'
    );

    await page
      .getByRole('button', { name: /schnellerfassung öffnen/i })
      .click();
    await page.getByRole('button', { name: /eigenen wert eingeben/i }).click();
    const content = page.locator('mat-dialog-content');
    await expect(content).toBeVisible();

    // The exercise autocomplete opens with the dialog's initial focus and
    // again after a pick — while it is up it covers the fields below, so
    // move focus off the field by clicking the dialog's title.
    const title = page.getByRole('heading', {
      name: /trainingseintrag anlegen/i,
    });
    await title.click();

    const exercise = page.getByTestId('training-entry-exercise');
    await exercise.fill('Laufen');
    await page
      .getByRole('option', { name: /^Laufen$/ })
      .first()
      .click();
    await title.click();
    await expect(page.locator('.mat-mdc-autocomplete-panel')).toHaveCount(0);

    const addInterval = page.getByRole('button', {
      name: /intervall hinzufügen/i,
    });
    await expect(addInterval).toBeVisible();
    await addInterval.click();
    await addInterval.click();
    await expect(page.locator('.interval-row')).toHaveCount(3);

    // A row fades in with a scaleY, and a transformed box measures short —
    // let the reveal finish before reading any geometry.
    await page.waitForFunction(() => {
      const el = document.querySelector('mat-dialog-content');
      return (
        !!el &&
        el
          .getAnimations({ subtree: true })
          .every((a) => a.playState !== 'running')
      );
    });

    const layout = await content.evaluate((el: HTMLElement) => {
      const box = (node: Element): DOMRect => node.getBoundingClientRect();
      const distinct = (values: number[]): number[] => [...new Set(values)];
      return {
        horizontalOverflow: el.scrollWidth - el.clientWidth,
        fieldHeights: distinct(
          Array.from(el.querySelectorAll('mat-form-field')).map((f) =>
            Math.round(box(f).height)
          )
        ),
        fieldWidths: distinct(
          Array.from(el.querySelectorAll('mat-form-field')).map((f) =>
            Math.round(box(f).width)
          )
        ),
        pairedRowTops: Array.from(el.querySelectorAll('.duration-row')).map(
          (row) =>
            distinct(
              Array.from(row.querySelectorAll(':scope > mat-form-field')).map(
                (f) => Math.round(box(f).top)
              )
            ).length
        ),
        clippedLabels: Array.from(el.querySelectorAll('.mdc-floating-label'))
          .filter((l) => l.scrollWidth > l.clientWidth + 1)
          .map((l) => (l.textContent ?? '').trim()),
      };
    });

    expect(layout.horizontalOverflow).toBe(0);
    // A Minuten/Sekunden pair shares one line, so one shared top edge.
    expect(layout.pairedRowTops.every((tops) => tops === 1)).toBe(true);
    // Full width or half of it — nothing squeezed to fit buttons beside it.
    expect(layout.fieldWidths).toHaveLength(2);
    expect(layout.fieldHeights).toHaveLength(1);
    expect(layout.clippedLabels).toEqual([]);
  });
});
