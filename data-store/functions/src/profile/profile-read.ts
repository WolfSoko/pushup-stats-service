import {
  currentPlanDayIndex,
  findExerciseDefinition,
  findPlanById,
  friendshipId,
  isPausedPlan,
  isValidFriendUid,
  pausedPlanDayIndex,
  type Friendship,
  type UserTrainingPlan,
} from '@pu-stats/models';

import { db } from '../firebase-app';
import { profileWorkouts } from '../workouts/logic';
import type {
  ExerciseTotal,
  PlanProgress,
  RecentEntry,
  UserXpForPublicProfile,
} from './public-profile.types';

/** The Firestore reads behind a profile projection, one per section. */

/**
 * Per-exercise totals, biggest first. Capped because a profile is a
 * summary, not a database dump.
 */
export async function readExerciseTotals(
  uid: string
): Promise<ExerciseTotal[]> {
  const snap = await db
    .collection('userStats')
    .doc(uid)
    .collection('perExercise')
    .get();
  const rows: ExerciseTotal[] = [];
  for (const doc of snap.docs) {
    const definition = findExerciseDefinition(doc.id);
    if (!definition) continue;
    const total = Number(doc.data()['total'] ?? 0);
    if (!Number.isFinite(total) || total <= 0) continue;
    rows.push({
      exerciseId: doc.id,
      total,
      totalDays: Number(doc.data()['totalDays'] ?? 0),
      measurement: definition.measurement,
    });
  }
  return rows.sort((a, b) => b.total - a.total).slice(0, MAX_PROFILE_EXERCISES);
}

const MAX_PROFILE_EXERCISES = 8;

const MAX_RECENT_ENTRIES = 10;
/**
 * The workouts behind the numbers, newest first — the same "what did you
 * just train" the owner sees on their dashboard.
 *
 * Only fetched when the viewer may actually see them: it is the one extra
 * query per profile view, and a section set to `friends` would otherwise
 * be paid for by every anonymous visitor.
 */
export async function readRecentEntries(uid: string): Promise<RecentEntry[]> {
  const snap = await db
    .collection('exerciseEntries')
    .where('userId', '==', uid)
    .orderBy('timestamp', 'desc')
    .limit(MAX_RECENT_ENTRIES)
    .get();
  const rows: RecentEntry[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const definition = findExerciseDefinition(String(data['exerciseId'] ?? ''));
    const timestamp = data['timestamp'];
    if (!definition || typeof timestamp !== 'string' || !timestamp) continue;
    // Same fallback order as the stats trigger: a run carries both
    // `distanceM` and `durationSec`, and distance is its primary value.
    const value = Number(
      data['reps'] ?? data['distanceM'] ?? data['durationSec'] ?? 0
    );
    if (!Number.isFinite(value) || value <= 0) continue;
    rows.push({
      exerciseId: definition.id,
      value,
      measurement: definition.measurement,
      timestamp,
    });
  }
  return rows;
}

/**
 * The plan the user is running, as far as a visitor may see it: which
 * plan, how far in, and whether it is on hold. Named by id — the client
 * resolves title and length from its own catalog, in its own language.
 */
export async function readActivePlan(
  uid: string,
  today: string
): Promise<PlanProgress | null> {
  const snap = await db.collection('userTrainingPlans').doc(uid).get();
  const data = snap.data() as UserTrainingPlan | undefined;
  if (!data || (data.status !== 'active' && data.status !== 'paused')) {
    return null;
  }
  const plan = findPlanById(data.planId);
  if (!plan) return null;
  // A paused plan shows the day it was left on, not one the break ran past.
  const dayIndex =
    pausedPlanDayIndex(data, plan.totalDays) ??
    currentPlanDayIndex(plan, data.startDate, today);
  if (dayIndex === null) return null;
  return {
    planId: plan.id,
    dayIndex,
    totalDays: plan.totalDays,
    paused: isPausedPlan(data),
  };
}

/**
 * The workouts the owner put on their profile. Two equality filters, so
 * no composite index; the sort and cap happen in `profileWorkouts`.
 */
export async function readProfileWorkouts(uid: string) {
  const snap = await db
    .collection('workouts')
    .where('ownerId', '==', uid)
    .where('onProfile', '==', true)
    .get();
  return profileWorkouts(
    snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
  );
}
export async function readUserXp(
  uid: string
): Promise<UserXpForPublicProfile | null> {
  const snap = await db.collection('userXp').doc(uid).get();
  return snap.exists ? (snap.data() as UserXpForPublicProfile) : null;
}

/** Whether the two users have an accepted friendship. */
export async function areFriends(
  viewerUid: string,
  uid: string
): Promise<boolean> {
  if (!isValidFriendUid(viewerUid) || !isValidFriendUid(uid)) return false;
  const snap = await db
    .collection('friendships')
    .doc(friendshipId(viewerUid, uid))
    .get();
  return (snap.data() as Friendship | undefined)?.status === 'accepted';
}
