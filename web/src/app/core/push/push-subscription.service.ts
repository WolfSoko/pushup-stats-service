import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { firebaseRuntime } from '../../../env/firebase-runtime';

export type PushStatus =
  | 'unsupported'
  | 'denied'
  | 'not-subscribed'
  | 'subscribed'
  | 'loading'
  | 'error';

@Injectable({ providedIn: 'root' })
export class PushSubscriptionService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly functions: Functions | null = this.isBrowser
    ? inject(Functions, { optional: true })
    : null;

  private readonly _status = signal<PushStatus>(
    this.isBrowser ? 'not-subscribed' : 'unsupported'
  );

  readonly status = this._status.asReadonly();

  private get isSupported(): boolean {
    return (
      this.isBrowser &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  async init(): Promise<void> {
    if (!this.isSupported) {
      this._status.set('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      this._status.set('denied');
      return;
    }
    this._status.set('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      this._status.set(sub ? 'subscribed' : 'not-subscribed');
    } catch {
      this._status.set('error');
    }
  }

  async subscribe(): Promise<boolean> {
    if (!this.isSupported) return false;

    this._status.set('loading');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this._status.set('denied');
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        this._status.set('subscribed');
        return true;
      }

      const vapidKey = firebaseRuntime.vapidPublicKey;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidKey),
      });

      await this.saveSubscription(sub);
      this._status.set('subscribed');
      return true;
    } catch {
      this._status.set('error');
      return false;
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.isSupported) return;

    this._status.set('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await this.deleteSubscription(endpoint);
      }
      this._status.set('not-subscribed');
    } catch {
      this._status.set('error');
    }
  }

  private async saveSubscription(sub: PushSubscription): Promise<void> {
    if (!this.functions) return;
    const json = sub.toJSON();
    const callable = httpsCallable(this.functions, 'savePushSubscription');
    await callable({
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent,
      locale: navigator.language,
    });
  }

  private async deleteSubscription(endpoint: string): Promise<void> {
    if (!this.functions) return;
    const callable = httpsCallable(this.functions, 'deletePushSubscription');
    await callable({ endpoint });
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }
}
