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

/** One threshold set's track record, as computed by the Cloud Function. */
export interface AdminAutoCountSummary {
  profileId: string;
  mode: 'pose' | 'proximity';
  thresholdKey: string;
  thresholds: Record<string, number>;
  runs: number;
  exactRuns: number;
  /** Share of runs the detector got exactly right, `0..1`. */
  exactRate: number;
  /** Mean signed error (`actual - detected`): positive means undercounting. */
  meanDelta: number;
  meanAbsDelta: number;
}

export interface AdminAutoCountReport {
  id: string;
  exerciseId: string;
  profileId: string;
  mode: 'pose' | 'proximity';
  detectedReps: number;
  actualReps: number;
  thresholds: Record<string, number>;
  userId: string | null;
  createdAt: string | null;
}

export interface AdminAutoCountFeedback {
  summaries: AdminAutoCountSummary[];
  recent: AdminAutoCountReport[];
  totalReports: number;
}

export interface BulkDeleteResult {
  deleted: number;
  skipped: number;
  /** Eligible accounts left for the next run (per-run limit). */
  remaining: number;
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
