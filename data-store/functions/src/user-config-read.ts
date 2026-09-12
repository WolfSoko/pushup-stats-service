import { db } from './firebase-app';

/**
 * Other users' configs, read server-side so clients need no access to
 * them. One `getAll` per call — callers batch their uids.
 */
export async function readUserConfigs(
  uids: ReadonlyArray<string>
): Promise<Map<string, FirebaseFirestore.DocumentData | undefined>> {
  const configs = new Map<string, FirebaseFirestore.DocumentData | undefined>();
  const unique = [...new Set(uids)];
  if (unique.length === 0) return configs;
  const col = db.collection('userConfigs');
  const snaps = await db.getAll(...unique.map((uid) => col.doc(uid)));
  for (const snap of snaps) configs.set(snap.id, snap.data());
  return configs;
}

export function displayNameOf(
  config: FirebaseFirestore.DocumentData | undefined
): string | null {
  return String(config?.['displayName'] ?? '').trim() || null;
}

/** Display names by uid; users without one are absent from the map. */
export async function readDisplayNames(
  uids: ReadonlyArray<string>
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const [uid, config] of await readUserConfigs(uids)) {
    const name = displayNameOf(config);
    if (name) names.set(uid, name);
  }
  return names;
}
