import { inject, Injectable, LOCALE_ID, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  DEFAULT_REMINDER_TIMEZONE,
  isInQuietHours,
  normalizeReminderLocale,
  reminderTitle,
} from '@pu-stats/models';
import { ReminderStore } from './reminder.store';
import { ReminderPermissionService } from './reminder-permission.service';
import { MotivationStore } from '@pu-stats/motivation';
import { PushSwRegistrationService } from '@pu-push/push';
import { SHOULD_SKIP_IN_APP_REMINDER } from './skip-in-app-reminder.token';

// Re-exported so the in-app tier and the server dispatcher share one
// quiet-hours implementation (`@pu-stats/models`) — same timezone default,
// time parsing, and boundary handling on both sides.
export { isInQuietHours } from '@pu-stats/models';

export interface ReminderUserContext {
  userId?: string;
  displayName?: string;
}

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly store = inject(ReminderStore);
  private readonly permissionService = inject(ReminderPermissionService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly motivationStore = inject(MotivationStore);
  private readonly shouldSkipInApp = inject(SHOULD_SKIP_IN_APP_REMINDER);
  private readonly pushSwRegistration = inject(PushSwRegistrationService);
  private readonly locale = normalizeReminderLocale(inject(LOCALE_ID));

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private initialTickTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private quoteIndex = 0;
  private userContext: ReminderUserContext = {};

  start(userContext: ReminderUserContext = {}): void {
    this.userContext = userContext;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.initialTickTimeoutId !== null) {
      clearTimeout(this.initialTickTimeoutId);
      this.initialTickTimeoutId = null;
    }

    const config = this.store.config();
    if (!config?.enabled) return;
    if (this.permissionService.status() !== 'granted') return;

    // Fire once after a short delay so the user gets immediate feedback
    this.initialTickTimeoutId = setTimeout(() => {
      this.initialTickTimeoutId = null;
      this.tick();
    }, 5_000);

    const intervalMs = (config.intervalMinutes ?? 60) * 60 * 1000;
    this.intervalId = setInterval(() => this.tick(), intervalMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.initialTickTimeoutId !== null) {
      clearTimeout(this.initialTickTimeoutId);
      this.initialTickTimeoutId = null;
    }
    this.userContext = {};
  }

  private async tick(): Promise<void> {
    const config = this.store.config();
    if (!config?.enabled) return;

    // Stop if permission was revoked since start() was called
    if (this.permissionService.status() !== 'granted') {
      this.stop();
      return;
    }

    if (
      isInQuietHours(
        config.quietHours ?? [],
        config.timezone ?? DEFAULT_REMINDER_TIMEZONE
      )
    ) {
      return;
    }

    // Skip in-app notification when server-side push is active — the Cloud
    // Function already handles delivery, showing both causes duplicate sounds.
    if (this.shouldSkipInApp()) return;

    // Throttle: start() fires an immediate tick and runs on every login /
    // auth change, so without this a user who reloads the app gets a fresh
    // reminder every few seconds. Suppress if one was already shown within the
    // configured interval. Per-device (localStorage) — the server tier keeps
    // its own lastSentAt in reminderDispatchState, which stays Admin-SDK only.
    const intervalMs = (config.intervalMinutes ?? 60) * 60 * 1000;
    const lastShownAt = this.readLastShownAt();
    if (lastShownAt !== null && Date.now() - lastShownAt < intervalMs) return;

    const quote = await this.getNextQuote();
    if (!quote) return;

    const title = reminderTitle(this.locale);

    if (Notification.permission === 'granted') {
      // Prefer ServiceWorker notification — `new Notification()` is not
      // supported on Android Chrome and throws "Illegal constructor". We
      // explicitly show via the /push/ registration so that a later
      // notificationclick is handled by sw-push (ngsw has no listener).
      let displayed = false;
      try {
        const reg = await this.pushSwRegistration.getRegistration();
        if (reg) {
          const iconUrl = new URL('assets/pushup-logo.svg', document.baseURI)
            .href;
          await reg.showNotification(title, {
            body: quote,
            icon: iconUrl,
            tag: 'reminder',
            renotify: true,
            data: { url: `/${this.locale}/app`, locale: this.locale },
          } as NotificationOptions);
          displayed = true;
        }
      } catch {
        // SW notification failed — fall through to Notification() fallback
      }
      if (!displayed) {
        try {
          const iconUrl = new URL('assets/pushup-logo.svg', document.baseURI)
            .href;
          new Notification(title, {
            body: quote,
            icon: iconUrl,
          });
          displayed = true;
        } catch {
          // Fallback also failed (e.g. Android Chrome) — give up silently
        }
      }
      if (displayed) this.writeLastShownAt(Date.now());
    }
  }

  private static readonly LAST_SHOWN_KEY = 'pu:reminder:last-shown-at';

  private readLastShownAt(): number | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(ReminderService.LAST_SHOWN_KEY);
      if (!raw) return null;
      const ms = Number(raw);
      return Number.isFinite(ms) ? ms : null;
    } catch {
      return null;
    }
  }

  private writeLastShownAt(ms: number): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(ReminderService.LAST_SHOWN_KEY, String(ms));
    } catch {
      // Storage unavailable (private mode / quota) — throttle is best-effort.
    }
  }

  private async getNextQuote(): Promise<string | null> {
    const userId = this.userContext.userId;

    // Ensure quotes are loaded (store deduplicates in-flight requests)
    await this.motivationStore.loadQuotes(userId);

    const quotes = this.motivationStore.quotes();

    if (!quotes.length) return null;

    const quote = quotes[this.quoteIndex % quotes.length];
    this.quoteIndex++;
    return quote;
  }
}
