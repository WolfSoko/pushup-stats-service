import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';

import { PlanTodayCardComponent } from './plan-today-card.component';
import { DayRow } from './training-plan-detail.models';

function row(overrides: Partial<DayRow> = {}): DayRow {
  return {
    day: {
      dayIndex: 3,
      kind: 'main',
      targetReps: 30,
      description: 'Zirkel für den ganzen Körper',
    },
    weekIndex: 1,
    isToday: true,
    isCompleted: false,
    isSkipped: false,
    isFuture: false,
    isCheckoff: false,
    exercises: [],
    pushupTypes: [],
    ...overrides,
  };
}

async function setup(
  overrides: Partial<DayRow> = {},
  offersSession = true
): Promise<void> {
  await render(PlanTodayCardComponent, {
    inputs: {
      row: row(overrides),
      sessionLink: ['/training-plans', 'challenge-30d', 'session'],
      interactive: true,
      offersSession,
    },
    providers: [provideRouter([])],
  });
}

const byTestId = (id: string): HTMLElement =>
  document.querySelector(`[data-testid="${id}"]`) as HTMLElement;

describe('PlanTodayCardComponent', () => {
  it("should name today's day and its target", async () => {
    // given / when
    await setup();

    // then — the heading reads "Tag 3 · 30 Wdh." as one line
    expect(screen.getByText(/Heute/)).toBeTruthy();
    const heading = document.querySelector('.today-title') as HTMLElement;
    expect(heading.textContent).toContain('3');
    expect(heading.textContent).toContain('30');
  });

  it("should render the day's description", async () => {
    // given / when
    await setup();

    // then
    expect(screen.getByText('Zirkel für den ganzen Körper')).toBeTruthy();
  });

  it('should link into the guided session', async () => {
    // given / when
    await setup();

    // then
    expect(byTestId('plan-today-start-session').getAttribute('href')).toBe(
      '/training-plans/challenge-30d/session'
    );
  });

  it('should hide the session link when the day has nothing left open', async () => {
    // given / when
    await setup({ isCompleted: true }, false);

    // then
    expect(byTestId('plan-today-start-session')).toBeNull();
    expect(byTestId('plan-today-done')).toBeTruthy();
  });

  it('should not offer an exercise list on a rest day', async () => {
    // given / when
    await setup({
      day: {
        dayIndex: 4,
        kind: 'rest',
        targetReps: 0,
        description: 'Ruhetag',
      },
    });

    // then
    expect(document.querySelector('app-plan-day-exercises')).toBeNull();
  });
});
