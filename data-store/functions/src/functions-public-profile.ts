import * as Sentry from '@sentry/node';
import { logger } from 'firebase-functions';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';

// Imported for its init side effects (Sentry + admin.initializeApp) so this
// module is safe to load before any other firebase-app consumer.
import {
  isSectionVisibleTo,
  sectionVisibility,
  summaryFromTrainingStats,
  type ProfileSection,
  type ProfileViewer,
} from '@pu-stats/models';

import { berlinDateParts } from './datetime';
import { hasCheered } from './friends/cheers-read';
import { db } from './firebase-app';
import { periodKeys } from './user-stats-delta';
import { resolvePhotoUrl } from './functions-profile-photo';
import {
  areFriends,
  readActivePlan,
  readExerciseTotals,
  readProfileWorkouts,
  readRecentEntries,
  readUserXp,
} from './profile/profile-read';
import { readTrainingStats } from './training/stats-read';
import {
  buildPublicProfile,
  isValidUid,
  type UserConfigForPublicProfile,
  type UserAchievementsForPublicProfile,
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
 * Sections fed by the training aggregate. Skipped when none is visible:
 * for a user without an aggregate yet, the read falls back to every entry.
 */
const TRAINING_SECTIONS: ReadonlyArray<ProfileSection> = [
  'heatmap',
  'total',
  'entries',
  'days',
  'streak',
  'bestSet',
  'bestDay',
];

async function fetchPublicProfileProjection(uid: string, viewerUid = '') {
  if (!isValidUid(uid)) return null;
  const [cfgSnap, achievementsSnap] = await Promise.all([
    db.collection('userConfigs').doc(uid).get(),
    db.collection('userAchievements').doc(uid).get(),
  ]);
  const config = cfgSnap.exists
    ? (cfgSnap.data() as UserConfigForPublicProfile)
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
    !buildPublicProfile(uid, config, null, { viewerIsOwner, viewerIsFriend })
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
  const needsTraining = TRAINING_SECTIONS.some(shows);
  const [
    photoURL,
    exercises,
    recent,
    plan,
    workouts,
    viewerCheeredToday,
    training,
    xp,
  ] = await Promise.all([
    resolvePhotoUrl(uid, config ?? {}, viewerIsOwner),
    readExerciseTotals(uid),
    shows('recent') ? readRecentEntries(uid) : Promise.resolve([]),
    shows('plan') ? readActivePlan(uid, parts.isoDate) : Promise.resolve(null),
    shows('workouts') ? readProfileWorkouts(uid) : Promise.resolve([]),
    viewerIsFriend
      ? hasCheered(viewerUid, uid, parts.isoDate)
      : Promise.resolve(false),
    needsTraining ? readTrainingStats(db, uid) : Promise.resolve(null),
    shows('xp') ? readUserXp(uid) : Promise.resolve(null),
  ]);
  const stats: UserStatsForPublicProfile | null = training
    ? { heatmap: { ...training.heatmap }, updatedAt: training.updatedAt }
    : null;
  return buildPublicProfile(uid, config, stats, {
    summary: training
      ? summaryFromTrainingStats(training, parts.isoDate)
      : null,
    xp,
    achievements,
    photoURL,
    exercises,
    recent,
    plan,
    workouts,
    currentWeeklyKey: keys.weeklyKey,
    currentMonthlyKey: keys.monthlyKey,
    viewerIsOwner,
    viewerIsFriend,
    viewerCheeredToday,
  });
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
