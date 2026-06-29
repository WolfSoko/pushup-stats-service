import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AdsStore } from '@pu-stats/ads';
import { AuthService, AuthStore } from '@pu-auth/auth';
import { makeAuthServiceMock, makeAuthStoreMock } from '@pu-stats/testing';
import { InstallPromptService } from '../../core/install-prompt.service';
import { LandingPageComponent } from './landing-page.component';

interface InstallPromptStub {
  canInstall: ReturnType<typeof signal<boolean>>;
  isStandalone: ReturnType<typeof signal<boolean>>;
  isIos: boolean;
  prompt: ReturnType<typeof vitest.fn>;
}

function makeInstallPromptMock(
  init: Partial<{
    canInstall: boolean;
    isStandalone: boolean;
    isIos: boolean;
  }> = {}
): InstallPromptStub {
  return {
    canInstall: signal(init.canInstall ?? false),
    isStandalone: signal(init.isStandalone ?? false),
    isIos: init.isIos ?? false,
    prompt: vitest.fn().mockResolvedValue('accepted'),
  };
}

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
      expect(
        screen.getByRole('link', { name: 'Zur Bestenliste' })
      ).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Zum Blog' })).toBeTruthy();
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

  it('renders a prominent brand logo inside the hero card', async () => {
    await render(LandingPageComponent, {
      providers: [
        provideRouter([]),
        { provide: AdsStore, useValue: adsConfigMock },
        { provide: AuthService, useValue: makeAuthServiceMock() },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
      ],
    });

    const logo = screen.getByAltText('Pushup Tracker Logo') as HTMLImageElement;
    expect(logo.getAttribute('src')).toBe('assets/pushup-logo.png');
    expect(logo.closest('section.hero')).toBeTruthy();
    // LCP element: prioritised, fixed-size, and served as WebP via <picture>.
    expect(logo.getAttribute('fetchpriority')).toBe('high');
    expect(logo.getAttribute('width')).toBe('160');
    expect(logo.getAttribute('height')).toBe('160');
    const webpSource = logo
      .closest('picture')
      ?.querySelector('source[type="image/webp"]');
    expect(webpSource?.getAttribute('srcset')).toBe('assets/pushup-logo.webp');
  });

  it('orders landing sections as feature grid, preview, discover', async () => {
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
    const discover = host.querySelector('section.discover');

    expect(features).toBeTruthy();
    expect(preview).toBeTruthy();
    expect(discover).toBeTruthy();

    if (!features || !preview || !discover) {
      throw new Error('Expected all landing sections to exist');
    }

    expect(
      features.compareDocumentPosition(preview) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      preview.compareDocumentPosition(discover) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('does not render the live leaderboard section anymore', async () => {
    const view = await render(LandingPageComponent, {
      providers: [
        provideRouter([]),
        { provide: AdsStore, useValue: adsConfigMock },
        { provide: AuthService, useValue: makeAuthServiceMock() },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
      ],
    });

    const host = view.fixture.nativeElement as HTMLElement;
    expect(host.querySelector('section.leaderboard')).toBeNull();
    // Period switch buttons (Tag/Woche/Monat) are gone with the live list.
    expect(screen.queryByRole('button', { name: 'Tag' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Woche' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Monat' })).toBeNull();
  });

  it('discover cards link to /leaderboard and /blog', async () => {
    await render(LandingPageComponent, {
      providers: [
        provideRouter([]),
        { provide: AdsStore, useValue: adsConfigMock },
        { provide: AuthService, useValue: makeAuthServiceMock() },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
      ],
    });

    const leaderboardLink = screen.getByRole('link', {
      name: 'Zur Bestenliste',
    });
    const blogLink = screen.getByRole('link', { name: 'Zum Blog' });

    expect(leaderboardLink.getAttribute('href')).toBe('/leaderboard');
    expect(blogLink.getAttribute('href')).toBe('/blog');
  });

  describe('training plans section', () => {
    it('showcases a diverse set of plan cards beyond pushups', async () => {
      await render(LandingPageComponent, {
        providers: [
          provideRouter([]),
          { provide: AdsStore, useValue: adsConfigMock },
          { provide: AuthService, useValue: makeAuthServiceMock() },
          { provide: AuthStore, useValue: makeAuthStoreMock() },
        ],
      });

      const planLinks = screen.getAllByRole('link', { name: 'Plan ansehen' });
      const hrefs = planLinks.map((a) => a.getAttribute('href'));

      // The featured trio spans a pushup progression, a full-body and a core
      // plan so the section reflects the broader catalog, not just pushups.
      expect(hrefs).toEqual(
        expect.arrayContaining([
          '/training-plans/recruit-6w',
          '/training-plans/full-body-6w',
          '/training-plans/core-4w',
        ])
      );
    });

    it('always shows "Alle Pläne ansehen" linking to /training-plans', async () => {
      await render(LandingPageComponent, {
        providers: [
          provideRouter([]),
          { provide: AdsStore, useValue: adsConfigMock },
          { provide: AuthService, useValue: makeAuthServiceMock() },
          { provide: AuthStore, useValue: makeAuthStoreMock() },
        ],
      });

      const overviewLink = screen.getByRole('link', {
        name: 'Alle Pläne ansehen',
      });
      expect(overviewLink.getAttribute('href')).toBe('/training-plans');
    });

    it('shows signup CTA pointing to /register?returnUrl=/training-plans for unauthenticated visitors', async () => {
      await render(LandingPageComponent, {
        providers: [
          provideRouter([]),
          { provide: AdsStore, useValue: adsConfigMock },
          { provide: AuthService, useValue: makeAuthServiceMock() },
          { provide: AuthStore, useValue: makeAuthStoreMock() },
        ],
      });

      const signupLink = screen.getByRole('link', {
        name: 'Konto erstellen & Plan starten',
      });
      const href = signupLink.getAttribute('href') ?? '';

      expect(href).toContain('/register');
      expect(decodeURIComponent(href)).toContain('returnUrl=/training-plans');
    });

    it('hides plan signup CTA for authenticated users', async () => {
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

      expect(
        screen.queryByRole('link', { name: 'Konto erstellen & Plan starten' })
      ).toBeNull();
    });
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

  describe('heatmap preview data', () => {
    it('expands HEATMAP_PATTERN into 18 weeks × 7 days with correct level mapping', async () => {
      const view = await render(LandingPageComponent, {
        providers: [
          provideRouter([]),
          { provide: AdsStore, useValue: adsConfigMock },
          { provide: AuthService, useValue: makeAuthServiceMock() },
          { provide: AuthStore, useValue: makeAuthStoreMock() },
        ],
      });

      const component = view.fixture.componentInstance;
      const weeks = component.heatmapWeeks;

      // Given the pattern: 18 weeks, 7 days each, x stride 14, y stride 14
      expect(weeks).toHaveLength(18);
      weeks.forEach((week, i) => {
        expect(week.x).toBe(i * 14);
        expect(week.days).toHaveLength(7);
        week.days.forEach((day, j) => {
          expect(day.y).toBe(j * 14);
          // Level is 'empty' or one of '1'..'5' — never the raw 'e' encoding.
          expect(['empty', '1', '2', '3', '4', '5']).toContain(day.level);
        });
      });
    });

    it("maps the pattern character 'e' to 'empty' and digits to themselves", async () => {
      // Given
      const view = await render(LandingPageComponent, {
        providers: [
          provideRouter([]),
          { provide: AdsStore, useValue: adsConfigMock },
          { provide: AuthService, useValue: makeAuthServiceMock() },
          { provide: AuthStore, useValue: makeAuthStoreMock() },
        ],
      });
      const component = view.fixture.componentInstance;

      // Then — week 0 should match the documented pattern '1e213e2'
      const week0Levels = component.heatmapWeeks[0].days.map((d) => d.level);
      expect(week0Levels).toEqual(['1', 'empty', '2', '1', '3', 'empty', '2']);
    });

    it('renders one rect per day in the heatmap preview SVG', async () => {
      const view = await render(LandingPageComponent, {
        providers: [
          provideRouter([]),
          { provide: AdsStore, useValue: adsConfigMock },
          { provide: AuthService, useValue: makeAuthServiceMock() },
          { provide: AuthStore, useValue: makeAuthStoreMock() },
        ],
      });
      const host = view.fixture.nativeElement as HTMLElement;

      // The 18 × 7 grid + the 6-step legend below it = 132 rects
      const dayCells = host.querySelectorAll(
        '.feature-visual--heatmap rect[class^="lp-day-"]'
      );
      expect(dayCells).toHaveLength(18 * 7 + 6);
    });
  });

  describe('Given the install card', () => {
    async function renderWith(installMock: InstallPromptStub): Promise<void> {
      await render(LandingPageComponent, {
        providers: [
          provideRouter([]),
          { provide: AdsStore, useValue: adsConfigMock },
          { provide: AuthService, useValue: makeAuthServiceMock() },
          { provide: AuthStore, useValue: makeAuthStoreMock() },
          { provide: InstallPromptService, useValue: installMock },
        ],
      });
    }

    it('does not contain the literal text "PWA" anymore', async () => {
      await renderWith(makeInstallPromptMock());

      expect(screen.queryByText(/\bPWA\b/)).toBeNull();
      expect(
        screen.getByText('App-Installation, Live-Sync & Teilen')
      ).toBeTruthy();
    });

    it('shows the install button and triggers the prompt on click', async () => {
      const installMock = makeInstallPromptMock({ canInstall: true });
      await renderWith(installMock);

      const button = screen.getByRole('button', {
        name: /Jetzt als App installieren/,
      });
      await userEvent.click(button);

      expect(installMock.prompt).toHaveBeenCalledTimes(1);
    });

    it('hides the install button while the browser has not offered the prompt', async () => {
      await renderWith(makeInstallPromptMock({ canInstall: false }));

      expect(
        screen.queryByRole('button', { name: /Jetzt als App installieren/ })
      ).toBeNull();
    });

    it('shows the iOS hint when running on iOS Safari without prompt', async () => {
      await renderWith(makeInstallPromptMock({ isIos: true }));

      expect(screen.getByText(/Teilen-Symbol antippen/)).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: /Jetzt als App installieren/ })
      ).toBeNull();
    });

    it('shows the "already installed" badge when running standalone', async () => {
      await renderWith(makeInstallPromptMock({ isStandalone: true }));

      expect(
        screen.getByText('Du nutzt bereits die installierte App')
      ).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: /Jetzt als App installieren/ })
      ).toBeNull();
    });
  });
});
