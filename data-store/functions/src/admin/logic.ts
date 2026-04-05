/**
 * Admin user management logic
 * Pure validation and data transformation utilities
 */

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
export function validateDeleteUserPayload(
  data: unknown
): { valid: boolean; uid?: string; anonymize?: boolean; error?: string } {
  const obj = data as Record<string, unknown>;
  const uid = String(obj?.uid || '').trim();
  const anonymize = Boolean(obj?.anonymize ?? true);

  if (!uid) {
    return { valid: false, error: 'uid missing or empty' };
  }

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
 * Batches array into chunks for processing
 * @param array Array to batch
 * @param size Batch size
 * @returns Array of batches
 */
export function batchArray<T>(array: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    batches.push(array.slice(i, i + size));
  }
  return batches;
}
