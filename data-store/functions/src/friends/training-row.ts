import { summaryFromTrainingStats, type TrainingStats } from '@pu-stats/models';

import {
  countDistinctDays,
  periodStartIso,
  type FriendStatsRow,
  type FriendsLeaderboardPeriod,
} from './leaderboard';

/**
 * Maps the training aggregate onto the shape the `days` and `streak`
 * metrics rank: the same numbers the owner's profile shows, across every
 * exercise. Week and month count days straight from the aggregate's day
 * map, so no entry query is needed.
 */
export function trainingRowOf(
  stats: TrainingStats,
  period: FriendsLeaderboardPeriod,
  todayIso: string
): Pick<FriendStatsRow, 'stats' | 'days'> {
  const dayKeys = Object.keys(stats.days).sort();
  const summary = summaryFromTrainingStats(stats, todayIso);
  return {
    stats: {
      totalDays: summary.days,
      currentStreak: summary.currentStreak,
      lastEntryDate: dayKeys.at(-1),
      dailyReps: stats.days[todayIso]?.entries ?? 0,
      dailyKey: todayIso,
    },
    days:
      period === 'week' || period === 'month'
        ? countDistinctDays(dayKeys, periodStartIso(period, todayIso), todayIso)
        : undefined,
  };
}
