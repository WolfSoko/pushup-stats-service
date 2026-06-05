import { Injectable } from '@angular/core';

/**
 * Retained as a no-op shell so existing DI tokens that inject
 * `StatsApiService` don't need to be updated in the same step.
 * All pushup read/write paths have been removed — data now flows
 * exclusively through `ExerciseFirestoreService` and `LiveDataStore`.
 */
@Injectable({ providedIn: 'root' })
export class StatsApiService {}
