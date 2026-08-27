import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { SessionFeatureSectionComponent } from './session-feature-section.component';

async function setup() {
  const ctaClick = vitest.fn();
  await render(SessionFeatureSectionComponent, {
    providers: [provideRouter([{ path: 'training-plans', children: [] }])],
    on: { ctaClick },
  });
  return { ctaClick };
}

describe('SessionFeatureSectionComponent', () => {
  it('should pitch the guided session with its headline and description', async () => {
    // given / when
    await setup();

    // then
    expect(screen.getByText('Geführte Sessions')).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: 'Dein Plan führt dich durch das Workout.',
      })
    ).toBeTruthy();
    expect(
      screen.getByText(/Zirkeltraining oder Übung für Übung/)
    ).toBeTruthy();
    expect(
      screen.getByText(/Kamera-Zähler & Halte-Timer je Übung/)
    ).toBeTruthy();
  });

  it('should link the CTA to the training plan overview', async () => {
    // given / when
    await setup();

    // then
    const cta = screen.getByRole('link', {
      name: 'Plan wählen & Session starten',
    });
    expect(cta.getAttribute('href')).toBe('/training-plans');
  });

  it('should emit ctaClick when the CTA is clicked', async () => {
    // given
    const { ctaClick } = await setup();

    // when
    await userEvent.click(
      screen.getByRole('link', { name: 'Plan wählen & Session starten' })
    );

    // then
    expect(ctaClick).toHaveBeenCalledTimes(1);
  });
});
