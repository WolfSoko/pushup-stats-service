import { createAccount, readEntries } from '../support/emulator';
import { expect, test } from '../support/test-fixtures';

/**
 * `recruit-6w` day 1 is `3×10` pushups — three sets, all quantified, no
 * test input and no rest day in the way, which makes it the shortest
 * complete session in the catalog.
 */
const PLAN_SLUG = 'recruit-6w';
const SETS = 3;
const REPS_PER_SET = 10;
const DAY_TARGET = SETS * REPS_PER_SET;

test.describe('Training session', () => {
  test('should work through every set of the active plan and log the reps', async ({
    loginPage,
    trainingPlanPage,
    trainingSessionPage,
    page,
  }) => {
    // given — an account with the plan running
    const user = await createAccount('session');
    await loginPage.signIn(user);
    await trainingPlanPage.goto(PLAN_SLUG);
    await trainingPlanPage.startPlan();

    // when — the session is started from the plan's day and played out
    await trainingPlanPage.startSessionLink.click();
    await expect(page).toHaveURL(new RegExp(`/${PLAN_SLUG}/session$`));
    await trainingSessionPage.begin();
    await trainingSessionPage.logAllSets(SETS);

    // then
    await expect(trainingSessionPage.doneTitle).toBeVisible({
      timeout: 20_000,
    });

    await expect(async () => {
      const entries = await readEntries(user.uid);
      expect(entries).toHaveLength(SETS);
      expect(entries.every((entry) => entry['exerciseId'] === 'pushup')).toBe(
        true
      );
      expect(
        entries.reduce((sum, entry) => sum + Number(entry['reps'] ?? 0), 0)
      ).toBe(DAY_TARGET);
    }).toPass({ timeout: 20_000 });

    // and — closing the session returns to the plan
    await trainingSessionPage.finish();
    await expect(page).toHaveURL(new RegExp(`/training-plans/${PLAN_SLUG}$`));
  });

  test('should refuse a guided session for a plan that is not active', async ({
    loginPage,
    trainingSessionPage,
  }) => {
    // given
    await loginPage.signIn(await createAccount('session-inactive'));

    // when
    await trainingSessionPage.goto(PLAN_SLUG);

    // then
    await expect(trainingSessionPage.inactivePlanNote).toBeVisible({
      timeout: 20_000,
    });
    await expect(trainingSessionPage.startButton).toBeHidden();
  });
});
