import type { XpLedgerEntry } from '@pu-stats/models';
import { logger } from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';

import { db, DEMO_USER_ID } from './firebase-app';
import { assertAdmin } from './functions-admin';
import { awardXpBadges } from './xp/award';
import { type BackfillEntry, planXpBackfill } from './xp/backfill-plan';
import { readXpConfig } from './xp/config-read';
import { rebuildXpLeaderboardCore } from './xp/leaderboard';
import { inChunks, rebuildUserAggregate } from './xp/rebuild';

/** Users booked per live run; the rest waits for the next run. */
export const XP_BACKFILL_USER_LIMIT = 200;

const BACKFILL_CONCURRENCY = 20;

/** gRPC status of a `create` on an existing document. */
const ALREADY_EXISTS = 6;

async function readLedger(): Promise<Map<string, Map<string, XpLedgerEntry>>> {
  const snap = await db
    .collectionGroup('xpLedger')
    .select('userId', 'exerciseId', 'timestamp', 'rate', 'xp')
    .get();
  const ledger = new Map<string, Map<string, XpLedgerEntry>>();
  for (const doc of snap.docs) {
    const userId = doc.ref.parent.parent?.id;
    if (!userId) continue;
    const lines = ledger.get(userId) ?? new Map<string, XpLedgerEntry>();
    lines.set(doc.id, doc.data() as XpLedgerEntry);
    ledger.set(userId, lines);
  }
  return ledger;
}

// Books XP for every entry saved before the points system existed, at
// today's rates. Uniform `{ dryRun }` migration contract; idempotent, so
// the admin repeats it until `remaining` is 0.
export const backfillXp = onCall(
  { region: 'europe-west3', timeoutSeconds: 540, memory: '1GiB' },
  async (request) => {
    assertAdmin(request);
    const dryRun = request.data?.dryRun !== false;

    const [entriesSnap, ledger, aggregates, config] = await Promise.all([
      db
        .collection('exerciseEntries')
        .select(
          'userId',
          'exerciseId',
          'timestamp',
          'reps',
          'durationSec',
          'distanceM'
        )
        .get(),
      readLedger(),
      db.collection('userXp').select().get(),
      readXpConfig(db),
    ]);
    const entries: BackfillEntry[] = entriesSnap.docs.map((d) => ({
      id: d.id,
      data: d.data(),
    }));
    const plans = planXpBackfill(
      entries,
      ledger,
      new Set(aggregates.docs.map((d) => d.id)),
      config,
      new Set([DEMO_USER_ID])
    );
    const missingLines = plans.reduce((n, p) => n + p.missing.length, 0);

    if (dryRun) {
      return {
        dryRun: true,
        entries: entries.length,
        pendingUsers: plans.length,
        missingLines,
      };
    }

    const batch = plans.slice(0, XP_BACKFILL_USER_LIMIT);
    const bookedLines = batch.reduce((n, p) => n + p.missing.length, 0);
    const writer = db.bulkWriter();
    // A live trigger may book a line while the backfill runs; its line wins.
    writer.onWriteError(
      (err) => err.code !== ALREADY_EXISTS && err.failedAttempts < 3
    );
    for (const plan of batch) {
      const ledgerRef = db
        .collection('userXp')
        .doc(plan.userId)
        .collection('xpLedger');
      for (const { id, line } of plan.missing) {
        writer.create(ledgerRef.doc(id), line).catch(() => undefined);
      }
    }
    await writer.close();

    const nowIso = new Date().toISOString();
    const awarded = await inChunks(
      batch,
      BACKFILL_CONCURRENCY,
      async (plan) => {
        const xp = await rebuildUserAggregate(db, plan.userId, nowIso);
        return (await awardXpBadges(db, plan.userId, xp, { notify: false }))
          .length;
      }
    );
    const badges = awarded.reduce((n, count) => n + count, 0);
    await rebuildXpLeaderboardCore(db, { includeAllTime: true });

    logger.info('backfillXp', {
      users: batch.length,
      lines: bookedLines,
      badges,
      by: request.auth?.uid,
    });
    return {
      dryRun: false,
      bookedUsers: batch.length,
      bookedLines,
      badges,
      remaining: plans.length - batch.length,
    };
  }
);
