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
