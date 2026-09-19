import { onCall } from 'firebase-functions/v2/https';

import {
  type AutoCountReport,
  summarizeAutoCountFeedback,
  toAutoCountReport,
} from './admin/auto-count-feedback';
import { db } from './firebase-app';
import { assertAdmin } from './functions-admin';

/** How many reports the accuracy summary is computed over. */
const SUMMARY_WINDOW = 500;
/** How many individual reports come back for spotting outliers. */
const RECENT_LIMIT = 50;

/**
 * Accuracy of the camera rep counter: how often it matched reality, per
 * detector profile and threshold set. Admin-only — the collection is
 * create-only for clients, so this callable is the only way to read it.
 */
export const adminListAutoCountFeedback = onCall(
  { region: 'europe-west3', timeoutSeconds: 60 },
  async (request) => {
    assertAdmin(request);

    const snap = await db
      .collection('autoCountFeedback')
      .orderBy('createdAt', 'desc')
      .limit(SUMMARY_WINDOW)
      .get();

    const reports: AutoCountReport[] = [];
    for (const doc of snap.docs) {
      const report = toAutoCountReport(doc.id, doc.data());
      if (report) reports.push(report);
    }

    return {
      summaries: summarizeAutoCountFeedback(reports),
      recent: reports.slice(0, RECENT_LIMIT),
      totalReports: reports.length,
    };
  }
);
