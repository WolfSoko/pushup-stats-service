import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { AuthStore } from '@pu-auth/auth';
import { makeAuthStoreMock } from '@pu-stats/testing';
import { TRAINING_PLANS } from '@pu-stats/models';
import { TrainingPlansPageComponent } from './training-plans-page.component';
import { TrainingPlanStore } from './training-plan.store';

function makeStoreMock() {
  return {
    allPlans: () => TRAINING_PLANS,
    activeCatalog: signal(null),
    activePlan: signal(null),
    hasActivePlan: signal(false),
    currentDayIndex: signal(null),
    completionPercent: signal(0),
    todayDay: signal(null),
    todayDone: signal(false),
    abandon: vitest.fn(),
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
});
