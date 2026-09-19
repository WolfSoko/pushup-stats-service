import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PostAuthHook } from '@pu-auth/auth';
import { User } from '@pu-auth/auth';
import { UserConfigApiService } from '@pu-stats/data-access';
import { type UserConfigUpdate } from '@pu-stats/models';

/**
 * Syncs user profile data to the database after authentication.
 * Preserves existing display names set by the user.
 *
 * Only fields that have a value are written. Firestore rejects a write
 * carrying `undefined`, and e-mail registration runs this hook between
 * creating the account and the username step — with neither side holding
 * a name, the patch used to carry `displayName: undefined`, the write
 * threw, and the address never landed either.
 */
@Injectable()
export class UserProfileSyncHook implements PostAuthHook {
  private readonly userConfigApi = inject(UserConfigApiService);

  async onAuthenticated(user: User): Promise<void> {
    const existingConfig = await firstValueFrom(
      this.userConfigApi.getConfig(user.uid)
    );

    // Preserve user-set display name over provider display name
    const displayName =
      existingConfig?.displayName?.trim() || user.displayName?.trim() || '';

    const patch: UserConfigUpdate = {
      ...(user.email ? { email: user.email } : {}),
      ...(displayName ? { displayName } : {}),
    };
    if (Object.keys(patch).length === 0) return;

    await firstValueFrom(this.userConfigApi.updateConfig(user.uid, patch));
  }
}
