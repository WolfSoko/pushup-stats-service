import type { XpLedgerEntry } from '@pu-stats/models';
import { logger } from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';

import { db, DEMO_USER_ID } from './firebase-app';
import { assertAdmin } from './functions-admin';
import { rebuildUserXp } from './xp/aggregate';
import { awardXpBadges } from './xp/award';
import { type BackfillEntry, planXpBackfill } from './xp/backfill-plan';
import { readXpConfig } from './xp/config-read';
import { rebuildXpLeaderboardCore } from './xp/leaderboard';

/** Users booked per live run; the rest waits for the next run. */
export const XP_BACKFILL_USER_LIMIT = 200;

async function readLedger(): Promise<Map<string, Map<string, XpLedgerEntry>>> {
  const snap = await db.collectionGroup('xpLedger').get();
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
    const writer = db.bulkWriter();
    const nowIso = new Date().toISOString();
    for (const plan of batch) {
      const userRef = db.collection('userXp').doc(plan.userId);
      for (const { id, line } of plan.missing) {
        void writer.set(userRef.collection('xpLedger').doc(id), line);
      }
      void writer.set(userRef, {
        ...rebuildUserXp(plan.userId, plan.lines, nowIso),
        updatedAt: nowIso,
      });
    }
    await writer.close();

    let badges = 0;
    for (const plan of batch) {
      const xp = rebuildUserXp(plan.userId, plan.lines, nowIso);
      badges += (await awardXpBadges(db, plan.userId, xp, { notify: false }))
        .length;
    }
    await rebuildXpLeaderboardCore(db, { includeAllTime: true });

    logger.info('backfillXp', {
      users: batch.length,
      lines: batch.reduce((n, p) => n + p.missing.length, 0),
      badges,
      by: request.auth?.uid,
    });
    return {
      dryRun: false,
      bookedUsers: batch.length,
      bookedLines: batch.reduce((n, p) => n + p.missing.length, 0),
      badges,
      remaining: plans.length - batch.length,
    };
  }
);
