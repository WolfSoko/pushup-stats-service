import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PostAuthHook } from '@pu-auth/auth';
import { User } from '@pu-auth/auth';
import { UserConfigApiService } from '@pu-stats/data-access';

/**
 * Syncs user profile data to the database after authentication.
 * Preserves existing display names set by the user.
 */
@Injectable()
export class UserProfileSyncHook implements PostAuthHook {
  private readonly userConfigApi = inject(UserConfigApiService);

  async onAuthenticated(user: User): Promise<void> {
    const existingConfig = await firstValueFrom(
      this.userConfigApi.getConfig(user.uid)
    );

    // Preserve user-set display name over provider display name
    const nextDisplayName =
      existingConfig?.displayName?.trim() || user.displayName || undefined;

    await firstValueFrom(
      this.userConfigApi.updateConfig(user.uid, {
        email: user.email ?? undefined,
        displayName: nextDisplayName,
      })
    );
  }
}
