import { ReminderConfig } from './reminder-config.models';

export interface UserConfig {
  userId: string;
  email?: string | null;
  displayName?: string;
  dailyGoal?: number;
  weeklyGoal?: number;
  monthlyGoal?: number;
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
    | 'weeklyGoal'
    | 'monthlyGoal'
    | 'consent'
    | 'ui'
    | 'reminder'
  >
>;
