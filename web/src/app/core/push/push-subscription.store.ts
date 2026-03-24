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
import { firebaseRuntime } from '../../../env/firebase-runtime';

export type PushStatus =
  | 'unsupported'
  | 'denied'
  | 'not-subscribed'
  | 'subscribed'
  | 'loading'
  | 'error';

type PushSubscriptionState = {
  status: PushStatus;
};

export const PushSubscriptionStore = signalStore(
  { providedIn: 'root' },
  withState<PushSubscriptionState>({
    status: 'not-subscribed',
  }),
  withProps(() => ({
    _isBrowser: isPlatformBrowser(inject(PLATFORM_ID)),
    _functions: isPlatformBrowser(inject(PLATFORM_ID))
      ? inject(Functions, { optional: true })
      : null,
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

    function urlBase64ToUint8Array(base64String: string): Uint8Array {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const rawData = atob(base64);
      return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
    }

    async function saveSubscription(sub: PushSubscription): Promise<void> {
      if (!store._functions) return;
      const json = sub.toJSON();
      const callable = httpsCallable(store._functions, 'savePushSubscription');
      await callable({
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
        locale: navigator.language,
      });
    }

    async function deleteSubscription(endpoint: string): Promise<void> {
      if (!store._functions) return;
      const callable = httpsCallable(
        store._functions,
        'deletePushSubscription'
      );
      await callable({ endpoint });
    }

    return {
      async init(): Promise<void> {
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
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (!sub) {
            patchState(store, { status: 'not-subscribed' });
            return;
          }
          // Re-register with backend to ensure server-side record is current
          await saveSubscription(sub);
          patchState(store, { status: 'subscribed' });
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
            patchState(store, { status: 'denied' });
            return false;
          }

          const reg = await navigator.serviceWorker.ready;
          const existingSub = await reg.pushManager.getSubscription();
          const subToSave =
            existingSub ??
            (await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(
                firebaseRuntime.vapidPublicKey
              ),
            }));

          await saveSubscription(subToSave);
          patchState(store, { status: 'subscribed' });
          return true;
        } catch {
          patchState(store, { status: 'error' });
          return false;
        }
      },

      async unsubscribe(): Promise<void> {
        if (!isSupported()) return;

        patchState(store, { status: 'loading' });
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            const endpoint = sub.endpoint;
            await sub.unsubscribe();
            await deleteSubscription(endpoint);
          }
          patchState(store, { status: 'not-subscribed' });
        } catch {
          patchState(store, { status: 'error' });
        }
      },
    };
  })
);
