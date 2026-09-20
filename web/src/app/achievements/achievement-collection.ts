import {
  INVITE_ACHIEVEMENTS,
  PLAN_DAY_ACHIEVEMENTS,
  planCompletedAchievement,
  TRAINING_PLANS,
  type AchievementDefinition,
  type AchievementKind,
  type EarnedAchievement,
} from '@pu-stats/models';

import { achievementLabel } from './achievement-label';

/**
 * The badge collection: every badge in the catalog, earned or not, plus
 * how close the next one is.
 *
 * Locked badges are shown rather than hidden — an empty slot you can see
 * pulls harder than one you cannot. The counters come from
 * `userAchievements/{uid}`, which the trigger already maintains, so
 * nothing here needs a new server write.
 */

export interface AchievementTileView {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
  /** ISO timestamp, or `null` while the badge is still locked. */
  readonly earnedAt: string | null;
  /** Only on the one badge that is next in reach. */
  readonly progress: {
    readonly current: number;
    readonly target: number;
  } | null;
}

export interface AchievementGroupView {
  readonly kind: AchievementKind;
  readonly tiles: ReadonlyArray<AchievementTileView>;
}

export interface AchievementCollectionView {
  readonly groups: ReadonlyArray<AchievementGroupView>;
  readonly earnedCount: number;
  readonly totalCount: number;
  /** The nearest locked badge, or `null` when everything is earned. */
  readonly next: AchievementTileView | null;
}

export interface AchievementCollectionInput {
  readonly earned: ReadonlyArray<EarnedAchievement>;
  readonly planDayTotal: number;
  readonly invitedCount: number;
}

const KIND_ORDER: ReadonlyArray<AchievementKind> = [
  'plan-days',
  'plan-completed',
  'invites',
];

function catalog(): ReadonlyArray<AchievementDefinition> {
  return [
    ...PLAN_DAY_ACHIEVEMENTS,
    ...TRAINING_PLANS.map((plan) => planCompletedAchievement(plan.id)),
    ...INVITE_ACHIEVEMENTS,
  ];
}

/** The counter a locked badge of this kind is waiting on. */
function currentFor(
  kind: AchievementKind,
  input: AchievementCollectionInput
): number | null {
  if (kind === 'plan-days') return input.planDayTotal;
  if (kind === 'invites') return input.invitedCount;
  // A finished plan is not a counter — it is done or it is not.
  return null;
}

export function buildAchievementCollection(
  input: AchievementCollectionInput
): AchievementCollectionView {
  const awardedAt = new Map(input.earned.map((e) => [e.id, e.awardedAt]));

  const tiles = catalog().map((definition) => ({
    definition,
    tile: {
      id: definition.id,
      icon: definition.icon,
      label: achievementLabel(definition),
      earnedAt: awardedAt.get(definition.id) ?? null,
      progress: null,
    } satisfies AchievementTileView,
  }));

  const next = pickNext(tiles, input);

  return {
    groups: KIND_ORDER.map((kind) => ({
      kind,
      tiles: tiles
        .filter((t) => t.definition.kind === kind)
        .map((t) => (t.tile.id === next?.id ? next : t.tile)),
    })).filter((group) => group.tiles.length > 0),
    earnedCount: tiles.filter((t) => t.tile.earnedAt !== null).length,
    totalCount: tiles.length,
    next,
  };
}

/**
 * The locked badge with the smallest gap to its threshold. Plan
 * completions are skipped: "finish this plan" has no distance to show,
 * and a badge with no progress would always sort first at gap zero.
 */
function pickNext(
  tiles: ReadonlyArray<{
    definition: AchievementDefinition;
    tile: AchievementTileView;
  }>,
  input: AchievementCollectionInput
): AchievementTileView | null {
  let best: { gap: number; tile: AchievementTileView } | null = null;

  for (const { definition, tile } of tiles) {
    if (tile.earnedAt !== null) continue;
    const target = definition.threshold;
    const current = currentFor(definition.kind, input);
    if (target === undefined || current === null) continue;

    const gap = target - current;
    if (gap <= 0) continue;
    if (best && gap >= best.gap) continue;
    best = { gap, tile: { ...tile, progress: { current, target } } };
  }

  return best?.tile ?? null;
}
