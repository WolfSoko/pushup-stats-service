import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  inject,
  Injectable,
  Injector,
  PLATFORM_ID,
} from '@angular/core';
import {
  PushSubscriptionService,
  PushSwRegistrationService,
} from '@pu-push/push';
import type { WorkoutReminder } from '@pu-stats/models';

import { WorkoutsStore } from '../workouts.store';
import { dueInAppOccurrence } from './workout-reminder-due';
import { WorkoutRemindersStore } from './workout-reminders.store';

const TICK_MS = 60_000;
const SHOWN_KEY = 'pu:workout-reminder:shown:';

/**
 * The fallback tier for session reminders: while the app is open on a
 * device without push, it shows the notification itself. With push on
 * this device the dispatcher delivers it and this stays quiet.
 *
 * The push status is only known after `PushSubscriptionService.init()`,
 * which re-registers the subscription with the backend. It runs once a
 * reminder is actually due, not on every app start.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutReminderInAppService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly injector = inject(Injector);
  private readonly reminders = inject(WorkoutRemindersStore);
  private readonly push = inject(PushSubscriptionService);
  private readonly swRegistration = inject(PushSwRegistrationService);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  start(): void {
    if (!this.isBrowser || this.intervalId !== null) return;
    this.intervalId = setInterval(() => void this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.intervalId === null) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  async tick(now: Date = new Date()): Promise<void> {
    if (globalThis.Notification?.permission !== 'granted') return;
    for (const reminder of this.reminders.reminders()) {
      const at = dueInAppOccurrence(reminder, now, this.readShown(reminder));
      if (!at) continue;
      const delivery = await this.pushDelivery();
      if (delivery === 'unknown') return;
      if (delivery === 'push') this.writeShown(reminder, at);
      else await this.show(reminder, at);
    }
  }

  private async pushDelivery(): Promise<'push' | 'none' | 'unknown'> {
    await this.push.init();
    const status = this.push.status();
    if (status === 'subscribed') return 'push';
    return status === 'loading' ? 'unknown' : 'none';
  }

  /**
   * The workouts listener only starts once a reminder is actually due,
   * so an app without reminders never opens it. Until it has delivered,
   * the occurrence stays unshown and the next tick tries again.
   */
  private async show(reminder: WorkoutReminder, at: Date): Promise<void> {
    const workouts = this.injector.get(WorkoutsStore);
    if (!workouts.loaded()) return;
    const workout = workouts.workoutById(reminder.workoutId);
    this.writeShown(reminder, at);
    if (!workout) return;

    const title = `⏰ ${workout.title}`;
    const body = $localize`:@@workouts.reminder.notificationBody:Zeit für deine Session. Tippe, um direkt loszulegen.`;
    const url = new URL(`workouts/${workout.id}/run`, document.baseURI);
    try {
      const reg = await this.swRegistration.getRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: new URL('assets/pushup-logo.svg', document.baseURI).href,
          tag: `workout-reminder-${workout.id}`,
          renotify: true,
          data: { url: url.pathname },
        } as NotificationOptions);
        return;
      }
    } catch {
      // fall through to the page-level notification
    }
    try {
      new Notification(title, { body });
    } catch {
      // Android Chrome has no Notification constructor — nothing left to try.
    }
  }

  private readShown(reminder: WorkoutReminder): string | null {
    try {
      return localStorage.getItem(SHOWN_KEY + reminder.workoutId);
    } catch {
      return null;
    }
  }

  private writeShown(reminder: WorkoutReminder, at: Date): void {
    try {
      localStorage.setItem(SHOWN_KEY + reminder.workoutId, at.toISOString());
    } catch {
      // Storage unavailable — at worst the same occurrence shows again.
    }
  }
}
