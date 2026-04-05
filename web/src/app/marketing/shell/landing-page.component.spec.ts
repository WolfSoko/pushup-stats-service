import { provideRouter, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AdsStore } from '@pu-stats/ads';
import { AuthService, AuthStore } from '@pu-auth/auth';
import { makeAuthServiceMock, makeAuthStoreMock } from '@pu-stats/testing';
import { LandingPageComponent } from './landing-page.component';

const adsConfigMock = {
  enabled: () => false,
  dashboardInlineEnabled: () => false,
  adClient: () => '',
  dashboardInlineSlot: () => '',
  landingInlineSlot: () => '',
  adsAllowed: () => false,
  targetedAdsConsent: () => true,
};

describe('LandingPageComponent', () => {
  describe('unauthenticated', () => {
    it('renders product pitch and all CTA buttons', async () => {
      await render(LandingPageComponent, {
        providers: [
          provideRouter([]),
          { provide: AdsStore, useValue: adsConfigMock },
          { provide: AuthService, useValue: makeAuthServiceMock() },
          { provide: AuthStore, useValue: makeAuthStoreMock() },
        ],
      });

      expect(screen.getByText('Pushup Tracker')).toBeTruthy();
      expect(
        screen.getByText('Dein Training. Klar visualisiert.')
      ).toBeTruthy();
      expect(
        screen.getByRole('link', { name: 'Jetzt registrieren' })
      ).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Einloggen' })).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Als Gast ausprobieren' })
      ).toBeTruthy();
      expect(screen.getByText('Bestenliste')).toBeTruthy();
    });
  });

  describe('auth not yet resolved', () => {
    it('hides guest CTA and login buttons while auth state is pending', async () => {
      // Given – auth state has not yet been determined by Firebase
      await render(LandingPageComponent, {
        providers: [
          provideRouter([]),
          { provide: AdsStore, useValue: adsConfigMock },
          { provide: AuthService, useValue: makeAuthServiceMock() },
          {
            provide: AuthStore,
            useValue: makeAuthStoreMock({ authResolved: false }),
          },
        ],
      });

      // Then – no CTA buttons should be visible
      expect(
        screen.queryByRole('button', { name: 'Als Gast ausprobieren' })
      ).toBeNull();
      expect(
        screen.queryByRole('link', { name: 'Jetzt registrieren' })
      ).toBeNull();
      expect(screen.queryByRole('link', { name: 'Einloggen' })).toBeNull();
    });
  });

  describe('authenticated as real user', () => {
    it('shows only dashboard button', async () => {
      await render(LandingPageComponent, {
        providers: [
          provideRouter([]),
          { provide: AdsStore, useValue: adsConfigMock },
          { provide: AuthService, useValue: makeAuthServiceMock() },
          {
            provide: AuthStore,
            useValue: makeAuthStoreMock({ isAuthenticated: true }),
          },
        ],
      });

      expect(screen.getByRole('link', { name: 'Zum Dashboard' })).toBeTruthy();
      expect(
        screen.queryByRole('link', { name: 'Jetzt registrieren' })
      ).toBeNull();
      expect(screen.queryByRole('link', { name: 'Einloggen' })).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Als Gast ausprobieren' })
      ).toBeNull();
    });
  });

  describe('authenticated as guest', () => {
    it('shows dashboard button and "Konto erstellen"', async () => {
      await render(LandingPageComponent, {
        providers: [
          provideRouter([]),
          { provide: AdsStore, useValue: adsConfigMock },
          { provide: AuthService, useValue: makeAuthServiceMock() },
          {
            provide: AuthStore,
            useValue: makeAuthStoreMock({
              isAuthenticated: true,
              isGuest: true,
            }),
          },
        ],
      });

      expect(screen.getByRole('link', { name: 'Zum Dashboard' })).toBeTruthy();
      expect(
        screen.getByRole('link', { name: 'Konto erstellen' })
      ).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Einloggen' })).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Als Gast ausprobieren' })
      ).toBeNull();
    });
  });

  it('orders landing sections as feature grid, preview, leaderboard', async () => {
    const view = await render(LandingPageComponent, {
      providers: [
        provideRouter([]),
        { provide: AdsStore, useValue: adsConfigMock },
        { provide: AuthService, useValue: makeAuthServiceMock() },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
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
    const signInGuestIfNeeded = vitest.fn().mockResolvedValue(undefined);
    const view = await render(LandingPageComponent, {
      providers: [
        provideRouter([{ path: 'app', component: LandingPageComponent }]),
        { provide: AdsStore, useValue: adsConfigMock },
        {
          provide: AuthService,
          useValue: makeAuthServiceMock({ overrides: { signInGuestIfNeeded } }),
        },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
      ],
    });

    const router = view.fixture.debugElement.injector.get(Router);
    const navigateSpy = vitest
      .spyOn(router, 'navigate')
      .mockResolvedValue(true);

    // When
    await userEvent.click(
      screen.getByRole('button', { name: 'Als Gast ausprobieren' })
    );

    // Then
    expect(signInGuestIfNeeded).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/app']);
  });
});
