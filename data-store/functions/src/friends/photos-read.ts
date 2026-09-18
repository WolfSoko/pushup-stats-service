import { getAuth } from 'firebase-admin/auth';
import { logger } from 'firebase-functions';

import { friendPhotoUrls } from './photos';
import type { UserConfigForPublicProfile } from '../profile';

/**
 * Firestore/Auth side of friend avatars. Not in the `./friends` barrel,
 * so the pure modules and their tests stay free of the Admin SDK — the
 * rule that decides which picture a friend sees is in `photos.ts`.
 */
export async function readFriendPhotoUrls(
  configs: ReadonlyMap<string, FirebaseFirestore.DocumentData | undefined>
): Promise<Map<string, string>> {
  const { urls, failed } = await friendPhotoUrls(
    new Map(
      [...configs].map(([uid, data]) => [
        uid,
        data as UserConfigForPublicProfile | undefined,
      ])
    ),
    async (uids) => {
      const { users } = await getAuth().getUsers(uids.map((uid) => ({ uid })));
      return users;
    }
  );
  if (failed > 0) {
    logger.error('readFriendPhotoUrls: lookup failed', { batches: failed });
  }
  return urls;
}
