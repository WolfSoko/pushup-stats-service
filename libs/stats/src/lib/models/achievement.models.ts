/**
 * Achievements a user can earn by working through training plans.
 *
 * Awarding is deliberately **server-side only**: `deriveAchievements`
 * runs inside a Firestore trigger and the resulting documents live under
 * an Admin-SDK-only path (`allow write: if false`). Achievements surface
 * on the public profile, so a client-writable badge would be trivially
 * forgeable. This mirrors how `currentStreak` is derived — the user
 * controls the raw input, the server owns every value derived from it.
 *
 * The catalog is pure data and the derivation is a pure function, so
 * both are unit-testable without Firebase.
 */

/** Stable id of an earned achievement. Never rename — it is the doc id. */
export type AchievementId = string;

export type AchievementKind = 'plan-days' | 'plan-completed';

export interface AchievementDefinition {
  readonly id: AchievementId;
  readonly kind: AchievementKind;
  /** Material icon name rendered on the badge. */
  readonly icon: string;
  /**
   * For `plan-days`: how many completed plan days unlock it.
   * For `plan-completed`: unset — the badge is tied to `planId`.
   */
  readonly threshold?: number;
  /** For `plan-completed`: which catalog plan it belongs to. */
  readonly planId?: string;
}

export interface EarnedAchievement {
  readonly id: AchievementId;
  /** ISO timestamp the server stamped when the badge was first awarded. */
  readonly awardedAt: string;
}

/**
 * Cumulative plan-day milestones. Deliberately sparse: a badge for every
 * single day would turn the profile into a wall of noise and make none of
 * them worth sharing.
 */
export const PLAN_DAY_MILESTONES: ReadonlyArray<number> = [1, 10, 25, 50, 100];

export const PLAN_DAY_ACHIEVEMENTS: ReadonlyArray<AchievementDefinition> =
  PLAN_DAY_MILESTONES.map((threshold) => ({
    id: `plan-days-${threshold}`,
    kind: 'plan-days' as const,
    icon: threshold >= 50 ? 'military_tech' : 'workspace_premium',
    threshold,
  }));

/** Badge id for finishing a specific catalog plan. */
export function planCompletedAchievementId(planId: string): AchievementId {
  return `plan-completed-${planId}`;
}

export function planCompletedAchievement(
  planId: string
): AchievementDefinition {
  return {
    id: planCompletedAchievementId(planId),
    kind: 'plan-completed',
    icon: 'emoji_events',
    planId,
  };
}

export interface AchievementInput {
  /**
   * Total plan days the user has completed. Cumulative across plans, so
   * switching plans does not reset progress toward a milestone.
   */
  readonly completedPlanDays: number;
  /** Catalog ids of plans the user has finished. */
  readonly completedPlanIds: ReadonlyArray<string>;
}

/**
 * The full set of achievement ids a user qualifies for, given their
 * progress. Pure and order-stable.
 *
 * Returns the *entitlement*, not a delta: the caller diffs it against
 * what is already stored and writes only the additions. Achievements are
 * never revoked — un-marking a plan day must not silently take a badge
 * away, and re-deriving from scratch on every write would do exactly
 * that.
 */
export function deriveAchievements(
  input: AchievementInput
): ReadonlyArray<AchievementId> {
  const ids: AchievementId[] = [];
  for (const milestone of PLAN_DAY_MILESTONES) {
    if (input.completedPlanDays >= milestone) {
      ids.push(`plan-days-${milestone}`);
    }
  }
  for (const planId of [...input.completedPlanIds].sort()) {
    ids.push(planCompletedAchievementId(planId));
  }
  return ids;
}

/**
 * Resolves a stored id back to its definition. Unknown ids yield `null`
 * rather than throwing: a badge earned under an older catalog must not
 * break the profile page after the catalog changes.
 */
export function findAchievementDefinition(
  id: AchievementId
): AchievementDefinition | null {
  const milestone = PLAN_DAY_ACHIEVEMENTS.find((a) => a.id === id);
  if (milestone) return milestone;
  const planMatch = /^plan-completed-(.+)$/.exec(id);
  return planMatch ? planCompletedAchievement(planMatch[1]) : null;
}
