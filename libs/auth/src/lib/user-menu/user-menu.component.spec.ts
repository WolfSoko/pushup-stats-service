import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { UserMenuComponent } from './user-menu.component';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { signal } from '@angular/core';

interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  emailVerified: boolean;
  providerId: string;
  isAnonymous: boolean;
}

const mockAuthService = {
  user: signal<User | null>(null),
  loading: signal(false),
  isAuthenticated: signal(false),
  error: signal(null),
  signOut: jest.fn(),
};

const mockRouter = {
  navigate: jest.fn(),
};

describe('UserMenuComponent', () => {
  beforeEach(() => {
    mockAuthService.user.set(null);
    mockAuthService.loading.set(false);
    mockAuthService.isAuthenticated.set(false);
    mockAuthService.error.set(null);
    jest.clearAllMocks();
  });

  it('should render login button when not authenticated', async () => {
    await render(UserMenuComponent, {
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
    expect(
      screen.getByRole('button', { name: /anmelden/i })
    ).toBeInTheDocument();
  });

  it('should render user avatar when authenticated with photo', async () => {
    mockAuthService.isAuthenticated.set(true);
    mockAuthService.user.set({
      uid: '123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/avatar.png',
      emailVerified: true,
      providerId: 'google.com',
      isAnonymous: false,
    });
    await render(UserMenuComponent, {
      providers: [
        { provide: AuthService, useValue: mockAuthService },
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
    mockAuthService.isAuthenticated.set(true);
    mockAuthService.user.set({
      uid: '123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: null,
      emailVerified: true,
      providerId: 'google.com',
      isAnonymous: false,
    });
    await render(UserMenuComponent, {
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
    expect(screen.getByText('account_circle')).toBeInTheDocument();
  });

  it('should navigate to login on signIn', async () => {
    await render(UserMenuComponent, {
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
    const loginBtn = screen.getByRole('button', { name: /anmelden/i });
    await userEvent.click(loginBtn);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should call authService.signOut on logout', async () => {
    mockAuthService.isAuthenticated.set(true);
    mockAuthService.user.set({
      uid: '123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: null,
      emailVerified: true,
      providerId: 'google.com',
      isAnonymous: false,
    });
    mockAuthService.signOut.mockResolvedValue(undefined);
    await render(UserMenuComponent, {
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
    // Open menu
    const menuBtn = screen.getByLabelText('User menu');
    await userEvent.click(menuBtn);
    // Click logout
    const logoutBtn = screen.getByRole('menuitem', { name: /abmelden/i });
    await userEvent.click(logoutBtn);
    expect(mockAuthService.signOut).toHaveBeenCalled();
  });
});
