import { AdminUser } from './admin-page.models';

/**
 * Groups the full admin user list into the three buckets the Android-test
 * page renders. Users with no `androidTest` entry (never scanned, or
 * scanned-and-not-a-candidate) appear in none of them.
 */
export function groupByAndroidTestStatus(users: AdminUser[]): {
  candidates: AdminUser[];
  optedIn: AdminUser[];
  notified: AdminUser[];
} {
  const candidates: AdminUser[] = [];
  const optedIn: AdminUser[] = [];
  const notified: AdminUser[] = [];
  for (const user of users) {
    switch (user.androidTest?.status) {
      case 'candidate':
        candidates.push(user);
        break;
      case 'optedIn':
        optedIn.push(user);
        break;
      case 'notified':
        notified.push(user);
        break;
    }
  }
  return { candidates, optedIn, notified };
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
