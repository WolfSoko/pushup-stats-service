import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { ReminderStore } from './reminder.store';
import { ReminderPermissionService } from './reminder-permission.service';
import { AuthStore } from '@pu-auth/auth';

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

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly store = inject(ReminderStore);
  private readonly permissionService = inject(ReminderPermissionService);
  private readonly auth = inject(AuthStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  // Only inject Functions in the browser — calling getFunctions() with a
  // server-side Firebase app (initializeServerApp) is unsupported and causes
  // the SSR dev server to crash before Playwright can connect.
  private readonly functions: Functions | null = this.isBrowser
    ? inject(Functions, { optional: true })
    : null;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private quoteCache: string[] = [];
  private quoteIndex = 0;

  start(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    const config = this.store.config();
    if (!config?.enabled) return;
    if (this.permissionService.status() !== 'granted') return;

    const intervalMs = (config.intervalMinutes ?? 60) * 60 * 1000;
    this.intervalId = setInterval(() => this.tick(), intervalMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async tick(): Promise<void> {
    const config = this.store.config();
    if (!config?.enabled) return;

    if (isInQuietHours(config.quietHours ?? [], config.timezone ?? 'UTC')) {
      return;
    }

    const quote = await this.getNextQuote();
    if (!quote) return;

    const lang = config.language ?? 'de';
    const title =
      lang === 'en' ? '💪 Time for push-ups!' : '💪 Zeit für Liegestütze!';

    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: quote,
          icon: '/assets/pushup-logo.svg',
        });
      } catch {
        // Notification creation failed silently
      }
    }
  }

  private async getNextQuote(): Promise<string | null> {
    if (this.quoteCache.length - this.quoteIndex < 2) {
      await this.fetchQuotes();
    }

    if (!this.quoteCache.length) return null;

    const quote = this.quoteCache[this.quoteIndex % this.quoteCache.length];
    this.quoteIndex = (this.quoteIndex + 1) % this.quoteCache.length;
    return quote;
  }

  private async fetchQuotes(): Promise<void> {
    if (!this.functions) return;

    const config = this.store.config();
    const user = this.auth.user();
    const displayName = user?.displayName || 'Champ';

    try {
      const callable = httpsCallable<
        {
          language: string;
          totalToday: number;
          dailyGoal: number;
          displayName: string;
        },
        { quotes: string[] }
      >(this.functions, 'generateMotivationQuotes');

      const result = await callable({
        language: config?.language ?? 'de',
        totalToday: 0,
        dailyGoal: 100,
        displayName,
      });

      this.quoteCache = result.data?.quotes ?? [];
      this.quoteIndex = 0;
    } catch {
      // Keep existing cache on failure
    }
  }
}
