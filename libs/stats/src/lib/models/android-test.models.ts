/**
 * Thresholds for the Android closed-test candidate scan.
 *
 * Shared because both sides need them: the Cloud Function applies them
 * (`isAndroidTestCandidate`) and the admin UI seeds its input fields with the
 * same defaults. Neither may import the other, so the values live here.
 */

export interface AndroidTestThresholds {
  /** Minimum total `exerciseEntries` a user must have logged. */
  minEntries: number;
  /** A candidate must have logged something within this many days. */
  activeWithinDays: number;
}

/**
 * Starting point for the scan form, deliberately rough — the admin tunes
 * them per run and confirms every candidate by hand anyway.
 */
export const DEFAULT_ANDROID_TEST_THRESHOLDS: AndroidTestThresholds = {
  minEntries: 15,
  activeWithinDays: 30,
};

/**
 * Upper bounds for the admin-supplied values. Not a policy — just a sanity
 * range so a typo can't turn the scan into a full-history scan or an
 * everybody-qualifies pass.
 */
export const ANDROID_TEST_THRESHOLD_LIMITS = {
  minEntries: { min: 1, max: 10_000 },
  activeWithinDays: { min: 1, max: 3650 },
} as const;
