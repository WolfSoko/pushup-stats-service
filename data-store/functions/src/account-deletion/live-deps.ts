import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

import { db } from '../firebase-app';
import { PHOTO_BUCKET } from '../profile/photo-storage';
import type { DeleteAccountDeps } from './delete-account';

export function liveDeleteAccountDeps(): DeleteAccountDeps {
  return {
    db,
    photoBucket: getStorage().bucket(PHOTO_BUCKET),
    auth: getAuth(),
    nowMs: Date.now(),
  };
}
