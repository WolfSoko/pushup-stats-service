import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { UserMenuComponent } from './user-menu.component';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { AuthStore } from '../../core/state/auth.store';

type User = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
};

const mockState = {
  user: signal<User | null>(null),
  loading: signal(false),
  isAuthenticated: signal(false),
  idToken: signal<string | null>(null),
  error: signal<Error | null>(null),
  logout: jest.fn(),
};

const mockRouter = {
  navigate: jest.fn(),
};

describe('UserMenuComponent', () => {
  beforeEach(() => {
    mockState.user.set(null);
    mockState.loading.set(false);
    mockState.isAuthenticated.set(false);
    mockState.error.set(null);
    jest.clearAllMocks();
  });

  it('should render login button when not authenticated', async () => {
    await render(UserMenuComponent, {
      providers: [
        { provide: AuthStore, useValue: mockState },
        { provide: Router, useValue: mockRouter },
      ],
    });

    expect(
      screen.getByRole('button', { name: /anmelden/i })
    ).toBeInTheDocument();
  });

  it('should render user avatar when authenticated with photo', async () => {
    mockState.isAuthenticated.set(true);
    mockState.user.set({
      uid: '123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/avatar.png',
    });

    await render(UserMenuComponent, {
      providers: [
        { provide: AuthStore, useValue: mockState },
        { provide: Router, useValue: mockRouter },
      ],
    });

    const avatarImg = screen.getByAltText('Avatar');
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute(
      'src',
      expect.stringContaining('avatar.png')
    );
  });

  it('should render fallback icon when no photo', async () => {
    mockState.isAuthenticated.set(true);
    mockState.user.set({
      uid: '123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: null,
    });

    await render(UserMenuComponent, {
      providers: [
        { provide: AuthStore, useValue: mockState },
        { provide: Router, useValue: mockRouter },
      ],
    });

    expect(screen.getByText('account_circle')).toBeInTheDocument();
  });

  it('should navigate to login on signIn', async () => {
    await render(UserMenuComponent, {
      providers: [
        { provide: AuthStore, useValue: mockState },
        { provide: Router, useValue: mockRouter },
      ],
    });

    const loginBtn = screen.getByRole('button', { name: /anmelden/i });
    await userEvent.click(loginBtn);

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should call authStore.logout on logout click', async () => {
    mockState.isAuthenticated.set(true);
    mockState.user.set({
      uid: '123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: null,
    });
    mockState.logout.mockResolvedValue(undefined);

    await render(UserMenuComponent, {
      providers: [
        { provide: AuthStore, useValue: mockState },
        { provide: Router, useValue: mockRouter },
      ],
    });

    const menuBtn = screen.getByLabelText('User menu');
    await userEvent.click(menuBtn);

    const logoutBtn = screen.getByRole('menuitem', { name: /abmelden/i });
    await userEvent.click(logoutBtn);

    expect(mockState.logout).toHaveBeenCalled();
  });
});
