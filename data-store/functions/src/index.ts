// Cloud Functions entrypoint. This file is a thin re-export barrel: every
// trigger/callable lives in a domain module under `./functions-*`. Firebase
// deploys by exported symbol name, so the set of names re-exported here is the
// deployed-function contract — adding/renaming/removing one creates or deletes
// a deployed function. Keep this file export-only.
//
// `./firebase-app` MUST be imported first: it owns the side-effectful
// `Sentry.init()` + `admin.initializeApp()` and exports the shared `db`
// handle. Importing it ahead of the trigger modules guarantees init runs
// before any module evaluates `admin.firestore()`.
import './firebase-app';

export {
  adminBulkDeleteInactiveAnonymous,
  adminDeleteUser,
  adminListUsers,
  adminSetLeaderboardExclusion,
  getMigrationStatuses,
  setMigrationStatus,
} from './functions-admin';

export {
  adminCreateGithubIssue,
  adminDeleteFeedback,
  adminListFeedback,
  adminMarkFeedbackRead,
} from './functions-feedback';

export {
  rebuildExerciseLeaderboards,
  refreshExerciseLeaderboardsOnEntryWrite,
} from './functions-leaderboards';

export { getPublicProfile, ogProfile } from './functions-public-profile';

export { generateMotivationQuotes } from './functions-motivation';

export {
  deletePushSubscription,
  dispatchPushReminders,
  revokeAllSessions,
  savePushSubscription,
  snoozeReminder,
  unsubscribeAllPushDevices,
} from './functions-push';

export {
  rebuildUserStats,
  updateExerciseStatsOnEntryWrite,
} from './functions-user-stats';

export {
  backfillPushupPerExerciseStats,
  migratePushupsToExerciseEntries,
  rollbackPushupUnification,
} from './functions-pushup-migration';
