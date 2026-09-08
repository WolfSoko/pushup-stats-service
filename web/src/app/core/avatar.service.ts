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

/**
 * DI seam for the Firebase Storage download-URL fetch.
 * Tests override this token with a useValue provider instead of vi.mock()-ing
 * @angular/fire/storage — which breaks the esbuild shared-chunk bundle.
 * See docs/gotchas/testing.md → "vi.mock('@angular/fire/…') is a landmine".
 */
export const AVATAR_DOWNLOADER = new InjectionToken<
  (storage: Storage, uid: string) => Promise<string>
>('AVATAR_DOWNLOADER', {
  factory: () => async (storage: Storage, uid: string) =>
    getDownloadURL(ref(storage, profilePhotoPath(uid))),
});

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
  private readonly downloader = inject(AVATAR_DOWNLOADER);

  private readonly uploaded = resource({
    params: () => ({
      uid: this.user.userIdSafe(),
      version: this.configStore.config()?.photoUpdatedAt ?? '',
    }),
    loader: async ({ params }) => {
      if (!this.storage || !params.uid || !params.version) return null;
      try {
        return await this.downloader(this.storage, params.uid);
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
