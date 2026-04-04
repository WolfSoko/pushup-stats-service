import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';

/**
 * Port for user profile/config persistence.
 * Auth module defines this interface; the concrete implementation
 * (e.g. Firestore) is provided at the application level.
 */
export interface UserProfilePort {
  getConfig(userId: string): Observable<UserConfig>;
  updateConfig(userId: string, update: UserConfigUpdate): Observable<unknown>;
}

export const USER_PROFILE_PORT = new InjectionToken<UserProfilePort>(
  'USER_PROFILE_PORT'
);
