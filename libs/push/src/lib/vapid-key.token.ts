import { InjectionToken } from '@angular/core';

/** VAPID public key for Web Push subscriptions. Provided by the host application. */
export const VAPID_PUBLIC_KEY = new InjectionToken<string>('VAPID_PUBLIC_KEY');
