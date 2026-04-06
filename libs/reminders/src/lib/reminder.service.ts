import { inject, Injectable, LOCALE_ID, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ReminderStore } from './reminder.store';
import { ReminderPermissionService } from './reminder-permission.service';
import { MotivationStore } from '@pu-stats/motivation';
import { PushSubscriptionStore } from './push/push-subscription.store';

export function isInQuietHours(
  quietHours: { from: string; to: string }[],
  timezone: string,
  now: Date = new Date()
): boolean {
  if (!quietHours.length) return false;

  // Get HH:MM in the target timezone
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(now)
    .slice(0, 5); // "HH:MM"

  return quietHours.some(({ from, to }) => {
    if (from === to) return false;

    if (from < to) {
      // Same-day window e.g. 12:00 – 13:00
      return hhmm >= from && hhmm < to;
    } else {
      // Overnight window e.g. 22:00 – 07:00
      return hhmm >= from || hhmm < to;
    }
  });
}

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
  private readonly pushStore = inject(PushSubscriptionStore);
  private readonly locale = (() => {
    const l = inject(LOCALE_ID).toLowerCase();
    return l.startsWith('en') ? 'en' : 'de';
  })();

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

    if (isInQuietHours(config.quietHours ?? [], config.timezone ?? 'UTC')) {
      return;
    }

    // Skip in-app notification when server-side push is active — the Cloud
    // Function already handles delivery, showing both causes duplicate sounds.
    if (this.pushStore.status() === 'subscribed') return;

    const quote = await this.getNextQuote();
    if (!quote) return;

    const lang = config.language ?? 'de';
    const title =
      lang === 'en' ? '💪 Time for push-ups!' : '💪 Zeit für Liegestütze!';

    if (Notification.permission === 'granted') {
      // Prefer ServiceWorker notification — `new Notification()` is not
      // supported on Android Chrome and throws "Illegal constructor".
      // Try getRegistration() first; if SW isn't registered yet
      // (registerWhenStable:30000), wait up to 5s via .ready with timeout.
      let shown = false;
      try {
        let reg = await navigator.serviceWorker?.getRegistration();
        if (!reg) {
          reg = await Promise.race([
            navigator.serviceWorker?.ready,
            new Promise<undefined>((resolve) =>
              setTimeout(() => resolve(undefined), 5_000)
            ),
          ]);
        }
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
          shown = true;
        }
      } catch {
        // SW notification failed — fall through to Notification() fallback
      }
      if (!shown) {
        try {
          const iconUrl = new URL('assets/pushup-logo.svg', document.baseURI)
            .href;
          new Notification(title, {
            body: quote,
            icon: iconUrl,
          });
        } catch {
          // Fallback also failed (e.g. Android Chrome) — give up silently
        }
      }
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
