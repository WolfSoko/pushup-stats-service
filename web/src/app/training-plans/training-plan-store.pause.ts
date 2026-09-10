import { isPausedPlan, resumeStartDate } from '@pu-stats/models';
import { toBerlinIsoDate } from '@pu-stats/date';
import { firstValueFrom } from 'rxjs';

import type { TrainingPlanActionsStore } from './training-plan-store.internals';

type Store = TrainingPlanActionsStore;

/**
 * Putting the active plan on hold and picking it back up.
 *
 * Both sides are one write plus a reload; the day arithmetic that makes a
 * break cost no plan days lives in `training-plan-pause.models.ts`.
 */

/**
 * Freeze the plan on the day the user is currently on. No-op when there is
 * no running plan — a paused plan cannot be paused again, and an
 * abandoned or completed one has nothing to hold.
 */
export async function pause(store: Store): Promise<void> {
  const plan = store.activePlan();
  const catalog = store.activeCatalog();
  if (!plan || !catalog || plan.status !== 'active') return;
  const dayIndex = store.currentDayIndex();
  if (dayIndex === null) return;
  const userId = store._user.userIdSafe();
  await firstValueFrom(store._api.pausePlan(userId, dayIndex));
  store.activeResource.reload();
}

/**
 * Resume a paused plan at the day it was paused on, whatever happened in
 * between.
 */
export async function resume(store: Store): Promise<void> {
  const plan = store.activePlan();
  const catalog = store.activeCatalog();
  if (!plan || !catalog || !isPausedPlan(plan)) return;
  const userId = store._user.userIdSafe();
  const newStartDate = resumeStartDate(
    plan,
    catalog,
    toBerlinIsoDate(new Date())
  );
  await firstValueFrom(store._api.resumePlan(userId, newStartDate));
  store.activeResource.reload();
}
