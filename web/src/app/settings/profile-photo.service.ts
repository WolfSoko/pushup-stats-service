import { inject, Injectable, signal } from '@angular/core';
import {
  deleteObject,
  getDownloadURL,
  ref,
  Storage,
  uploadBytes,
} from '@angular/fire/storage';
import { UserContextService } from '@pu-auth/auth';

import { UserConfigStore } from '../core/user-config.store';
import { prepareProfilePhoto, type PhotoRejection } from './profile-photo';

export type PhotoUploadResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: PhotoRejection | 'upload' };

/**
 * Uploads and removes the profile photo.
 *
 * The object path is fixed per user (`profile-photos/<uid>/avatar`), so a
 * new upload replaces the old one instead of accumulating orphans that
 * nothing would ever clean up. `photoUpdatedAt` in the user config is what
 * makes the change visible: the profile projection reads it to build the
 * photo URL, and it doubles as the cache-buster.
 */
@Injectable({ providedIn: 'root' })
export class ProfilePhotoService {
  private readonly storage = inject(Storage, { optional: true });
  private readonly user = inject(UserContextService);
  private readonly configStore = inject(UserConfigStore);

  readonly busy = signal(false);

  private path(uid: string): string {
    return `profile-photos/${uid}/avatar`;
  }

  async upload(file: File): Promise<PhotoUploadResult> {
    const uid = this.user.userIdSafe();
    if (!this.storage || !uid) return { ok: false, reason: 'upload' };

    const prepared = await prepareProfilePhoto(file);
    if ('rejected' in prepared) return { ok: false, reason: prepared.rejected };

    this.busy.set(true);
    try {
      await uploadBytes(ref(this.storage, this.path(uid)), prepared.blob, {
        contentType: 'image/jpeg',
      });
      await this.configStore.save({ photoUpdatedAt: new Date().toISOString() });
      return { ok: true };
    } catch {
      return { ok: false, reason: 'upload' };
    } finally {
      this.busy.set(false);
    }
  }

  async remove(): Promise<void> {
    const uid = this.user.userIdSafe();
    if (!this.storage || !uid) return;
    this.busy.set(true);
    try {
      await deleteObject(ref(this.storage, this.path(uid)));
    } catch {
      // Already gone is a success for the caller's purposes.
    } finally {
      // Clear the marker either way: leaving it set would keep the profile
      // pointing at a photo that is no longer there.
      await this.configStore.save({ photoUpdatedAt: '' });
      this.busy.set(false);
    }
  }

  /**
   * Download URL for the signed-in user's own photo. The bucket is private
   * and an `<img>` cannot send a token, so this SDK-issued URL is how the
   * owner previews their photo while the profile is still private.
   */
  async ownPhotoUrl(): Promise<string | null> {
    const uid = this.user.userIdSafe();
    if (!this.storage || !uid) return null;
    try {
      return await getDownloadURL(ref(this.storage, this.path(uid)));
    } catch {
      return null;
    }
  }
}
