import { planPhotoUrls } from '../profile/photo-source';
import type { UserConfigForPublicProfile } from '../profile/public-profile.types';

/**
 * Pure side of friend avatars: which picture each friend gets, and how the
 * Auth reads behind that are batched. The Admin SDK lives in
 * `photos-read.ts` — importing it here would put `firebase-admin/auth`
 * (and its ESM-only JWT stack) in front of every test in this folder.
 */

/** `getUsers` takes at most 100 identifiers per call. */
const AUTH_CHUNK = 100;

/** The Auth records a batch of uids resolves to, photo only. */
export type AccountPhotoLookup = (
  uids: ReadonlyArray<string>
) => Promise<ReadonlyArray<{ uid: string; photoURL?: string }>>;

export interface FriendPhotoResult {
  /** Avatar URL by uid; friends without one are absent. */
  readonly urls: Map<string, string>;
  /** Lookups that threw — those friends fall back to initials. */
  readonly failed: number;
}

/**
 * Avatar URLs for confirmed friends, under the rule the profile page
 * already applies: an uploaded photo only while the profile is public
 * enough for the unauthenticated `profilePhoto` endpoint to serve it,
 * otherwise the Google account picture — and nothing at all for someone
 * who took that picture off their profile.
 *
 * A friend's *private* uploaded photo resolves to nothing rather than to
 * a URL that would 404: the endpoint is reached by an `<img>`, which
 * carries no token and cannot prove the viewer is a friend. The list
 * falls back to initials there.
 *
 * A failed lookup is counted, not thrown: a picture is not worth failing
 * the friends list over.
 */
export async function friendPhotoUrls(
  configs: ReadonlyMap<string, UserConfigForPublicProfile | undefined>,
  lookup: AccountPhotoLookup
): Promise<FriendPhotoResult> {
  const { urls, fromAccount } = planPhotoUrls(configs);
  let failed = 0;

  for (let i = 0; i < fromAccount.length; i += AUTH_CHUNK) {
    try {
      for (const user of await lookup(fromAccount.slice(i, i + AUTH_CHUNK))) {
        if (user.photoURL) urls.set(user.uid, user.photoURL);
      }
    } catch {
      failed += 1;
    }
  }
  return { urls, failed };
}
