import { AdminFeedback, AdminUser } from './admin-page.models';

type SortValue = string | number;

// `lastEntry`/`createdAt` are full ISO timestamps, not date-only strings, so
// `new Date(...).getTime()` (not @pu-stats/date's date-only parser) is required.
function timeOf(value: string | null): number {
  return value ? new Date(value).getTime() : 0;
}

export function adminUserSortValue(
  item: AdminUser,
  property: string
): SortValue {
  switch (property) {
    case 'displayName':
      return (item.displayName ?? '').toLowerCase();
    case 'email':
      return (item.email ?? '').toLowerCase();
    case 'anonymous':
      return item.anonymous ? 1 : 0;
    case 'entryCount':
      return item.entryCount;
    case 'lastEntry':
      return timeOf(item.lastEntry);
    case 'createdAt':
      return timeOf(item.createdAt);
    default:
      return '';
  }
}

export function adminFeedbackSortValue(
  item: AdminFeedback,
  property: string
): SortValue {
  switch (property) {
    case 'createdAt':
      return timeOf(item.createdAt);
    case 'name':
      return (item.name ?? '').toLowerCase();
    case 'email':
      return (item.email ?? '').toLowerCase();
    default:
      return '';
  }
}

export function filterAdminUsers(
  users: AdminUser[],
  onlyAnonymous: boolean
): AdminUser[] {
  return onlyAnonymous ? users.filter((u) => u.anonymous) : users;
}

export function toggleSetMember(
  set: ReadonlySet<string>,
  id: string,
  present: boolean
): Set<string> {
  const next = new Set(set);
  if (present) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
}

// A callable whose response never parsed — the request was blocked, the
// backend died before writing CORS headers, or the client is offline — reaches
// us as an Error whose entire message is the bare status code. Rendering that
// verbatim tells an admin nothing, so these are replaced with a sentence that
// still carries the code for a bug report. Anything else is a real message
// (our callables throw German `HttpsError`s) and is shown as-is.
const OPAQUE_CALLABLE_MESSAGES: ReadonlySet<string> = new Set([
  'internal',
  'INTERNAL',
  'unknown',
  'UNKNOWN',
]);

export function errorMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  if (!OPAQUE_CALLABLE_MESSAGES.has(err.message)) return err.message;

  const code = err.message.toLowerCase();
  return $localize`:@@admin.error.callableFailed:Serverfehler (${code}:code:) – die Aktion konnte nicht ausgeführt werden. Details stehen im Server-Log.`;
}
