import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { XpFeatureSectionComponent } from './xp-feature-section.component';

async function setup() {
  const ctaClick = vitest.fn();
  await render(XpFeatureSectionComponent, {
    providers: [provideRouter([{ path: 'leaderboard', children: [] }])],
    on: { ctaClick },
  });
  return { ctaClick };
}

describe('XpFeatureSectionComponent', () => {
  it('should pitch the points system as new, with levels, variety and the leaderboard', async () => {
    // given / when
    await setup();

    // then
    expect(screen.getByText('Neu · Punkte-System')).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: 'Jede Wiederholung zählt — sammle XP und steig im Level auf.',
      })
    ).toBeTruthy();
    expect(
      screen.getByText('Level und Abzeichen für Level 5, 10, 20 und mehr')
    ).toBeTruthy();
    expect(
      screen.getByText('XP-Bestenliste weltweit und unter Freunden')
    ).toBeTruthy();
  });

  it('should link the CTA to the leaderboard and report the click', async () => {
    // given
    const { ctaClick } = await setup();
    const cta = screen.getByRole('link', { name: 'Zur XP-Bestenliste' });
    expect(cta.getAttribute('href')).toBe('/leaderboard');

    // when
    await userEvent.setup().click(cta);

    // then
    expect(ctaClick).toHaveBeenCalledTimes(1);
  });
});
