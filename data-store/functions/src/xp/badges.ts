import {
  deriveXpAchievements,
  levelForXp,
  type AchievementId,
  type EarnedAchievement,
  type UserXp,
} from '@pu-stats/models';

type XpBadgeInput = Pick<UserXp, 'total' | 'byExercise'>;

/** XP badges the aggregate entitles the user to that are not stored yet. */
export function newXpBadges(
  xp: XpBadgeInput,
  earned: ReadonlyArray<EarnedAchievement>
): AchievementId[] {
  const have = new Set(earned.map((e) => e.id));
  return deriveXpAchievements(xp).filter((id) => !have.has(id));
}

/**
 * Whether a change can unlock a badge at all: only a level-up or XP in a
 * new exercise can. Everything else skips the achievements transaction.
 */
export function xpBadgesMayChange(
  before: XpBadgeInput | null,
  after: XpBadgeInput
): boolean {
  if (!before) return true;
  if (levelForXp(after.total) > levelForXp(before.total)) return true;
  return Object.keys(after.byExercise).some((id) => !(id in before.byExercise));
}
