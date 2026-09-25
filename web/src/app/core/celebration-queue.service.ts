import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

type OpenCelebration = () =>
  | MatDialogRef<unknown>
  | null
  | Promise<MatDialogRef<unknown> | null>;

/**
 * Runs celebration dialogs (XP, goal reached, badges) one at a time. A
 * save can trigger all three within a second; queued, each gets its
 * moment instead of stacking modals and trapping focus in the top one.
 *
 * `busy` is mirrored onto `<body data-celebration-busy>` so end-to-end
 * tests can wait for the queue to drain instead of guessing a delay.
 */
@Injectable({ providedIn: 'root' })
export class CelebrationQueueService {
  private readonly dialog = inject(MatDialog);
  private readonly queued = signal(0);
  private tail: Promise<void> = Promise.resolve();

  readonly busy = computed(() => this.queued() > 0);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const body = inject(DOCUMENT).body;
    effect(() => body.toggleAttribute('data-celebration-busy', this.busy()));
  }

  /** Resolves once this celebration has been shown and closed (or skipped). */
  enqueue(open: OpenCelebration): Promise<void> {
    this.queued.update((n) => n + 1);
    const run = async () => {
      try {
        if (this.dialog.openDialogs.length > 0) {
          await firstValueFrom(this.dialog.afterAllClosed);
        }
        const ref = await open();
        if (ref) await firstValueFrom(ref.afterClosed());
      } finally {
        this.queued.update((n) => n - 1);
      }
    };
    const next = this.tail.then(run);
    this.tail = next.catch(() => undefined);
    return next;
  }
}
