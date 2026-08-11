import { AdminUser } from './admin-page.models';

/**
 * Groups the full admin user list into the three buckets the Android-test
 * page renders. Users with no `androidTest` entry (never scanned, or
 * scanned-and-not-a-candidate) appear in none of them.
 */
export function groupByAndroidTestStatus(users: AdminUser[]): {
  candidates: AdminUser[];
  confirmed: AdminUser[];
  optedIn: AdminUser[];
  notified: AdminUser[];
} {
  const candidates: AdminUser[] = [];
  const confirmed: AdminUser[] = [];
  const optedIn: AdminUser[] = [];
  const notified: AdminUser[] = [];
  for (const user of users) {
    switch (user.androidTest?.status) {
      case 'candidate':
        candidates.push(user);
        break;
      case 'confirmed':
        confirmed.push(user);
        break;
      case 'optedIn':
        optedIn.push(user);
        break;
      case 'notified':
        notified.push(user);
        break;
    }
  }
  return { candidates, confirmed, optedIn, notified };
}

/**
 * Statuses that mean the user is already somewhere in the flow, so offering
 * to add them again would be meaningless. `declined` is deliberately absent:
 * re-adding someone who was declined by mistake is a normal correction.
 */
const IN_FLOW: ReadonlySet<string> = new Set([
  'candidate',
  'confirmed',
  'optedIn',
  'notified',
]);

/** Max rows offered at once — this is a picker, not a user listing. */
export const MANUAL_ADD_MAX_MATCHES = 10;

/**
 * Search-driven picker for adding a tester by hand, bypassing the activity
 * heuristic. Mirrors the backend eligibility rule (`canBeAndroidTester`):
 * anonymous accounts and accounts without an email can never be added to the
 * Play Console tester list, so they are never offered.
 *
 * Returns nothing for an empty search term — the full user list would be
 * useless to scroll and expensive to render.
 */
export function manualAddMatches(
  users: AdminUser[],
  search: string
): AdminUser[] {
  const term = search.trim().toLowerCase();
  if (!term) return [];
  return users
    .filter((user) => {
      if (user.anonymous || !user.email) return false;
      const status = user.androidTest?.status;
      if (status && IN_FLOW.has(status)) return false;
      return (
        user.email.toLowerCase().includes(term) ||
        (user.displayName ?? '').toLowerCase().includes(term)
      );
    })
    .slice(0, MANUAL_ADD_MAX_MATCHES);
}

/**
 * Newline-joined list of emails for the admin to paste into the Play
 * Console closed-test tester email list. Users without an email (anonymous
 * accounts that somehow opted in) are skipped — there's nothing to paste.
 */
export function androidTestEmailsForClipboard(users: AdminUser[]): string {
  return users
    .map((u) => u.email)
    .filter((email): email is string => !!email)
    .join('\n');
}
