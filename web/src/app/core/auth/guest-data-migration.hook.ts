import { inject, Injectable } from '@angular/core';
import { PostAuthHook } from '@pu-auth/auth';
import { User } from '@pu-auth/auth';
import { PushupFirestoreService } from '@pu-stats/data-access';

/**
 * Migrates pushup data from a guest account to the newly authenticated account.
 */
@Injectable()
export class GuestDataMigrationHook implements PostAuthHook {
  private readonly pushupFirestore = inject(PushupFirestoreService, {
    optional: true,
  });

  async onAuthenticated(_user: User): Promise<void> {
    // No action needed on regular authentication
  }

  async onGuestMigration(fromUid: string, toUid: string): Promise<void> {
    if (!this.pushupFirestore) return;
    await this.pushupFirestore.migrateUserData(fromUid, toUid);
  }
}
