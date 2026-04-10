import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Functions, httpsCallable } from '@angular/fire/functions';
import {
  patchState,
  signalStore,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { VAPID_PUBLIC_KEY } from './vapid-key.token';

export type PushStatus =
  | 'unsupported'
  | 'denied'
  | 'not-subscribed'
  | 'subscribed'
  | 'loading'
  | 'error';

type PushSubscriptionState = {
  status: PushStatus;
  /** Number of active push subscriptions across all devices for this user */
  deviceCount: number;
};

export const PushSubscriptionStore = signalStore(
  { providedIn: 'root' },
  withState<PushSubscriptionState>({
    status: 'not-subscribed',
    deviceCount: 0,
  }),
  withProps(() => ({
    _isBrowser: isPlatformBrowser(inject(PLATFORM_ID)),
    _functions: isPlatformBrowser(inject(PLATFORM_ID))
      ? inject(Functions, { optional: true })
      : null,
    _vapidPublicKey: inject(VAPID_PUBLIC_KEY),
  })),
  withMethods((store) => {
    function isSupported(): boolean {
      return (
        store._isBrowser &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
      );
    }

    function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const rawData = atob(base64);
      const buffer = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) {
        buffer[i] = rawData.charCodeAt(i);
      }
      return buffer.buffer;
    }

    async function saveSubscription(
      sub: PushSubscription
    ): Promise<{ deviceCount: number }> {
      if (!store._functions) {
        throw new Error('Firebase Functions is not available');
      }
      const json = sub.toJSON();
      const callable = httpsCallable<
        unknown,
        { ok: boolean; subId: string; deviceCount: number }
      >(store._functions, 'savePushSubscription');
      const result = await callable({
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
        locale: navigator.language,
      });
      return { deviceCount: result.data.deviceCount ?? 1 };
    }

    async function deleteSubscription(
      endpoint: string
    ): Promise<{ deviceCount: number }> {
      if (!store._functions) return { deviceCount: 0 };
      const callable = httpsCallable<
        unknown,
        { ok: boolean; deviceCount: number }
      >(store._functions, 'deletePushSubscription');
      const result = await callable({ endpoint });
      return { deviceCount: result.data.deviceCount ?? 0 };
    }

    async function snoozeReminder(snoozeMinutes: number): Promise<void> {
      if (!store._functions) return;
      const callable = httpsCallable(store._functions, 'snoozeReminder');
      await callable({ snoozeMinutes });
    }

    /**
     * Max time to wait for the Angular service worker to become available
     * before giving up. Must be comfortably larger than the
     * `registerWhenStable:<delay>` in `provideServiceWorker(...)` so the
     * subscribe flow doesn't race the registration on first page load.
     */
    const SW_READY_TIMEOUT_MS = 15_000;
    /** Poll interval while waiting for the SW to register. */
    const SW_POLL_INTERVAL_MS = 250;

    /**
     * Get the SW registration, waiting for it if not yet available.
     *
     * The app uses `registerWhenStable:<delay>`, so on first load the SW may
     * not be registered at the moment the user toggles push on. We poll
     * `getRegistration()` instead of awaiting `navigator.serviceWorker.ready`
     * because `.ready` hangs forever when no SW is ever registered
     * (dev mode, SW disabled) — see CLAUDE.md "Push Notifications" rules.
     */
    async function getSwRegistration(): Promise<
      ServiceWorkerRegistration | undefined
    > {
      const deadline = Date.now() + SW_READY_TIMEOUT_MS;
      // First attempt — likely hit on re-visits where the SW is already active.
      let reg = await navigator.serviceWorker.getRegistration();
      if (reg) return reg;
      // Poll until the SW shows up or we hit the timeout.
      while (Date.now() < deadline) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, SW_POLL_INTERVAL_MS)
        );
        reg = await navigator.serviceWorker.getRegistration();
        if (reg) return reg;
      }
      return undefined;
    }

    // Guard: prevent duplicate init() runs (e.g. from re-mounted components)
    let initStarted = false;
    // Register SW message listener once (guard prevents duplicate registrations)
    let swListenerRegistered = false;
    function ensureSwListener(): void {
      if (
        swListenerRegistered ||
        !store._isBrowser ||
        !('serviceWorker' in navigator)
      )
        return;
      swListenerRegistered = true;
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SNOOZE_REMINDER') {
          void snoozeReminder(event.data.snoozeMinutes ?? 30);
        }
      });
    }

    return {
      /** Register SW message listener — safe to call multiple times, idempotent. */
      registerSwListener(): void {
        ensureSwListener();
      },

      async init(): Promise<void> {
        if (initStarted) return;
        initStarted = true;
        ensureSwListener();
        if (!isSupported()) {
          patchState(store, { status: 'unsupported' });
          return;
        }
        if (Notification.permission === 'denied') {
          patchState(store, { status: 'denied' });
          return;
        }
        patchState(store, { status: 'loading' });
        try {
          const reg = await getSwRegistration();
          if (!reg) {
            patchState(store, { status: 'not-subscribed', deviceCount: 0 });
            return;
          }
          const sub = await reg.pushManager.getSubscription();
          if (!sub) {
            patchState(store, { status: 'not-subscribed', deviceCount: 0 });
            return;
          }
          // Re-register with backend to ensure server-side record is current
          const { deviceCount } = await saveSubscription(sub);
          patchState(store, { status: 'subscribed', deviceCount });
        } catch {
          patchState(store, { status: 'error' });
        }
      },

      async subscribe(): Promise<boolean> {
        if (!isSupported()) return false;

        patchState(store, { status: 'loading' });
        try {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            patchState(store, {
              status: permission === 'denied' ? 'denied' : 'not-subscribed',
            });
            return false;
          }

          const reg = await getSwRegistration();
          if (!reg) {
            // The SW never became available inside the timeout. Surface this
            // as an error instead of 'not-subscribed' so the UI can show a
            // "try again" state — silently flipping to 'not-subscribed' makes
            // the toggle look enabled while no real subscription exists, and
            // users only see notifications while the app is open (via the
            // in-app interval), not in the background.
            console.error(
              '[PushSubscriptionStore] Service Worker not available within ' +
                `${SW_READY_TIMEOUT_MS}ms — cannot subscribe to push. ` +
                'Reload the app and try again.'
            );
            patchState(store, { status: 'error' });
            return false;
          }
          const existingSub = await reg.pushManager.getSubscription();
          const subToSave =
            existingSub ??
            (await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(
                store._vapidPublicKey
              ),
            }));

          const { deviceCount } = await saveSubscription(subToSave);
          patchState(store, { status: 'subscribed', deviceCount });
          return true;
        } catch (err) {
          console.error('[PushSubscriptionStore] subscribe() failed', err);
          patchState(store, { status: 'error' });
          return false;
        }
      },

      async snooze(snoozeMinutes = 30): Promise<void> {
        await snoozeReminder(snoozeMinutes);
      },

      async unsubscribe(): Promise<void> {
        if (!isSupported()) return;

        patchState(store, { status: 'loading' });
        try {
          const reg = await getSwRegistration();
          const sub = reg
            ? await reg.pushManager.getSubscription()
            : null;
          if (sub) {
            const endpoint = sub.endpoint;
            await sub.unsubscribe();
            const { deviceCount } = await deleteSubscription(endpoint);
            // Always not-subscribed on this device, deviceCount shows other devices
            patchState(store, { status: 'not-subscribed', deviceCount });
            return;
          }
          patchState(store, { status: 'not-subscribed', deviceCount: 0 });
        } catch {
          patchState(store, { status: 'error' });
        }
      },
    };
  })
);
