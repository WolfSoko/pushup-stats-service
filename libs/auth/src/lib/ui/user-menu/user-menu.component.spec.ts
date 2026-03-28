import { render, screen } from '@testing-library/angular';
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
  isGuest: signal(false),
  logout: vi.fn(),
};

const mockRouter = {
  navigate: vi.fn(),
};

describe('UserMenuComponent', () => {
  beforeEach(() => {
    mockState.user.set(null);
    mockState.loading.set(false);
    mockState.isAuthenticated.set(false);
    mockState.error.set(null);
    mockState.isGuest.set(false);
    vi.clearAllMocks();
  });

  it('should render guest menu button when not authenticated', async () => {
    await render(UserMenuComponent, {
      providers: [
        { provide: AuthStore, useValue: mockState },
        { provide: Router, useValue: mockRouter },
      ],
    });

    expect(screen.getByRole('button', { name: /gast/i })).toBeInTheDocument();
  });

  it('should render user menu button when authenticated with photo', async () => {
    mockState.isAuthenticated.set(true);
    mockState.user.set({
      uid: '123',
      email: 'test@test.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/photo.jpg',
    });

    await render(UserMenuComponent, {
      providers: [
        { provide: AuthStore, useValue: mockState },
        { provide: Router, useValue: mockRouter },
      ],
    });

    const btn = screen.getByRole('button', { name: /nutzerkonto/i });
    expect(btn).toBeInTheDocument();
    const img = btn.querySelector('img.avatar-img');
    expect(img).not.toBeNull();
  });

  it('should render fallback icon when no photo', async () => {
    mockState.isAuthenticated.set(true);
    mockState.user.set({
      uid: '123',
      email: 'test@test.com',
      displayName: 'Test User',
      photoURL: null,
    });

    await render(UserMenuComponent, {
      providers: [
        { provide: AuthStore, useValue: mockState },
        { provide: Router, useValue: mockRouter },
      ],
    });

    expect(
      screen.getByRole('button', { name: /nutzerkonto/i })
    ).toBeInTheDocument();
  });

  it('should show loading spinner when loading', async () => {
    mockState.loading.set(true);

    await render(UserMenuComponent, {
      providers: [
        { provide: AuthStore, useValue: mockState },
        { provide: Router, useValue: mockRouter },
      ],
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
