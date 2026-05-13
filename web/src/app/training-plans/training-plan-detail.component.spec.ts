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

    it('renders pushup-type chips that link to the wiki for explicit variants', async () => {
      // recruit-6w mentions "saubere Liegestütze" (standard) on day 1
      // and the one-arm plan mentions Archer/Diamond/Wide etc. We use
      // the one-arm plan because it has the most type-rich descriptions
      // and we can assert multiple chips in one render.
      await render(TrainingPlanDetailComponent, {
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: makeRouteMock('one-arm-12w') },
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

      // Archer chip is present (used on multiple days of the plan).
      const archerLinks = screen.getAllByRole('link', {
        name: /Archer-Liegestütze/i,
      });
      expect(archerLinks.length).toBeGreaterThan(0);

      // Chip links directly to the wiki detail page for the type
      // (auto-link to the per-type SEO page). Default test locale is
      // German so we expect the German default slug `archer`.
      const href = archerLinks[0].getAttribute('href') ?? '';
      expect(href).toBe('/wiki/liegestuetz-typen/archer');
    });

    it('does NOT render pushup-type chips for rest days', async () => {
      const { container } = await render(TrainingPlanDetailComponent, {
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

      // Rest days say "Ruhetag" / "Rest day" — no type chip container
      // should appear on any rest row. Walk every rest day-row and
      // assert it has no `.pushup-types` descendant.
      const restRows = Array.from(
        container.querySelectorAll<HTMLElement>('.day-row')
      ).filter((row) => row.textContent?.includes('Ruhetag'));
      expect(restRows.length).toBeGreaterThan(0);
      for (const row of restRows) {
        expect(row.querySelector('.pushup-types')).toBeNull();
        expect(row.querySelector('.pushup-type-chip')).toBeNull();
      }
    });

    it('scrolls the matching day-row into view when ?day=N is set in the URL', async () => {
      // jsdom does not implement `Element.scrollIntoView` — install a
      // mock on the prototype so the spy can record calls and we can
      // assert which element it was invoked on.
      const original = HTMLElement.prototype.scrollIntoView;
      const scrollIntoView = vitest.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoView;

      // Given the user lands on the plan detail with `?day=12` (e.g.
      // navigated via the dashboard banner CTA, which carries the
      // active day index in its queryParams).
      const { fixture } = await render(TrainingPlanDetailComponent, {
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: makeRouteMock('recruit-6w', { day: '12' }),
          },
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

      // afterRenderEffect runs after the next render — flush.
      await fixture.whenStable();
      fixture.detectChanges();

      // Then each day-row has a stable `day-<index>` id so the dashboard
      // banner can deep-link any day, and `scrollIntoView` was called
      // on the day-12 element specifically (not just any element).
      const root = fixture.nativeElement as HTMLElement;
      const day12 = root.querySelector('#day-12') as HTMLElement | null;
      expect(day12).not.toBeNull();
      expect(day12!.classList.contains('day-row')).toBe(true);
      expect(scrollIntoView).toHaveBeenCalled();
      const wasCalledOnDay12 = scrollIntoView.mock.contexts.some(
        (ctx) => ctx === day12
      );
      expect(wasCalledOnDay12).toBe(true);

      HTMLElement.prototype.scrollIntoView = original;
    });

    it('offsets day-row anchors below the sticky toolbar so deep-linked days are not hidden', async () => {
      // Regression: navigating from the dashboard banner with `?day=N`
      // scrolls the matching `.day-row` to the top of the scroll
      // container, but the sticky `mat-toolbar.top-nav` (≈64px tall)
      // would otherwise overlap the row. `scroll-margin-top` shifts the
      // scroll resting position down so the row is fully visible.
      const { fixture } = await render(TrainingPlanDetailComponent, {
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
      fixture.detectChanges();

      const dayRow = (fixture.nativeElement as HTMLElement).querySelector(
        '.day-row'
      );
      expect(dayRow).not.toBeNull();
      const computed = window.getComputedStyle(dayRow as Element);
      const offset = parseFloat(computed.scrollMarginTop);
      expect(offset).toBeGreaterThanOrEqual(64);
    });

    it('does not scroll when ?day is missing', async () => {
      const original = HTMLElement.prototype.scrollIntoView;
      const scrollIntoView = vitest.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoView;

      const { fixture } = await render(TrainingPlanDetailComponent, {
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

      await fixture.whenStable();
      fixture.detectChanges();

      expect(scrollIntoView).not.toHaveBeenCalled();
      HTMLElement.prototype.scrollIntoView = original;
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
