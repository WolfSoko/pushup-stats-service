import { expect, test } from './fixtures/test-fixtures';

test.describe('Guest flow @smoke', () => {
  test('guest CTA click navigates to /app or /login', async ({
    landingPage,
    page,
  }) => {
    await landingPage.goto();
    await landingPage.expectLoaded();

    await landingPage.guestCta.click();

    await page.waitForURL(/(\/app|\/login)/, { timeout: 10_000 });
    await expect(page).toHaveURL(/(\/app|\/login)/);
  });
});
