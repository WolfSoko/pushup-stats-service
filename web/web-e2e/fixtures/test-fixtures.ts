import { test as base } from '@playwright/test';
import { LandingPage } from '../pages/landing-page';
import { LoginPage } from '../pages/login-page';
import { RegisterPage } from '../pages/register-page';

type AppFixtures = {
  landingPage: LandingPage;
  loginPage: LoginPage;
  registerPage: RegisterPage;
};

export const test = base.extend<AppFixtures>({
  landingPage: async ({ page }, use) => {
    await use(new LandingPage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
});

export { expect } from '@playwright/test';
