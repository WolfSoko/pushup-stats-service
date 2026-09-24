import {
  deriveXpAchievements,
  type AchievementId,
  type EarnedAchievement,
  type UserXp,
} from '@pu-stats/models';

/** XP badges the aggregate entitles the user to that are not stored yet. */
export function newXpBadges(
  xp: Pick<UserXp, 'level' | 'byExercise'>,
  earned: ReadonlyArray<EarnedAchievement>
): AchievementId[] {
  const have = new Set(earned.map((e) => e.id));
  return deriveXpAchievements(xp).filter((id) => !have.has(id));
}
