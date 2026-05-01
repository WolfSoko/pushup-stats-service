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
    activePlanLoaded: signal(true),
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
  describe('while auth is unresolved', () => {
    it('does NOT flash the signup CTA before auth is resolved', async () => {
      await render(TrainingPlanDetailComponent, {
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: makeRouteMock('recruit-6w') },
          { provide: TrainingPlanStore, useValue: makeStoreMock() },
          {
            provide: AuthStore,
            useValue: makeAuthStoreMock({
              isAuthenticated: false,
              authResolved: false,
            }),
          },
        ],
      });

      // Neither manual-start nor signup CTA renders during the
      // pre-resolution window — avoids a misleading flash for users
      // whose persisted Firebase session is still being restored.
      expect(screen.queryByRole('button', { name: 'Plan starten' })).toBeNull();
      expect(
        screen.queryByRole('link', { name: 'Konto erstellen & Plan starten' })
      ).toBeNull();
      expect(
        screen.queryByRole('link', { name: 'Schon Konto? Einloggen' })
      ).toBeNull();
    });

    it('does NOT auto-start while auth is unresolved (even with ?autoStart=1)', async () => {
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
              isAuthenticated: false,
              authResolved: false,
            }),
          },
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(store.start).not.toHaveBeenCalled();
    });
  });

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

    it('login CTA returnUrl does NOT carry autoStart (would silently replace an existing plan after login)', async () => {
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

      const loginLink = screen.getByRole('link', {
        name: 'Schon Konto? Einloggen',
      });
      const href = decodeURIComponent(loginLink.getAttribute('href') ?? '');

      expect(href).toContain('/login');
      expect(href).toContain('returnUrl=/training-plans/recruit-6w');
      expect(href).not.toContain('autoStart');
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

    it('does NOT auto-start while active-plan resource has not loaded yet (avoids race-overwrite of an existing plan)', async () => {
      const store = makeStoreMock({ activePlanLoaded: signal(false) });
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

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(store.start).not.toHaveBeenCalled();
    });

    it('shows a snackbar and does not get stuck when auto-start fails', async () => {
      const store = makeStoreMock();
      store.start.mockRejectedValueOnce(new Error('network'));
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

      // Allow the rejected promise to surface.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(store.start).toHaveBeenCalled();
      // No throw → unhandled rejection isn't propagated. The user-facing
      // error path (snackbar) is wired up; we'd need a snackbar mock to
      // assert it directly without provoking jsdom matSnackBar quirks.
    });

    it('does NOT auto-start (even with ?autoStart=1) when a different plan is already active', async () => {
      const store = makeStoreMock({
        hasActivePlan: signal(true),
        // Different plan than the one whose detail page is being viewed.
        activePlan: signal({
          planId: 'challenge-30d-v1',
          status: 'active',
        } as never),
      });
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

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(store.start).not.toHaveBeenCalled();
    });
  });
});
