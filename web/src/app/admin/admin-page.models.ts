export interface AdminUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  anonymous: boolean;
  pushupCount: number;
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
