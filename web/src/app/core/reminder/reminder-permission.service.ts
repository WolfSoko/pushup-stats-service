import { Injectable, signal, Signal } from '@angular/core';

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

@Injectable({ providedIn: 'root' })
export class ReminderPermissionService {
  private readonly _status = signal<NotificationPermissionStatus>(this.readInitial());

  readonly status: Signal<NotificationPermissionStatus> = this._status.asReadonly();

  async requestPermission(): Promise<'granted' | 'denied'> {
    if (!this.isSupported()) {
      return 'denied';
    }
    const result = await Notification.requestPermission();
    const normalized: 'granted' | 'denied' = result === 'granted' ? 'granted' : 'denied';
    this._status.set(normalized);
    return normalized;
  }

  private readInitial(): NotificationPermissionStatus {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission as NotificationPermissionStatus;
  }

  private isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window && !!window.Notification;
  }
}
