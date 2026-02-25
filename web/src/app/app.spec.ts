import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { signal, WritableSignal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
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

  beforeEach(() => {
    userNameSignal = signal('default');
  });

  it('should create app shell', async () => {
    const { fixture } = await render(App, {
      providers: [
        provideRouter([]),
        { provide: UserContextService, useValue: { userNameSafe: userNameSignal.asReadonly() } },
        { provide: AuthStore, useValue: authMock },
      ],
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders sidenav navigation links', async () => {
    await render(App, {
      providers: [
        provideRouter([]),
        { provide: UserContextService, useValue: { userNameSafe: userNameSignal.asReadonly() } },
        { provide: AuthStore, useValue: authMock },
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

  describe('HTML title', () => {
    async function setup() {
      return render(App, {
        providers: [
          provideRouter([]),
          { provide: UserContextService, useValue: { userNameSafe: userNameSignal.asReadonly() } },
          { provide: AuthStore, useValue: authMock },
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
      fixture.detectChanges();
      const title = TestBed.inject(Title);
      expect(title.getTitle()).toBe('Pushup Tracker – wolf');
      userNameSignal.set('anna');
      fixture.detectChanges()
      expect(title.getTitle()).toBe('Pushup Tracker – anna');
    });

  });
});
