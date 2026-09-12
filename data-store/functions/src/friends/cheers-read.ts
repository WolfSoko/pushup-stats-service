import { db } from '../firebase-app';
import type { CheersToday } from './leaderboard';

/**
 * Today's cheers among a group: how many each received, and whom the
 * viewer already cheered. Firestore-side, so it stays out of the
 * `./friends` barrel that the pure modules and their tests share.
 */
export async function readCheersToday(
  viewerUid: string,
  uids: ReadonlyArray<string>,
  day: string
): Promise<CheersToday> {
  const received = new Map<string, number>();
  const cheeredByViewer = new Set<string>();
  const col = db.collection('cheers');
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));
  const [byViewer, ...toGroup] = await Promise.all([
    col.where('from', '==', viewerUid).where('day', '==', day).get(),
    ...chunks.map((chunk) =>
      col.where('day', '==', day).where('to', 'in', chunk).get()
    ),
  ]);
  for (const snap of byViewer.docs) {
    cheeredByViewer.add(String(snap.data()['to']));
  }
  for (const result of toGroup) {
    for (const snap of result.docs) {
      const to = String(snap.data()['to']);
      received.set(to, (received.get(to) ?? 0) + 1);
    }
  }
  return { received, cheeredByViewer };
}
