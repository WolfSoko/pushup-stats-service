export interface ReminderConfig {
  enabled: boolean;
  intervalMinutes: number;
  quietHours: {
    from: string;
    to: string;
  }[];
  timezone: string;
  language: 'de' | 'en';
  lastQuoteFetchAt?: string;
  /**
   * One-tap pushup count surfaced as a notification action button. When set
   * (and > 0), reminders show "✅ N eintragen" instead of the generic log
   * action — tapping it logs the entry without the user opening the app.
   */
  quickLogReps?: number;
}

export const QUICK_LOG_REPS_MIN = 1;
export const QUICK_LOG_REPS_MAX = 500;
