import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StatsApiService } from '@pu-stats/data-access';
import { appendLocalOffset } from '@pu-stats/models';
import { firstValueFrom } from 'rxjs';

/**
 * Listens for `QUICK_LOG_PUSHUPS` messages posted by the push service worker
 * (`libs/sw-push/src/handlers.ts`) when the user taps the "✅ N eintragen"
 * notification action. The message arrives only when a window client is open;
 * if it isn't, the SW navigates to `?quickLog=N` and the dashboard handles
 * it on render instead.
 *
 * Idempotency: registration is guarded by a flag — calling `init()` multiple
 * times (per-page injection, route changes) installs only one listener.
 */
@Injectable({ providedIn: 'root' })
export class QuickLogListenerService {
  private readonly api = inject(StatsApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private registered = false;

  init(): void {
    if (
      this.registered ||
      !this.isBrowser ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }
    this.registered = true;

    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = (event as MessageEvent).data as {
        type?: string;
        reps?: number;
      } | null;
      if (data?.type !== 'QUICK_LOG_PUSHUPS') return;
      const reps = Number(data.reps);
      if (!Number.isFinite(reps) || reps <= 0) return;
      // SW message events fire outside Angular's zone — re-enter so any
      // signals/snackbar triggered downstream propagate change detection.
      this.zone.run(() => {
        void this.logEntry(Math.floor(reps));
      });
    });
  }

  /** Visible for testing — invokes the same flow as the SW message handler. */
  async logEntry(reps: number): Promise<void> {
    try {
      await firstValueFrom(
        this.api.createPushup({
          timestamp: appendLocalOffset(currentLocalTimestamp()),
          reps,
          sets: [reps],
          source: 'reminder',
          type: 'Standard',
        })
      );
      this.snackBar.open(
        $localize`:@@reminder.quickLog.success:${reps}:reps: Push-ups eingetragen ✓`,
        $localize`:@@snackbar.close:Schließen`,
        { duration: 3000 }
      );
    } catch {
      this.snackBar.open(
        $localize`:@@reminder.quickLog.error:Eintrag konnte nicht gespeichert werden.`,
        $localize`:@@snackbar.close:Schließen`,
        { duration: 5000 }
      );
    }
  }
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
