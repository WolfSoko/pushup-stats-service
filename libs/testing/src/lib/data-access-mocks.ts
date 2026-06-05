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
 *   const mock = makePushupFirestoreMock({ migrateUserData: jest.fn() });
 *   // Vitest:
 *   const mock = makePushupFirestoreMock({ migrateUserData: vitest.fn() });
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
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';

// ---------------------------------------------------------------------------
// PushupFirestoreService mock
// ---------------------------------------------------------------------------

/**
 * Creates a PushupFirestoreService mock.
 *
 * @example
 * { provide: PushupFirestoreService, useValue: makePushupFirestoreMock() }
 */
export function makePushupFirestoreMock(
  overrides: Partial<PushupFirestoreService> = {}
): Partial<PushupFirestoreService> {
  return {
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

/**
 * Creates a StatsApiService mock. The service is now a no-op shell,
 * so this factory simply returns an empty object.
 *
 * @example
 * { provide: StatsApiService, useValue: makeStatsApiMock() }
 */
export function makeStatsApiMock(
  overrides: Partial<StatsApiService> = {}
): Partial<StatsApiService> {
  return {
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// LeaderboardService mock
// ---------------------------------------------------------------------------

const makeEmptyBucket = (): LeaderboardBucket => ({ top: [], current: null });
const makeEmptyLeaderboard = (): LeaderboardData => ({
  daily: makeEmptyBucket(),
  last7: makeEmptyBucket(),
  last30: makeEmptyBucket(),
  allTime: makeEmptyBucket(),
  updatedAt: null,
});

/**
 * Creates a LeaderboardService mock that resolves with empty data by default.
 * Fresh objects per call so a mutation in one test doesn't leak into another.
 *
 * @example
 * { provide: LeaderboardService, useValue: makeLeaderboardMock() }
 */
export function makeLeaderboardMock(
  overrides: Partial<LeaderboardService> = {}
): Partial<LeaderboardService> {
  return {
    load: () => Promise.resolve(makeEmptyLeaderboard()),
    observeSnapshot: () => EMPTY,
    ...overrides,
  };
}
