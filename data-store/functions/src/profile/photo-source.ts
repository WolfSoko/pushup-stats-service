import {
  isPublicProfileAllowed,
  type UserConfigForPublicProfile,
} from './public-profile';
export type PhotoSource =
  | { readonly kind: 'endpoint'; readonly version: string }
  | { readonly kind: 'inline' }
  | { readonly kind: 'account' }
  | { readonly kind: 'none' };

/**
 * Decides where a profile's photo comes from.
 *
 * Split out from the IO so the privacy rule is testable on its own: an
 * uploaded photo on a *private* profile must never resolve to the public
 * `profilePhoto` endpoint, because that endpoint answers 404 for private
 * profiles — including to the owner, since an `<img>` carries no token.
 * The owner's copy is inlined by the caller instead.
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
  return { kind: 'account' };
}
