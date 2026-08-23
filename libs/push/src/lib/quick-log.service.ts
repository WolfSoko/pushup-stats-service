import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ExerciseFirestoreService,
  pushupValidationMessage,
} from '@pu-stats/data-access';
import { QUICK_LOG_REPS_MAX, QUICK_LOG_REPS_MIN } from '@pu-stats/models';
import { appendLocalOffset } from '@pu-stats/date';
import { firstValueFrom } from 'rxjs';
import { UserContextService } from '@pu-auth/auth';

/**
 * Writes the entry behind the "✅ N eintragen" notification action.
 *
 * Called by `PushIntentDrainService` once it has claimed a `quick-log` intent
 * from the store the push SW writes. It used to listen for a
 * `QUICK_LOG_PUSHUPS` postMessage instead — that channel is gone: a frozen
 * PWA processes such a message whenever it thaws, with no way to tell a fresh
 * tap from one queued hours ago, which is how push-ups appeared in production
 * at 02:05 on the back of an unrelated snooze tap.
 */
@Injectable({ providedIn: 'root' })
export class QuickLogService {
  private readonly exerciseApi = inject(ExerciseFirestoreService, {
    optional: true,
  });
  private readonly userContext = inject(UserContextService);
  private readonly snackBar = inject(MatSnackBar);

  /**
   * Persists `reps` push-ups. Clamps into the configured range — the count
   * has round-tripped through the notification payload and the intent store,
   * so it is treated as untrusted (the CF and SW clamp too).
   *
   * Reports success so the drain can tell the SW whether a window still needs
   * to be brought up for the user to see the failure snackbar.
   */
  async logEntry(rawReps: number): Promise<boolean> {
    const reps = clampReps(rawReps);
    if (reps == null) return false;
    const userId = this.userContext.userIdSafe();
    if (!userId || !this.exerciseApi) {
      this.snackBar.open(
        pushupValidationMessage(new Error('not authenticated')),
        $localize`:@@snackbar.close:Schließen`,
        { duration: 5000 }
      );
      return false;
    }
    try {
      await firstValueFrom(
        this.exerciseApi.createEntry(userId, {
          exerciseId: 'pushup',
          timestamp: appendLocalOffset(currentLocalTimestamp()),
          reps,
          sets: [reps],
          source: 'reminder',
        })
      );
      this.snackBar.open(
        $localize`:@@reminder.quickLog.success:${reps}:reps: Push-ups eingetragen ✓`,
        $localize`:@@snackbar.close:Schließen`,
        { duration: 3000 }
      );
      return true;
    } catch (err) {
      this.snackBar.open(
        pushupValidationMessage(err),
        $localize`:@@snackbar.close:Schließen`,
        { duration: 5000 }
      );
      return false;
    }
  }
}

/**
 * Mirrors the dispatch CF sanitizer: returns an integer in
 * `[QUICK_LOG_REPS_MIN, QUICK_LOG_REPS_MAX]`, or `null` for missing/invalid
 * input. Defense-in-depth — the CF and SW already clamp, but stale payloads
 * from older deployments can still reach this handler.
 */
function clampReps(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < QUICK_LOG_REPS_MIN) return null;
  return Math.min(Math.floor(n), QUICK_LOG_REPS_MAX);
}

function currentLocalTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}
