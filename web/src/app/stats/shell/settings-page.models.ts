import type { SnapQuality } from '@pu-stats/models';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export const AUTO_SAVE_DEBOUNCE_MS = 600;
export const SAVED_INDICATOR_MS = 1800;

export interface DraftSnapshot {
  displayName: string;
  hideFromLeaderboard: boolean;
  publicProfile: boolean;
  adsConsent: boolean;
  snapQuality: SnapQuality;
}

export interface ResolvedConfig {
  displayName: string;
  hideFromLeaderboard: boolean;
  publicProfile: boolean;
  consent: { targetedAds?: boolean } & Record<string, unknown>;
  snapQuality: SnapQuality;
}
