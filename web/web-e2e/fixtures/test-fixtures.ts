import { test as base } from '@playwright/test';
import { LandingPage } from '../pages/landing-page';

type AppFixtures = {
  landingPage: LandingPage;
};

export const test = base.extend<AppFixtures>({
  landingPage: async ({ page }, use) => {
    await use(new LandingPage(page));
  },
});

export { expect } from '@playwright/test';
