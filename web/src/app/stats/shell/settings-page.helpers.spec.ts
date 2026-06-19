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
    it('Given a null config, When resolved, Then it returns defaults with ads opted-in', () => {
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

    it('Given a non-object config, When resolved, Then it returns the defaults', () => {
      // given
      // when
      const result = resolveConfig('nonsense' as unknown);

      // then
      expect(result.displayName).toBe('');
      expect(result.consent.targetedAds).toBe(true);
    });

    it('Given a fully populated config, When resolved, Then every field is mapped', () => {
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

    it('Given a config missing ui and consent, When resolved, Then defaults fill the gaps', () => {
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

    it('Given a config with an empty ui object, When resolved, Then ui fields fall back to defaults', () => {
      // given
      const raw = { displayName: 'Ann', ui: {} };

      // when
      const result = resolveConfig(raw);

      // then
      expect(result.hideFromLeaderboard).toBe(false);
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

    it('Given a config, When snapshotted, Then the displayName is trimmed', () => {
      // when
      const snap = snapshotFromConfig(base);

      // then
      expect(snap.displayName).toBe('Wolf');
    });

    it('Given consent without targetedAds, When snapshotted, Then adsConsent defaults to true', () => {
      // given
      const cfg: ResolvedConfig = { ...base, consent: {} };

      // when
      const snap = snapshotFromConfig(cfg);

      // then
      expect(snap.adsConsent).toBe(true);
    });

    it('Given consent.targetedAds false, When snapshotted, Then adsConsent is false', () => {
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

    it('Given two identical snapshots, When compared, Then they are equal', () => {
      // when
      const result = snapshotsEqual(a, { ...a });

      // then
      expect(result).toBe(true);
    });

    it('Given snapshots differing only in displayName, When compared, Then they are not equal', () => {
      // when
      const result = snapshotsEqual(a, { ...a, displayName: 'Other' });

      // then
      expect(result).toBe(false);
    });

    it('Given snapshots differing in snapQuality, When compared, Then they are not equal', () => {
      // when
      const result = snapshotsEqual(a, { ...a, snapQuality: 'high' });

      // then
      expect(result).toBe(false);
    });

    it('Given snapshots differing in each boolean flag, When compared, Then each difference is detected', () => {
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

    it('Given a draft and current config, When building the update, Then existing consent keys are preserved', () => {
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

    it('Given a current config with no consent, When building the update, Then only targetedAds is written', () => {
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
    it('Given an input event, When read, Then the target value is returned', () => {
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

    it('Given consent stored as granted, When checked, Then it returns true', () => {
      // given
      stubStorage({
        getItem: (key: string) =>
          key === 'pus_analytics_consent' ? 'granted' : null,
      } as Storage);

      // when / then
      expect(isAnalyticsConsentGranted()).toBe(true);
    });

    it('Given consent stored as something else, When checked, Then it returns false', () => {
      // given
      stubStorage({ getItem: () => 'denied' } as unknown as Storage);

      // when / then
      expect(isAnalyticsConsentGranted()).toBe(false);
    });

    it('Given no localStorage, When checked, Then it returns false', () => {
      // given
      stubStorage(undefined);

      // when / then
      expect(isAnalyticsConsentGranted()).toBe(false);
    });
  });
});
