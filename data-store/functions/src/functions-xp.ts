import {
  USER_XP_VERSION,
  type UserXp,
  type XpLedgerEntry,
} from '@pu-stats/models';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import { isPurgedEntryDeletion } from './account-deletion/tombstone';
import { db } from './firebase-app';
import { applyXpChange, rebuildUserXp } from './xp/aggregate';
import { awardXpBadges } from './xp/award';
import { readXpConfig } from './xp/config-read';
import { ledgerLineFor, sameLedgerLine } from './xp/ledger';
import { rebuildXpLeaderboardCore } from './xp/leaderboard';

function ledgerRef(userId: string, entryId: string) {
  return db
    .collection('userXp')
    .doc(userId)
    .collection('xpLedger')
    .doc(entryId);
}

/**
 * Books an entry's XP into `userXp/{uid}/xpLedger/{entryId}`. The ledger
 * — not the entry — is the record of earned XP, so admin re-weighting
 * never rewrites history and no entry write re-fires the other entry
 * triggers.
 */
export const bookXpOnEntryWrite = onDocumentWritten(
  { document: 'exerciseEntries/{entryId}', region: 'europe-west3' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const userId = (after?.['userId'] ?? before?.['userId']) as
      | string
      | undefined;
    const entryId = event.params['entryId'];
    if (!userId || !entryId) return;
    if (await isPurgedEntryDeletion(db, before, after)) return;

    const ref = ledgerRef(userId, entryId);
    const existingSnap = await ref.get();
    const existing = existingSnap.exists
      ? (existingSnap.data() as XpLedgerEntry)
      : null;
    const config = after && !existing ? await readXpConfig(db) : null;
    const next = ledgerLineFor(after, existing, config);

    if (!next) {
      if (existing) await ref.delete();
      return;
    }
    if (sameLedgerLine(existing, next)) return;
    await ref.set(next);
  }
);

/**
 * Folds ledger changes into the `userXp/{uid}` aggregate and awards the
 * level/variety badges it unlocks. Backfill bookings are skipped: the
 * backfill callable rebuilds the aggregate once per user instead of
 * once per historic entry.
 */
export const aggregateXpOnLedgerWrite = onDocumentWritten(
  { document: 'userXp/{userId}/xpLedger/{entryId}', region: 'europe-west3' },
  async (event) => {
    const before = event.data?.before?.data() as XpLedgerEntry | undefined;
    const after = event.data?.after?.data() as XpLedgerEntry | undefined;
    const userId = event.params['userId'];
    if (!userId) return;
    if (!before && after?.source === 'backfill') return;
    if (
      await isPurgedEntryDeletion(
        db,
        before as Record<string, unknown> | undefined,
        after as Record<string, unknown> | undefined
      )
    ) {
      return;
    }

    const aggregateRef = db.collection('userXp').doc(userId);
    const nowIso = new Date().toISOString();
    const xp = await db.runTransaction(async (tx) => {
      const snap = await tx.get(aggregateRef);
      const current = snap.exists ? (snap.data() as UserXp) : null;
      let next: UserXp;
      if (!current || (current.version ?? 0) < USER_XP_VERSION) {
        const ledger = await tx.get(aggregateRef.collection('xpLedger'));
        next = rebuildUserXp(
          userId,
          ledger.docs.map((d) => d.data() as XpLedgerEntry),
          nowIso
        );
      } else {
        next = applyXpChange(current, before ?? null, after ?? null, nowIso);
      }
      tx.set(aggregateRef, { ...next, updatedAt: nowIso });
      return next;
    });

    const awarded = await awardXpBadges(db, userId, xp, { notify: true });
    if (awarded.length > 0) {
      logger.info('aggregateXpOnLedgerWrite: awarded', { userId, awarded });
    }
  }
);

export const refreshXpLeaderboardOnLedgerWrite = onDocumentWritten(
  {
    document: 'userXp/{userId}/xpLedger/{entryId}',
    region: 'europe-west3',
    retry: false,
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before && after?.['source'] === 'backfill') return;
    if (await isPurgedEntryDeletion(db, before, after)) return;
    await rebuildXpLeaderboardCore(db, { includeAllTime: false });
  }
);
