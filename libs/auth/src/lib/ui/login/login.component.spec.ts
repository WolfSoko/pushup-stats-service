import { render, screen } from '@testing-library/angular';
import { ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { AuthStore } from '../../core/state/auth.store';
import { LoginOnboardingStore } from '../../core/state/login-onboarding.store';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const renderLogin = () =>
    render(LoginComponent, {
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
        {
          provide: AuthStore,
          useValue: {
            loading: signal(false),
            error: signal(null),
            isAuthenticated: signal(false),
            user: signal(null),
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
    });

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
});
