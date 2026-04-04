import { ReminderConfig } from './reminder-config.models';

export type UserRole = 'user' | 'admin';

export interface UserConfig {
  userId: string;
  email?: string | null;
  displayName?: string;
  dailyGoal?: number;
  consent?: {
    dataProcessing?: boolean;
    statistics?: boolean;
    targetedAds?: boolean;
    acceptedAt?: string;
  };
  ui?: {
    showSourceColumn?: boolean;
    hideFromLeaderboard?: boolean;
    dayChartMode?: '24h' | '14h';
  };
  role?: UserRole;
  createdAt?: string;
  updatedAt?: string;
  reminder?: ReminderConfig;
}

export type UserConfigUpdate = Partial<
  Pick<
    UserConfig,
    | 'email'
    | 'displayName'
    | 'dailyGoal'
    | 'consent'
    | 'ui'
    | 'role'
    | 'reminder'
  >
>;
