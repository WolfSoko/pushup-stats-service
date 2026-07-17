export interface AdminUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  anonymous: boolean;
  entryCount: number;
  lastEntry: string | null;
  createdAt: string | null;
  role: string | null;
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
