import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { signal, WritableSignal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { of } from 'rxjs';
import { UserConfigApiService } from '@pu-stats/data-access';
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
    error: () => null,
    logout: () => Promise.resolve(),
  };

  const userConfigApiMock = {
    getConfig: vitest.fn().mockReturnValue(of({ dailyGoal: 100 })),
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
      ],
    });
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Daten')).toBeTruthy();
    expect(screen.getByText('Analyse')).toBeTruthy();
    expect(screen.getByText('Einstellungen')).toBeTruthy();
    expect(screen.getByText('Sprache')).toBeTruthy();
    expect(screen.getByText('Deutsch')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
  });

  it('shows daily goal in toolbar', async () => {
    userConfigApiMock.getConfig.mockReturnValueOnce(of({ dailyGoal: 137 }));

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
      ],
    });

    expect(screen.getByText('Tagesziel')).toBeTruthy();
    expect(
      await screen.findByText((content) => content.includes('137'))
    ).toBeTruthy();
  });

  describe('HTML title', () => {
    async function setup() {
      return render(App, {
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
        ],
      });
    }

    it('shows fallback text in title when user is default', async () => {
      await setup();
      const title = TestBed.inject(Title);
      expect(title.getTitle()).toBe('Pushup Tracker – Dein Name 💪');
    });

    it('shows username in title when user is set', async () => {
      const { fixture } = await setup();
      userNameSignal.set('wolf');
      await fixture.whenStable();
      const title = TestBed.inject(Title);
      expect(title.getTitle()).toBe('Pushup Tracker – wolf');
      userNameSignal.set('anna');
      await fixture.whenStable();
      expect(title.getTitle()).toBe('Pushup Tracker – anna');
    });
  });
});
