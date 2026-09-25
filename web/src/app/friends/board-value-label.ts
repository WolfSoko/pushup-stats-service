import { formatXp } from '../core/xp/xp-format';
import type { FriendsBoardMetric } from './friends-api.service';

/** A board value with its unit: days and XP carry one, reps are just the number. */
export function boardValueLabel(
  metric: FriendsBoardMetric,
  value: number,
  locale: string
): string {
  if (metric === 'reps') return String(value);
  if (metric === 'xp') return formatXp(value, locale);
  return value === 1
    ? $localize`:@@friends.board.dayOne:1 Tag`
    : $localize`:@@friends.board.days:${value}:count: Tage`;
}
