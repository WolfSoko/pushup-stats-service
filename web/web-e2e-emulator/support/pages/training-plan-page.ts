import { expect, type Locator, type Page } from '@playwright/test';

/** A plan's detail page: where a plan is activated and a session starts. */
export class TrainingPlanPage {
  readonly startPlanButton: Locator;
  readonly startSessionLink: Locator;
  readonly endPlanButton: Locator;

  constructor(private readonly page: Page) {
    this.startPlanButton = page.getByRole('button', { name: 'Plan starten' });
    this.startSessionLink = page.getByTestId('start-session').first();
    this.endPlanButton = page.getByRole('button', { name: 'Plan beenden' });
  }

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/training-plans/${slug}`);
  }

  /** Activates the plan and waits for the page to switch to the active view. */
  async startPlan(): Promise<void> {
    await expect(this.startPlanButton).toBeVisible({ timeout: 30_000 });
    await this.startPlanButton.click();
    await expect(this.endPlanButton).toBeVisible({ timeout: 30_000 });
  }
}
