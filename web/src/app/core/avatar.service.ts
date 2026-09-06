import { computed, inject, Injectable, resource } from '@angular/core';
import { getDownloadURL, ref, Storage } from '@angular/fire/storage';
import { UserContextService } from '@pu-auth/auth';

import { UserConfigStore } from './user-config.store';

export function profilePhotoPath(uid: string): string {
  return `profile-photos/${uid}/avatar`;
}

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
        return await getDownloadURL(
          ref(this.storage, profilePhotoPath(params.uid))
        );
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
