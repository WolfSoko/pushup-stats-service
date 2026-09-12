import { render, screen } from '@testing-library/angular';
import type { TrainingPlanDay } from '@pu-stats/models';

import {
  ActivePlanCardComponent,
  type ActivePlanView,
} from './active-plan-card.component';

describe('ActivePlanCardComponent', () => {
  const view: ActivePlanView = {
    slug: 'recruit-6w',
    title: 'Recruit',
    summary: 'Six weeks.',
    totalDays: 42,
  };

  const day: TrainingPlanDay = {
    dayIndex: 3,
    kind: 'main',
    targetReps: 40,
    description: 'Tag 3',
  };

  async function renderCard(inputs: Record<string, unknown> = {}) {
    return render(ActivePlanCardComponent, {
      inputs: { view, dayIndex: 3, today: day, ...inputs },
    });
  }

  it('should offer pausing and logging while the plan runs', async () => {
    // given
    await renderCard();

    // then
    expect(screen.getByRole('button', { name: /Plan pausieren/ })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Heute eintragen/ })
    ).toBeTruthy();
    expect(document.body.textContent).toContain('Aktiver Plan');
  });

  it('should offer sharing the plan', async () => {
    // given — a plan is the one thing on this page worth showing off
    const sharePlan = vitest.fn();
    await render(ActivePlanCardComponent, {
      inputs: { view, dayIndex: 3, today: day },
      on: { sharePlan },
    });

    // when
    screen.getByTestId('active-plan-share').click();

    // then
    expect(sharePlan).toHaveBeenCalled();
  });

  it('should keep offering it while the plan is paused', async () => {
    // given — coming back to a plan is worth telling people about too
    await renderCard({ paused: true });

    // then
    expect(screen.getByTestId('active-plan-share')).toBeTruthy();
  });

  it('should offer resuming instead of logging while the plan is paused', async () => {
    // given
    await renderCard({ paused: true });

    // then
    expect(
      screen.getByRole('button', { name: /Plan fortsetzen/ })
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Heute eintragen/ })
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /Plan pausieren/ })).toBeNull();
    expect(document.body.textContent).toContain('Pausierter Plan');
  });

  it('should label the frozen day as what comes next, not as today', async () => {
    // given
    await renderCard({ paused: true });

    // then
    expect(document.body.textContent).toContain('Beim Fortsetzen:');
    expect(document.body.textContent).not.toContain('Heute geplant:');
  });

  it('should keep showing where the user stands while paused', async () => {
    // given
    await renderCard({ paused: true, completionPercent: 20 });

    // then
    expect(document.body.textContent).toContain('3 / 42');
    expect(document.querySelector('mat-progress-bar')).toBeTruthy();
  });

  it('should report the actions the user takes on the card', async () => {
    // given
    const pause = vitest.fn();
    const abandon = vitest.fn();
    const logToday = vitest.fn();
    await render(ActivePlanCardComponent, {
      inputs: { view, dayIndex: 3, today: day },
      on: { pausePlan: pause, abandon, logToday },
    });

    // when
    screen.getByRole('button', { name: /Plan pausieren/ }).click();
    screen.getByRole('button', { name: /Heute eintragen/ }).click();
    screen.getByRole('button', { name: /Plan beenden/ }).click();

    // then
    expect(pause).toHaveBeenCalled();
    expect(logToday).toHaveBeenCalled();
    expect(abandon).toHaveBeenCalled();
  });

  it('should report a resume from the paused card', async () => {
    // given
    const resume = vitest.fn();
    await render(ActivePlanCardComponent, {
      inputs: { view, dayIndex: 3, today: day, paused: true },
      on: { resumePlan: resume },
    });

    // when
    screen.getByRole('button', { name: /Plan fortsetzen/ }).click();

    // then
    expect(resume).toHaveBeenCalled();
  });
});
