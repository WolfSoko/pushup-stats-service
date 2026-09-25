import {
  USER_XP_VERSION,
  type UserXp,
  type XpLedgerEntry,
} from '@pu-stats/models';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import { isPurgedEntryDeletion } from './account-deletion/tombstone';
import { db } from './firebase-app';
import { applyXpChange, rebuildUserXp, rememberEvent } from './xp/aggregate';
import { awardXpBadges } from './xp/award';
import { xpBadgesMayChange } from './xp/badges';
import { readXpConfig } from './xp/config-read';
import { isBackfillCreation, ledgerLineFor, sameLedgerLine } from './xp/ledger';
import { rebuildXpLeaderboardCore } from './xp/leaderboard';

/**
 * Books an entry's XP into `userXp/{uid}/xpLedger/{entryId}`. The ledger
 * — not the entry — is the record of earned XP, so admin re-weighting
 * never rewrites history and no entry write re-fires the other entry
 * triggers.
 *
 * The line is built from the entry as it is *now*, read inside the
 * transaction, not from the event: Firestore does not order trigger
 * deliveries, and a late create event must not overwrite a newer edit.
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

    const entryRef = db.collection('exerciseEntries').doc(entryId);
    const ref = db
      .collection('userXp')
      .doc(userId)
      .collection('xpLedger')
      .doc(entryId);
    const config = await readXpConfig(db);

    await db.runTransaction(async (tx) => {
      const [entrySnap, lineSnap] = await Promise.all([
        tx.get(entryRef),
        tx.get(ref),
      ]);
      const existing = lineSnap.exists
        ? (lineSnap.data() as XpLedgerEntry)
        : null;
      const next = ledgerLineFor(entrySnap.data(), existing, config);
      if (!next) {
        if (existing) tx.delete(ref);
        return;
      }
      if (!sameLedgerLine(existing, next)) tx.set(ref, next);
    });
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
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const userId = event.params['userId'];
    if (!userId) return;
    if (isBackfillCreation(before, after)) return;
    if (await isPurgedEntryDeletion(db, before, after)) return;

    const aggregateRef = db.collection('userXp').doc(userId);
    const nowIso = new Date().toISOString();
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(aggregateRef);
      const current = snap.exists ? (snap.data() as UserXp) : null;
      if (current?.recentEventIds?.includes(event.id)) return null;
      let next: UserXp;
      let previous: UserXp | null = current;
      if (!current || (current.version ?? 0) < USER_XP_VERSION) {
        const ledger = await tx.get(aggregateRef.collection('xpLedger'));
        next = rebuildUserXp(
          userId,
          ledger.docs.map((d) => d.data() as XpLedgerEntry),
          nowIso
        );
        previous = null;
      } else {
        next = applyXpChange(
          current,
          (before as XpLedgerEntry | undefined) ?? null,
          (after as XpLedgerEntry | undefined) ?? null,
          nowIso
        );
      }
      tx.set(aggregateRef, {
        ...next,
        recentEventIds: rememberEvent(current?.recentEventIds, event.id),
        updatedAt: nowIso,
      });
      return { previous, next };
    });

    if (!result || !xpBadgesMayChange(result.previous, result.next)) return;
    const awarded = await awardXpBadges(db, userId, result.next, {
      notify: true,
    });
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
    if (isBackfillCreation(before, after)) return;
    if (await isPurgedEntryDeletion(db, before, after)) return;
    await rebuildXpLeaderboardCore(db, { includeAllTime: false });
  }
);
