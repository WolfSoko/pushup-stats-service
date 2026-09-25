import {
  parseXpConfig,
  XP_CONFIG_DOC_PATH,
  type XpConfig,
} from '@pu-stats/models';
import type { Firestore } from 'firebase-admin/firestore';

/** Rates change only when an admin edits them; warm instances reuse them briefly. */
export const XP_CONFIG_TTL_MS = 60_000;

let cached: { config: XpConfig | null; readAt: number } | null = null;

export async function readXpConfig(
  db: Firestore,
  nowMs: number = Date.now()
): Promise<XpConfig | null> {
  if (cached && nowMs - cached.readAt < XP_CONFIG_TTL_MS) return cached.config;
  const snap = await db.doc(XP_CONFIG_DOC_PATH).get();
  const config = snap.exists ? parseXpConfig(snap.data()) : null;
  cached = { config, readAt: nowMs };
  return config;
}

export function resetXpConfigCache(): void {
  cached = null;
}
