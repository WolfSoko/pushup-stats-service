import type { User as FbUser } from '@firebase/auth';
import { mapAuthUserToPUSUser } from './map-auth-user-to-user';

describe('mapAuthUserToPUSUser', () => {
  it('should return null if no user is given (given undefined)', () => {
    expect(mapAuthUserToPUSUser(undefined)).toBeNull();
    expect(mapAuthUserToPUSUser(null)).toBeNull();
  });

  it('should map all fields from firebase user (given valid user)', () => {
    const fbUser: Partial<FbUser> = {
      uid: 'u',
      email: 'e',
      displayName: 'd',
      photoURL: 'p',
      emailVerified: true,
      providerId: 'google',
      isAnonymous: false,
    };
    const result = mapAuthUserToPUSUser(fbUser as FbUser);
    expect(result).toEqual({
      uid: 'u',
      email: 'e',
      displayName: 'd',
      photoURL: 'p',
      emailVerified: true,
      providerId: 'google',
      isAnonymous: false,
    });
  });

  it('should set providerId to unknown if missing (given no providerId)', () => {
    const fbUser: Partial<FbUser> = {
      uid: 'u',
      email: 'e',
      displayName: 'd',
      photoURL: 'p',
      emailVerified: true,
      isAnonymous: false,
    };
    const result = mapAuthUserToPUSUser(fbUser as FbUser);
    expect(result?.providerId).toBe('unknown');
  });
});
