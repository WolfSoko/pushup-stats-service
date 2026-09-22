import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { AuthStore } from '@pu-auth/auth';
import { makeAuthStoreMock } from '@pu-stats/testing';
import { TRAINING_PLANS } from '@pu-stats/models';
import { TrainingPlansPageComponent } from './training-plans-page.component';
import { TrainingPlanStore } from './training-plan.store';

function makeStoreMock(
  activeCatalog: (typeof TRAINING_PLANS)[number] | null = null,
  hasActivePlan = false,
  hasPausedPlan = false
) {
  return {
    allPlans: () => TRAINING_PLANS,
    activeCatalog: signal(activeCatalog),
    activePlan: signal(null),
    hasActivePlan: signal(hasActivePlan),
    hasPausedPlan: signal(hasPausedPlan),
    activePlanLoaded: signal(true),
    currentDayIndex: signal(null),
    completionPercent: signal(0),
    todayDay: signal(null),
    todayDone: signal(false),
    busyKeys: signal<ReadonlySet<string>>(new Set()),
    abandon: vitest.fn(),
    pause: vitest.fn().mockResolvedValue(undefined),
    resume: vitest.fn().mockResolvedValue(undefined),
    logTodayPlanDay: vitest.fn().mockResolvedValue('noop'),
  };
}

describe('TrainingPlansPageComponent', () => {
  it('shows the public signup banner for unauthenticated visitors once auth is resolved', async () => {
    await render(TrainingPlansPageComponent, {
      providers: [
        provideRouter([]),
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

    expect(
      screen.getByText('Plan auswählen, Konto erstellen, durchstarten')
    ).toBeTruthy();

    const signupLink = screen.getByRole('link', {
      name: 'Kostenlos registrieren',
    });
    expect(signupLink.getAttribute('href')).toContain('/register');
    expect(decodeURIComponent(signupLink.getAttribute('href') ?? '')).toContain(
      'returnUrl=/training-plans'
    );
  });

  it('hides the signup banner before auth state is resolved', async () => {
    await render(TrainingPlansPageComponent, {
      providers: [
        provideRouter([]),
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

    expect(
      screen.queryByText('Plan auswählen, Konto erstellen, durchstarten')
    ).toBeNull();
  });

  it('hides the signup banner for authenticated users', async () => {
    await render(TrainingPlansPageComponent, {
      providers: [
        provideRouter([]),
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

    expect(
      screen.queryByText('Plan auswählen, Konto erstellen, durchstarten')
    ).toBeNull();
  });

  it('renders all curated plans regardless of auth state', async () => {
    await render(TrainingPlansPageComponent, {
      providers: [
        provideRouter([]),
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

    const planLinks = screen.getAllByRole('link', { name: 'Plan ansehen' });
    expect(planLinks.length).toBe(TRAINING_PLANS.length);
  });

  it('should link the active plan card to its catalog slug', async () => {
    // given
    const activePlan = TRAINING_PLANS[0];

    // when
    await render(TrainingPlansPageComponent, {
      providers: [
        provideRouter([]),
        {
          provide: TrainingPlanStore,
          useValue: makeStoreMock(activePlan, true),
        },
        {
          provide: AuthStore,
          useValue: makeAuthStoreMock({
            isAuthenticated: true,
            authResolved: true,
          }),
        },
      ],
    });

    // then
    expect(
      screen.getByRole('link', { name: 'Details öffnen' }).getAttribute('href')
    ).toBe(`/training-plans/${activePlan.slug}`);
  });

  it('should show the active plan card button busy while its store action runs', async () => {
    // given
    const store = makeStoreMock(TRAINING_PLANS[0], true);
    const { fixture } = await render(TrainingPlansPageComponent, {
      providers: [
        provideRouter([]),
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

    // when
    store.busyKeys.set(new Set(['abandon']));
    fixture.detectChanges();

    // then
    expect(
      screen
        .getByRole('button', { name: /Plan beenden/ })
        .getAttribute('aria-busy')
    ).toBe('true');
    expect(
      screen
        .getByRole('button', { name: /Plan pausieren/ })
        .getAttribute('aria-busy')
    ).toBeNull();
  });

  it('should hold the active plan card as a skeleton while the plan is still loading', async () => {
    // given
    const store = makeStoreMock(TRAINING_PLANS[0], true);
    store.activePlanLoaded.set(false);

    // when
    const { container } = await render(TrainingPlansPageComponent, {
      providers: [
        provideRouter([]),
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

    // then
    const loading = screen.getByTestId('active-plan-loading');
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(loading.closest('app-active-plan-card-skeleton')).not.toBeNull();
    expect(loading.querySelectorAll('pu-skeleton').length).toBeGreaterThan(0);
    expect(container.querySelector('app-active-plan-card')).toBeNull();
    expect(container.querySelector('mat-spinner')).toBeNull();
  });

  it('should swap the skeleton for the active plan card once the plan is there', async () => {
    // given
    const store = makeStoreMock(TRAINING_PLANS[0], true);
    store.activePlanLoaded.set(false);
    const { container, fixture } = await render(TrainingPlansPageComponent, {
      providers: [
        provideRouter([]),
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

    // when
    store.activePlanLoaded.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    // then
    expect(screen.queryByTestId('active-plan-loading')).toBeNull();
    expect(container.querySelector('pu-skeleton')).toBeNull();
    expect(container.querySelector('app-active-plan-card')).not.toBeNull();
  });

  it('should never show the active plan skeleton to a guest', async () => {
    // given
    const store = makeStoreMock();
    store.activePlanLoaded.set(false);

    // when
    const { container } = await render(TrainingPlansPageComponent, {
      providers: [
        provideRouter([]),
        { provide: TrainingPlanStore, useValue: store },
        {
          provide: AuthStore,
          useValue: makeAuthStoreMock({
            isAuthenticated: false,
            authResolved: true,
          }),
        },
      ],
    });

    // then
    expect(screen.queryByTestId('active-plan-loading')).toBeNull();
    expect(container.querySelector('app-active-plan-card-skeleton')).toBeNull();
    expect(container.querySelector('app-active-plan-card')).toBeNull();
  });

  it('renders a topical hero image for every plan card', async () => {
    const { container } = await render(TrainingPlansPageComponent, {
      providers: [
        provideRouter([]),
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

    const images =
      container.querySelectorAll<HTMLImageElement>('.card-media img');
    expect(images.length).toBe(TRAINING_PLANS.length);

    const [firstPlan] = TRAINING_PLANS;
    const firstImg = images[0];
    expect(firstImg.getAttribute('src')).toBe(firstPlan.heroImage);
    // Localized title doubles as the alt text.
    expect(firstImg.getAttribute('alt')).toBe(firstPlan.title);
  });

  it('should hide a card image given an image load failure (OnPush + zoneless)', async () => {
    // Given: a rendered component with a hero image on every plan card
    const { container, fixture } = await render(TrainingPlansPageComponent, {
      providers: [
        provideRouter([]),
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

    const firstImg =
      container.querySelector<HTMLImageElement>('.card-media img');
    expect(firstImg).not.toBeNull();

    // When: the first image fails to load
    firstImg?.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    await fixture.whenStable();

    // Then: that image is removed from the DOM
    const images =
      container.querySelectorAll<HTMLImageElement>('.card-media img');
    expect(images.length).toBe(TRAINING_PLANS.length - 1);
  });
});
