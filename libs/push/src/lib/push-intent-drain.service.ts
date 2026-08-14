import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  effect,
  inject,
  Injectable,
  NgZone,
  PLATFORM_ID,
} from '@angular/core';
import { AuthStore } from '@pu-auth/auth';

import { drainPushIntents, type PushIntent } from './push-intent-queue';
import { PushSubscriptionStore } from './push-subscription.store';
import { QuickLogService } from './quick-log.service';

/** Mirrors `DRAIN_INTENTS_MESSAGE` in `libs/sw-push/src/notification-click.ts`. */
export const DRAIN_INTENTS_MESSAGE = 'DRAIN_PUSH_INTENTS';

/**
 * Applies what the user tapped on a reminder notification.
 *
 * The push SW records the tap in IndexedDB and nudges any open client; this
 * service is the consumer. It drains on three triggers, because none of them
 * is reliable alone on an installed Android PWA:
 *
 *   - once auth has resolved (cold start from the notification),
 *   - on the SW's nudge (app already open and responsive),
 *   - on `visibilitychange → visible` (the frozen-tab case: the SW focused a
 *     window, Android resumed the existing task without navigating, and the
 *     nudge is still sitting unprocessed in the client's message queue).
 *
 * Draining is gated on `authResolved()`: the callable behind a snooze needs a
 * Firebase Auth token, and intents are consumed on read — acting too early
 * would burn them against an unauthenticated request.
 */
@Injectable({ providedIn: 'root' })
export class PushIntentDrainService {
  private readonly push = inject(PushSubscriptionStore);
  private readonly quickLog = inject(QuickLogService);
  private readonly auth = inject(AuthStore);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private listenersRegistered = false;
  private inFlight: Promise<boolean> | null = null;

  // Cold start from a notification: the app boots, Firebase restores the
  // session, and only then can the snooze callable succeed.
  private readonly _drainWhenAuthReady = effect(() => {
    if (!this.isBrowser) return;
    if (!this.auth.authResolved()) return;
    void this.drain();
  });

  /** Registers the SW + visibility triggers. Idempotent. */
  init(): void {
    if (this.listenersRegistered || !this.isBrowser) return;
    this.listenersRegistered = true;

    const onSwMessage = (event: Event): void => {
      const data = (event as MessageEvent).data as { type?: string } | null;
      if (data?.type !== DRAIN_INTENTS_MESSAGE) return;
      const port = (event as MessageEvent).ports?.[0];
      // SW messages arrive outside Angular's zone — re-enter so the entry
      // snackbar and any signal writes trigger change detection.
      this.zone.run(() => {
        void this.drain().then(
          (ok) => port?.postMessage({ ok }),
          () => port?.postMessage({ ok: false })
        );
      });
    };
    const onVisibilityChange = (): void => {
      if (document.visibilityState !== 'visible') return;
      this.zone.run(() => void this.drain());
    };

    const swContainer =
      'serviceWorker' in navigator ? navigator.serviceWorker : null;
    swContainer?.addEventListener('message', onSwMessage);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Both listeners outlive the injector otherwise — and a leaked one still
    // drains the shared store, stealing intents from the live instance.
    this.destroyRef.onDestroy(() => {
      swContainer?.removeEventListener('message', onSwMessage);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      this.listenersRegistered = false;
    });
  }

  /**
   * Consumes every fresh intent. Resolves `false` when nothing could be
   * applied, which is what tells the SW to bring a window to the front.
   *
   * Overlapping callers are serialised rather than merged: the three triggers
   * routinely fire together, and a nudge that arrives while an earlier drain
   * is mid-flight is asking about an intent that drain never read. Sharing the
   * in-flight promise would answer it from a stale read — the SW would take
   * that as "handled", skip focusing a window, and the intent would sit until
   * some later trigger, possibly past its expiry. Each caller therefore gets
   * its own read; the store's read-and-clear transaction is what keeps an
   * intent from being applied twice.
   */
  async drain(): Promise<boolean> {
    if (!this.isBrowser || !this.auth.authResolved()) return false;

    const run = (this.inFlight ?? Promise.resolve(false)).then(
      () => this.runDrain(),
      () => this.runDrain()
    );
    this.inFlight = run.catch(() => false);
    return run;
  }

  private async runDrain(): Promise<boolean> {
    // No IndexedDB (private mode, ancient browser, jsdom) means the SW had
    // nowhere to write either — nothing to apply.
    if (typeof indexedDB === 'undefined') return false;

    let intents: PushIntent[];
    try {
      intents = await drainPushIntents(indexedDB);
    } catch (err) {
      console.error('[PushIntentDrain] could not read intents', err);
      return false;
    }
    if (intents.length === 0) return false;

    let applied = false;
    for (const intent of intents) {
      try {
        applied = (await this.apply(intent)) || applied;
      } catch (err) {
        console.error('[PushIntentDrain] intent failed', intent.type, err);
      }
    }
    return applied;
  }

  private async apply(intent: PushIntent): Promise<boolean> {
    if (intent.type === 'snooze') {
      await this.push.snooze(intent.snoozeMinutes ?? 30);
      return true;
    }
    if (intent.type === 'quick-log' && typeof intent.reps === 'number') {
      return this.quickLog.logEntry(intent.reps);
    }
    return false;
  }
}
