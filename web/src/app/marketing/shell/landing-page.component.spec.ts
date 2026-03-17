import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { AdsConfigService } from '@pu-stats/ads';
import { LandingPageComponent } from './landing-page.component';

const adsConfigMock = {
  enabled: () => false,
  dashboardInlineEnabled: () => false,
  adClient: () => '',
  dashboardInlineSlot: () => '',
  landingInlineSlot: () => '',
};

describe('LandingPageComponent', () => {
  it('renders product pitch and call-to-action buttons', async () => {
    await render(LandingPageComponent, {
      providers: [
        provideRouter([]),
        { provide: AdsConfigService, useValue: adsConfigMock },
      ],
    });

    expect(screen.getByText('Pushup Tracker')).toBeTruthy();
    expect(screen.getByText('Dein Training. Klar visualisiert.')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Jetzt registrieren' })
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Einloggen' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zum Dashboard' })).toBeTruthy();
    expect(screen.getByText('Bestenliste')).toBeTruthy();
  });

  it('orders landing sections as feature grid, preview, leaderboard', async () => {
    const view = await render(LandingPageComponent, {
      providers: [
        provideRouter([]),
        { provide: AdsConfigService, useValue: adsConfigMock },
      ],
    });

    const host = view.fixture.nativeElement as HTMLElement;
    const features = host.querySelector('section.feature-grid');
    const preview = host.querySelector('section.preview');
    const leaderboard = host.querySelector('section.leaderboard');

    expect(features).toBeTruthy();
    expect(preview).toBeTruthy();
    expect(leaderboard).toBeTruthy();

    if (!features || !preview || !leaderboard) {
      throw new Error('Expected all landing sections to exist');
    }

    expect(
      features.compareDocumentPosition(preview) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      preview.compareDocumentPosition(leaderboard) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
