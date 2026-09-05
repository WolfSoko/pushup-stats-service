import { render, screen, fireEvent } from '@testing-library/angular';
import { Auth } from '@angular/fire/auth';
import { provideRouter, Router } from '@angular/router';
import { AuthStore } from '../../core/state/auth.store';
import { UserMenuComponent } from './user-menu.component';

function makeStore(opts: {
  isAuthenticated: boolean;
  isGuest: boolean;
  loading?: boolean;
  tryAsGuest?: jest.Mock;
  uid?: string | undefined;
}) {
  return {
    isAuthenticated: jest.fn().mockReturnValue(opts.isAuthenticated),
    isGuest: jest.fn().mockReturnValue(opts.isGuest),
    loading: jest.fn().mockReturnValue(opts.loading ?? false),
    error: jest.fn().mockReturnValue(null),
    user: jest.fn().mockReturnValue(
      opts.isAuthenticated
        ? {
            uid: 'uid' in opts ? opts.uid : 'test-uid',
            displayName: 'Test User',
            email: 'test@example.com',
            photoURL: null,
          }
        : null
    ),
    logout: jest.fn().mockResolvedValue(undefined),
    tryAsGuest: opts.tryAsGuest ?? jest.fn().mockResolvedValue(true),
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
        { provide: Auth, useValue: {} },
      ],
    });
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
        { provide: Auth, useValue: {} },
      ],
    });
    expect(screen.getByLabelText('Anmelde-Menü')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Anmelde-Menü'));
    expect(screen.getByText('Als Gast ausprobieren')).toBeTruthy();
    expect(screen.getByText('Anmelden')).toBeTruthy();
    expect(screen.queryByText(/Du nutzt/)).toBeNull();
  });

  it('tryAsGuest calls store.tryAsGuest and navigates to /app on success', async () => {
    const tryAsGuestSpy = jest.fn().mockResolvedValue(true);
    const { fixture } = await render(UserMenuComponent, {
      providers: [
        provideRouter([{ path: 'app', children: [] }]),
        {
          provide: AuthStore,
          useValue: makeStore({
            isAuthenticated: false,
            isGuest: false,
            tryAsGuest: tryAsGuestSpy,
          }),
        },
        { provide: Auth, useValue: {} },
      ],
    });
    const router = fixture.debugElement.injector.get(Router);
    const navigateSpy = jest.spyOn(router, 'navigate');

    fireEvent.click(screen.getByLabelText('Anmelde-Menü'));
    fireEvent.click(screen.getByText('Als Gast ausprobieren'));
    await fixture.whenStable();

    expect(tryAsGuestSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/app']);
  });

  it('tryAsGuest does not navigate on failure', async () => {
    const tryAsGuestSpy = jest.fn().mockResolvedValue(false);
    const { fixture } = await render(UserMenuComponent, {
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: makeStore({
            isAuthenticated: false,
            isGuest: false,
            tryAsGuest: tryAsGuestSpy,
          }),
        },
        { provide: Auth, useValue: {} },
      ],
    });
    const router = fixture.debugElement.injector.get(Router);
    const navigateSpy = jest.spyOn(router, 'navigate');

    fireEvent.click(screen.getByLabelText('Anmelde-Menü'));
    fireEvent.click(screen.getByText('Als Gast ausprobieren'));
    await fixture.whenStable();

    expect(tryAsGuestSpy).toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('given authenticated user, when opening menu, then shows only account actions', async () => {
    // Given — Historie, Tagesziele und Erinnerungen sind keine
    // Kontoaktionen; sie leben jetzt in der Navigation bzw. unter
    // Einstellungen. Das Menü darf sie nicht doppeln.
    await render(UserMenuComponent, {
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: makeStore({ isAuthenticated: true, isGuest: false }),
        },
        { provide: Auth, useValue: {} },
      ],
    });

    // When
    fireEvent.click(screen.getByLabelText('Nutzerkonto-Menü'));

    // Then
    expect(screen.getByText('Einstellungen')).toBeTruthy();
    expect(screen.getByText('Abmelden')).toBeTruthy();
    expect(screen.queryByText('Historie')).toBeNull();
    expect(screen.queryByText('Tagesziele')).toBeNull();
    expect(screen.queryByText('Erinnerungen')).toBeNull();
  });

  it('given authenticated user, when clicking Mein Profil, then navigates to the own profile', async () => {
    // Given
    const { fixture } = await render(UserMenuComponent, {
      providers: [
        provideRouter([{ path: 'u/:uid', children: [] }]),
        {
          provide: AuthStore,
          useValue: makeStore({ isAuthenticated: true, isGuest: false }),
        },
        { provide: Auth, useValue: {} },
      ],
    });
    const router = fixture.debugElement.injector.get(Router);
    const navigateSpy = jest.spyOn(router, 'navigate');

    // When
    fireEvent.click(screen.getByLabelText('Nutzerkonto-Menü'));
    fireEvent.click(screen.getByText('Mein Profil'));
    await fixture.whenStable();

    // Then
    expect(navigateSpy).toHaveBeenCalledWith(['/u', 'test-uid']);
  });

  it('given a user whose uid has not resolved yet, when clicking Mein Profil, then falls back to the settings tab', async () => {
    // Given — routing to `/u/` with an empty segment would 404 on the
    // user's own profile
    const { fixture } = await render(UserMenuComponent, {
      providers: [
        provideRouter([{ path: 'settings/profil', children: [] }]),
        {
          provide: AuthStore,
          useValue: makeStore({
            isAuthenticated: true,
            isGuest: false,
            uid: undefined,
          }),
        },
        { provide: Auth, useValue: {} },
      ],
    });
    const router = fixture.debugElement.injector.get(Router);
    const navigateSpy = jest.spyOn(router, 'navigate');

    // When
    fireEvent.click(screen.getByLabelText('Nutzerkonto-Menü'));
    fireEvent.click(screen.getByText('Mein Profil'));
    await fixture.whenStable();

    // Then
    expect(navigateSpy).toHaveBeenCalledWith(['/settings', 'profil']);
  });

  it('given authenticated user, when clicking Einstellungen, then navigates to /settings', async () => {
    // Given
    const { fixture } = await render(UserMenuComponent, {
      providers: [
        provideRouter([{ path: 'settings', children: [] }]),
        {
          provide: AuthStore,
          useValue: makeStore({ isAuthenticated: true, isGuest: false }),
        },
        { provide: Auth, useValue: {} },
      ],
    });
    const router = fixture.debugElement.injector.get(Router);
    const navigateSpy = jest.spyOn(router, 'navigate');

    // When
    fireEvent.click(screen.getByLabelText('Nutzerkonto-Menü'));
    fireEvent.click(screen.getByText('Einstellungen'));
    await fixture.whenStable();

    // Then
    expect(navigateSpy).toHaveBeenCalledWith(['/settings']);
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
        { provide: Auth, useValue: {} },
      ],
    });
    expect(document.body.querySelector('mat-spinner')).toBeTruthy();
  });
});
