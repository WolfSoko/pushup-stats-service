import { DEFAULT_SNAP_QUALITY } from '@pu-stats/models';
import {
  buildSaveUpdate,
  eventValue,
  isAnalyticsConsentGranted,
  resolveConfig,
  snapshotFromConfig,
  snapshotsEqual,
} from './settings-page.helpers';
import type { DraftSnapshot, ResolvedConfig } from './settings-page.models';

describe('settings-page.helpers', () => {
  describe('resolveConfig', () => {
    it('should return defaults with ads opted-in for a null config', () => {
      // given
      // when
      const result = resolveConfig(null);

      // then
      expect(result).toEqual({
        displayName: '',
        hideFromLeaderboard: false,
        publicProfile: false,
        consent: { targetedAds: true },
        snapQuality: DEFAULT_SNAP_QUALITY,
      });
    });

    it('should return the defaults for a non-object config', () => {
      // given
      // when
      const result = resolveConfig('nonsense' as unknown);

      // then
      expect(result.displayName).toBe('');
      expect(result.consent.targetedAds).toBe(true);
    });

    it('should map every field for a fully populated config', () => {
      // given
      const raw = {
        displayName: 'Wolf',
        ui: {
          hideFromLeaderboard: true,
          publicProfile: true,
          snapQuality: 'high',
        },
        consent: { targetedAds: false, dataProcessing: true },
      };

      // when
      const result = resolveConfig(raw);

      // then
      expect(result).toEqual({
        displayName: 'Wolf',
        hideFromLeaderboard: true,
        publicProfile: true,
        consent: { targetedAds: false, dataProcessing: true },
        snapQuality: 'high',
      });
    });

    it('should fill the gaps with defaults for a config missing ui and consent', () => {
      // given
      const raw = { displayName: 'Ann' };

      // when
      const result = resolveConfig(raw);

      // then
      expect(result.hideFromLeaderboard).toBe(false);
      expect(result.publicProfile).toBe(false);
      expect(result.snapQuality).toBe(DEFAULT_SNAP_QUALITY);
      expect(result.consent).toEqual({ targetedAds: true });
    });

    it('should fall back ui fields to defaults for a config with an empty ui object', () => {
      // given
      const raw = { displayName: 'Ann', ui: {} };

      // when
      const result = resolveConfig(raw);

      // then
      expect(result.hideFromLeaderboard).toBe(false);
      expect(result.snapQuality).toBe(DEFAULT_SNAP_QUALITY);
    });

    it('should coerce wrongly-typed fields to their defaults', () => {
      // given
      const raw = {
        displayName: 42,
        ui: { hideFromLeaderboard: 'yes', publicProfile: 1 },
        consent: { targetedAds: 'nope' },
      };

      // when
      const result = resolveConfig(raw as unknown);

      // then
      expect(result.displayName).toBe('');
      expect(result.hideFromLeaderboard).toBe(false);
      expect(result.publicProfile).toBe(false);
      expect(result.consent.targetedAds).toBe(true);
    });

    it('should fall back to defaults when ui and consent are non-objects', () => {
      // given
      const raw = { displayName: 'Ann', ui: 'broken', consent: 7 };

      // when
      const result = resolveConfig(raw as unknown);

      // then
      expect(result.displayName).toBe('Ann');
      expect(result.hideFromLeaderboard).toBe(false);
      expect(result.consent).toEqual({ targetedAds: true });
      expect(result.snapQuality).toBe(DEFAULT_SNAP_QUALITY);
    });
  });

  describe('snapshotFromConfig', () => {
    const base: ResolvedConfig = {
      displayName: '  Wolf  ',
      hideFromLeaderboard: true,
      publicProfile: false,
      consent: { targetedAds: false },
      snapQuality: 'middle',
    };

    it('should trim the displayName when snapshotted', () => {
      // when
      const snap = snapshotFromConfig(base);

      // then
      expect(snap.displayName).toBe('Wolf');
    });

    it('should default adsConsent to true when consent lacks targetedAds', () => {
      // given
      const cfg: ResolvedConfig = { ...base, consent: {} };

      // when
      const snap = snapshotFromConfig(cfg);

      // then
      expect(snap.adsConsent).toBe(true);
    });

    it('should set adsConsent to false when consent.targetedAds is false', () => {
      // when
      const snap = snapshotFromConfig(base);

      // then
      expect(snap.adsConsent).toBe(false);
    });
  });

  describe('snapshotsEqual', () => {
    const a: DraftSnapshot = {
      displayName: 'Wolf',
      hideFromLeaderboard: false,
      publicProfile: true,
      adsConsent: true,
      snapQuality: 'low',
    };

    it('should report two identical snapshots as equal', () => {
      // when
      const result = snapshotsEqual(a, { ...a });

      // then
      expect(result).toBe(true);
    });

    it('should report snapshots differing only in displayName as not equal', () => {
      // when
      const result = snapshotsEqual(a, { ...a, displayName: 'Other' });

      // then
      expect(result).toBe(false);
    });

    it('should report snapshots differing in snapQuality as not equal', () => {
      // when
      const result = snapshotsEqual(a, { ...a, snapQuality: 'high' });

      // then
      expect(result).toBe(false);
    });

    it('should detect a difference in each boolean flag', () => {
      // then
      expect(snapshotsEqual(a, { ...a, hideFromLeaderboard: true })).toBe(
        false
      );
      expect(snapshotsEqual(a, { ...a, publicProfile: false })).toBe(false);
      expect(snapshotsEqual(a, { ...a, adsConsent: false })).toBe(false);
    });
  });

  describe('buildSaveUpdate', () => {
    const draft: DraftSnapshot = {
      displayName: 'Wolf',
      hideFromLeaderboard: true,
      publicProfile: true,
      adsConsent: false,
      snapQuality: 'high',
    };

    it('should preserve existing consent keys when building the update', () => {
      // given
      const current: ResolvedConfig = {
        displayName: 'Wolf',
        hideFromLeaderboard: false,
        publicProfile: false,
        consent: { targetedAds: true, dataProcessing: true },
        snapQuality: 'low',
      };

      // when
      const update = buildSaveUpdate(draft, current);

      // then
      expect(update).toEqual({
        displayName: 'Wolf',
        consent: { targetedAds: false, dataProcessing: true },
        ui: {
          hideFromLeaderboard: true,
          publicProfile: true,
          snapQuality: 'high',
        },
      });
    });

    it('should write only targetedAds when the current config has no consent', () => {
      // given
      const current: ResolvedConfig = {
        displayName: 'Wolf',
        hideFromLeaderboard: false,
        publicProfile: false,
        consent: undefined as unknown as ResolvedConfig['consent'],
        snapQuality: 'low',
      };

      // when
      const update = buildSaveUpdate(draft, current);

      // then
      expect(update.consent).toEqual({ targetedAds: false });
    });
  });

  describe('eventValue', () => {
    it('should return the target value from an input event', () => {
      // given
      const event = { target: { value: 'hello' } } as unknown as Event;

      // when
      const result = eventValue(event);

      // then
      expect(result).toBe('hello');
    });
  });

  describe('isAnalyticsConsentGranted', () => {
    const original = globalThis.localStorage;

    afterEach(() => {
      Object.defineProperty(globalThis, 'localStorage', {
        value: original,
        configurable: true,
      });
    });

    function stubStorage(value: Storage | undefined): void {
      Object.defineProperty(globalThis, 'localStorage', {
        value,
        configurable: true,
      });
    }

    it('should return true when consent is stored as granted', () => {
      // given
      stubStorage({
        getItem: (key: string) =>
          key === 'pus_analytics_consent' ? 'granted' : null,
      } as Storage);

      // when / then
      expect(isAnalyticsConsentGranted()).toBe(true);
    });

    it('should return false when consent is stored as something else', () => {
      // given
      stubStorage({ getItem: () => 'denied' } as unknown as Storage);

      // when / then
      expect(isAnalyticsConsentGranted()).toBe(false);
    });

    it('should return false when there is no localStorage', () => {
      // given
      stubStorage(undefined);

      // when / then
      expect(isAnalyticsConsentGranted()).toBe(false);
    });

    it('should fail closed and return false when localStorage access throws', () => {
      // given
      stubStorage({
        getItem: () => {
          throw new Error('blocked');
        },
      } as unknown as Storage);

      // when / then
      expect(isAnalyticsConsentGranted()).toBe(false);
    });
  });
});
