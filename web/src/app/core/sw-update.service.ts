import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MatSnackBar,
  type MatSnackBarRef,
  type TextOnlySnackBar,
} from '@angular/material/snack-bar';
import { SwUpdate } from '@angular/service-worker';
import { filter, fromEvent, interval, merge, take } from 'rxjs';

/** How often a long-lived session asks ngsw for a fresh manifest. */
export const SW_UPDATE_POLL_INTERVAL_MS = 10 * 60 * 1000;

type PendingKind = 'update' | 'unrecoverable';

/**
 * Surfaces ngsw version changes to the user.
 *
 * `VERSION_READY` fires exactly once per downloaded version, so a prompt
 * that only lives in a snackbar is lost for good the moment anything else
 * calls `MatSnackBar.open()` — the snackbar is a singleton and every open
 * dismisses the current one. Roughly a dozen call sites (quick-add,
 * training plans, feedback, reminders) do exactly that, which is why the
 * reload prompt kept vanishing before users could act on it.
 *
 * The fix is to latch the event into `updateAvailable`, which the toolbar
 * renders as a persistent button. The snackbar becomes the loud-but-
 * transient half of the notice, the toolbar button the durable half.
 */
@Injectable({ providedIn: 'root' })
export class SwUpdateService {
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly pending = signal<PendingKind | null>(null);

  /** True from the moment a new version is ready until the user reloads. */
  readonly updateAvailable = computed(() => this.pending() !== null);

  /**
   * ngsw lost the cached version it was serving and cannot self-heal — the
   * page keeps running on whatever is already in memory, so a reload is the
   * only way back to a consistent build.
   */
  readonly unrecoverable = computed(() => this.pending() === 'unrecoverable');

  private promptRef: MatSnackBarRef<TextOnlySnackBar> | null = null;
  private promptKind: PendingKind | null = null;

  constructor() {
    const swUpdate = this.swUpdate;
    if (!this.isBrowser || !swUpdate?.isEnabled) return;

    swUpdate.versionUpdates
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        // VERSION_DETECTED only means "download started" — prompting there
        // would offer a reload into a version that isn't cached yet.
        if (event.type !== 'VERSION_READY') return;
        this.pending.set('update');
        this.showPrompt();
      });

    swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.pending.set('unrecoverable');
        this.showPrompt();
      });

    // Long-lived sessions (PWA / TWA users who never close the tab) only see
    // VERSION_READY when ngsw re-checks the manifest, and it only does that
    // once on app stabilisation. Background tabs also get their timers
    // throttled, so the visibility hook is what actually catches an app the
    // user resumes hours after a deploy.
    merge(
      interval(SW_UPDATE_POLL_INTERVAL_MS),
      fromEvent(this.document, 'visibilitychange').pipe(
        filter(() => this.document.visibilityState === 'visible')
      )
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.poll());
  }

  /**
   * Activate the waiting worker, then reload. `reload()` alone keeps the old
   * worker in place — it just opens another navigation against the still-
   * active one, so the user would reload into the same stale build.
   */
  async applyUpdate(): Promise<void> {
    try {
      await this.swUpdate?.activateUpdate();
    } catch {
      // Activation can fail when the cached version is already gone (the
      // unrecoverable path). Reloading is still the right move: without a
      // waiting worker the browser fetches the current build from the network.
    }
    window.location.reload();
  }

  private poll(): void {
    if (this.pending()) {
      // A prompt is already owed. Re-surfacing it is more useful than asking
      // ngsw for a manifest we have already acted on.
      this.showPrompt();
      return;
    }
    this.swUpdate?.checkForUpdate().catch(() => {
      // Offline or ngsw in safe mode — the next tick retries.
    });
  }

  private showPrompt(): void {
    const kind = this.pending();
    if (!kind) return;
    if (this.promptRef) {
      // An open prompt for the same state is already saying the right thing.
      if (this.promptKind === kind) return;
      // Escalating from 'update' to 'unrecoverable' changes the message, so
      // the stale one has to go.
      this.promptRef.dismiss();
    }

    const message =
      kind === 'unrecoverable'
        ? $localize`:@@sw.update.unrecoverable:App-Daten beschädigt – bitte neu laden`
        : $localize`:@@sw.update.available:Neue Version verfügbar`;

    // Sticky (no `duration`) + top-center: the prompt sits at eye level and
    // stays put until the user acts. An auto-dismiss timer made the toast easy
    // to miss (especially when the mobile bottom-nav cropped the bottom-
    // anchored variant). Distinct panelClass lets `styles.scss` give it its own
    // surface colour so it doesn't get mistaken for a routine info toast.
    const ref = this.snackBar.open(
      message,
      $localize`:@@sw.update.reload:Neu laden`,
      {
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: 'sw-update-snackbar',
      }
    );
    this.promptRef = ref;
    this.promptKind = kind;

    ref
      .onAction()
      .pipe(take(1))
      .subscribe(() => void this.applyUpdate());
    ref
      .afterDismissed()
      .pipe(take(1))
      .subscribe(() => {
        // `dismiss()` above resolves asynchronously, so the replaced ref's
        // event can land after the replacement is already tracked.
        if (this.promptRef !== ref) return;
        this.promptRef = null;
        this.promptKind = null;
      });
  }
}
