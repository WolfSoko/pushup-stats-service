import { isPublicProfileAllowed } from './public-profile';
import type { UserConfigForPublicProfile } from './public-profile.types';
export type PhotoSource =
  | { readonly kind: 'endpoint'; readonly version: string }
  | { readonly kind: 'inline' }
  | { readonly kind: 'account' }
  | { readonly kind: 'none' };

/**
 * Decides where a profile's photo comes from.
 *
 * Split out from the IO so the privacy rules are testable on their own.
 *
 * An uploaded photo on a *private* profile must never resolve to the
 * public `profilePhoto` endpoint, because that endpoint answers 404 for
 * private profiles — including to the owner, since an `<img>` carries no
 * token. The owner's copy is inlined by the caller instead.
 *
 * The account picture is a fallback the user never asked to publish, so
 * `hideAccountPhoto` takes it back off the profile. It only ever applies
 * when there is no upload; an uploaded photo was chosen deliberately and
 * is governed by the profile's own visibility instead.
 */
export function photoSource(
  config: UserConfigForPublicProfile | null | undefined,
  viewerIsOwner: boolean
): PhotoSource {
  const uploaded = config?.photoUpdatedAt;
  if (typeof uploaded === 'string' && uploaded) {
    if (isPublicProfileAllowed(config)) {
      return { kind: 'endpoint', version: uploaded };
    }
    return viewerIsOwner ? { kind: 'inline' } : { kind: 'none' };
  }
  return config?.ui?.hideAccountPhoto === true
    ? { kind: 'none' }
    : { kind: 'account' };
}

/**
 * The public `profilePhoto` URL for an uploaded photo. `version` is the
 * upload's timestamp and doubles as the cache-buster, so a new upload can
 * never be served from a stale CDN entry.
 */
export function photoEndpointUrl(uid: string, version: string): string {
  const project = process.env['GCLOUD_PROJECT'] ?? 'pushup-stats';
  return `https://europe-west3-${project}.cloudfunctions.net/profilePhoto?uid=${encodeURIComponent(uid)}&v=${encodeURIComponent(version)}`;
}

/**
 * Splits a group of users into the photo URLs already decided and those
 * whose picture still has to be read from their Auth record.
 *
 * Batching that read is the reason this exists: a friends list would
 * otherwise make one `getUser` round-trip per row.
 */
export function planPhotoUrls(
  configs: ReadonlyMap<string, UserConfigForPublicProfile | undefined>
): {
  readonly urls: Map<string, string>;
  readonly fromAccount: string[];
} {
  const urls = new Map<string, string>();
  const fromAccount: string[] = [];
  for (const [uid, config] of configs) {
    // No config document, no profile: `buildPublicProfile` returns
    // not-found for this user, so their Auth picture must not surface
    // here either. Happens to a half-deleted account.
    if (!config) continue;
    const source = photoSource(config, false);
    if (source.kind === 'endpoint') {
      urls.set(uid, photoEndpointUrl(uid, source.version));
    } else if (source.kind === 'account') {
      fromAccount.push(uid);
    }
  }
  return { urls, fromAccount };
}
