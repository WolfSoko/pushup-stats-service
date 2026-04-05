import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { AuthStore } from '../../core/state/auth.store';
import { RegisterOnboardingStore } from '../../core/state/register-onboarding.store';
import { RegisterComponent } from './register.component';

const authStoreMock = {
  loading: signal(false),
  error: signal<Error | null>(null),
  isAuthenticated: signal(false),
  user: signal(null),
  signUpWithEmail: jest.fn(),
  upgradeWithGoogle: jest.fn(),
  logout: jest.fn(),
};

const onboardingStoreMock = {
  saving: signal(false),
  error: signal<string | null>(null),
  registerSuccess: signal(false),
  saveProfile: jest.fn(),
};

const breakpointObserverMock = {
  observe: jest.fn().mockReturnValue(
    of({ matches: true } as BreakpointState)
  ),
};

async function renderRegister() {
  return render(RegisterComponent, {
    providers: [
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: { get: () => null } } },
      },
      { provide: AuthStore, useValue: authStoreMock },
      { provide: RegisterOnboardingStore, useValue: onboardingStoreMock },
      { provide: Auth, useValue: null },
      { provide: BreakpointObserver, useValue: breakpointObserverMock },
    ],
  });
}

describe('RegisterComponent', () => {
  beforeEach(() => {
    authStoreMock.error.set(null);
    onboardingStoreMock.error.set(null);
  });

  it('renders registration title', async () => {
    await renderRegister();
    expect(screen.getByText('Registrierung')).toBeInTheDocument();
  });

  it('shows human-readable error message (not [object Object]) for invalid email', async () => {
    const user = userEvent.setup();
    await renderRegister();

    const emailInput = screen.getByPlaceholderText('deine@email.de');
    await user.type(emailInput, 'not-an-email');
    await user.clear(emailInput);
    await user.tab();

    const errors = screen.queryAllByRole('generic', { hidden: true });
    const matErrors = document.querySelectorAll('mat-error');
    matErrors.forEach((el) => {
      expect(el.textContent).not.toContain('[object Object]');
      expect(el.textContent?.trim().length).toBeGreaterThan(0);
    });
  });

  it('shows required error message as readable string when email is touched and empty', async () => {
    const user = userEvent.setup();
    await renderRegister();

    const emailInput = screen.getByPlaceholderText('deine@email.de');
    await user.click(emailInput);
    await user.tab();

    const matErrors = document.querySelectorAll('mat-error');
    matErrors.forEach((el) => {
      expect(el.textContent).not.toBe('[object Object]');
    });
  });
});
