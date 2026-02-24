import { User as FbUser } from '@firebase/auth';
import { User } from './core/state/user.type';

export function mapAuthUserToPUSUser(
  fbUser?: FbUser | null | undefined
): User | null {
  if (!fbUser) return null;

  return {
    uid: fbUser.uid,
    email: fbUser.email,
    displayName: fbUser.displayName,
    photoURL: fbUser.photoURL,
    emailVerified: fbUser.emailVerified,
    providerId: fbUser.providerId || 'unknown',
    isAnonymous: fbUser.isAnonymous,
  };
}
