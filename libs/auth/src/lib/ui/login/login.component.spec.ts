import { fireEvent, render, screen } from '@testing-library/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { AuthStore } from '../../core/state/auth.store';
import { LoginOnboardingStore } from '../../core/state/login-onboarding.store';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const renderLogin = (error: Error | null = null) => {
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

    expect(screen.getByText('Willkommen bei PushUp Stats')).toBeInTheDocument();
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
});
