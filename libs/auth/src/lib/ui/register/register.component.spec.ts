import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { AuthStore } from '../../core/state/auth.store';
import { RegisterOnboardingStore } from '../../core/state/register-onboarding.store';
import { RegistrationAnalyticsService } from '../../core/registration-analytics.service';
import { RegisterComponent } from './register.component';
import { RegisterUiStore } from './register-ui.store';

const authStoreMock = {
  loading: signal(false),
  error: signal<Error | null>(null),
  isAuthenticated: signal(false),
  user: signal<{ uid: string } | null>(null),
  signUpWithEmail: jest.fn(),
  upgradeWithGoogle: jest.fn(),
  logout: jest.fn(),
};

const onboardingStoreMock = {
  saving: signal(false),
  error: signal<string | null>(null),
  saveProfile: jest.fn(),
};

const breakpointObserverMock = {
  observe: jest.fn().mockReturnValue(of({ matches: true } as BreakpointState)),
};

const analyticsMock = {
  trackStarted: jest.fn(),
  trackStepView: jest.fn(),
  trackStepCompleted: jest.fn(),
  trackSubmitted: jest.fn(),
  trackSucceeded: jest.fn(),
  trackFailed: jest.fn(),
  trackAbandoned: jest.fn(),
};

async function renderRegister(queryParams: Record<string, string> = {}) {
  return render(RegisterComponent, {
    providers: [
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: {
              get: (key: string): string | null => queryParams[key] ?? null,
            },
          },
        },
      },
      { provide: AuthStore, useValue: authStoreMock },
      { provide: RegisterOnboardingStore, useValue: onboardingStoreMock },
      { provide: Auth, useValue: null },
      { provide: BreakpointObserver, useValue: breakpointObserverMock },
      { provide: RegistrationAnalyticsService, useValue: analyticsMock },
    ],
  });
}

describe('RegisterComponent', () => {
  beforeEach(() => {
    authStoreMock.error.set(null);
    onboardingStoreMock.error.set(null);
    authStoreMock.user.set(null);
    onboardingStoreMock.saveProfile.mockReset().mockResolvedValue(undefined);
    authStoreMock.signUpWithEmail.mockReset().mockResolvedValue(true);
    authStoreMock.upgradeWithGoogle.mockReset().mockResolvedValue(true);
    Object.values(analyticsMock).forEach((spy) => spy.mockReset());
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

  describe('with preselected training plan', () => {
    it('Given ?planId=recruit-6w-v1 When rendered Then shows the plan banner with the localized title', async () => {
      const view = await renderRegister({ planId: 'recruit-6w-v1' });

      const banner = view.fixture.nativeElement.querySelector(
        '[data-testid="register-plan-banner"]'
      ) as HTMLElement | null;
      expect(banner).not.toBeNull();
      expect(banner?.textContent).toContain('Trainingsplan vorausgewählt');
      // The detail-page title is locale-aware (de: "Von 0 auf 100 …", en:
      // "From 0 to 100 …"). Both share the "0" and "100" tokens, so
      // assert both to keep this stable across LOCALE_ID defaults.
      expect(banner?.textContent).toMatch(/0.*100/);
    });

    it('Given an unknown planId Then no plan banner is shown', async () => {
      const view = await renderRegister({ planId: 'unknown-plan' });

      const banner = view.fixture.nativeElement.querySelector(
        '[data-testid="register-plan-banner"]'
      );
      expect(banner).toBeNull();
    });

    it('Given no planId Then no plan banner is shown', async () => {
      const view = await renderRegister();

      const banner = view.fixture.nativeElement.querySelector(
        '[data-testid="register-plan-banner"]'
      );
      expect(banner).toBeNull();
    });
  });

  describe('analytics tracking', () => {
    it('Given the register page is opened Then register_started and the email step view are tracked', async () => {
      await renderRegister();

      expect(analyticsMock.trackStarted).toHaveBeenCalledWith({
        plan_preselected: false,
      });
      expect(analyticsMock.trackStepView).toHaveBeenCalledWith('email', {
        is_google: false,
      });
    });

    it('Given a preselected plan When opening the register page Then plan_preselected is true', async () => {
      await renderRegister({ planId: 'recruit-6w-v1' });

      expect(analyticsMock.trackStarted).toHaveBeenCalledWith({
        plan_preselected: true,
      });
    });

    it('Given the user destroys the page before success Then register_abandoned is tracked with the last step', async () => {
      const view = await renderRegister();
      analyticsMock.trackAbandoned.mockClear();

      view.fixture.destroy();

      expect(analyticsMock.trackAbandoned).toHaveBeenCalledWith({
        last_step: 'email',
        is_google: false,
      });
    });

    it('Given the registration succeeded When the page is destroyed Then no abandoned event is tracked', async () => {
      authStoreMock.user.set({ uid: 'uid-1' });
      const view = await renderRegister();
      const uiStore = view.fixture.debugElement.injector.get(RegisterUiStore);
      uiStore.setDisplayName('Alex');
      uiStore.setDailyGoal(10);
      await uiStore.persistProfile();
      expect(uiStore.registerSuccess()).toBe(true);
      analyticsMock.trackAbandoned.mockClear();

      view.fixture.destroy();

      expect(analyticsMock.trackAbandoned).not.toHaveBeenCalled();
    });

    it('Given the user moves forward in the stepper Then step_completed for the previous and step_view for the next are tracked', async () => {
      const view = await renderRegister();
      const component = view.fixture.componentInstance;
      analyticsMock.trackStepCompleted.mockClear();
      analyticsMock.trackStepView.mockClear();

      component.onStepperSelectionChange({
        previouslySelectedIndex: 0,
        selectedIndex: 1,
      } as never);

      expect(analyticsMock.trackStepCompleted).toHaveBeenCalledWith('email', {
        is_google: false,
      });
      expect(analyticsMock.trackStepView).toHaveBeenCalledWith('password', {
        is_google: false,
      });
    });

    it('Given the user navigates back in the stepper Then only step_view fires, not step_completed', async () => {
      const view = await renderRegister();
      const component = view.fixture.componentInstance;
      analyticsMock.trackStepCompleted.mockClear();
      analyticsMock.trackStepView.mockClear();

      component.onStepperSelectionChange({
        previouslySelectedIndex: 2,
        selectedIndex: 1,
      } as never);

      expect(analyticsMock.trackStepCompleted).not.toHaveBeenCalled();
      expect(analyticsMock.trackStepView).toHaveBeenCalledWith('password', {
        is_google: false,
      });
    });
  });
});
