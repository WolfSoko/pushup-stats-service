import { PLATFORM_ID, signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthStore } from '@pu-auth/auth';
import {
  PlanExerciseProgress,
  TrainingPlanDay,
  TrainingPlanExercise,
  UserTrainingPlan,
} from '@pu-stats/models';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { UserConfigStore } from '../../core/user-config.store';
import { TrainingPlanStore } from '../training-plan.store';
import { SessionCaptureService } from './session-capture.service';
import { TrainingSessionComponent } from './training-session.component';

const SLUG = 'challenge-30d';
const PLAN_ID = 'challenge-30d-v1';

const PLANK: TrainingPlanExercise = {
  exerciseId: 'plank.standard',
  target: 50,
};
const TWIST: TrainingPlanExercise = {
  exerciseId: 'abs.russiantwist',
  target: 20,
};
const PUSHUPS: TrainingPlanExercise = { exerciseId: 'pushup', target: 15 };

const DAY: TrainingPlanDay = {
  dayIndex: 3,
  kind: 'main',
  targetReps: 15,
  description: 'Zirkel für den ganzen Körper',
};

function item(
  itemIndex: number,
  exercise: TrainingPlanExercise,
  done = false
): PlanExerciseProgress {
  return {
    itemIndex,
    exercise,
    logged: 0,
    fulfilledByEntries: done,
    checkedOff: false,
    done,
  };
}

const ACTIVE_PLAN: UserTrainingPlan = {
  userId: 'u1',
  planId: PLAN_ID,
  startDate: '2026-08-22',
  status: 'active',
  completedDays: [],
};

interface Options {
  progress?: PlanExerciseProgress[];
  activePlan?: UserTrainingPlan | null;
  authenticated?: boolean;
  slug?: string;
  capture?: Partial<SessionCaptureService>;
}

async function setup(options: Options = {}) {
  const capture = vitest.fn().mockResolvedValue({
    status: 'captured',
    value: 999,
  });
  const captureByHand = vitest.fn().mockResolvedValue({
    status: 'cancelled',
    value: 0,
  });
  const logPlanExercise = vitest.fn().mockResolvedValue('logged');
  const setItemDone = vitest.fn().mockResolvedValue(undefined);
  const navigateByUrl = vitest.fn().mockResolvedValue(true);
  const saveSessionRestSec = vitest.fn().mockResolvedValue(undefined);

  const activePlan =
    options.activePlan === undefined ? ACTIVE_PLAN : options.activePlan;

  await render(TrainingSessionComponent, {
    providers: [
      { provide: PLATFORM_ID, useValue: 'server' },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ slug: options.slug ?? SLUG })),
          snapshot: {
            paramMap: convertToParamMap({ slug: options.slug ?? SLUG }),
          },
        },
      },
      {
        provide: Router,
        useValue: {
          navigateByUrl,
          createUrlTree: () => ({}),
          serializeUrl: () => '',
        },
      },
      { provide: MatSnackBar, useValue: { open: vitest.fn() } },
      {
        provide: AuthStore,
        useValue: {
          isAuthenticated: signal(options.authenticated ?? true),
          authResolved: signal(true),
        },
      },
      {
        provide: TrainingPlanStore,
        useValue: {
          currentDayIndex: signal(3),
          todayDay: signal(DAY),
          activePlan: signal(activePlan),
          activePlanLoaded: signal(true),
          dayProgress: () =>
            options.progress ?? [
              item(0, PLANK),
              item(1, TWIST),
              item(2, PUSHUPS),
            ],
          logPlanExercise,
          setItemDone,
        },
      },
      {
        provide: UserConfigStore,
        useValue: { sessionRestSec: signal(60), saveSessionRestSec },
      },
    ],
    componentProviders: [
      {
        provide: SessionCaptureService,
        useValue: { capture, captureByHand, ...options.capture },
      },
    ],
  });

  return {
    capture,
    captureByHand,
    logPlanExercise,
    setItemDone,
    navigateByUrl,
    saveSessionRestSec,
  };
}

const byTestId = (id: string): HTMLElement =>
  document.querySelector(`[data-testid="${id}"]`) as HTMLElement;

describe('TrainingSessionComponent', () => {
  it('should open on the day overview listing every exercise', async () => {
    // given / when
    await setup();

    // then
    expect(screen.getByText('Plank')).toBeTruthy();
    expect(screen.getByText('Russian Twist')).toBeTruthy();
    expect(byTestId('session-start')).toBeTruthy();
  });

  it('should refuse a session for a plan that is not active', async () => {
    // given / when
    await setup({ activePlan: null });

    // then
    expect(
      screen.getByText(/Für eine geführte Session muss dieser Plan aktiv sein/)
    ).toBeTruthy();
    expect(byTestId('session-start')).toBeNull();
  });

  it('should refuse a session for a plan other than the active one', async () => {
    // given / when
    await setup({
      activePlan: { ...ACTIVE_PLAN, planId: 'recruit-6w-v1' },
    });

    // then
    expect(
      screen.getByText(/Für eine geführte Session muss dieser Plan aktiv sein/)
    ).toBeTruthy();
  });

  it('should tell the user when the plan slug is unknown', async () => {
    // given / when
    await setup({ slug: 'not-a-plan' });

    // then
    expect(screen.getByText(/Diesen Plan gibt es nicht/)).toBeTruthy();
  });

  it('should treat a day with no exercises as a rest day', async () => {
    // given / when
    await setup({ progress: [] });

    // then
    expect(screen.getByText(/Ruhetag/)).toBeTruthy();
  });

  it('should walk to the first exercise on start', async () => {
    // given
    await setup();

    // when
    await userEvent.click(byTestId('session-start'));

    // then
    expect(screen.getByText(/Übung 1 von 3/)).toBeTruthy();
    expect(byTestId('session-capture')).toBeTruthy();
  });

  it('should run the step tool and rest before the next exercise', async () => {
    // given
    const { capture } = await setup();
    await userEvent.click(byTestId('session-start'));

    // when
    await userEvent.click(byTestId('session-capture'));

    // then
    expect(capture).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Als Nächstes: Russian Twist/)).toBeTruthy();
  });

  it('should stay on the exercise when the capture fell short of the target', async () => {
    // given
    const { capture } = await setup({
      capture: {
        capture: vitest
          .fn()
          .mockResolvedValue({ status: 'captured', value: 20 }),
      },
    });
    await userEvent.click(byTestId('session-start'));

    // when — 20 s of a 50 s plank
    await userEvent.click(byTestId('session-capture'));

    // then
    expect(capture).not.toHaveBeenCalled();
    expect(screen.getByText(/Übung 1 von 3/)).toBeTruthy();
  });

  it('should stay on the exercise when the capture was cancelled', async () => {
    // given
    await setup({
      capture: {
        capture: vitest
          .fn()
          .mockResolvedValue({ status: 'cancelled', value: 0 }),
      },
    });
    await userEvent.click(byTestId('session-start'));

    // when
    await userEvent.click(byTestId('session-capture'));

    // then
    expect(screen.getByText(/Übung 1 von 3/)).toBeTruthy();
  });

  it('should log the prescription in one tap and move on', async () => {
    // given
    const { logPlanExercise } = await setup();
    await userEvent.click(byTestId('session-start'));

    // when
    await userEvent.click(byTestId('session-log-prescribed'));

    // then
    expect(logPlanExercise).toHaveBeenCalledWith(3, 0);
    expect(screen.getByText(/Als Nächstes/)).toBeTruthy();
  });

  it('should keep the user on the exercise when the plan write did not go through', async () => {
    // given
    const { logPlanExercise } = await setup();
    logPlanExercise.mockResolvedValue('not-ready');
    await userEvent.click(byTestId('session-start'));

    // when
    await userEvent.click(byTestId('session-log-prescribed'));

    // then
    expect(screen.getByText(/Übung 1 von 3/)).toBeTruthy();
  });

  it('should keep the user on the exercise when the plan write throws', async () => {
    // given
    const { logPlanExercise } = await setup();
    logPlanExercise.mockRejectedValue(new Error('offline'));
    await userEvent.click(byTestId('session-start'));

    // when
    await userEvent.click(byTestId('session-log-prescribed'));

    // then
    expect(screen.getByText(/Übung 1 von 3/)).toBeTruthy();
  });

  it('should keep the user on the exercise when the check-off write throws', async () => {
    // given
    const { setItemDone } = await setup();
    setItemDone.mockRejectedValue(new Error('offline'));
    await userEvent.click(byTestId('session-start'));

    // when
    await userEvent.click(byTestId('session-check-off'));

    // then
    expect(screen.getByText(/Übung 1 von 3/)).toBeTruthy();
  });

  it('should tick an exercise off without an entry', async () => {
    // given
    const { setItemDone } = await setup();
    await userEvent.click(byTestId('session-start'));

    // when
    await userEvent.click(byTestId('session-check-off'));

    // then
    expect(setItemDone).toHaveBeenCalledWith(3, 0, true);
  });

  it('should skip an exercise straight to the next one without resting', async () => {
    // given
    await setup();
    await userEvent.click(byTestId('session-start'));

    // when
    await userEvent.click(byTestId('session-skip'));

    // then
    expect(screen.getByText(/Übung 2 von 3/)).toBeTruthy();
  });

  it('should start on the first exercise that is still open', async () => {
    // given
    await setup({
      progress: [item(0, PLANK, true), item(1, TWIST), item(2, PUSHUPS)],
    });

    // when
    await userEvent.click(byTestId('session-start'));

    // then
    expect(screen.getByText(/Übung 2 von 3/)).toBeTruthy();
  });

  it('should finish the session when nothing is left open', async () => {
    // given
    await setup({
      progress: [
        item(0, PLANK, true),
        item(1, TWIST, true),
        item(2, PUSHUPS, true),
      ],
    });

    // when
    await userEvent.click(byTestId('session-start'));

    // then
    expect(screen.getByText(/Session geschafft/)).toBeTruthy();
  });

  it('should return to the plan when the session is closed', async () => {
    // given
    const { navigateByUrl } = await setup({
      progress: [item(0, PLANK, true)],
    });
    await userEvent.click(byTestId('session-start'));

    // when
    await userEvent.click(byTestId('session-finish'));

    // then
    expect(navigateByUrl).toHaveBeenCalledWith(`/training-plans/${SLUG}`);
  });

  it('should persist a rest duration picked before starting', async () => {
    // given
    const { saveSessionRestSec } = await setup();
    const slider = byTestId('session-rest-slider') as HTMLInputElement;

    // when
    slider.value = '30';
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    // then
    expect(saveSessionRestSec).toHaveBeenCalledWith(30);
  });

  it('should go straight to the next exercise when rest is set to zero', async () => {
    // given
    const { capture } = await setup();
    const slider = byTestId('session-rest-slider') as HTMLInputElement;
    slider.value = '0';
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    await userEvent.click(byTestId('session-start'));

    // when
    await userEvent.click(byTestId('session-capture'));

    // then
    expect(capture).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Übung 2 von 3/)).toBeTruthy();
  });

  it('should report progress across the day', async () => {
    // given / when
    await setup({
      progress: [item(0, PLANK, true), item(1, TWIST), item(2, PUSHUPS)],
    });

    // then
    expect(screen.getByText(/1 von 3 Übungen\s+erledigt/)).toBeTruthy();
  });
});
