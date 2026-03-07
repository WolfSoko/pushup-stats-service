export type StatsGranularity = 'daily' | 'hourly';

export interface StatsMeta {
  from: string | null;
  to: string | null;
  entries: number;
  days: number;
  total: number;
  granularity: StatsGranularity;
}

export interface StatsSeriesEntry {
  bucket: string;
  total: number;
  dayIntegral: number;
  bucketLabel?: string;
}

export interface StatsResponse {
  meta: StatsMeta;
  series: StatsSeriesEntry[];
}

export interface StatsFilter {
  from?: string;
  to?: string;
}

export interface PushupRecord {
  _id: string;
  timestamp: string;
  reps: number;
  source: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PushupCreate {
  timestamp: string;
  reps: number;
  source?: string;
  type?: string;
}

export interface PushupUpdate {
  timestamp?: string;
  reps?: number;
  source?: string;
  type?: string;
}

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
  createdAt?: string;
  updatedAt?: string;
}

export type UserConfigUpdate = Partial<
  Pick<UserConfig, 'email' | 'displayName' | 'dailyGoal' | 'consent' | 'ui'>
>;
