import * as Sentry from '@sentry/node';
import { logger } from 'firebase-functions';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';

// Imported for its init side effects (Sentry + admin.initializeApp) so this
// module is safe to load before any other firebase-app consumer.
import {
  currentPlanDayIndex,
  findExerciseDefinition,
  findPlanById,
  friendshipId,
  isPausedPlan,
  isSectionVisibleTo,
  isValidFriendUid,
  pausedPlanDayIndex,
  sectionVisibility,
  type Friendship,
  type ProfileSection,
  type ProfileViewer,
  type UserTrainingPlan,
} from '@pu-stats/models';

import { berlinDateParts } from './datetime';
import { db } from './firebase-app';
import { periodKeys } from './user-stats-delta';
import { resolvePhotoUrl } from './functions-profile-photo';
import {
  buildPublicProfile,
  isValidUid,
  type UserConfigForPublicProfile,
  type ExerciseTotal,
  type UserAchievementsForPublicProfile,
  type PlanProgress,
  type RecentEntry,
  type UserStatsForPublicProfile,
} from './profile';
// `renderProfileOg` lives behind a dynamic `import()` call inside the
// `ogProfile` handler below — pulling satori + @resvg/resvg-wasm (~15 MB
// + WASM init) eagerly here would slow cold-start for every unrelated
// function in this bundle (leaderboards, motivation, push, …).

// Both `getPublicProfile` (callable) and `ogProfile` (HTTP) need the same
// validation → Firestore reads → projection chain with identical privacy
// semantics. Centralising the lookup here keeps the 404-parity contract
// from drifting between the two wrappers and matches the project's "trigger
// functions in `index.ts` are thin wrappers" rule.

/**
 * Per-exercise totals, biggest first. Capped because a profile is a
 * summary, not a database dump.
 */
async function readExerciseTotals(uid: string): Promise<ExerciseTotal[]> {
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
async function readRecentEntries(uid: string): Promise<RecentEntry[]> {
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
async function readActivePlan(
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

async function fetchPublicProfileProjection(uid: string, viewerUid = '') {
  if (!isValidUid(uid)) return null;
  const [cfgSnap, statsSnap, achievementsSnap] = await Promise.all([
    db.collection('userConfigs').doc(uid).get(),
    // Public pushup stats now live in the per-exercise aggregate
    // (`updateExerciseStatsOnEntryWrite` keeps it fresh); the top-level
    // `userStats/{uid}` doc is frozen for pushups. Same UserStats shape,
    // so `buildPublicProfile` is unchanged.
    db
      .collection('userStats')
      .doc(uid)
      .collection('perExercise')
      .doc('pushup')
      .get(),
    db.collection('userAchievements').doc(uid).get(),
  ]);
  const config = cfgSnap.exists
    ? (cfgSnap.data() as UserConfigForPublicProfile)
    : null;
  const stats = statsSnap.exists
    ? (statsSnap.data() as UserStatsForPublicProfile)
    : null;
  const achievements = achievementsSnap.exists
    ? (achievementsSnap.data() as UserAchievementsForPublicProfile)
    : null;

  const viewerIsOwner = viewerUid !== '' && viewerUid === uid;
  // A confirmed friendship opens the `friends` tier of the owner's
  // visibility settings. One get by deterministic id — no query, and only
  // for signed-in strangers, where it can actually change the answer.
  const viewerIsFriend =
    !viewerIsOwner && viewerUid !== '' && (await areFriends(viewerUid, uid));
  // Only pay for the extra reads once the profile will actually be shown.
  if (
    !buildPublicProfile(uid, config, stats, { viewerIsOwner, viewerIsFriend })
  ) {
    return null;
  }

  const parts = berlinDateParts();
  const keys = periodKeys(parts);
  const viewer: ProfileViewer = viewerIsOwner
    ? 'owner'
    : viewerIsFriend
      ? 'friend'
      : 'public';
  // Skip the extra read entirely when the viewer may not see the section.
  const shows = (section: ProfileSection): boolean =>
    isSectionVisibleTo(sectionVisibility(config?.ui, section), viewer);
  const [photoURL, exercises, recent, plan] = await Promise.all([
    resolvePhotoUrl(uid, config ?? {}, viewerIsOwner),
    readExerciseTotals(uid),
    shows('recent') ? readRecentEntries(uid) : Promise.resolve([]),
    shows('plan') ? readActivePlan(uid, parts.isoDate) : Promise.resolve(null),
  ]);
  return buildPublicProfile(uid, config, stats, {
    achievements,
    photoURL,
    exercises,
    recent,
    plan,
    currentWeeklyKey: keys.weeklyKey,
    currentMonthlyKey: keys.monthlyKey,
    viewerIsOwner,
    viewerIsFriend,
  });
}

/** Whether the two users have an accepted friendship. */
async function areFriends(viewerUid: string, uid: string): Promise<boolean> {
  if (!isValidFriendUid(viewerUid) || !isValidFriendUid(uid)) return false;
  const snap = await db
    .collection('friendships')
    .doc(friendshipId(viewerUid, uid))
    .get();
  return (snap.data() as Friendship | undefined)?.status === 'accepted';
}

// Returns a sanitized projection of `userConfigs/{uid}` + `userStats/{uid}`
// for users who explicitly set `ui.publicProfile = true`. Anyone else returns
// `not-found` so existence of a private user can't be probed by walking UIDs.
//
// This callable runs UNAUTHENTICATED on purpose — it backs the `/u/:uid`
// public route and the dynamic OG image endpoint. Do NOT add side effects
// here; only sanctioned read-only projection.
export const getPublicProfile = onCall(
  { region: 'europe-west3', invoker: 'public' },
  async (request) => {
    const uid = String(request.data?.uid ?? '').trim();
    // `invoker: 'public'` keeps the endpoint callable without auth, but a
    // signed-in caller still ships a verified token — that is the only
    // thing allowed to unlock a private profile, and only its own.
    const projection = await fetchPublicProfileProjection(
      uid,
      request.auth?.uid ?? ''
    );
    if (!projection) {
      // Same response for "malformed UID", "user does not exist", and
      // "user is private" so an attacker can't enumerate accounts.
      throw new HttpsError('not-found', 'Profile not available');
    }
    return projection;
  }
);

// `GET /ogProfile?uid=<uid>&lang=<de|en>` — renders a 1200×630 PNG via
// satori + resvg for the profile's current stats. Returns a 404 with the
// plain-text body `Profile not available` for users who haven't opted in
// (or for malformed UIDs), matching `getPublicProfile`'s privacy guarantee.
//
// Cache headers let Firebase Hosting / the function's own CDN do most of
// the work — full re-render is amortised across hours per user.
export const ogProfile = onRequest(
  {
    region: 'europe-west3',
    invoker: 'public',
    cors: true,
    memory: '512MiB',
    timeoutSeconds: 30,
  },
  async (req, res) => {
    const uidRaw = String(req.query['uid'] ?? '').trim();
    const lang = String(req.query['lang'] ?? 'de').toLowerCase();
    const locale = lang === 'en' ? 'en' : 'de';

    try {
      const projection = await fetchPublicProfileProjection(uidRaw);
      if (!projection) {
        // Same fingerprint as a non-existent UID. Cache the 404 briefly so
        // a hot-linked card from a private user doesn't hammer Firestore.
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
        res.status(404).send('Profile not available');
        return;
      }

      // Lazy-load the renderer so satori + @resvg/resvg-wasm only initialise
      // on the first OG request (and stay cached in module scope across warm
      // invocations) — keeps cold-start of unrelated functions in this
      // bundle unaffected by the heavy renderer deps.
      const { renderProfileOg } = await import('./profile/og-render');
      const png = await renderProfileOg(projection, locale);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', String(png.byteLength));
      // 5 min browser, 1 h CDN, 1 day stale-while-revalidate so a slow
      // delta-aggregation pipeline behind userStats doesn't stall a request.
      res.setHeader(
        'Cache-Control',
        'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
      );
      res.status(200).send(png);
    } catch (err) {
      Sentry.captureException(err);
      logger.error('ogProfile render failed', {
        uid: uidRaw,
        err: err instanceof Error ? err.message : String(err),
      });
      res.status(500).send('OG render failed');
    }
  }
);
