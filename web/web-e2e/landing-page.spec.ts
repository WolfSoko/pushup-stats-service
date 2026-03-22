import { expect, test } from './fixtures/test-fixtures';

test.describe('Landing page', () => {
  test('loads and exposes primary CTAs @smoke', async ({ landingPage, page }) => {
    await landingPage.goto();
    await landingPage.expectLoaded();

    await expect(page).toHaveURL(/\/$/);
  });
});
