import { berlinDateParts } from '../datetime';
import { db } from '../firebase-app';
import { countDistinctDays, previousDay } from './leaderboard';

/**
 * Training days per user in [from, to], counted from the entries: the
 * aggregates keep day counts only for all time. One projection query per
 * user, bounded by the period — a board of friends is a handful of
 * people, and a week of entries is a handful of documents.
 *
 * The query starts a day early because timestamps are stored as written
 * (UTC or with an offset), and the Berlin date decides the day.
 */
export async function readTrainingDays(
  uids: ReadonlyArray<string>,
  from: string,
  to: string
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  await Promise.all(
    uids.map(async (uid) => {
      const snap = await db
        .collection('exerciseEntries')
        .where('userId', '==', uid)
        .where('timestamp', '>=', previousDay(from))
        .select('timestamp')
        .get();
      const days = snap.docs.map(
        (doc) =>
          berlinDateParts(new Date(String(doc.data()['timestamp']))).isoDate
      );
      counts.set(uid, countDistinctDays(days, from, to));
    })
  );
  return counts;
}
