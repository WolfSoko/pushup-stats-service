/**
 * Recaptcha validation logic
 * Pure logic and response parsing (Firebase client injected at call time)
 */

export interface RecaptchaTokenProperties {
  valid?: boolean | null;
  invalidReason?: unknown;
  action?: string | null;
}

export interface RecaptchaRiskAnalysis {
  score?: number | null;
  reasons?: unknown;
}

export interface RecaptchaResponse {
  tokenProperties?: RecaptchaTokenProperties | null;
  riskAnalysis?: RecaptchaRiskAnalysis | null;
}

export interface AssessmentResult {
  ok: boolean;
  score: number;
  reasons: string[];
  actionMatched: boolean;
  action: string | null;
  reason?: string;
}

export interface InvalidAssessmentResult {
  ok: false;
  score: 0;
  reason: string;
  reasons: string[];
  actionMatched: false;
  action: string | null;
}

/**
 * Parses Recaptcha assessment response and validates against minimum score and expected action
 * @param response Raw Recaptcha response
 * @param recaptchaAction Expected action from token
 * @param minScore Minimum acceptable score (0-1)
 * @returns Assessment result with ok flag, score, and details
 */
export function parseRecaptchaResponse(
  response: RecaptchaResponse,
  recaptchaAction: string,
  minScore: number
): AssessmentResult | InvalidAssessmentResult {
  // Token is invalid
  if (!response.tokenProperties?.valid) {
    return {
      ok: false,
      score: 0,
      reason: `invalid-token:${response.tokenProperties?.invalidReason || 'unknown'}`,
      reasons: [],
      actionMatched: false,
      action: response.tokenProperties?.action || null,
    };
  }

  const actionMatched = response.tokenProperties?.action === recaptchaAction;
  const score = Number(response.riskAnalysis?.score || 0);
  const reasons = (
    Array.isArray(response.riskAnalysis?.reasons)
      ? response.riskAnalysis.reasons
      : []
  ).map(String);

  return {
    ok: actionMatched && score >= minScore,
    score,
    reasons,
    actionMatched,
    action: response.tokenProperties?.action || null,
  };
}

/**
 * Validates Recaptcha token payload
 * @param token Token value to validate
 * @param action Expected action for the token
 * @returns Object with validation result and error if invalid
 */
export function validateRecaptchaPayload(
  token: unknown,
  action: unknown
): { valid: boolean; error?: string } {
  if (typeof token !== 'string' || !token.trim()) {
    return { valid: false, error: 'token missing or invalid' };
  }

  if (typeof action !== 'string' || !action.trim()) {
    return { valid: false, error: 'action missing or invalid' };
  }

  return { valid: true };
}

/**
 * Validates that the caller is allowed to revoke their own sessions.
 *
 * Anonymous (guest) sessions are rejected because:
 *   1. There's no recoverable identity for the user to log back in with.
 *   2. Their refresh token is the *only* way back into their data — revoking
 *      it permanently orphans their pushup history.
 *
 * @returns Error code/message if the request is invalid, otherwise null.
 */
export function validateRevokeSessionsRequest(
  auth: { uid: string; token: Record<string, unknown> } | undefined
): {
  code: 'unauthenticated' | 'failed-precondition';
  message: string;
} | null {
  if (!auth?.uid) {
    return { code: 'unauthenticated', message: 'Nicht angemeldet.' };
  }
  const firebaseClaim = auth.token['firebase'] as
    | { sign_in_provider?: unknown }
    | undefined;
  if (firebaseClaim?.sign_in_provider === 'anonymous') {
    return {
      code: 'failed-precondition',
      message: 'Gast-Sitzungen können nicht abgemeldet werden.',
    };
  }
  return null;
}
