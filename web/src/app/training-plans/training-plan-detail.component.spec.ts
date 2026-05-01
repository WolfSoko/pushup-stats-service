import { signal } from '@angular/core';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { AuthStore } from '@pu-auth/auth';
import { makeAuthStoreMock } from '@pu-stats/testing';
import { TrainingPlanDetailComponent } from './training-plan-detail.component';
import { TrainingPlanStore } from './training-plan.store';

function makeStoreMock(overrides: Partial<ReturnType<typeof baseStore>> = {}) {
  return { ...baseStore(), ...overrides };
}

function baseStore() {
  return {
    activeCatalog: signal(null),
    activePlan: signal(null),
    hasActivePlan: signal(false),
    currentDayIndex: signal(null),
    completionPercent: signal(0),
    todayDay: signal(null),
    todayDone: signal(false),
    start: vitest.fn().mockResolvedValue(undefined),
    abandon: vitest.fn().mockResolvedValue(undefined),
    markDayDone: vitest.fn().mockResolvedValue(undefined),
    unmarkDayDone: vitest.fn().mockResolvedValue(undefined),
    logPlanDay: vitest.fn().mockResolvedValue('noop' as const),
  };
}

function makeRouteMock(slug: string, queryParams: Record<string, string> = {}) {
  return {
    paramMap: of(convertToParamMap({ slug })),
    queryParamMap: of(convertToParamMap(queryParams)),
    snapshot: {
      paramMap: convertToParamMap({ slug }),
      queryParamMap: convertToParamMap(queryParams),
    },
  };
}

describe('TrainingPlanDetailComponent', () => {
  describe('when unauthenticated', () => {
    it('shows the signup CTA pointing to /register with planId and autoStart returnUrl', async () => {
      await render(TrainingPlanDetailComponent, {
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: makeRouteMock('recruit-6w') },
          { provide: TrainingPlanStore, useValue: makeStoreMock() },
          {
            provide: AuthStore,
            useValue: makeAuthStoreMock({
              isAuthenticated: false,
              authResolved: true,
            }),
          },
        ],
      });

      const signupLink = screen.getByRole('link', {
        name: 'Konto erstellen & Plan starten',
      });
      const href = decodeURIComponent(signupLink.getAttribute('href') ?? '');

      expect(href).toContain('/register');
      expect(href).toContain('planId=recruit-6w-v1');
      expect(href).toContain(
        'returnUrl=/training-plans/recruit-6w?autoStart=1'
      );
    });

    it('does not render the "Plan starten" button when unauthenticated', async () => {
      await render(TrainingPlanDetailComponent, {
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: makeRouteMock('recruit-6w') },
          { provide: TrainingPlanStore, useValue: makeStoreMock() },
          {
            provide: AuthStore,
            useValue: makeAuthStoreMock({
              isAuthenticated: false,
              authResolved: true,
            }),
          },
        ],
      });

      expect(screen.queryByRole('button', { name: 'Plan starten' })).toBeNull();
    });
  });

  describe('when authenticated', () => {
    it('shows the "Plan starten" button and hides the signup CTA', async () => {
      await render(TrainingPlanDetailComponent, {
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: makeRouteMock('recruit-6w') },
          { provide: TrainingPlanStore, useValue: makeStoreMock() },
          {
            provide: AuthStore,
            useValue: makeAuthStoreMock({
              isAuthenticated: true,
              authResolved: true,
            }),
          },
        ],
      });

      expect(screen.getByRole('button', { name: 'Plan starten' })).toBeTruthy();
      expect(
        screen.queryByRole('link', { name: 'Konto erstellen & Plan starten' })
      ).toBeNull();
    });

    it('auto-starts the plan when ?autoStart=1 is set in the URL', async () => {
      const store = makeStoreMock();
      await render(TrainingPlanDetailComponent, {
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: makeRouteMock('recruit-6w', { autoStart: '1' }),
          },
          { provide: TrainingPlanStore, useValue: store },
          {
            provide: AuthStore,
            useValue: makeAuthStoreMock({
              isAuthenticated: true,
              authResolved: true,
            }),
          },
        ],
      });

      // Yield once so the constructor's effect runs.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(store.start).toHaveBeenCalledWith('recruit-6w-v1');
    });

    it('does not auto-start when ?autoStart is missing', async () => {
      const store = makeStoreMock();
      await render(TrainingPlanDetailComponent, {
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: makeRouteMock('recruit-6w') },
          { provide: TrainingPlanStore, useValue: store },
          {
            provide: AuthStore,
            useValue: makeAuthStoreMock({
              isAuthenticated: true,
              authResolved: true,
            }),
          },
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(store.start).not.toHaveBeenCalled();
    });
  });
});
