// Cloud Functions entrypoint. This file is a thin re-export barrel: every
// trigger/callable lives in a domain module under `./functions-*`. Firebase
// deploys by exported symbol name, so the set of names re-exported here is the
// deployed-function contract — adding/renaming/removing one creates or deletes
// a deployed function. Keep this file export-only.
//
// `./firebase-app` MUST be imported first: it owns the side-effectful
// `Sentry.init()` + `initializeApp()` and exports the shared `db`
// handle. Importing it ahead of the trigger modules guarantees init runs
// before any module evaluates `getFirestore()`.
import './firebase-app';

export {
  cleanupOrphanedUserData,
  deleteOwnAccount,
} from './functions-account-deletion';

export {
  adminBulkDeleteInactiveAnonymous,
  adminDeleteUser,
  adminListUsers,
  adminSetLeaderboardExclusion,
} from './functions-admin';

export {
  adminComputeAndroidTestCandidates,
  adminConfirmAndroidTestCandidate,
  adminMarkAndroidTesterAdded,
  optInAndroidTest,
} from './functions-android-test';

export {
  backfillAdminUserActivity,
  updateAdminUserActivityOnEntryWrite,
} from './functions-admin-user-activity';

export {
  adminDeleteUserEntries,
  adminListUserEntries,
  adminUpdateUserEntry,
} from './functions-admin-user-entries';
export { adminGetUserDetails } from './functions-admin-user-details';
export { adminFriendshipGraph } from './functions-admin-network';

export {
  getMigrationStatuses,
  setMigrationStatus,
} from './functions-migration-status';

export {
  adminCreateGithubIssue,
  adminDeleteFeedback,
  adminListFeedback,
  adminMarkFeedbackRead,
} from './functions-feedback';

export { adminListAutoCountFeedback } from './functions-auto-count-feedback';

export {
  rebuildExerciseLeaderboards,
  refreshExerciseLeaderboardsOnEntryWrite,
} from './functions-leaderboards';

export { getPublicProfile, ogProfile } from './functions-public-profile';

export { profilePhoto } from './functions-profile-photo';

export { generateMotivationQuotes } from './functions-motivation';

export {
  deletePushSubscription,
  dispatchPushReminders,
  revokeAllSessions,
  savePushSubscription,
  unsubscribeAllPushDevices,
} from './functions-push';

export { reminderAction } from './functions-reminder-action';

export { getFriendsLeaderboard } from './functions-friends-leaderboard';
export {
  listFriends,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from './functions-friends';
export {
  claimFriendInvite,
  createFriendInvite,
} from './functions-friend-invite';
export { notifyFriendshipWrite } from './functions-friends-notify';
export { sendCheer } from './functions-cheers';
export { shareWorkout } from './functions-workouts';
export { dispatchWorkoutReminders } from './functions-workout-reminders';
export {
  createChallenge,
  leaveChallenge,
  listChallenges,
  respondChallenge,
} from './functions-challenges';
export { claimReferral } from './functions-referral';
export { updateExerciseStatsOnEntryWrite } from './functions-user-stats';
export { updateTrainingStatsOnEntryWrite } from './functions-training-stats';
export { backfillTrainingStats } from './functions-training-backfill';

export { awardAchievementsOnPlanWrite } from './functions-achievements';
export { notifyGoalReachedOnStatsWrite } from './functions-goal-reached';

export { archiveDeletedExerciseEntry } from './functions-entry-trash';

export {
  aggregateXpOnLedgerWrite,
  bookXpOnEntryWrite,
  refreshXpLeaderboardOnLedgerWrite,
} from './functions-xp';
export { backfillXp } from './functions-xp-backfill';
