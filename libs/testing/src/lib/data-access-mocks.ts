/**
 * Shared data-access mock factories for tests across the monorepo.
 *
 * Usage:
 *   import { makePushupFirestoreMock, makeUserConfigMock, makeStatsApiMock } from '@pu-stats/testing';
 *
 * All factories are framework-agnostic (no jest/vitest imports).
 * Pass your framework's spy as an override to verify calls:
 *
 *   // Jest:
 *   const mock = makePushupFirestoreMock({ createPushup: jest.fn().mockReturnValue(of(record)) });
 *   // Vitest:
 *   const mock = makePushupFirestoreMock({ createPushup: vitest.fn().mockReturnValue(of(record)) });
 */

import { EMPTY, of } from 'rxjs';
import {
  LeaderboardBucket,
  LeaderboardData,
  LeaderboardService,
  PushupFirestoreService,
  StatsApiService,
  UserConfigApiService,
} from '@pu-stats/data-access';
import {
  PushupRecord,
  StatsFilter,
  StatsResponse,
  UserConfig,
  UserConfigUpdate,
} from '@pu-stats/models';
import { makePushupRecord } from './pushup-fixtures';

// ---------------------------------------------------------------------------
// PushupFirestoreService mock
// ---------------------------------------------------------------------------

/**
 * Creates a PushupFirestoreService mock that returns empty lists by default.
 *
 * @example
 * { provide: PushupFirestoreService, useValue: makePushupFirestoreMock() }
 *
 * // With custom data:
 * const records = makePushupList(3);
 * const mock = makePushupFirestoreMock({ listPushups: () => of(records) });
 */
export function makePushupFirestoreMock(
  overrides: Partial<PushupFirestoreService> = {}
): Partial<PushupFirestoreService> {
  const defaultRecord = makePushupRecord();
  return {
    listPushups: (_userId: string, _filter?: StatsFilter) =>
      of([] as PushupRecord[]),
    createPushup: (_userId: string) => of(defaultRecord),
    updatePushup: (_id: string) => of(undefined),
    deletePushup: (_id: string) => of({ ok: true as const }),
    migrateUserData: () => Promise.resolve(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// UserConfigApiService mock
// ---------------------------------------------------------------------------

/**
 * Creates a UserConfigApiService mock with a default config.
 *
 * @example
 * const mock = makeUserConfigMock({ getConfig: jest.fn().mockReturnValue(of({ userId: 'u1' })) });
 */
export function makeUserConfigMock(
  overrides: Partial<UserConfigApiService> = {}
): Partial<UserConfigApiService> {
  const defaultConfig: UserConfig = { userId: 'test-uid', dailyGoal: 100 };
  return {
    getConfig: (_userId: string) => of(defaultConfig),
    updateConfig: (_userId: string, patch: UserConfigUpdate) =>
      of({ ...defaultConfig, ...patch }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// StatsApiService mock
// ---------------------------------------------------------------------------

const emptyStats: StatsResponse = {
  meta: {
    from: null,
    to: null,
    entries: 0,
    days: 0,
    total: 0,
    granularity: 'daily',
  },
  series: [],
};

/**
 * Creates a StatsApiService mock returning empty stats by default.
 *
 * @example
 * { provide: StatsApiService, useValue: makeStatsApiMock() }
 */
export function makeStatsApiMock(
  overrides: Partial<StatsApiService> = {}
): Partial<StatsApiService> {
  const defaultRecord = makePushupRecord();
  return {
    load: (_filter?: StatsFilter) => of(emptyStats),
    listPushups: (_filter?: StatsFilter) => of([] as PushupRecord[]),
    createPushup: () => of(defaultRecord),
    updatePushup: (_id: string) => of(undefined),
    deletePushup: (_id: string) => of({ ok: true as const }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// LeaderboardService mock
// ---------------------------------------------------------------------------

const emptyBucket: LeaderboardBucket = { top: [], current: null };
const emptyLeaderboard: LeaderboardData = {
  daily: emptyBucket,
  weekly: emptyBucket,
  monthly: emptyBucket,
};

/**
 * Creates a LeaderboardService mock that resolves with empty data by default.
 *
 * @example
 * { provide: LeaderboardService, useValue: makeLeaderboardMock() }
 */
export function makeLeaderboardMock(
  overrides: Partial<LeaderboardService> = {}
): Partial<LeaderboardService> {
  return {
    load: () => Promise.resolve(emptyLeaderboard),
    observeSnapshot: () => EMPTY,
    ...overrides,
  };
}
