import {
  isValidXpRate,
  XP_CONFIG_DOC_PATH,
  type XpConfig,
} from '@pu-stats/models';
import type { Firestore } from 'firebase-admin/firestore';

/** Keeps only well-formed rates, so a bad admin write cannot poison XP. */
export function parseXpConfig(data: unknown): XpConfig | null {
  const rates = (data as { rates?: unknown } | undefined)?.rates;
  if (!rates || typeof rates !== 'object') return null;
  const clean: Record<string, number> = {};
  for (const [id, rate] of Object.entries(rates as Record<string, unknown>)) {
    if (isValidXpRate(rate)) clean[id] = rate;
  }
  return { rates: clean };
}

export async function readXpConfig(db: Firestore): Promise<XpConfig | null> {
  const snap = await db.doc(XP_CONFIG_DOC_PATH).get();
  return snap.exists ? parseXpConfig(snap.data()) : null;
}
