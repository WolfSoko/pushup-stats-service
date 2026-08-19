import type { UserConfig } from '@pu-stats/models';

/**
 * Derived from the shared model rather than restated, so the status union
 * can't drift from the Cloud Functions state machine that writes it.
 */
export type AdminAndroidTestState = NonNullable<UserConfig['androidTest']>;

export interface AdminUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  anonymous: boolean;
  entryCount: number;
  lastEntry: string | null;
  createdAt: string | null;
  role: string | null;
  /**
   * Optional (not `| null`-required) so existing `AdminUser` fixtures across
   * the admin spec suite don't all need updating — absent means "never
   * entered the Android-test flow", same as a `null` value would.
   */
  androidTest?: AdminAndroidTestState | null;
}

export interface AdminFeedback {
  id: string;
  name: string | null;
  email: string | null;
  message: string;
  userId: string | null;
  createdAt: string | null;
  userAgent: string | null;
  read: boolean;
  githubIssueUrl: string | null;
}

export interface BulkDeleteResult {
  deleted: number;
  skipped: number;
}

export interface AdminActivePlan {
  planId: string;
  startDate: string | null;
}

/** Richer per-user detail for the entries page header (via adminGetUserDetails). */
export interface AdminUserDetails {
  uid: string;
  displayName: string | null;
  email: string | null;
  anonymous: boolean;
  role: string | null;
  createdAt: string | null;
  entryCount: number;
  lastEntry: string | null;
  publicProfile: boolean;
  activePlan: AdminActivePlan | null;
}
