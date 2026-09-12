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
