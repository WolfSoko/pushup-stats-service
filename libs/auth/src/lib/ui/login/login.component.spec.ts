import { fireEvent, render, screen } from '@testing-library/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { AuthStore } from '../../core/state/auth.store';
import { LoginOnboardingStore } from '../../core/state/login-onboarding.store';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const renderLogin = (
    error: Error | null = null,
    authOverrides: Record<string, unknown> = {}
  ) => {
    const errorSignal: WritableSignal<Error | null> = signal(error);
    const clearError = jest.fn(() => errorSignal.set(null));
    const navigateByUrl = jest.fn().mockResolvedValue(true);

    return render(LoginComponent, {
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: AuthStore,
          useValue: {
            loading: signal(false),
            error: errorSignal,
            isAuthenticated: signal(false),
            user: signal(null),
            clearError,
            signInWithEmail: jest.fn(),
            login: jest.fn(),
            logout: jest.fn(),
            ...authOverrides,
          },
        },
        {
          provide: LoginOnboardingStore,
          useValue: {
            error: signal(null),
            isOnboardingRequired: jest.fn().mockResolvedValue(false),
            saveGoogleOnboarding: jest.fn(),
          },
        },
      ],
    }).then((rendered) => ({ ...rendered, clearError, navigateByUrl }));
  };

  it('renders login title', async () => {
    await renderLogin();

    expect(
      screen.getByText('Willkommen bei Pushup Tracker')
    ).toBeInTheDocument();
  });

  it('should prevent the native form submission so credentials never leak into the URL', async () => {
    // given
    const { container } = await renderLogin();
    const form = container.querySelector('form');
    const submitEvent = new Event('submit', {
      bubbles: true,
      cancelable: true,
    });

    // when
    form?.dispatchEvent(submitEvent);

    // then
    expect(submitEvent.defaultPrevented).toBe(true);
  });

  it('should clear a stale auth error when navigating to register', async () => {
    // given
    const message = 'E-Mail oder Passwort ist nicht korrekt.';
    const { clearError, navigateByUrl } = await renderLogin(new Error(message));
    expect(screen.getByText(message)).toBeInTheDocument();

    // when
    fireEvent.click(screen.getByRole('button', { name: /Registrieren/ }));

    // then
    expect(clearError).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/register');
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it('should mark the Google button busy while the sign-in is pending', async () => {
    // given
    let resolveLogin!: (ok: boolean) => void;
    const login = jest.fn(
      () => new Promise<boolean>((resolve) => (resolveLogin = resolve))
    );
    const { fixture } = await renderLogin(null, { login });
    const button = screen.getByRole('button', { name: /Google/ });

    // when
    fireEvent.click(button);
    await fixture.whenStable();

    // then
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(
      screen.getByRole('button', { name: /Anmelden/ }).getAttribute('aria-busy')
    ).toBeNull();

    // when
    resolveLogin(false);
    await new Promise<void>((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    // then
    expect(button.getAttribute('aria-busy')).toBeNull();
  });
});
