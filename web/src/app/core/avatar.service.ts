import {
  computed,
  inject,
  Injectable,
  InjectionToken,
  resource,
} from '@angular/core';
import { getDownloadURL, ref, Storage } from '@angular/fire/storage';
import { UserContextService } from '@pu-auth/auth';

import { UserConfigStore } from './user-config.store';

export function profilePhotoPath(uid: string): string {
  return `profile-photos/${uid}/avatar`;
}

/** Reads one object's download URL. Rejects when it isn't there. */
export type ProfilePhotoReader = (
  storage: Storage,
  path: string
) => Promise<string>;

/**
 * Seam for the Storage read, so a test can substitute it through DI.
 *
 * Not module mocking: specs in this project share a Vitest module registry,
 * so a `vi.mock` of `@angular/fire/storage` only wins when no neighbouring
 * spec loaded the real module onto the worker first. That made this
 * service's test pass or fail depending on how Vitest happened to pack
 * files — which is exactly how it started failing when an unrelated spec
 * grew. The same lesson is written down in `ai-assistant.tools.spec.ts`.
 */
export const PROFILE_PHOTO_READER = new InjectionToken<ProfilePhotoReader>(
  'PROFILE_PHOTO_READER',
  {
    providedIn: 'root',
    factory: (): ProfilePhotoReader => (storage, path) =>
      getDownloadURL(ref(storage, path)),
  }
);

/**
 * The picture that stands for the signed-in user across the app.
 *
 * One source on purpose: the settings preview and the toolbar avatar
 * showed different pictures while each resolved its own, so an upload
 * only reached the menu after a reload. Keying the lookup on
 * `photoUpdatedAt` makes both update the moment the config is written.
 */
@Injectable({ providedIn: 'root' })
export class AvatarService {
  private readonly storage = inject(Storage, { optional: true });
  private readonly user = inject(UserContextService);
  private readonly configStore = inject(UserConfigStore);
  private readonly readPhoto = inject(PROFILE_PHOTO_READER);

  private readonly uploaded = resource({
    params: () => ({
      uid: this.user.userIdSafe(),
      version: this.configStore.config()?.photoUpdatedAt ?? '',
    }),
    loader: async ({ params }) => {
      // No version means nothing was ever uploaded — asking Storage would
      // be a guaranteed 404 on every page load.
      if (!this.storage || !params.uid || !params.version) return null;
      try {
        return await this.readPhoto(this.storage, profilePhotoPath(params.uid));
      } catch {
        return null;
      }
    },
  });

  /** The user's own upload — the only picture the app can delete. */
  readonly uploadedUrl = computed(() => this.uploaded.value() ?? null);

  /** What to display: the upload, else the identity provider's picture. */
  readonly avatarUrl = computed(
    () => this.uploadedUrl() ?? this.user.accountPhotoUrl()
  );
}
