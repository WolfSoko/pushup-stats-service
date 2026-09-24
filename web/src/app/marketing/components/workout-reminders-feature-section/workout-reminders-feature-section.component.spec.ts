import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { WorkoutRemindersFeatureSectionComponent } from './workout-reminders-feature-section.component';

async function setup() {
  const ctaClick = vitest.fn();
  await render(WorkoutRemindersFeatureSectionComponent, {
    providers: [provideRouter([{ path: 'workouts', children: [] }])],
    on: { ctaClick },
  });
  return { ctaClick };
}

describe('WorkoutRemindersFeatureSectionComponent', () => {
  it('should pitch session reminders as new, with both rhythms and push', async () => {
    // given / when
    await setup();

    // then
    expect(screen.getByText('Neu · Session-Erinnerungen')).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: 'Deine Session meldet sich — genau dann, wenn du trainieren willst.',
      })
    ).toBeTruthy();
    expect(
      screen.getByText('Alle paar Tage oder an festen Wochentagen')
    ).toBeTruthy();
    expect(
      screen.getByText(/Push aufs Handy — ein Tipp startet die Session/)
    ).toBeTruthy();
  });

  it('should link the CTA to the sessions page and report the click', async () => {
    // given
    const { ctaClick } = await setup();
    const cta = screen.getByRole('link', { name: 'Erinnerung einrichten' });
    expect(cta.getAttribute('href')).toBe('/workouts');

    // when
    await userEvent.setup().click(cta);

    // then
    expect(ctaClick).toHaveBeenCalledTimes(1);
  });
});
