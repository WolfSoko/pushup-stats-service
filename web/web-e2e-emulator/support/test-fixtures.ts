import { test as base } from '@playwright/test';

import { collectDiagnostics, reportDiagnostics } from './diagnostics';

import { DashboardPage } from './pages/dashboard-page';
import { FriendsPage } from './pages/friends-page';
import { LoginPage } from './pages/login-page';
import { RegisterPage } from './pages/register-page';
import { TrainingPlanPage } from './pages/training-plan-page';
import { TrainingSessionPage } from './pages/training-session-page';

type AppFixtures = {
  dashboardPage: DashboardPage;
  friendsPage: FriendsPage;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  trainingPlanPage: TrainingPlanPage;
  trainingSessionPage: TrainingSessionPage;
};

export const test = base.extend<AppFixtures>({
  /**
   * The stock page, plus a log of what the browser complained about that
   * is printed when the test ends badly. See `support/diagnostics.ts`.
   */
  page: async ({ page }, use, testInfo) => {
    const lines = collectDiagnostics(page);
    await use(page);
    if (testInfo.status !== testInfo.expectedStatus) {
      await reportDiagnostics(page, testInfo, lines());
    }
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  friendsPage: async ({ page }, use) => {
    await use(new FriendsPage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
  trainingPlanPage: async ({ page }, use) => {
    await use(new TrainingPlanPage(page));
  },
  trainingSessionPage: async ({ page }, use) => {
    await use(new TrainingSessionPage(page));
  },
});

export { expect } from '@playwright/test';
