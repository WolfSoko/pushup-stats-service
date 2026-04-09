/**
 * Admin user management logic
 * Pure validation and data transformation utilities
 */

/**
 * Validates that a request comes from an authenticated admin user
 * by checking the `admin` custom claim on the auth token.
 * Returns an error object if validation fails, or null if the request is authorized.
 */
export function validateAdminAccess(auth?: {
  uid: string;
  token: Record<string, unknown>;
}): { code: 'unauthenticated' | 'permission-denied'; message: string } | null {
  if (!auth?.uid) {
    return { code: 'unauthenticated', message: 'Nicht angemeldet.' };
  }
  if (auth.token.admin !== true) {
    return { code: 'permission-denied', message: 'Kein Admin-Zugriff.' };
  }
  return null;
}

export interface UserAccountInfo {
  uid: string;
  displayName: string | null;
  email: string | null;
  anonymous: boolean;
  pushupCount: number;
  lastEntry: string | null;
  createdAt: unknown;
  role: string | null;
}

export interface AdminListUserRow {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  role?: string;
}

export interface AdminDeletePayload {
  uid?: string;
  anonymize?: boolean;
}

/**
 * Validates delete user payload
 * @param data Payload from admin delete request
 * @returns Validation result with error if invalid
 */
export function validateDeleteUserPayload(data: unknown): {
  valid: boolean;
  uid?: string;
  anonymize?: boolean;
  error?: string;
} {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'payload must be an object' };
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.uid !== 'string' || obj.uid.trim().length === 0) {
    return { valid: false, error: 'uid missing or empty' };
  }
  if (obj.anonymize != null && typeof obj.anonymize !== 'boolean') {
    return { valid: false, error: 'anonymize must be boolean' };
  }
  const uid = obj.uid.trim();
  const anonymize = obj.anonymize ?? true;

  return { valid: true, uid, anonymize };
}

/**
 * Checks if a user ID is the demo user
 * @param uid User ID to check
 * @param demoUserId The demo user ID
 * @returns true if uid is the demo user
 */
export function isDemoUser(uid: string, demoUserId: string): boolean {
  return uid === demoUserId;
}

/**
 * Validates that a feedbackId is present in the payload.
 * Returns { valid: true, feedbackId } on success, or { valid: false, error } on failure.
 */
export function validateFeedbackId(
  data: unknown
): { valid: true; feedbackId: string } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'payload must be an object' };
  }
  const obj = data as Record<string, unknown>;
  if (
    typeof obj.feedbackId !== 'string' ||
    obj.feedbackId.trim().length === 0
  ) {
    return { valid: false, error: 'feedbackId missing or empty' };
  }
  return { valid: true, feedbackId: obj.feedbackId.trim() };
}

/**
 * Validates the payload for the adminMarkFeedbackRead function.
 * Requires feedbackId; read defaults to true if omitted.
 */
export function validateMarkFeedbackReadPayload(
  data: unknown
):
  | { valid: true; feedbackId: string; read: boolean }
  | { valid: false; error: string } {
  const idResult = validateFeedbackId(data);
  if (!idResult.valid) return idResult;

  const obj = data as Record<string, unknown>;
  if (obj.read !== undefined && typeof obj.read !== 'boolean') {
    return { valid: false, error: 'read must be boolean' };
  }
  const read = obj.read !== false;
  return { valid: true, feedbackId: idResult.feedbackId, read };
}

export interface GithubIssueParts {
  title: string;
  body: string;
}

export interface FeedbackForIssue {
  name: string | null;
  email: string | null;
  message: string;
  createdAt: string | null;
  userId: string | null;
}

/**
 * Builds the GitHub issue title and body from a feedback document.
 */
export function buildGithubIssueBody(
  feedback: FeedbackForIssue
): GithubIssueParts {
  const name = feedback.name ?? 'Anonym';
  const email = feedback.email ?? '–';
  const createdAt = feedback.createdAt ?? 'unbekannt';
  const userId = feedback.userId
    ? feedback.userId.slice(0, 8) + '...'
    : 'Anonym';

  const truncatedMessage = feedback.message.slice(0, 80);
  const ellipsis = feedback.message.length > 80 ? '…' : '';
  const title = `Feedback: ${truncatedMessage}${ellipsis}`;

  const body = [
    '## Feedback',
    '',
    `**Von:** ${name} (${email})`,
    `**Datum:** ${createdAt}`,
    `**User:** ${userId}`,
    '',
    '### Nachricht',
    '',
    feedback.message,
  ].join('\n');

  return { title, body };
}

/**
 * Batches array into chunks for processing
 * @param array Array to batch
 * @param size Batch size
 * @returns Array of batches
 */
export function batchArray<T>(array: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError('size must be a positive integer');
  }
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    batches.push(array.slice(i, i + size));
  }
  return batches;
}
