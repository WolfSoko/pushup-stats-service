import { provideRouter, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AdsConfigService } from '@pu-stats/ads';
import { AuthService } from '@pu-auth/auth';
import { LandingPageComponent } from './landing-page.component';

const adsConfigMock = {
  enabled: () => false,
  dashboardInlineEnabled: () => false,
  adClient: () => '',
  dashboardInlineSlot: () => '',
  landingInlineSlot: () => '',
};

function makeAuthServiceMock() {
  return { signInGuestIfNeeded: jest.fn().mockResolvedValue(undefined) };
}

describe('LandingPageComponent', () => {
  it('renders product pitch and call-to-action buttons', async () => {
    await render(LandingPageComponent, {
      providers: [
        provideRouter([]),
        { provide: AdsConfigService, useValue: adsConfigMock },
        { provide: AuthService, useValue: makeAuthServiceMock() },
      ],
    });

    expect(screen.getByText('Pushup Tracker')).toBeTruthy();
    expect(screen.getByText('Dein Training. Klar visualisiert.')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Jetzt registrieren' })
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Einloggen' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Als Gast ausprobieren' })
    ).toBeTruthy();
    expect(screen.getByText('Bestenliste')).toBeTruthy();
  });

  it('orders landing sections as feature grid, preview, leaderboard', async () => {
    const view = await render(LandingPageComponent, {
      providers: [
        provideRouter([]),
        { provide: AdsConfigService, useValue: adsConfigMock },
        { provide: AuthService, useValue: makeAuthServiceMock() },
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

  it('clicking "Als Gast ausprobieren" calls signInGuestIfNeeded and navigates to /app', async () => {
    const authServiceMock = makeAuthServiceMock();
    const view = await render(LandingPageComponent, {
      providers: [
        provideRouter([{ path: 'app', component: LandingPageComponent }]),
        { provide: AdsConfigService, useValue: adsConfigMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    });

    const router = view.fixture.debugElement.injector.get(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    // When
    await userEvent.click(
      screen.getByRole('button', { name: 'Als Gast ausprobieren' })
    );

    // Then
    expect(authServiceMock.signInGuestIfNeeded).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/app']);
  });
});
