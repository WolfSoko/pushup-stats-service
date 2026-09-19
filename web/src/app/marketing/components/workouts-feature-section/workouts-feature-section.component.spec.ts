import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { WorkoutsFeatureSectionComponent } from './workouts-feature-section.component';

async function setup() {
  const ctaClick = vitest.fn();
  await render(WorkoutsFeatureSectionComponent, {
    providers: [provideRouter([{ path: 'workouts', children: [] }])],
    on: { ctaClick },
  });
  return { ctaClick };
}

describe('WorkoutsFeatureSectionComponent', () => {
  it('should pitch custom sessions as new, with what they do', async () => {
    // given / when
    await setup();

    // then
    expect(screen.getByText('Neu · Eigene Sessions')).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: 'Dein Workout, deine Regeln — und deine Freunde trainieren mit.',
      })
    ).toBeTruthy();
    expect(
      screen.getByText(/Übungen, Ziele und Sätze frei kombinieren/)
    ).toBeTruthy();
    expect(
      screen.getByText(/Auf dem Profil zeigen oder Freunden schicken/)
    ).toBeTruthy();
  });

  it('should link the CTA to the sessions page and report the click', async () => {
    // given
    const { ctaClick } = await setup();
    const cta = screen.getByRole('link', { name: 'Eigene Session erstellen' });
    expect(cta.getAttribute('href')).toBe('/workouts');

    // when
    await userEvent.setup().click(cta);

    // then
    expect(ctaClick).toHaveBeenCalledTimes(1);
  });
});
