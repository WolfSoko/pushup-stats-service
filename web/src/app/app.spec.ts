import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { signal, WritableSignal, PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate } from '@angular/service-worker';
import { of, Subject } from 'rxjs';
import { StatsApiService, UserConfigApiService } from '@pu-stats/data-access';
import { Auth } from '@angular/fire/auth';
import { AuthService, AuthStore, UserContextService } from '@pu-auth/auth';
import { AdsStore } from '@pu-stats/ads';
import { VAPID_PUBLIC_KEY } from '@pu-reminders/reminders';
import { App } from './app';

describe('App (testing-library)', () => {
  let userNameSignal: WritableSignal<string>;
  const authMock = {
    user: signal({ uid: 'default', displayName: 'default', email: 'default' }),
    loading: () => false,
    isAuthenticated: () => true,
    authResolved: () => true,
    isGuest: () => false,
    error: () => null,
    logout: () => Promise.resolve(),
    tryAsGuest: () => Promise.resolve(true),
  };

  const authServiceMock = {
    signInGuestIfNeeded: () => Promise.resolve(),
  };

  const firebaseAuthMock = {
    currentUser: { uid: 'u1' },
  };

  const userConfigApiMock = {
    getConfig: vitest.fn().mockReturnValue(of({ dailyGoal: 100 })),
  };

  const adsStoreMock = {
    enabled: () => true,
    adClient: () => undefined,
    targetedAdsConsent: () => true,
    consentAnswered: () => true,
    adsAllowed: () => true,
    landingInlineSlot: () => undefined,
    dashboardInlineSlot: () => undefined,
    dashboardInlineEnabled: () => false,
    setTargetedAdsConsent: vitest.fn(),
    init: () => Promise.resolve(true),
    hydrateConsent: vitest.fn(),
  };

  const statsApiMock = {
    load: vitest.fn().mockReturnValue(
      of({
        meta: {
          from: null,
          to: null,
          entries: 0,
          days: 1,
          total: 0,
          granularity: 'daily',
        },
        series: [],
      })
    ),
    listPushups: vitest.fn().mockReturnValue(of([])),
  };

  beforeEach(() => {
    userNameSignal = signal('default');
    vitest.clearAllMocks();
  });

  afterEach(() => {
    vitest.restoreAllMocks();
  });

  it('should create app shell', async () => {
    const { fixture } = await render(App, {
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: UserContextService,
          useValue: {
            userNameSafe: userNameSignal.asReadonly(),
            userIdSafe: () => 'u1',
            isAdmin: () => false,
            isGuest: () => false,
          },
        },
        { provide: AuthStore, useValue: authMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: Auth, useValue: firebaseAuthMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
        { provide: StatsApiService, useValue: statsApiMock },
        { provide: AdsStore, useValue: adsStoreMock },
        { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
      ],
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders sidenav navigation links', async () => {
    await render(App, {
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: UserContextService,
          useValue: {
            userNameSafe: userNameSignal.asReadonly(),
            userIdSafe: () => 'u1',
            isAdmin: () => false,
            isGuest: () => false,
          },
        },
        { provide: AuthStore, useValue: authMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: Auth, useValue: firebaseAuthMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
        { provide: StatsApiService, useValue: statsApiMock },
        { provide: AdsStore, useValue: adsStoreMock },
        { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
      ],
    });
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Historie').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Analyse').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bestenliste').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Trainingspläne').length).toBeGreaterThan(0);
    // Wiki link is in both the sidenav and the footer.
    expect(screen.getAllByText('Liegestütztypen').length).toBeGreaterThan(0);
    // The language switcher renders as a mat-select with a 'Sprache'
    // label; only the currently-selected option is visible until the
    // panel is opened.
    expect(screen.getByText('Sprache')).toBeTruthy();
  });

  it('shows daily progress and goal in toolbar', async () => {
    userConfigApiMock.getConfig.mockReturnValue(of({ dailyGoal: 137 }));
    statsApiMock.load.mockReturnValue(
      of({
        meta: {
          from: null,
          to: null,
          entries: 2,
          days: 1,
          total: 42,
          granularity: 'daily',
        },
        series: [],
      })
    );

    await render(App, {
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: UserContextService,
          useValue: {
            userNameSafe: userNameSignal.asReadonly(),
            userIdSafe: () => 'u1',
            isAdmin: () => false,
            isGuest: () => false,
          },
        },
        { provide: AuthStore, useValue: authMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: Auth, useValue: firebaseAuthMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
        { provide: StatsApiService, useValue: statsApiMock },
        { provide: AdsStore, useValue: adsStoreMock },
        { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
      ],
    });

    expect(screen.getByText('Tagesziel')).toBeTruthy();
    expect(
      await screen.findByText((content) => content.includes('42 / 137'))
    ).toBeTruthy();
  });

  describe('setLanguage', () => {
    it('preserves current page path when switching from de to en', async () => {
      const { fixture } = await render(App, {
        providers: [
          provideRouter([]),
          { provide: PLATFORM_ID, useValue: 'browser' },
          {
            provide: UserContextService,
            useValue: {
              userNameSafe: userNameSignal.asReadonly(),
              userIdSafe: () => 'u1',
              isAdmin: () => false,
              isGuest: () => false,
            },
          },
          { provide: AuthStore, useValue: authMock },
          { provide: AuthService, useValue: authServiceMock },
          { provide: Auth, useValue: firebaseAuthMock },

          { provide: UserConfigApiService, useValue: userConfigApiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          { provide: AdsStore, useValue: adsStoreMock },
          { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
        ],
      });

      const replaceSpy = vitest.fn();
      const locationMock = {
        pathname: '/de/app',
        search: '',
        hash: '',
        replace: replaceSpy,
      };
      vitest
        .spyOn(window, 'location', 'get')
        .mockReturnValue(locationMock as unknown as Location);

      fixture.componentInstance.setLanguage('en');
      expect(replaceSpy).toHaveBeenCalledWith('/en/app');
    });

    it('preserves current page path when switching from en to de', async () => {
      const { fixture } = await render(App, {
        providers: [
          provideRouter([]),
          { provide: PLATFORM_ID, useValue: 'browser' },
          {
            provide: UserContextService,
            useValue: {
              userNameSafe: userNameSignal.asReadonly(),
              userIdSafe: () => 'u1',
              isAdmin: () => false,
              isGuest: () => false,
            },
          },
          { provide: AuthStore, useValue: authMock },
          { provide: AuthService, useValue: authServiceMock },
          { provide: Auth, useValue: firebaseAuthMock },

          { provide: UserConfigApiService, useValue: userConfigApiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          { provide: AdsStore, useValue: adsStoreMock },
          { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
        ],
      });

      const replaceSpy = vitest.fn();
      const locationMock = {
        pathname: '/en/settings',
        search: '?tab=profile',
        hash: '',
        replace: replaceSpy,
      };
      vitest
        .spyOn(window, 'location', 'get')
        .mockReturnValue(locationMock as unknown as Location);

      fixture.componentInstance.setLanguage('de');
      expect(replaceSpy).toHaveBeenCalledWith('/de/settings?tab=profile');
    });

    it('navigates to locale root when on landing page', async () => {
      const { fixture } = await render(App, {
        providers: [
          provideRouter([]),
          { provide: PLATFORM_ID, useValue: 'browser' },
          {
            provide: UserContextService,
            useValue: {
              userNameSafe: userNameSignal.asReadonly(),
              userIdSafe: () => 'u1',
              isAdmin: () => false,
              isGuest: () => false,
            },
          },
          { provide: AuthStore, useValue: authMock },
          { provide: AuthService, useValue: authServiceMock },
          { provide: Auth, useValue: firebaseAuthMock },

          { provide: UserConfigApiService, useValue: userConfigApiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          { provide: AdsStore, useValue: adsStoreMock },
          { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
        ],
      });

      const replaceSpy = vitest.fn();
      const locationMock = {
        pathname: '/de',
        search: '',
        hash: '',
        replace: replaceSpy,
      };
      vitest
        .spyOn(window, 'location', 'get')
        .mockReturnValue(locationMock as unknown as Location);

      fixture.componentInstance.setLanguage('en');
      expect(replaceSpy).toHaveBeenCalledWith('/en/');
    });

    it('preserves hash fragment when switching language', async () => {
      const { fixture } = await render(App, {
        providers: [
          provideRouter([]),
          { provide: PLATFORM_ID, useValue: 'browser' },
          {
            provide: UserContextService,
            useValue: {
              userNameSafe: userNameSignal.asReadonly(),
              userIdSafe: () => 'u1',
              isAdmin: () => false,
              isGuest: () => false,
            },
          },
          { provide: AuthStore, useValue: authMock },
          { provide: AuthService, useValue: authServiceMock },
          { provide: Auth, useValue: firebaseAuthMock },

          { provide: UserConfigApiService, useValue: userConfigApiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          { provide: AdsStore, useValue: adsStoreMock },
          { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
        ],
      });

      const replaceSpy = vitest.fn();
      vitest.spyOn(window, 'location', 'get').mockReturnValue({
        pathname: '/de/settings',
        search: '?tab=profile',
        hash: '#privacy',
        replace: replaceSpy,
      } as unknown as Location);

      fixture.componentInstance.setLanguage('en');
      expect(replaceSpy).toHaveBeenCalledWith(
        '/en/settings?tab=profile#privacy'
      );
    });

    // Regression: the prefix-stripping regex is now driven by
    // SUPPORTED_LOCALES, so a typo in any of the new codes would
    // silently break language switching. Smoke-test every one.
    it.each(['fr', 'es', 'it', 'nl', 'el', 'la', 'zh'] as const)(
      'switches from /de/<path> to /%s/<path> for the new locales',
      async (target) => {
        const { fixture } = await render(App, {
          providers: [
            provideRouter([]),
            { provide: PLATFORM_ID, useValue: 'browser' },
            {
              provide: UserContextService,
              useValue: {
                userNameSafe: userNameSignal.asReadonly(),
                userIdSafe: () => 'u1',
                isAdmin: () => false,
                isGuest: () => false,
              },
            },
            { provide: AuthStore, useValue: authMock },
            { provide: AuthService, useValue: authServiceMock },
            { provide: Auth, useValue: firebaseAuthMock },
            { provide: UserConfigApiService, useValue: userConfigApiMock },
            { provide: StatsApiService, useValue: statsApiMock },
            { provide: AdsStore, useValue: adsStoreMock },
            { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
          ],
        });

        const replaceSpy = vitest.fn();
        vitest.spyOn(window, 'location', 'get').mockReturnValue({
          pathname: '/de/training-plans',
          search: '',
          hash: '',
          replace: replaceSpy,
        } as unknown as Location);

        fixture.componentInstance.setLanguage(target);
        expect(replaceSpy).toHaveBeenCalledWith(`/${target}/training-plans`);
      }
    );

    it.each(['fr', 'es', 'it', 'nl', 'el', 'la', 'zh'] as const)(
      'strips a /%s/ prefix when switching back to /de/',
      async (source) => {
        const { fixture } = await render(App, {
          providers: [
            provideRouter([]),
            { provide: PLATFORM_ID, useValue: 'browser' },
            {
              provide: UserContextService,
              useValue: {
                userNameSafe: userNameSignal.asReadonly(),
                userIdSafe: () => 'u1',
                isAdmin: () => false,
                isGuest: () => false,
              },
            },
            { provide: AuthStore, useValue: authMock },
            { provide: AuthService, useValue: authServiceMock },
            { provide: Auth, useValue: firebaseAuthMock },
            { provide: UserConfigApiService, useValue: userConfigApiMock },
            { provide: StatsApiService, useValue: statsApiMock },
            { provide: AdsStore, useValue: adsStoreMock },
            { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
          ],
        });

        const replaceSpy = vitest.fn();
        vitest.spyOn(window, 'location', 'get').mockReturnValue({
          pathname: `/${source}/training-plans`,
          search: '',
          hash: '',
          replace: replaceSpy,
        } as unknown as Location);

        fixture.componentInstance.setLanguage('de');
        expect(replaceSpy).toHaveBeenCalledWith('/de/training-plans');
      }
    );
  });

  it('renders the brand logo inside the top toolbar', async () => {
    await render(App, {
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: UserContextService,
          useValue: {
            userNameSafe: userNameSignal.asReadonly(),
            userIdSafe: () => 'u1',
            isAdmin: () => false,
            isGuest: () => false,
          },
        },
        { provide: AuthStore, useValue: authMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: Auth, useValue: firebaseAuthMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
        { provide: StatsApiService, useValue: statsApiMock },
        { provide: AdsStore, useValue: adsStoreMock },
        { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
      ],
    });

    const brandLink = screen.getByRole('link', { name: 'Zur Landingpage' });
    expect(brandLink.closest('mat-toolbar.top-nav')).toBeTruthy();
    const logo = brandLink.querySelector('img') as HTMLImageElement | null;
    expect(logo).toBeTruthy();
    expect(logo?.getAttribute('src')).toBe('assets/pushup-logo.png');
  });

  it('given app is rendered, when reading bottom navigation, then it exposes five primary links', async () => {
    // Given
    await render(App, {
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: UserContextService,
          useValue: {
            userNameSafe: userNameSignal.asReadonly(),
            userIdSafe: () => 'u1',
            isAdmin: () => false,
            isGuest: () => false,
          },
        },
        { provide: AuthStore, useValue: authMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: Auth, useValue: firebaseAuthMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
        { provide: StatsApiService, useValue: statsApiMock },
        { provide: AdsStore, useValue: adsStoreMock },
        { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
      ],
    });

    // When
    const bottomNav = document.querySelector('.bottom-nav');

    // Then
    expect(bottomNav).toBeTruthy();
    if (!bottomNav) {
      throw new Error('Expected .bottom-nav to be rendered');
    }
    const links = bottomNav.querySelectorAll('a');
    expect(links.length).toBe(5);
    expect(links[0].getAttribute('href')).toBe('/app');
    expect(links[1].getAttribute('href')).toBe('/analysis');
    expect(links[2].getAttribute('href')).toBe('/leaderboard');
    expect(links[3].getAttribute('href')).toBe('/training-plans');
    expect(links[4].getAttribute('href')).toBe('/blog');
  });

  // Regression: the early-access notice used to sit at the bottom-left,
  // where it overlapped the cookie consent banner (also bottom-anchored).
  // It must now open at the top so the consent banner stays visible.
  it('opens the early-access snackbar at the top so it does not overlap the consent banner', async () => {
    try {
      localStorage.removeItem('pus_early_access_dismissed');
    } catch {
      /* localStorage unavailable in this environment */
    }
    const openSpy = vitest
      .spyOn(MatSnackBar.prototype, 'open')
      .mockReturnValue({
        onAction: () => of(undefined),
        afterDismissed: () => of({ dismissedByAction: false }),
      } as unknown as ReturnType<MatSnackBar['open']>);

    await render(App, {
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: UserContextService,
          useValue: {
            userNameSafe: userNameSignal.asReadonly(),
            userIdSafe: () => 'u1',
            isAdmin: () => false,
            isGuest: () => false,
          },
        },
        { provide: AuthStore, useValue: authMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: Auth, useValue: firebaseAuthMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
        { provide: StatsApiService, useValue: statsApiMock },
        { provide: AdsStore, useValue: adsStoreMock },
        { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
      ],
    });

    const earlyAccessCall = openSpy.mock.calls.find(
      ([, , config]) => config?.panelClass === 'early-access-snackbar'
    );
    expect(earlyAccessCall).toBeTruthy();
    expect(earlyAccessCall?.[2]?.verticalPosition).toBe('top');
  });

  describe('service worker update notifications', () => {
    function makeSwUpdateMock() {
      const versionUpdates = new Subject<{ type: string }>();
      return {
        versionUpdates: versionUpdates.asObservable(),
        isEnabled: true,
        emit: (event: { type: string }) => versionUpdates.next(event),
      };
    }

    it('shows the actionable reload snackbar on VERSION_READY', async () => {
      const swUpdate = makeSwUpdateMock();
      const onActionSubject = new Subject<void>();
      const openSpy = vitest
        .spyOn(MatSnackBar.prototype, 'open')
        .mockReturnValue({
          onAction: () => onActionSubject.asObservable(),
          afterDismissed: () => of({ dismissedByAction: false }),
        } as unknown as ReturnType<MatSnackBar['open']>);

      await render(App, {
        providers: [
          provideRouter([]),
          { provide: PLATFORM_ID, useValue: 'browser' },
          {
            provide: UserContextService,
            useValue: {
              userNameSafe: userNameSignal.asReadonly(),
              userIdSafe: () => 'u1',
              isAdmin: () => false,
              isGuest: () => false,
            },
          },
          { provide: AuthStore, useValue: authMock },
          { provide: AuthService, useValue: authServiceMock },
          { provide: Auth, useValue: firebaseAuthMock },
          { provide: UserConfigApiService, useValue: userConfigApiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          { provide: AdsStore, useValue: adsStoreMock },
          { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
          { provide: SwUpdate, useValue: swUpdate },
        ],
      });

      swUpdate.emit({ type: 'VERSION_READY' });

      const reloadCall = openSpy.mock.calls.find(
        ([, action]) => action === 'Neu laden'
      );
      expect(reloadCall).toBeTruthy();
      expect(reloadCall?.[0]).toBe('Neue Version verfügbar');
    });

    // Regression: a non-actionable "downloading in background" toast used to
    // fire on VERSION_DETECTED, visually replacing the actionable reload toast
    // and leaving users with no way to apply the update.
    it('does not show a snackbar on VERSION_DETECTED', async () => {
      const swUpdate = makeSwUpdateMock();
      const openSpy = vitest
        .spyOn(MatSnackBar.prototype, 'open')
        .mockReturnValue({
          onAction: () => of(undefined),
          afterDismissed: () => of({ dismissedByAction: false }),
        } as unknown as ReturnType<MatSnackBar['open']>);

      await render(App, {
        providers: [
          provideRouter([]),
          { provide: PLATFORM_ID, useValue: 'browser' },
          {
            provide: UserContextService,
            useValue: {
              userNameSafe: userNameSignal.asReadonly(),
              userIdSafe: () => 'u1',
              isAdmin: () => false,
              isGuest: () => false,
            },
          },
          { provide: AuthStore, useValue: authMock },
          { provide: AuthService, useValue: authServiceMock },
          { provide: Auth, useValue: firebaseAuthMock },
          { provide: UserConfigApiService, useValue: userConfigApiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          { provide: AdsStore, useValue: adsStoreMock },
          { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
          { provide: SwUpdate, useValue: swUpdate },
        ],
      });

      const callsBefore = openSpy.mock.calls.length;
      swUpdate.emit({ type: 'VERSION_DETECTED' });
      expect(openSpy.mock.calls.length).toBe(callsBefore);
    });
  });

  it('keeps base document title when no seo route data is active', async () => {
    await render(App, {
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: UserContextService,
          useValue: {
            userNameSafe: userNameSignal.asReadonly(),
            userIdSafe: () => 'u1',
            isAdmin: () => false,
            isGuest: () => false,
          },
        },
        { provide: AuthStore, useValue: authMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: Auth, useValue: firebaseAuthMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
        { provide: StatsApiService, useValue: statsApiMock },
        { provide: AdsStore, useValue: adsStoreMock },
        { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
      ],
    });

    const title = TestBed.inject(Title);
    expect(title.getTitle()).toContain('Pushup Tracker');
  });
});
