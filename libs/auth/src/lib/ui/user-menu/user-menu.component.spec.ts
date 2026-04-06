import { render, screen, fireEvent } from '@testing-library/angular';
import { Auth } from '@angular/fire/auth';
import { provideRouter } from '@angular/router';
import { AuthStore } from '../../core/state/auth.store';
import { AuthService } from '../../core/auth.service';
import { UserMenuComponent } from './user-menu.component';

function makeStore(opts: {
  isAuthenticated: boolean;
  isGuest: boolean;
  loading?: boolean;
}) {
  return {
    isAuthenticated: jest.fn().mockReturnValue(opts.isAuthenticated),
    isGuest: jest.fn().mockReturnValue(opts.isGuest),
    loading: jest.fn().mockReturnValue(opts.loading ?? false),
    error: jest.fn().mockReturnValue(null),
    user: jest.fn().mockReturnValue(
      opts.isAuthenticated
        ? {
            displayName: 'Test User',
            email: 'test@example.com',
            photoURL: null,
          }
        : null
    ),
    logout: jest.fn().mockResolvedValue(undefined),
  };
}

function makeAuthService() {
  return {
    signInGuestIfNeeded: jest.fn().mockResolvedValue(undefined),
  };
}

describe('UserMenuComponent', () => {
  it('shows guest menu button when isGuest is true', async () => {
    await render(UserMenuComponent, {
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: makeStore({ isAuthenticated: true, isGuest: true }),
        },
        { provide: AuthService, useValue: makeAuthService() },
        { provide: Auth, useValue: {} },
      ],
    });
    expect(screen.getByLabelText('Gast-Menü')).toBeTruthy();
  });

  it('shows guest hint text in guest menu (no PUS)', async () => {
    await render(UserMenuComponent, {
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: makeStore({ isAuthenticated: true, isGuest: true }),
        },
        { provide: AuthService, useValue: makeAuthService() },
        { provide: Auth, useValue: {} },
      ],
    });
    // Open the guest menu
    fireEvent.click(screen.getByLabelText('Gast-Menü'));
    expect(screen.getByText('Du nutzt die App als Gast')).toBeTruthy();
    expect(screen.queryByText(/PUS/)).toBeNull();
  });

  it('shows user menu when authenticated and not guest', async () => {
    await render(UserMenuComponent, {
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: makeStore({ isAuthenticated: true, isGuest: false }),
        },
        { provide: AuthService, useValue: makeAuthService() },
        { provide: Auth, useValue: {} },
      ],
    });
    expect(screen.getByLabelText('Nutzerkonto-Menü')).toBeTruthy();
  });

  it('shows anon menu with try-as-guest CTA when not authenticated', async () => {
    await render(UserMenuComponent, {
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: makeStore({ isAuthenticated: false, isGuest: false }),
        },
        { provide: AuthService, useValue: makeAuthService() },
        { provide: Auth, useValue: {} },
      ],
    });
    // Anon menu button is shown
    expect(screen.getByLabelText('Menü')).toBeTruthy();
    // Open the menu
    fireEvent.click(screen.getByLabelText('Menü'));
    expect(screen.getByText('Als Gast ausprobieren')).toBeTruthy();
    expect(screen.getByText('Anmelden')).toBeTruthy();
    expect(screen.queryByText(/Gast-Menü|Du nutzt/)).toBeNull();
  });

  it('tryAsGuest calls signInGuestIfNeeded and navigates to /app', async () => {
    const authService = makeAuthService();
    await render(UserMenuComponent, {
      providers: [
        provideRouter([{ path: 'app', children: [] }]),
        {
          provide: AuthStore,
          useValue: makeStore({ isAuthenticated: false, isGuest: false }),
        },
        { provide: AuthService, useValue: authService },
        { provide: Auth, useValue: {} },
      ],
    });
    fireEvent.click(screen.getByLabelText('Menü'));
    fireEvent.click(screen.getByText('Als Gast ausprobieren'));
    expect(authService.signInGuestIfNeeded).toHaveBeenCalled();
  });

  it('shows spinner when loading', async () => {
    await render(UserMenuComponent, {
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: makeStore({
            isAuthenticated: false,
            isGuest: false,
            loading: true,
          }),
        },
        { provide: AuthService, useValue: makeAuthService() },
        { provide: Auth, useValue: {} },
      ],
    });
    expect(document.body.querySelector('mat-spinner')).toBeTruthy();
  });
});
