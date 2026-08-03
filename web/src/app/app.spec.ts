import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal, WritableSignal, PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { of } from 'rxjs';
import {
  ExerciseFirestoreService,
  StatsApiService,
  UserConfigApiService,
} from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import { Auth } from '@angular/fire/auth';
import {
  AuthService,
  AuthStore,
  FeatureFlagsService,
  UserContextService,
} from '@pu-auth/auth';
import { AdsStore } from '@pu-stats/ads';
import { VAPID_PUBLIC_KEY } from '@pu-push/push';
import { App } from './app';
import { GoalReachedNotificationService } from './core/goal-reached-notification.service';
import { QuickAddOrchestrationService } from './core/quick-add-orchestration.service';
import { SwUpdateService } from './core/sw-update.service';

describe('App (testing-library)', () => {
  let userNameSignal: WritableSignal<string>;
  let liveEntriesSignal: WritableSignal<unknown[]>;
  let liveConnectedSignal: WritableSignal<boolean>;
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

  const exerciseFirestoreMock = {
    createEntry: vitest.fn().mockReturnValue(of({ _id: 'x' })),
    listEntries: vitest.fn().mockReturnValue(of([])),
    deleteEntry: vitest.fn().mockReturnValue(of({ ok: true })),
    updateEntry: vitest.fn().mockReturnValue(of(undefined)),
  };

  beforeEach(() => {
    userNameSignal = signal('default');
    liveEntriesSignal = signal([]);
    liveConnectedSignal = signal(false);
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
        { provide: ExerciseFirestoreService, useValue: exerciseFirestoreMock },
        {
          provide: LiveDataStore,
          useValue: {
            connected: liveConnectedSignal,
            exerciseEntries: liveEntriesSignal,
            exerciseEntriesLoaded: liveConnectedSignal,
            updateTick: signal(0),
          },
        },
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
        { provide: ExerciseFirestoreService, useValue: exerciseFirestoreMock },
        {
          provide: LiveDataStore,
          useValue: {
            connected: liveConnectedSignal,
            exerciseEntries: liveEntriesSignal,
            exerciseEntriesLoaded: liveConnectedSignal,
            updateTick: signal(0),
          },
        },
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
    const today = new Date().toISOString().slice(0, 10);
    liveEntriesSignal.set([
      {
        _id: 'e1',
        exerciseId: 'pushup',
        timestamp: `${today}T10:00:00`,
        reps: 42,
        source: 'web',
      },
    ]);
    liveConnectedSignal.set(true);

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
        { provide: ExerciseFirestoreService, useValue: exerciseFirestoreMock },
        {
          provide: LiveDataStore,
          useValue: {
            connected: liveConnectedSignal,
            exerciseEntries: liveEntriesSignal,
            exerciseEntriesLoaded: liveConnectedSignal,
            updateTick: signal(0),
          },
        },
      ],
    });

    expect(screen.getByText('Tagesziel')).toBeTruthy();
    expect(
      await screen.findAllByText((content) => content.includes('42 / 137'))
    ).toBeTruthy();
  });

  it('given a configured daily goal, when the goal pill is hovered, then it expands into a per-exercise breakdown dropdown', async () => {
    userConfigApiMock.getConfig.mockReturnValue(of({ dailyGoal: 137 }));
    const today = new Date().toISOString().slice(0, 10);
    liveEntriesSignal.set([
      {
        _id: 'e1',
        exerciseId: 'pushup',
        timestamp: `${today}T10:00:00`,
        reps: 42,
        source: 'web',
      },
    ]);
    liveConnectedSignal.set(true);

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
        { provide: ExerciseFirestoreService, useValue: exerciseFirestoreMock },
        {
          provide: LiveDataStore,
          useValue: {
            connected: liveConnectedSignal,
            exerciseEntries: liveEntriesSignal,
            exerciseEntriesLoaded: liveConnectedSignal,
            updateTick: signal(0),
          },
        },
      ],
    });

    // Wait for the daily progress resource to resolve so the breakdown is
    // populated.
    await screen.findAllByText((content) => content.includes('42 / 137'));

    const pillWrap = screen.getByTestId('toolbar-goal-pill-wrap');
    // Panel renders through a body-level CDK overlay only once opened, so it
    // is absent until the pill is hovered.
    expect(
      document.querySelector('[data-testid="toolbar-goal-dropdown"]')
    ).toBeNull();

    const user = userEvent.setup();
    await user.hover(pillWrap);

    const dropdown = await screen.findByTestId('toolbar-goal-dropdown');
    const items = dropdown.querySelectorAll(
      '[data-testid="toolbar-goal-dropdown-item"]'
    );
    expect(items.length).toBe(1);
    expect(dropdown.textContent).toContain('Liegestütze');
    expect(dropdown.textContent).toContain('42 / 137');
  });

  describe('toolbar goal-pill replay', () => {
    function makeNotifierMock(): {
      reopen: ReturnType<typeof vitest.fn>;
      reopenPrimaryGoal: ReturnType<typeof vitest.fn>;
    } {
      return { reopen: vitest.fn(), reopenPrimaryGoal: vitest.fn() };
    }

    function commonProviders(notifierMock: {
      reopen: ReturnType<typeof vitest.fn>;
      reopenPrimaryGoal: ReturnType<typeof vitest.fn>;
    }) {
      return [
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
        { provide: ExerciseFirestoreService, useValue: exerciseFirestoreMock },
        {
          provide: LiveDataStore,
          useValue: {
            connected: liveConnectedSignal,
            exerciseEntries: liveEntriesSignal,
            exerciseEntriesLoaded: liveConnectedSignal,
            updateTick: signal(0),
          },
        },
        // Stub the notifier so its constructor-time effects (which inject
        // many other root services) don't run in this minimal harness.
        { provide: GoalReachedNotificationService, useValue: notifierMock },
      ];
    }

    it('given the daily goal is reached, when the pill is clicked, then it replays the daily celebration', async () => {
      // Given — dailyGoal=50, todayProgress=80 → goalReached === true.
      userConfigApiMock.getConfig.mockReturnValue(of({ dailyGoal: 50 }));
      const notifierMock = makeNotifierMock();
      const user = userEvent.setup();
      const today1 = new Date().toISOString().slice(0, 10);
      liveEntriesSignal.set([
        {
          _id: 'e1',
          exerciseId: 'pushup',
          timestamp: `${today1}T10:00:00`,
          reps: 80,
          source: 'web',
        },
      ]);
      liveConnectedSignal.set(true);
      await render(App, {
        providers: commonProviders(notifierMock),
      });
      await screen.findAllByText((content) => content.includes('80 / 50'));

      // When
      await user.click(screen.getByTestId('toolbar-goal-pill'));

      // Then
      expect(notifierMock.reopenPrimaryGoal).toHaveBeenCalledTimes(1);
      expect(notifierMock.reopen).not.toHaveBeenCalled();
    });

    it('given the daily goal has NOT been reached, when the pill is clicked, then the notifier stays quiet', async () => {
      // Given — dailyGoal=100, todayProgress=10 → goalReached === false.
      userConfigApiMock.getConfig.mockReturnValue(of({ dailyGoal: 100 }));
      const notifierMock = makeNotifierMock();
      const user = userEvent.setup();
      const today2 = new Date().toISOString().slice(0, 10);
      liveEntriesSignal.set([
        {
          _id: 'e1',
          exerciseId: 'pushup',
          timestamp: `${today2}T10:00:00`,
          reps: 10,
          source: 'web',
        },
      ]);
      liveConnectedSignal.set(true);
      await render(App, {
        providers: commonProviders(notifierMock),
      });
      await screen.findAllByText((content) => content.includes('10 / 100'));

      // When
      await user.click(screen.getByTestId('toolbar-goal-pill'));

      // Then
      expect(notifierMock.reopenPrimaryGoal).not.toHaveBeenCalled();
      expect(notifierMock.reopen).not.toHaveBeenCalled();
    });

    it('exposes role="button", tabindex="0" and a localized aria-label on the pill once the daily goal is reached', async () => {
      // Given
      userConfigApiMock.getConfig.mockReturnValue(of({ dailyGoal: 50 }));
      const notifierMock = makeNotifierMock();
      const today3 = new Date().toISOString().slice(0, 10);
      liveEntriesSignal.set([
        {
          _id: 'e1',
          exerciseId: 'pushup',
          timestamp: `${today3}T10:00:00`,
          reps: 80,
          source: 'web',
        },
      ]);
      liveConnectedSignal.set(true);
      await render(App, { providers: commonProviders(notifierMock) });
      await screen.findAllByText((content) => content.includes('80 / 50'));

      // Then — the source-locale (de) build serves the German aria copy.
      const pill = document.querySelector<HTMLElement>(
        '[data-testid="toolbar-goal-pill"]'
      );
      expect(pill).toBeTruthy();
      expect(pill?.classList.contains('is-clickable')).toBe(true);
      expect(pill?.getAttribute('role')).toBe('button');
      expect(pill?.getAttribute('tabindex')).toBe('0');
      expect(pill?.getAttribute('aria-label')).toBe(
        'Tagesziel-Animation erneut abspielen'
      );
    });

    it('labels the pill as the goal-details toggle while the daily goal is not yet reached', async () => {
      // Given
      userConfigApiMock.getConfig.mockReturnValue(of({ dailyGoal: 100 }));
      const notifierMock = makeNotifierMock();
      const today4 = new Date().toISOString().slice(0, 10);
      liveEntriesSignal.set([
        {
          _id: 'e1',
          exerciseId: 'pushup',
          timestamp: `${today4}T10:00:00`,
          reps: 10,
          source: 'web',
        },
      ]);
      liveConnectedSignal.set(true);
      await render(App, { providers: commonProviders(notifierMock) });
      await screen.findAllByText((content) => content.includes('10 / 100'));

      // Then
      const pill = document.querySelector<HTMLElement>(
        '[data-testid="toolbar-goal-pill"]'
      );
      expect(pill).toBeTruthy();
      expect(pill?.getAttribute('role')).toBe('button');
      expect(pill?.getAttribute('tabindex')).toBe('0');
      expect(pill?.getAttribute('aria-label')).toBe(
        'Tagesziel-Einzelpositionen anzeigen'
      );
      expect(pill?.getAttribute('aria-expanded')).toBe('false');
    });

    it('opens the goal details on a pill tap while the daily goal is not yet reached', async () => {
      // given a goal that is still open (no hover on touch devices)
      userConfigApiMock.getConfig.mockReturnValue(of({ dailyGoal: 100 }));
      const notifierMock = makeNotifierMock();
      const today = new Date().toISOString().slice(0, 10);
      liveEntriesSignal.set([
        {
          _id: 'e1',
          exerciseId: 'pushup',
          timestamp: `${today}T10:00:00`,
          reps: 10,
          source: 'web',
        },
      ]);
      liveConnectedSignal.set(true);
      await render(App, { providers: commonProviders(notifierMock) });
      await screen.findAllByText((content) => content.includes('10 / 100'));

      // when the pill is tapped
      await userEvent.click(screen.getByTestId('toolbar-goal-pill'));

      // then the breakdown opens instead of replaying the celebration
      const dropdown = await screen.findByTestId('toolbar-goal-dropdown');
      expect(dropdown.textContent).toContain('Liegestütze');
      expect(notifierMock.reopenPrimaryGoal).not.toHaveBeenCalled();
    });

    it('replays the celebration when Enter is pressed on the pill after the goal is reached', async () => {
      // Given — goal reached + pill focusable.
      userConfigApiMock.getConfig.mockReturnValue(of({ dailyGoal: 50 }));
      const notifierMock = makeNotifierMock();
      const today5 = new Date().toISOString().slice(0, 10);
      liveEntriesSignal.set([
        {
          _id: 'e1',
          exerciseId: 'pushup',
          timestamp: `${today5}T10:00:00`,
          reps: 80,
          source: 'web',
        },
      ]);
      liveConnectedSignal.set(true);
      await render(App, { providers: commonProviders(notifierMock) });
      await screen.findAllByText((content) => content.includes('80 / 50'));
      const pill = document.querySelector<HTMLElement>(
        '[data-testid="toolbar-goal-pill"]'
      );

      // When
      pill?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );

      // Then
      expect(notifierMock.reopenPrimaryGoal).toHaveBeenCalledTimes(1);
      expect(notifierMock.reopen).not.toHaveBeenCalled();
    });

    it('replays the celebration when Space is pressed and suppresses the default page-scroll', async () => {
      // Given
      userConfigApiMock.getConfig.mockReturnValue(of({ dailyGoal: 50 }));
      const notifierMock = makeNotifierMock();
      const today6 = new Date().toISOString().slice(0, 10);
      liveEntriesSignal.set([
        {
          _id: 'e1',
          exerciseId: 'pushup',
          timestamp: `${today6}T10:00:00`,
          reps: 80,
          source: 'web',
        },
      ]);
      liveConnectedSignal.set(true);
      await render(App, { providers: commonProviders(notifierMock) });
      await screen.findAllByText((content) => content.includes('80 / 50'));
      const pill = document.querySelector<HTMLElement>(
        '[data-testid="toolbar-goal-pill"]'
      );
      const spaceEvent = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true,
      });

      // When
      pill?.dispatchEvent(spaceEvent);

      // Then
      expect(notifierMock.reopenPrimaryGoal).toHaveBeenCalledTimes(1);
      expect(notifierMock.reopen).not.toHaveBeenCalled();
      expect(spaceEvent.defaultPrevented).toBe(true);
    });

    it('does NOT replay the celebration on auto-repeat keydown events (held key)', async () => {
      // Given — held Enter emits repeated keydown events; WAI-ARIA Button
      // Pattern says only the first press activates.
      userConfigApiMock.getConfig.mockReturnValue(of({ dailyGoal: 50 }));
      const notifierMock = makeNotifierMock();
      const today7 = new Date().toISOString().slice(0, 10);
      liveEntriesSignal.set([
        {
          _id: 'e1',
          exerciseId: 'pushup',
          timestamp: `${today7}T10:00:00`,
          reps: 80,
          source: 'web',
        },
      ]);
      liveConnectedSignal.set(true);
      await render(App, { providers: commonProviders(notifierMock) });
      await screen.findAllByText((content) => content.includes('80 / 50'));
      const pill = document.querySelector<HTMLElement>(
        '[data-testid="toolbar-goal-pill"]'
      );

      // When — repeat: true on the synthetic event flags it as auto-repeat.
      pill?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          repeat: true,
        })
      );

      // Then
      expect(notifierMock.reopenPrimaryGoal).not.toHaveBeenCalled();
      expect(notifierMock.reopen).not.toHaveBeenCalled();
    });
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
          {
            provide: ExerciseFirestoreService,
            useValue: exerciseFirestoreMock,
          },
          {
            provide: LiveDataStore,
            useValue: {
              connected: liveConnectedSignal,
              exerciseEntries: liveEntriesSignal,
              exerciseEntriesLoaded: liveConnectedSignal,
              updateTick: signal(0),
            },
          },
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
          {
            provide: ExerciseFirestoreService,
            useValue: exerciseFirestoreMock,
          },
          {
            provide: LiveDataStore,
            useValue: {
              connected: liveConnectedSignal,
              exerciseEntries: liveEntriesSignal,
              exerciseEntriesLoaded: liveConnectedSignal,
              updateTick: signal(0),
            },
          },
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
          {
            provide: ExerciseFirestoreService,
            useValue: exerciseFirestoreMock,
          },
          {
            provide: LiveDataStore,
            useValue: {
              connected: liveConnectedSignal,
              exerciseEntries: liveEntriesSignal,
              exerciseEntriesLoaded: liveConnectedSignal,
              updateTick: signal(0),
            },
          },
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
          {
            provide: ExerciseFirestoreService,
            useValue: exerciseFirestoreMock,
          },
          {
            provide: LiveDataStore,
            useValue: {
              connected: liveConnectedSignal,
              exerciseEntries: liveEntriesSignal,
              exerciseEntriesLoaded: liveConnectedSignal,
              updateTick: signal(0),
            },
          },
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
    it.each(['fr', 'es', 'it', 'nl', 'el', 'no', 'zh'] as const)(
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
            {
              provide: ExerciseFirestoreService,
              useValue: exerciseFirestoreMock,
            },
            {
              provide: LiveDataStore,
              useValue: {
                connected: liveConnectedSignal,
                exerciseEntries: liveEntriesSignal,
                exerciseEntriesLoaded: liveConnectedSignal,
                updateTick: signal(0),
              },
            },
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

    it.each(['fr', 'es', 'it', 'nl', 'el', 'no', 'zh'] as const)(
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
            {
              provide: ExerciseFirestoreService,
              useValue: exerciseFirestoreMock,
            },
            {
              provide: LiveDataStore,
              useValue: {
                connected: liveConnectedSignal,
                exerciseEntries: liveEntriesSignal,
                exerciseEntriesLoaded: liveConnectedSignal,
                updateTick: signal(0),
              },
            },
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
        { provide: ExerciseFirestoreService, useValue: exerciseFirestoreMock },
        {
          provide: LiveDataStore,
          useValue: {
            connected: liveConnectedSignal,
            exerciseEntries: liveEntriesSignal,
            exerciseEntriesLoaded: liveConnectedSignal,
            updateTick: signal(0),
          },
        },
      ],
    });

    const brandLink = screen.getByRole('link', { name: 'Zur Landingpage' });
    expect(brandLink.closest('mat-toolbar.top-nav')).toBeTruthy();
    const logo = brandLink.querySelector('img') as HTMLImageElement | null;
    expect(logo).toBeTruthy();
    expect(logo?.getAttribute('src')).toBe('assets/pushup-logo.webp');
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
        { provide: ExerciseFirestoreService, useValue: exerciseFirestoreMock },
        {
          provide: LiveDataStore,
          useValue: {
            connected: liveConnectedSignal,
            exerciseEntries: liveEntriesSignal,
            exerciseEntriesLoaded: liveConnectedSignal,
            updateTick: signal(0),
          },
        },
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

  describe('speed-dial coachmark', () => {
    const SEEN_KEY = 'pus_speeddial_coachmark_seen';

    function coachmarkProviders() {
      return [
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
        { provide: ExerciseFirestoreService, useValue: exerciseFirestoreMock },
        {
          provide: LiveDataStore,
          useValue: {
            connected: liveConnectedSignal,
            exerciseEntries: liveEntriesSignal,
            exerciseEntriesLoaded: liveConnectedSignal,
            updateTick: signal(0),
          },
        },
      ];
    }

    afterEach(() => {
      try {
        localStorage.removeItem(SEEN_KEY);
      } catch {
        /* localStorage unavailable */
      }
    });

    it('shows the tutorial bubble once onboarding is complete and it has not been seen', async () => {
      // given — onboarding finished (consent.acceptedAt set), flag absent
      localStorage.removeItem(SEEN_KEY);
      userConfigApiMock.getConfig.mockReturnValue(
        of({ dailyGoal: 100, consent: { acceptedAt: '2025-01-01T00:00:00Z' } })
      );

      // when
      await render(App, { providers: coachmarkProviders() });

      // then — the bubble's primary action proves it is visible
      expect(
        await screen.findByRole('button', { name: 'Verstanden' })
      ).toBeTruthy();
    });

    it('stays hidden when the tutorial was already dismissed', async () => {
      // given — flag persisted from a previous session
      localStorage.setItem(SEEN_KEY, '1');
      userConfigApiMock.getConfig.mockReturnValue(
        of({ dailyGoal: 100, consent: { acceptedAt: '2025-01-01T00:00:00Z' } })
      );

      // when
      await render(App, { providers: coachmarkProviders() });
      // wait until config has propagated (toolbar shows the goal) so the
      // trigger effect has definitely run before we assert absence
      await screen.findAllByText((content) => content.includes('/ 100'));

      // then
      expect(screen.queryByRole('button', { name: 'Verstanden' })).toBeNull();
    });

    it('stays hidden while onboarding is not yet complete', async () => {
      // given — no consent.acceptedAt → onboarding unfinished
      localStorage.removeItem(SEEN_KEY);
      userConfigApiMock.getConfig.mockReturnValue(of({ dailyGoal: 100 }));

      // when
      await render(App, { providers: coachmarkProviders() });
      await screen.findAllByText((content) => content.includes('/ 100'));

      // then
      expect(screen.queryByRole('button', { name: 'Verstanden' })).toBeNull();
    });
  });

  describe('speed-dial FAB visibility', () => {
    function providersForUser(userCtx: {
      userIdSafe: () => string;
      isGuest: () => boolean;
    }) {
      return [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: UserContextService,
          useValue: {
            userNameSafe: userNameSignal.asReadonly(),
            isAdmin: () => false,
            ...userCtx,
          },
        },
        { provide: AuthStore, useValue: authMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: Auth, useValue: firebaseAuthMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
        { provide: StatsApiService, useValue: statsApiMock },
        { provide: AdsStore, useValue: adsStoreMock },
        { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
        { provide: ExerciseFirestoreService, useValue: exerciseFirestoreMock },
        {
          provide: LiveDataStore,
          useValue: {
            connected: liveConnectedSignal,
            exerciseEntries: liveEntriesSignal,
            exerciseEntriesLoaded: liveConnectedSignal,
            updateTick: signal(0),
          },
        },
      ];
    }

    it('renders the speed-dial FAB for guest users', async () => {
      // given — a guest (real anonymous uid, isGuest === true)
      await render(App, {
        providers: providersForUser({
          userIdSafe: () => 'guest-uid',
          isGuest: () => true,
        }),
      });

      // then
      expect(
        await screen.findByRole('button', { name: /Schnellerfassung öffnen/i })
      ).toBeTruthy();
    });

    it('hides the speed-dial FAB when there is no authenticated user', async () => {
      // given — signed out (no uid)
      await render(App, {
        providers: providersForUser({
          userIdSafe: () => '',
          isGuest: () => false,
        }),
      });

      // then
      expect(
        screen.queryByRole('button', { name: /Schnellerfassung öffnen/i })
      ).toBeNull();
    });
  });

  // The reload prompt used to live only in a MatSnackBar, which any other
  // toast dismisses for good — VERSION_READY never fires twice. The toolbar
  // button is the durable half of the notice; SwUpdateService owns the
  // snackbar half and is covered in core/sw-update.service.spec.ts.
  describe('service worker update indicator', () => {
    function renderWithSwUpdate(swUpdateService: {
      updateAvailable: () => boolean;
      applyUpdate: () => Promise<void>;
    }) {
      return render(App, {
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
          {
            provide: ExerciseFirestoreService,
            useValue: exerciseFirestoreMock,
          },
          {
            provide: LiveDataStore,
            useValue: {
              connected: liveConnectedSignal,
              exerciseEntries: liveEntriesSignal,
              exerciseEntriesLoaded: liveConnectedSignal,
              updateTick: signal(0),
            },
          },
          { provide: SwUpdateService, useValue: swUpdateService },
        ],
      });
    }

    it('should hide the reload button while no update is pending', async () => {
      // given / when
      await renderWithSwUpdate({
        updateAvailable: () => false,
        applyUpdate: vitest.fn().mockResolvedValue(undefined),
      });

      // then
      expect(
        screen.queryByRole('button', {
          name: /Neue Version verf\u00fcgbar/i,
        })
      ).toBeNull();
    });

    it('should apply the update when the toolbar reload button is clicked', async () => {
      // given
      const applyUpdate = vitest.fn().mockResolvedValue(undefined);
      const pending = signal(true);
      await renderWithSwUpdate({
        updateAvailable: pending,
        applyUpdate,
      });

      // when
      await userEvent.click(
        screen.getByRole('button', { name: /Neue Version verf\u00fcgbar/i })
      );

      // then
      expect(applyUpdate).toHaveBeenCalledTimes(1);
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
        { provide: ExerciseFirestoreService, useValue: exerciseFirestoreMock },
        {
          provide: LiveDataStore,
          useValue: {
            connected: liveConnectedSignal,
            exerciseEntries: liveEntriesSignal,
            exerciseEntriesLoaded: liveConnectedSignal,
            updateTick: signal(0),
          },
        },
      ],
    });

    const title = TestBed.inject(Title);
    expect(title.getTitle()).toContain('Pushup Tracker');
  });

  describe('auto-count feature flag wiring', () => {
    it('given the admin-gated auto counter flag is true, then app.autoCountEnabled() is true', async () => {
      const autoFlag = signal(true);
      const { fixture } = await render(App, {
        providers: [
          provideRouter([]),
          { provide: PLATFORM_ID, useValue: 'browser' },
          {
            provide: UserContextService,
            useValue: {
              userNameSafe: userNameSignal.asReadonly(),
              userIdSafe: () => 'u1',
              isAdmin: () => true,
              isGuest: () => false,
            },
          },
          {
            provide: FeatureFlagsService,
            useValue: { autoExerciseCounter: autoFlag.asReadonly() },
          },
          { provide: AuthStore, useValue: authMock },
          { provide: AuthService, useValue: authServiceMock },
          { provide: Auth, useValue: firebaseAuthMock },
          { provide: UserConfigApiService, useValue: userConfigApiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          { provide: AdsStore, useValue: adsStoreMock },
          { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
          {
            provide: ExerciseFirestoreService,
            useValue: exerciseFirestoreMock,
          },
          {
            provide: LiveDataStore,
            useValue: {
              connected: liveConnectedSignal,
              exerciseEntries: liveEntriesSignal,
              exerciseEntriesLoaded: liveConnectedSignal,
              updateTick: signal(0),
            },
          },
        ],
      });
      expect(fixture.componentInstance.autoCountEnabled()).toBe(true);

      autoFlag.set(false);
      expect(fixture.componentInstance.autoCountEnabled()).toBe(false);
    });

    it('when handleOpenAutoCount is invoked, then it delegates to QuickAddOrchestrationService.openAutoCount', async () => {
      const openAutoCount = vitest.fn();
      const { fixture } = await render(App, {
        providers: [
          provideRouter([]),
          { provide: PLATFORM_ID, useValue: 'browser' },
          {
            provide: UserContextService,
            useValue: {
              userNameSafe: userNameSignal.asReadonly(),
              userIdSafe: () => 'u1',
              isAdmin: () => true,
              isGuest: () => false,
            },
          },
          {
            provide: FeatureFlagsService,
            useValue: { autoExerciseCounter: signal(true).asReadonly() },
          },
          { provide: AuthStore, useValue: authMock },
          { provide: AuthService, useValue: authServiceMock },
          { provide: Auth, useValue: firebaseAuthMock },
          { provide: UserConfigApiService, useValue: userConfigApiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          { provide: AdsStore, useValue: adsStoreMock },
          { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
          {
            provide: ExerciseFirestoreService,
            useValue: exerciseFirestoreMock,
          },
          {
            provide: LiveDataStore,
            useValue: {
              connected: liveConnectedSignal,
              exerciseEntries: liveEntriesSignal,
              exerciseEntriesLoaded: liveConnectedSignal,
              updateTick: signal(0),
            },
          },
          {
            provide: QuickAddOrchestrationService,
            useValue: {
              add: vitest.fn(),
              fillToGoal: vitest.fn(),
              openDialog: vitest.fn(),
              openAutoCount,
              fillToGoalInFlight: signal(false).asReadonly(),
            },
          },
        ],
      });

      fixture.componentInstance.handleOpenAutoCount();
      expect(openAutoCount).toHaveBeenCalledTimes(1);
    });

    it('when handleOpenExerciseTimer is invoked, then it delegates to QuickAddOrchestrationService.openExerciseTimer', async () => {
      const openExerciseTimer = vitest.fn();
      const { fixture } = await render(App, {
        providers: [
          provideRouter([]),
          { provide: PLATFORM_ID, useValue: 'browser' },
          {
            provide: UserContextService,
            useValue: {
              userNameSafe: userNameSignal.asReadonly(),
              userIdSafe: () => 'u1',
              isAdmin: () => true,
              isGuest: () => false,
            },
          },
          {
            provide: FeatureFlagsService,
            useValue: { autoExerciseCounter: signal(true).asReadonly() },
          },
          { provide: AuthStore, useValue: authMock },
          { provide: AuthService, useValue: authServiceMock },
          { provide: Auth, useValue: firebaseAuthMock },
          { provide: UserConfigApiService, useValue: userConfigApiMock },
          { provide: StatsApiService, useValue: statsApiMock },
          { provide: AdsStore, useValue: adsStoreMock },
          { provide: VAPID_PUBLIC_KEY, useValue: 'test-vapid-key' },
          {
            provide: ExerciseFirestoreService,
            useValue: exerciseFirestoreMock,
          },
          {
            provide: LiveDataStore,
            useValue: {
              connected: liveConnectedSignal,
              exerciseEntries: liveEntriesSignal,
              exerciseEntriesLoaded: liveConnectedSignal,
              updateTick: signal(0),
            },
          },
          {
            provide: QuickAddOrchestrationService,
            useValue: {
              add: vitest.fn(),
              fillToGoal: vitest.fn(),
              openDialog: vitest.fn(),
              openAutoCount: vitest.fn(),
              openExerciseTimer,
              fillToGoalInFlight: signal(false).asReadonly(),
            },
          },
        ],
      });

      fixture.componentInstance.handleOpenExerciseTimer();
      expect(openExerciseTimer).toHaveBeenCalledTimes(1);
    });
  });
});
