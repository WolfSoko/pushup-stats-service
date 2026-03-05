import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { LandingPageComponent } from './landing-page.component';

describe('LandingPageComponent', () => {
  it('renders product pitch and call-to-action buttons', async () => {
    await render(LandingPageComponent, {
      providers: [provideRouter([])],
    });

    expect(screen.getByText('Pushup Tracker')).toBeTruthy();
    expect(screen.getByText('Dein Training. Klar visualisiert.')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Jetzt registrieren' })
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Einloggen' })).toBeTruthy();
  });
});
