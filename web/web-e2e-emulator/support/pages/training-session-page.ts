import { expect, type Locator, type Page } from '@playwright/test';

/**
 * A guided training session: the intro, one card per set, the rest
 * countdown between them, and the closing screen.
 */
export class TrainingSessionPage {
  readonly startButton: Locator;
  readonly restSlider: Locator;
  readonly logAsPrescribedButton: Locator;
  readonly skipRestButton: Locator;
  readonly finishButton: Locator;
  readonly doneTitle: Locator;
  readonly inactivePlanNote: Locator;
  /** The celebration that opens over the session when the day's goal is met. */
  readonly goalReachedCard: Locator;
  readonly goalReachedClose: Locator;

  constructor(private readonly page: Page) {
    this.startButton = page.getByTestId('session-start');
    this.restSlider = page.getByTestId('session-rest-slider');
    this.logAsPrescribedButton = page.getByTestId('session-log-prescribed');
    this.skipRestButton = page.getByTestId('session-skip-rest');
    this.finishButton = page.getByTestId('session-finish');
    this.doneTitle = page.getByText('Session geschafft');
    this.inactivePlanNote = page.getByText(
      'Für eine geführte Session muss dieser Plan aktiv sein.'
    );
    this.goalReachedCard = page.getByTestId('goal-reached-card');
    this.goalReachedClose = page.getByTestId('goal-reached-close');
  }

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/training-plans/${slug}/session`);
  }

  /** Starts the session, asking for no rest so the sets follow each other. */
  async begin(): Promise<void> {
    await expect(this.startButton).toBeVisible({ timeout: 20_000 });
    await this.restSlider.fill('0');
    await this.startButton.click();
  }

  /**
   * Logs the prescribed reps for every set of the day.
   *
   * Each set is waited out before the next one is tapped. What a set
   * prescribes is `target − logged`, and `logged` comes back from the
   * live entries mirror rather than from the click, so tapping ahead of
   * it would write the previous set's reps a second time — a
   * machine-speed race no person runs into, and not what this spec is
   * about.
   */
  async logAllSets(sets: number): Promise<void> {
    for (let set = 1; set <= sets; set += 1) {
      await this.waitForSetCard(set, sets);
      await this.logAsPrescribedButton.click();
      await expect(this.setsDoneLabel(set, sets)).toBeVisible({
        timeout: 20_000,
      });
    }
  }

  /**
   * Closes the goal celebration. It is an overlay, so anything behind it
   * — the session's own closing action included — is unclickable until
   * it is gone.
   */
  async dismissGoalReached(): Promise<void> {
    await this.goalReachedClose.click();
    await expect(this.goalReachedCard).toBeHidden({ timeout: 20_000 });
  }

  /** The session's own count of finished sets. */
  setsDoneLabel(done: number, total: number): Locator {
    return this.page.getByText(`${done} von ${total} Sätzen erledigt`);
  }

  /**
   * Waits until set `step` is on screen and ready to be logged,
   * clicking through a rest countdown if one is showing. The rest
   * slider asks for none, but the persisted config can still put one in
   * front of the next set, and a rest is a normal part of the flow
   * rather than a failure.
   */
  private async waitForSetCard(step: number, total: number): Promise<void> {
    await expect(async () => {
      if (await this.skipRestButton.isVisible()) {
        await this.skipRestButton.click();
      }
      await expect(
        this.page.getByText(`Schritt ${step} von ${total}`)
      ).toBeVisible({ timeout: 2_000 });
      await expect(this.logAsPrescribedButton).toBeEnabled({ timeout: 2_000 });
    }).toPass({ timeout: 60_000 });
  }
}
