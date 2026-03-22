import { type Locator, type Page, expect } from '@playwright/test';

export class DashboardPage {
  readonly heading: Locator;
  readonly statsTable: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {
      level: 1,
      name: /liegestütze statistik/i,
    });
    // Stats table rendered by <app-stats-table>
    this.statsTable = page.locator('app-stats-table');
  }

  async goto(): Promise<void> {
    await this.page.goto('/app');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async expectPushupList(): Promise<void> {
    await expect(this.statsTable).toBeVisible();
  }

  async addEntry(reps: 10 | 20 | 30 = 10): Promise<void> {
    await this.page
      .getByRole('button', { name: new RegExp(`\\+${reps} reps`, 'i') })
      .click();
  }
}
