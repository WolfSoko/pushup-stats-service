import type { FriendsBoardMetric } from './friends-api.service';

/** A board value with its unit: days carry one, reps are just the number. */
export function boardValueLabel(
  metric: FriendsBoardMetric,
  value: number
): string {
  if (metric === 'reps') return String(value);
  return value === 1
    ? $localize`:@@friends.board.dayOne:1 Tag`
    : $localize`:@@friends.board.days:${value}:count: Tage`;
}
