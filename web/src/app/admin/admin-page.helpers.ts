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

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
