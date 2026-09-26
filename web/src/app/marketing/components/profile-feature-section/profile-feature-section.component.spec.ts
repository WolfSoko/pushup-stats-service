import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { ProfileFeatureSectionComponent } from './profile-feature-section.component';

async function setup() {
  const ctaClick = vitest.fn();
  await render(ProfileFeatureSectionComponent, {
    providers: [provideRouter([{ path: 'register', children: [] }])],
    on: { ctaClick },
  });
  return { ctaClick };
}

describe('ProfileFeatureSectionComponent', () => {
  it('should pitch the profile as new, covering every exercise and XP', async () => {
    // when
    await setup();

    // then
    expect(screen.getByText('Neu · Trainingsprofil')).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: 'Dein Profil zeigt alles, was du trainierst — nicht nur Liegestütze.',
      })
    ).toBeTruthy();
    expect(
      screen.getByText('Wiederholungen, Zeit und Kilometer über alle Übungen')
    ).toBeTruthy();
  });

  it('should send the CTA to the sign-up and report the click', async () => {
    // given
    const { ctaClick } = await setup();
    const cta = screen.getByRole('link', { name: 'Eigenes Profil anlegen' });
    expect(cta.getAttribute('href')).toBe('/register');

    // when
    await userEvent.setup().click(cta);

    // then
    expect(ctaClick).toHaveBeenCalledTimes(1);
  });
});
