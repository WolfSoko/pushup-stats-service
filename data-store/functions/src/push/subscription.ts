/**
 * Push subscription management logic
 * Database-agnostic helpers for push subscription handling
 */

import crypto from 'node:crypto';

/**
 * Generates a unique ID for a push subscription based on its endpoint
 * Uses SHA-256 hash for consistent, collision-resistant IDs
 * @param endpoint Push subscription endpoint URL
 * @returns Hexadecimal hash of the endpoint
 */
export function pushSubscriptionId(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex');
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string | null;
  locale?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string | null;
  locale?: string | null;
}

/**
 * Validates push subscription payload structure
 * @param data Subscription data to validate
 * @returns Object with validation result and error message if invalid
 */
export function validateSubscriptionPayload(
  data: unknown
): { valid: boolean; error?: string } {
  const obj = data as Record<string, unknown>;

  if (!obj?.endpoint || typeof obj.endpoint !== 'string') {
    return { valid: false, error: 'endpoint missing or invalid' };
  }

  if (!obj.keys || typeof obj.keys !== 'object') {
    return { valid: false, error: 'keys missing' };
  }

  const keys = obj.keys as Record<string, unknown>;
  if (!keys.p256dh || typeof keys.p256dh !== 'string') {
    return { valid: false, error: 'keys.p256dh missing or invalid' };
  }

  if (!keys.auth || typeof keys.auth !== 'string') {
    return { valid: false, error: 'keys.auth missing or invalid' };
  }

  return { valid: true };
}
