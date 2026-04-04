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
}
