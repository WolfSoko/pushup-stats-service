import { Injectable, signal } from '@angular/core';

/** A request may take this long before the global indicator appears. */
export const PENDING_INDICATOR_DELAY_MS = 300;

/** Once shown, the indicator stays at least this long so it never flickers. */
export const PENDING_INDICATOR_MIN_VISIBLE_MS = 500;

/**
 * Counts in-flight requests app-wide and derives whether the global
 * loading indicator should show: only once a request has been pending for
 * {@link PENDING_INDICATOR_DELAY_MS}, and then for at least
 * {@link PENDING_INDICATOR_MIN_VISIBLE_MS}.
 *
 * Firestore and Cloud Functions bypass `HttpClient`, so there is no
 * interceptor to hook — every promise-based request (writes, callables,
 * one-off reads) is wrapped in {@link track} at the API-service layer
 * instead. Live listeners (`docData`, `collectionData`) are streams, not
 * actions, and stay untracked.
 */
@Injectable({ providedIn: 'root' })
export class PendingRequestsService {
  private readonly _pending = signal(0);
  private readonly _visible = signal(false);

  /** Number of requests currently in flight. */
  readonly pending = this._pending.asReadonly();
  /** Whether the global indicator should be rendered right now. */
  readonly visible = this._visible.asReadonly();

  private showTimer: ReturnType<typeof setTimeout> | undefined;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private shownAt = 0;

  /** Wraps a request so it counts as pending until it settles. */
  track<T>(request: Promise<T>): Promise<T> {
    this.begin();
    return request.finally(() => this.end());
  }

  /** Marks one request as started; pair every call with {@link end}. */
  begin(): void {
    this._pending.update((count) => count + 1);
    if (this._pending() !== 1) return;
    this.clearTimer('hide');
    if (this._visible()) return;
    this.showTimer = setTimeout(() => {
      this.showTimer = undefined;
      this.shownAt = Date.now();
      this._visible.set(true);
    }, PENDING_INDICATOR_DELAY_MS);
  }

  /** Marks one request as settled (resolved or rejected). */
  end(): void {
    if (this._pending() === 0) return;
    this._pending.update((count) => count - 1);
    if (this._pending() > 0) return;
    this.clearTimer('show');
    if (!this._visible()) return;
    const remaining =
      PENDING_INDICATOR_MIN_VISIBLE_MS - (Date.now() - this.shownAt);
    if (remaining <= 0) {
      this._visible.set(false);
      return;
    }
    this.hideTimer = setTimeout(() => {
      this.hideTimer = undefined;
      this._visible.set(false);
    }, remaining);
  }

  private clearTimer(kind: 'show' | 'hide'): void {
    const timer = kind === 'show' ? this.showTimer : this.hideTimer;
    if (timer === undefined) return;
    clearTimeout(timer);
    if (kind === 'show') this.showTimer = undefined;
    else this.hideTimer = undefined;
  }
}
