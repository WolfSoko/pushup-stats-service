import type { InboxRow } from '../notifications/inbox-rows';

/**
 * What the dashboard's motivational line shows.
 *
 * The slot already existed for the generated daily quote. A cheer from a
 * real person beats any generated line, so it takes precedence — and
 * that gives an anfeuerung a second, quieter stage next to the fireworks
 * overlay: someone who was offline when it arrived reads it here on
 * their next visit, which the live ping deliberately does not replay.
 */
export interface MotivationSlot {
  readonly icon: string;
  readonly text: string;
  /** Distinguishes a personal message from the generated quote. */
  readonly personal: boolean;
}

/** How recent a cheer has to be to still be worth surfacing. */
export const MOTIVATION_SLOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function pickMotivationSlot(
  rows: ReadonlyArray<InboxRow>,
  todayQuote: string | null,
  nowMs: number
): MotivationSlot | null {
  const cheer = rows.find(
    (row) =>
      row.category === 'motivation' &&
      row.unread &&
      isRecent(row.createdAt, nowMs)
  );
  if (cheer) {
    return { icon: cheer.icon, text: cheer.text, personal: true };
  }
  if (todayQuote) {
    return { icon: 'auto_awesome', text: todayQuote, personal: false };
  }
  return null;
}

function isRecent(iso: string | null, nowMs: number): boolean {
  if (!iso) return false;
  const at = Date.parse(iso);
  return (
    Number.isFinite(at) &&
    at <= nowMs &&
    nowMs - at <= MOTIVATION_SLOT_MAX_AGE_MS
  );
}
