import { expect, test } from './fixtures/test-fixtures';

test.describe('Landing page – unauthenticated state', () => {
  test('shows all three CTAs for unauthenticated visitors', async ({
    landingPage,
  }) => {
    await landingPage.goto();

    await expect(landingPage.signupCta).toBeVisible();
    await expect(landingPage.loginCta).toBeVisible();
    await expect(landingPage.guestCta).toBeVisible();
  });
});
