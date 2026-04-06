import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { signal, WritableSignal, PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { of } from 'rxjs';
import { StatsApiService, UserConfigApiService } from '@pu-stats/data-access';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { AdsStore } from '@pu-stats/ads';
import { VAPID_PUBLIC_KEY } from '@pu-reminders/reminders';
import { App } from './app';

describe('App (testing-library)', () => {
  let userNameSignal: WritableSignal<string>;
  const authMock = {
    user: signal({ uid: 'default', displayName: 'default', email: 'default' }),
    loading: () => false,
    isAuthenticated: () => true,
    isGuest: () => false,
    error: () => null,
    logout: () => Promise.resolve(),
    tryAsGuest: () => Promise.resolve(true),
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
        { provide: UserConfigApiService, useValue: userConfigApiMock },
        { provide: StatsApiService, useValue: statsApiMock },
        { provide: AdsStore, useValue: adsStoreMock },
        { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
      ],
    });
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Daten').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Analyse').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bestenliste').length).toBeGreaterThan(0);
    expect(screen.getByText('Sprache')).toBeTruthy();
    expect(screen.getByText('Deutsch')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
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
