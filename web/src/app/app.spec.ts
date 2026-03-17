import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { signal, WritableSignal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { of } from 'rxjs';
import { StatsApiService, UserConfigApiService } from '@pu-stats/data-access';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AuthStore } from '@pu-auth/auth';
import { App } from './app';
import { UserContextService } from './user-context.service';

describe('App (testing-library)', () => {
  let userNameSignal: WritableSignal<string>;
  const authMock = {
    user: signal({ uid: 'default', displayName: 'default', email: 'default' }),
    loading: () => false,
    isAuthenticated: () => true,
    isGuest: () => false,
    error: () => null,
    logout: () => Promise.resolve(),
  };

  const userConfigApiMock = {
    getConfig: vitest.fn().mockReturnValue(of({ dailyGoal: 100 })),
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
  };

  beforeEach(() => {
    userNameSignal = signal('default');
    vitest.clearAllMocks();
  });

  it('should create app shell', async () => {
    const { fixture } = await render(App, {
      providers: [
        provideRouter([]),
        {
          provide: UserContextService,
          useValue: {
            userNameSafe: userNameSignal.asReadonly(),
            userIdSafe: () => 'u1',
          },
        },
        { provide: AuthStore, useValue: authMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
        { provide: StatsApiService, useValue: statsApiMock },
      ],
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders sidenav navigation links', async () => {
    await render(App, {
      providers: [
        provideRouter([]),
        {
          provide: UserContextService,
          useValue: {
            userNameSafe: userNameSignal.asReadonly(),
            userIdSafe: () => 'u1',
          },
        },
        { provide: AuthStore, useValue: authMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
        { provide: StatsApiService, useValue: statsApiMock },
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
    userConfigApiMock.getConfig.mockReturnValueOnce(of({ dailyGoal: 137 }));
    statsApiMock.load.mockReturnValueOnce(
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
        {
          provide: UserContextService,
          useValue: {
            userNameSafe: userNameSignal.asReadonly(),
            userIdSafe: () => 'u1',
          },
        },
        { provide: AuthStore, useValue: authMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
        { provide: StatsApiService, useValue: statsApiMock },
      ],
    });

    expect(screen.getByText('Tagesziel')).toBeTruthy();
    expect(
      await screen.findByText((content) => content.includes('42 / 137'))
    ).toBeTruthy();
  });

  it('keeps base document title when no seo route data is active', async () => {
    await render(App, {
      providers: [
        provideRouter([]),
        {
          provide: UserContextService,
          useValue: {
            userNameSafe: userNameSignal.asReadonly(),
            userIdSafe: () => 'u1',
          },
        },
        { provide: AuthStore, useValue: authMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
        { provide: StatsApiService, useValue: statsApiMock },
      ],
    });

    const title = TestBed.inject(Title);
    expect(title.getTitle()).toContain('Pushup Tracker');
  });
});
