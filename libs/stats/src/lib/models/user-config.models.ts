import { ReminderConfig } from './reminder-config.models';

/** Particle-count quality preset for the goal-reached snap animation. */
export type SnapQuality = 'low' | 'middle' | 'high';

/** Maps a SnapQuality preset to its @wolsok/thanos `maxParticleCount`. */
export const SNAP_QUALITY_PARTICLES: Readonly<Record<SnapQuality, number>> = {
  low: 40_000,
  middle: 120_000,
  high: 200_000,
};

export const DEFAULT_SNAP_QUALITY: SnapQuality = 'low';

/** User-configurable quick-add button (up to 3 slots). */
export interface QuickAddConfig {
  reps: number;
  inSpeedDial: boolean;
}

export const MAX_QUICK_ADDS = 3;

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
    /**
     * Public-profile opt-in. When `true`, the `getPublicProfile(uid)` Cloud
     * Function returns a sanitized projection of this user's stats; otherwise
     * it returns `not-found`. Defaults to `false` (private).
     */
    publicProfile?: boolean;
    dayChartMode?: '24h' | '14h';
    quickAdds?: QuickAddConfig[];
    snapQuality?: SnapQuality;
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
