export const PHOTO_BUCKET = 'pushup-stats-profile-photos';
export const PHOTO_PREFIX = 'profile-photos';

export function photoObjectPath(uid: string): string {
  return `${PHOTO_PREFIX}/${uid}/avatar`;
}

/** Everything a user ever uploaded lives under this prefix. */
export function userPhotoPrefix(uid: string): string {
  return `${PHOTO_PREFIX}/${uid}/`;
}
