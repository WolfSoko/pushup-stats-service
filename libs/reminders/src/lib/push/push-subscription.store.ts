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
          // Use getRegistration() instead of .ready which hangs forever
          // when no SW is registered (e.g. dev mode).
          const reg = await navigator.serviceWorker.getRegistration();
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

          const reg = await navigator.serviceWorker.getRegistration();
          if (!reg) {
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
        } catch {
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
          const reg = await navigator.serviceWorker.getRegistration();
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
