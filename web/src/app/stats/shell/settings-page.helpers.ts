import {
  DEFAULT_SNAP_QUALITY,
  type SnapQuality,
  type UserConfigUpdate,
} from '@pu-stats/models';
import type { DraftSnapshot, ResolvedConfig } from './settings-page.models';

/**
 * Normalises the loosely-typed persisted config into the shape the page binds
 * to. A missing/non-object config defaults `targetedAds` to opted-in, matching
 * the legacy behaviour where ads consent was on until explicitly revoked.
 */
export function resolveConfig(val: unknown): ResolvedConfig {
  if (!val || typeof val !== 'object') {
    return {
      displayName: '',
      hideFromLeaderboard: false,
      publicProfile: false,
      consent: { targetedAds: true },
      snapQuality: DEFAULT_SNAP_QUALITY,
    };
  }
  const record = val as Record<string, unknown>;
  const ui =
    record['ui'] && typeof record['ui'] === 'object'
      ? (record['ui'] as Record<string, unknown>)
      : {};
  const consent =
    record['consent'] && typeof record['consent'] === 'object'
      ? (record['consent'] as Record<string, unknown>)
      : null;

  return {
    displayName:
      typeof record['displayName'] === 'string' ? record['displayName'] : '',
    hideFromLeaderboard:
      typeof ui['hideFromLeaderboard'] === 'boolean'
        ? ui['hideFromLeaderboard']
        : false,
    publicProfile:
      typeof ui['publicProfile'] === 'boolean' ? ui['publicProfile'] : false,
    consent:
      consent === null
        ? { targetedAds: true }
        : {
            ...consent,
            targetedAds:
              typeof consent['targetedAds'] === 'boolean'
                ? consent['targetedAds']
                : true,
          },
    snapQuality: (ui['snapQuality'] as SnapQuality) ?? DEFAULT_SNAP_QUALITY,
  };
}

export function snapshotFromConfig(cfg: ResolvedConfig): DraftSnapshot {
  return {
    displayName: cfg.displayName.trim(),
    hideFromLeaderboard: cfg.hideFromLeaderboard,
    publicProfile: cfg.publicProfile,
    adsConsent: cfg.consent?.targetedAds ?? true,
    snapQuality: cfg.snapQuality,
  };
}

export function snapshotsEqual(a: DraftSnapshot, b: DraftSnapshot): boolean {
  return (
    a.displayName === b.displayName &&
    a.hideFromLeaderboard === b.hideFromLeaderboard &&
    a.publicProfile === b.publicProfile &&
    a.adsConsent === b.adsConsent &&
    a.snapQuality === b.snapQuality
  );
}

export function buildSaveUpdate(
  draft: DraftSnapshot,
  current: ResolvedConfig
): UserConfigUpdate {
  return {
    displayName: draft.displayName,
    consent: {
      ...(current.consent ?? {}),
      targetedAds: draft.adsConsent,
    },
    ui: {
      hideFromLeaderboard: draft.hideFromLeaderboard,
      publicProfile: draft.publicProfile,
      snapQuality: draft.snapQuality,
    },
  };
}

export function eventValue(event: Event): string {
  return (event.target as HTMLInputElement).value;
}

export function isAnalyticsConsentGranted(): boolean {
  try {
    const storage = globalThis.localStorage;
    const hasGetItem = typeof storage?.getItem === 'function';
    if (!hasGetItem) return false;
    return storage.getItem('pus_analytics_consent') === 'granted';
  } catch {
    // Accessing localStorage can throw (e.g. blocked by privacy settings);
    // fail closed so analytics stays off when consent can't be confirmed.
    return false;
  }
}
