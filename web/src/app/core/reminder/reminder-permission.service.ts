import { inject, Injectable, PLATFORM_ID, signal, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type NotificationPermissionStatus =
  | 'default'
  | 'granted'
  | 'denied'
  | 'unsupported';

@Injectable({ providedIn: 'root' })
export class ReminderPermissionService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly _status = signal<NotificationPermissionStatus>(
    this.readInitial()
  );

  readonly status: Signal<NotificationPermissionStatus> =
    this._status.asReadonly();

  constructor() {
    void this.watchPermissionChanges();
  }

  async requestPermission(): Promise<'granted' | 'denied'> {
    if (!this.isSupported()) {
      return 'denied';
    }
    const result = await Notification.requestPermission();
    const normalized: 'granted' | 'denied' =
      result === 'granted' ? 'granted' : 'denied';
    this._status.set(normalized);
    return normalized;
  }

  private async watchPermissionChanges(): Promise<void> {
    if (!this.isBrowser || !this.isSupported()) return;

    const permissions = globalThis.navigator?.permissions;
    if (!permissions?.query) return;

    try {
      const status = await permissions.query({
        name: 'notifications' as PermissionName,
      });
      this._status.set(this.readInitial());
      status.onchange = () => this._status.set(this.readInitial());
    } catch {
      // Permissions API not supported consistently across browsers.
    }
  }

  private readInitial(): NotificationPermissionStatus {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission as NotificationPermissionStatus;
  }

  private isSupported(): boolean {
    return (
      this.isBrowser &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      !!window.Notification
    );
  }
}
