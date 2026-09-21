import { expect, test } from './fixtures/test-fixtures';
import type { Page } from '@playwright/test';

/**
 * Records every `class` value the <html> element carries, starting before
 * any page script runs, so a dark→light flip between first paint and
 * Angular's boot shows up as a class value without the stored theme.
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
    const root = document.documentElement;
    history.push(root.className);
    new MutationObserver(() => history.push(root.className)).observe(root, {
      attributes: true,
      attributeFilter: ['class'],
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
      expect(history.length).toBeGreaterThan(1);
      // The first entry is the SSR markup before any script ran; from the
      // boot script onwards every class value must carry the stored theme.
      for (const value of history.slice(1)) {
        expect(value).toContain(`${mode}-theme`);
        expect(value).not.toContain(other);
      }
      await expect(page.locator('html')).toHaveClass(
        new RegExp(`${mode}-theme`)
      );
    });
  }
});
