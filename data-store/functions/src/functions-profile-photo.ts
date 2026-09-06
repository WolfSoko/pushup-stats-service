import { onRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

import { db } from './firebase-app';
import {
  isPublicProfileAllowed,
  isValidUid,
  photoSource,
  type UserConfigForPublicProfile,
} from './profile';

const PHOTO_BUCKET = 'pushup-stats-profile-photos';
const PHOTO_PREFIX = 'profile-photos';

function photoObjectPath(uid: string): string {
  return `${PHOTO_PREFIX}/${uid}/avatar`;
}

/** Owner preview of a private photo is inlined; cap keeps the payload sane. */
const MAX_INLINE_PHOTO_BYTES = 512 * 1024;

async function inlinePhoto(uid: string): Promise<string | null> {
  try {
    const file = getStorage().bucket(PHOTO_BUCKET).file(photoObjectPath(uid));
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size ?? 0) > MAX_INLINE_PHOTO_BYTES) return null;
    const [buffer] = await file.download();
    const type = metadata.contentType ?? 'image/jpeg';
    return `data:${type};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Photo shown on the profile.
 *
 * An uploaded photo wins and is served through `profilePhoto` rather than
 * from a public bucket — the bucket stays private so a photo is never
 * more visible than the profile it belongs to. `photoUpdatedAt` doubles
 * as the cache-buster, so a new upload is not masked by the CDN.
 *
 * While the profile is private that endpoint has to answer 404 to
 * everyone, the owner included: it is reached by an `<img>`, which cannot
 * carry a token, so it has no way to recognise them. The owner is allowed
 * to see their own private profile, so their copy is inlined here instead
 * — this callable *is* authenticated, and a private profile is only ever
 * returned to them. Public profiles keep the cacheable URL.
 *
 * Otherwise the Google account picture, read from Firebase Auth rather
 * than copied into Firestore: it changes on Google's side, and a copy
 * would go stale silently.
 */
export async function resolvePhotoUrl(
  uid: string,
  config: UserConfigForPublicProfile,
  viewerIsOwner: boolean
): Promise<string | null> {
  const source = photoSource(config, viewerIsOwner);
  if (source.kind === 'none') return null;
  if (source.kind === 'inline') return inlinePhoto(uid);
  if (source.kind === 'endpoint') {
    const project = process.env['GCLOUD_PROJECT'] ?? 'pushup-stats';
    const version = encodeURIComponent(source.version);
    return `https://europe-west3-${project}.cloudfunctions.net/profilePhoto?uid=${encodeURIComponent(uid)}&v=${version}`;
  }
  try {
    const user = await getAuth().getUser(uid);
    return user.photoURL ?? null;
  } catch {
    // A missing auth record is normal for a deleted account; the profile
    // still renders, just without a picture.
    return null;
  }
}

/**
 * `GET /profilePhoto?uid=<uid>` — streams the uploaded profile photo.
 *
 * Applies the same visibility rule as the profile itself, minus the owner
 * bypass: this endpoint is unauthenticated (an `<img>` tag cannot send a
 * token), so it only ever serves photos of profiles that are public. The
 * owner reads their own file directly from Storage instead, which the
 * storage rules allow.
 */
export const profilePhoto = onRequest(
  { region: 'europe-west3', invoker: 'public', cors: true },
  async (req, res) => {
    const uid = String(req.query['uid'] ?? '').trim();
    if (!isValidUid(uid)) {
      res.status(404).type('text/plain').send('Photo not available');
      return;
    }

    const cfgSnap = await db.collection('userConfigs').doc(uid).get();
    const config = cfgSnap.exists
      ? (cfgSnap.data() as UserConfigForPublicProfile)
      : null;
    if (!config || !isPublicProfileAllowed(config) || !config.photoUpdatedAt) {
      res.status(404).type('text/plain').send('Photo not available');
      return;
    }

    try {
      const file = getStorage().bucket(PHOTO_BUCKET).file(photoObjectPath(uid));
      const [metadata] = await file.getMetadata();
      // Immutable: the URL carries `photoUpdatedAt`, so a new upload is a
      // new URL and can never be served from a stale cache entry.
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      res.setHeader('Content-Type', metadata.contentType ?? 'image/jpeg');
      file.createReadStream().pipe(res);
    } catch {
      res.status(404).type('text/plain').send('Photo not available');
    }
  }
);
