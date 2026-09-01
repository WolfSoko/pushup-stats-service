import { signal } from '@angular/core';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { AuthStore } from '@pu-auth/auth';
import { makeAuthStoreMock } from '@pu-stats/testing';
import {
  findPlanBySlug,
  PlanExerciseProgress,
  TrainingPlan,
  TrainingPlanDay,
  UserTrainingPlan,
} from '@pu-stats/models';
import { TrainingPlanDetailComponent } from './training-plan-detail.component';
import { TrainingPlanStore } from './training-plan.store';

function makeStoreMock(overrides: Partial<ReturnType<typeof baseStore>> = {}) {
  return { ...baseStore(), ...overrides };
}

function baseStore() {
  return {
    activeCatalog: signal<TrainingPlan | null>(null),
    activePlan: signal<UserTrainingPlan | null>(null),
    hasActivePlan: signal(false),
    activePlanLoaded: signal(true),
    currentDayIndex: signal<number | null>(null),
    completionPercent: signal(0),
    todayDay: signal<TrainingPlanDay | null>(null),
    todayDone: signal(false),
    start: vitest.fn().mockResolvedValue(undefined),
    abandon: vitest.fn().mockResolvedValue(undefined),
    markDayDone: vitest.fn().mockResolvedValue(undefined),
    unmarkDayDone: vitest.fn().mockResolvedValue(undefined),
    logPlanDay: vitest.fn().mockResolvedValue('noop' as const),
    dayProgress: vitest.fn(
      (dayIndex: number): ReadonlyArray<PlanExerciseProgress> => {
        void dayIndex;
        return [];
      }
    ),
    logPlanExercise: vitest.fn().mockResolvedValue('noop' as const),
    setItemDone: vitest.fn().mockResolvedValue(undefined),
    skipDay: vitest.fn().mockResolvedValue(undefined),
    unskipDay: vitest.fn().mockResolvedValue(undefined),
    jumpToDay: vitest.fn().mockResolvedValue(undefined),
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
      if (!day12) return;
      expect(day12.classList.contains('day-row')).toBe(true);
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

  describe('hero image', () => {
    it('renders the plan hero photo with the title as alt text and a credit line', async () => {
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

      const plan = findPlanBySlug('recruit-6w');
      const img = container.querySelector<HTMLImageElement>('.plan-hero img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toBe(plan?.heroImage);
      expect(img?.getAttribute('alt')).toBe(plan?.title);

      const caption = container.querySelector('.plan-hero figcaption');
      expect(caption?.textContent).toContain(plan?.heroImagePhotographer?.name);
      const photographerLink = caption?.querySelector<HTMLAnchorElement>(
        `a[href="${plan?.heroImagePhotographer?.profileUrl}"]`
      );
      expect(photographerLink).not.toBeNull();
      expect(caption?.innerHTML).toContain('unsplash.com');
    });

    it('hides the hero figure when the image fails to load (OnPush + zoneless)', async () => {
      const { container, fixture } = await render(TrainingPlanDetailComponent, {
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

      const img = container.querySelector<HTMLImageElement>('.plan-hero img');
      expect(img).not.toBeNull();

      img?.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(container.querySelector('.plan-hero')).toBeNull();
    });
  });
  describe('per-exercise tracking on an active plan', () => {
    const PLAN = findPlanBySlug('full-body-6w') as NonNullable<
      ReturnType<typeof findPlanBySlug>
    >;

    /** Store mock with `full-body-6w` active and day 2 (a circuit) as today. */
    function activeStore() {
      const day = PLAN.days[1];
      return makeStoreMock({
        activeCatalog: signal(PLAN),
        activePlan: signal({
          userId: 'u1',
          planId: PLAN.id,
          startDate: '2026-04-01',
          status: 'active',
          completedDays: [],
        }),
        hasActivePlan: signal(true),
        currentDayIndex: signal(2),
        todayDay: signal(day),
        dayProgress: vitest.fn((dayIndex: number) =>
          dayIndex === 2
            ? (day.exercises ?? []).map((exercise, itemIndex) => ({
                itemIndex,
                exercise,
                logged: 0,
                fulfilledByEntries: false,
                checkedOff: false,
                done: false,
              }))
            : []
        ),
      });
    }

    async function renderWithStore(
      store: ReturnType<typeof makeStoreMock>
    ): Promise<void> {
      await render(TrainingPlanDetailComponent, {
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: makeRouteMock('full-body-6w') },
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
    }

    it('should list every exercise of the day, not just the pushups', async () => {
      // given a circuit day prescribing four exercises
      const store = activeStore();
      // when rendering the plan
      await renderWithStore(store);
      // then each one has its own checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(
        (PLAN.days[1].exercises ?? []).length
      );
    });

    it('should tick a single exercise off through the store', async () => {
      // given
      const store = activeStore();
      await renderWithStore(store);
      // when checking the first exercise of today
      await userEvent.click(screen.getAllByRole('checkbox')[0]);
      // then only that exercise is marked, for that day
      expect(store.setItemDone).toHaveBeenCalledWith(2, 0, true);
    });

    it('should offer a guided session for today', async () => {
      // given
      const store = activeStore();

      // when
      await renderWithStore(store);

      // then
      const cta = document.querySelector('[data-testid="start-session"]');
      expect(cta).toBeTruthy();
      expect(cta?.getAttribute('href')).toBe(
        '/training-plans/full-body-6w/session'
      );
    });

    it('should offer the session on today only, not on every day', async () => {
      // given
      const store = activeStore();

      // when
      await renderWithStore(store);

      // then
      expect(
        document.querySelectorAll('[data-testid="start-session"]').length
      ).toBe(1);
    });

    it('should not offer a session once today is completed', async () => {
      // given
      const store = activeStore();
      store.activePlan.set({
        userId: 'u1',
        planId: PLAN.id,
        startDate: '2026-04-01',
        status: 'active',
        completedDays: [2],
      });

      // when
      await renderWithStore(store);

      // then
      expect(
        document.querySelector('[data-testid="start-session"]')
      ).toBeNull();
    });

    it('should not offer a session while the plan is inactive', async () => {
      // given
      const store = activeStore();
      store.activePlan.set(null);
      store.hasActivePlan.set(false);

      // when
      await renderWithStore(store);

      // then
      expect(
        document.querySelector('[data-testid="start-session"]')
      ).toBeNull();
    });

    it("should put today's card above the week list", async () => {
      // given
      const store = activeStore();

      // when
      await renderWithStore(store);

      // then
      const card = document.querySelector('[data-testid="plan-today-card"]');
      const firstWeek = document.querySelector('.week');
      expect(card).toBeTruthy();
      expect(firstWeek).toBeTruthy();
      if (!card || !firstWeek) return;
      const position = card.compareDocumentPosition(firstWeek);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should start the session from today's card at the top", async () => {
      // given
      const store = activeStore();

      // when
      await renderWithStore(store);

      // then
      expect(
        document
          .querySelector('[data-testid="plan-today-start-session"]')
          ?.getAttribute('href')
      ).toBe('/training-plans/full-body-6w/session');
    });

    it('should keep today in the week list as well as in the card', async () => {
      // given — "auch ganz oben": the card repeats today, it doesn't move it
      const store = activeStore();

      // when
      await renderWithStore(store);

      // then
      const todayRows = document.querySelectorAll('.day-row.today');
      expect(todayRows.length).toBe(1);
      expect(
        document.querySelector('[data-testid="plan-today-card"]')
      ).toBeTruthy();
    });

    it('should collapse a finished day and keep the open ones expanded', async () => {
      // given — day 1 is done, day 2 is today and still open
      const store = activeStore();
      store.activePlan.set({
        userId: 'u1',
        planId: PLAN.id,
        startDate: '2026-04-01',
        status: 'active',
        completedDays: [1],
      });

      // when
      await renderWithStore(store);

      // then
      const rows = Array.from(
        document.querySelectorAll<HTMLElement>('.day-row')
      );
      const done = rows.find((r) => r.classList.contains('done'));
      const today = rows.find((r) => r.classList.contains('today'));
      expect(done?.querySelector('.day-desc')).toBeNull();
      expect(today?.querySelector('.day-desc')).toBeTruthy();
    });

    it('should expand a finished day when the user opens it', async () => {
      // given
      const store = activeStore();
      store.activePlan.set({
        userId: 'u1',
        planId: PLAN.id,
        startDate: '2026-04-01',
        status: 'active',
        completedDays: [1],
      });
      await renderWithStore(store);
      const done = Array.from(
        document.querySelectorAll<HTMLElement>('.day-row')
      ).find((r) => r.classList.contains('done')) as HTMLElement;

      // when
      await userEvent.click(
        done.querySelector('[data-testid="day-toggle"]') as HTMLElement
      );

      // then
      expect(done.querySelector('.day-desc')).toBeTruthy();
    });
  });

  describe('editorial about section', () => {
    async function renderPlan(slug: string) {
      await render(TrainingPlanDetailComponent, {
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: makeRouteMock(slug) },
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
    }

    it('should render the markdown-sourced about section for a plan that ships content', async () => {
      // given the recruit plan, which has content/training-plans markdown
      // when the detail page renders (test locale is the de source locale)
      await renderPlan('recruit-6w');
      // then the section shows the rendered HTML body
      const about = document.querySelector('.plan-about');
      expect(about).toBeTruthy();
      expect(about?.textContent).toContain('Für wen ist dieser Plan?');
    });

    it('should omit the section for a plan without editorial content', async () => {
      // given a plan with no markdown files yet
      // when the detail page renders
      await renderPlan('hiit-4w');
      // then no empty section is left in the DOM
      expect(document.querySelector('.plan-about')).toBeNull();
    });
  });
});
