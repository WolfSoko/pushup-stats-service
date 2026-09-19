/**
 * Cheers: one friend telling another "keep going", once a day.
 *
 * One document per (sender, recipient, day) at `cheers/{cheerId}`, so a
 * second tap the same day is a document that already exists rather than
 * a second notification. Written only by the `sendCheer` callable.
 */

export interface Cheer {
  from: string;
  to: string;
  /** Berlin calendar day, `YYYY-MM-DD`. */
  day: string;
  createdAt: string;
}

export function cheerId(from: string, to: string, day: string): string {
  return `${from}__${to}__${day}`;
}

export type CheerRejection =
  | 'invalid' // malformed uid
  | 'self' // cheering yourself
  | 'not-friends' // only confirmed friends may cheer each other
  | 'already'; // already cheered them today

export function cheerRejection(args: {
  readonly from: string;
  readonly to: unknown;
  readonly isFriend: boolean;
  readonly alreadyToday: boolean;
}): CheerRejection | null {
  if (typeof args.to !== 'string' || args.to === '') return 'invalid';
  if (args.to === args.from) return 'self';
  if (!args.isFriend) return 'not-friends';
  if (args.alreadyToday) return 'already';
  return null;
}

/**
 * Live trigger for the recipient's fireworks animation: one doc per
 * recipient at `cheerPings/{uid}`, overwritten by every `sendCheer` call
 * (no history — the ledger for that is `cheers/{cheerId}`). Lets a
 * dashboard that's open right now react without polling the ledger.
 */
export interface CheerPing {
  from: string;
  /** ISO timestamp of the cheer that produced this ping. */
  at: string;
}

/**
 * Whether a ping should trigger the live animation: newer than the
 * moment the current tab started watching, so a ping written before this
 * session existed doesn't replay on load — that case is already covered
 * by the push notification.
 */
export function isFreshCheerPing(
  ping: CheerPing | null | undefined,
  sessionStartAtMs: number
): boolean {
  if (!ping) return false;
  const atMs = Date.parse(ping.at);
  return Number.isFinite(atMs) && atMs > sessionStartAtMs;
}
