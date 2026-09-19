import { inject, Injectable } from '@angular/core';
import type { WorkoutShareRejection } from '@pu-stats/models';

import { CallableFunctionsService } from '../admin/callable-functions.service';

export type WorkoutShareReason = WorkoutShareRejection | 'failed' | undefined;

export interface WorkoutShareResponse {
  readonly ok: boolean;
  readonly reason?: WorkoutShareReason;
  /** Friends who received a copy. */
  readonly sent?: number;
  /** Friends skipped because their list is full. */
  readonly full?: ReadonlyArray<string>;
}

/**
 * The `shareWorkout` callable: the one write into another user's list.
 * Everything else about workouts is the owner's own document, written
 * directly through `WorkoutsApiService`.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutShareApiService {
  private readonly callables = inject(CallableFunctionsService);

  async share(
    workoutId: string,
    friendUids: ReadonlyArray<string>
  ): Promise<WorkoutShareResponse> {
    const result = await this.callables.call<
      { workoutId: string; friendUids: ReadonlyArray<string> },
      WorkoutShareResponse
    >('shareWorkout')({ workoutId, friendUids });
    return result.data ?? { ok: false };
  }
}
