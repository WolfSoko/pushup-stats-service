import { expect, test } from './fixtures/test-fixtures';
import type { Page } from '@playwright/test';

/**
 * Records the <html> class value after every class mutation, starting before
 * any page script runs. The boot script's own change is the first entry;
 * a dark→light flip before Angular boots would show up as an entry carrying
 * the wrong theme class.
 */
async function recordHtmlClassHistory(
  page: Page,
  storedMode: 'light' | 'dark'
): Promise<void> {
  await page.addInitScript((mode) => {
    localStorage.setItem('theme-mode', mode);
    const history: string[] = [];
    (
      window as unknown as { __themeClassHistory: string[] }
    ).__themeClassHistory = history;
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.target === document.documentElement) {
          history.push(document.documentElement.className);
        }
      }
    }).observe(document, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    });
  }, storedMode);
}

const OTHER_THEME_CLASS = { light: 'dark-theme', dark: 'light-theme' } as const;

test.describe('Theme boot', () => {
  for (const mode of ['light', 'dark'] as const) {
    test(`applies the stored ${mode} theme before first paint and never flips`, async ({
      page,
      landingPage,
    }) => {
      await recordHtmlClassHistory(page, mode);

      await landingPage.goto();
      await landingPage.expectLoaded();
      await expect(page.locator('app-theme-toggle button')).toBeVisible();

      const history = await page.evaluate(
        () =>
          (window as unknown as { __themeClassHistory: string[] })
            .__themeClassHistory
      );
      const other = OTHER_THEME_CLASS[mode];
      expect(history[0]).toContain(`${mode}-theme`);
      expect(history.some((value) => value.includes(other))).toBe(false);
      await expect(page.locator('html')).toHaveClass(
        new RegExp(`${mode}-theme`)
      );
    });
  }
});
