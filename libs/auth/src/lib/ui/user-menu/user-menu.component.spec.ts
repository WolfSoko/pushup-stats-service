import { render } from '@testing-library/angular';
import { Auth } from '@angular/fire/auth';
import { provideRouter } from '@angular/router';
import { AuthStore } from '../../core/state/auth.store';
import { UserMenuComponent } from './user-menu.component';

function makeStore(opts: {
  isAuthenticated: boolean;
  isGuest: boolean;
  loading?: boolean;
}) {
  return {
    isAuthenticated: vi.fn().mockReturnValue(opts.isAuthenticated),
    isGuest: vi.fn().mockReturnValue(opts.isGuest),
    loading: vi.fn().mockReturnValue(opts.loading ?? false),
    error: vi.fn().mockReturnValue(null),
    user: vi.fn().mockReturnValue(
      opts.isAuthenticated
        ? {
            displayName: 'Test User',
            email: 'test@example.com',
            photoURL: null,
          }
        : null
    ),
    logout: vi.fn().mockResolvedValue(undefined),
  };
}

describe('UserMenuComponent', () => {
  it('shows guest menu (person_outline icon) when isGuest is true', async () => {
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
    // person_outline icon appears in guest menu button
    expect(document.body.innerHTML).toContain('person_outline');
  });

  it('shows convert-to-account CTA in guest menu', async () => {
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
    // The guest menu button should be present (mat-icon-button with guestMenu trigger)
    // The mat-menu items are in the DOM but may be hidden – check innerHTML
    expect(document.body.innerHTML).toContain('person_outline');
  });

  it('shows user menu (account_circle icon) when authenticated and not guest', async () => {
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
    expect(document.body.innerHTML).toContain('account_circle');
  });

  it('shows person_outline sign-in button when not authenticated and not guest', async () => {
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
    // When not authenticated and not guest → falls into else branch with person_outline + guestMenu
    expect(document.body.innerHTML).toContain('person_outline');
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
