import { InjectionToken } from '@angular/core';
import { User } from '../model/user.type';

/**
 * Hook that runs after successful authentication.
 * Implementations can sync user profiles, migrate data, etc.
 */
export interface PostAuthHook {
  /** Called after a user signs in or signs up (not for anonymous). */
  onAuthenticated(user: User): Promise<void>;
  /** Called when a guest account is migrated to a permanent account. */
  onGuestMigration?(fromUid: string, toUid: string): Promise<void>;
}

/**
 * Multi-provider token for post-authentication side effects.
 * Register implementations at the application level to decouple
 * auth from data persistence.
 */
export const POST_AUTH_HOOKS = new InjectionToken<PostAuthHook[]>(
  'POST_AUTH_HOOKS'
);
