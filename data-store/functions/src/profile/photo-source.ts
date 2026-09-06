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
