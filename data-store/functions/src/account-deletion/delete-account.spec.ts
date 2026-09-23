import { describe, expect, it, jest } from '@jest/globals';

import {
  type AuthDeleter,
  deleteAccountWithData,
  isRecentLogin,
  RECENT_LOGIN_WINDOW_SEC,
} from './delete-account';
import { FakeFirestore } from './fake-firestore.testing';
import { DELETED_ACCOUNTS_COLLECTION } from './tombstone';

const NOW_MS = Date.parse('2026-09-23T10:00:00Z');

function deps(fake: FakeFirestore, auth: AuthDeleter) {
  return {
    db: fake.asFirestore(),
    photoBucket: { deleteFiles: async () => undefined },
    auth,
    nowMs: NOW_MS,
  };
}

describe('isRecentLogin', () => {
  it('should accept a sign-in within the window', () => {
    // given / when / then
    expect(isRecentLogin(NOW_MS / 1000 - RECENT_LOGIN_WINDOW_SEC, NOW_MS)).toBe(
      true
    );
  });

  it('should reject a sign-in older than the window', () => {
    // given / when / then
    expect(
      isRecentLogin(NOW_MS / 1000 - RECENT_LOGIN_WINDOW_SEC - 1, NOW_MS)
    ).toBe(false);
  });

  it('should reject a token without auth_time', () => {
    // given / when / then
    expect(isRecentLogin(undefined, NOW_MS)).toBe(false);
    expect(isRecentLogin('123', NOW_MS)).toBe(false);
  });
});

describe('deleteAccountWithData', () => {
  it('should purge the data before deleting the auth user', async () => {
    // given a user with an entry
    const fake = new FakeFirestore().seed('exerciseEntries/e-1', {
      userId: 'u1',
    });
    const entryLeftAtAuthDelete: boolean[] = [];
    const auth = {
      deleteUser: jest.fn(async () => {
        entryLeftAtAuthDelete.push(fake.docs.has('exerciseEntries/e-1'));
      }),
    };

    // when
    await deleteAccountWithData(deps(fake, auth), 'u1');

    // then
    expect(auth.deleteUser).toHaveBeenCalledWith('u1');
    expect(entryLeftAtAuthDelete).toEqual([false]);
  });

  it('should treat an already deleted auth user as done', async () => {
    // given an auth user that no longer exists
    const fake = new FakeFirestore();
    const auth = {
      deleteUser: async () => {
        throw Object.assign(new Error('gone'), { code: 'auth/user-not-found' });
      },
    };

    // when / then
    await expect(
      deleteAccountWithData(deps(fake, auth), 'u1')
    ).resolves.toBeDefined();
    expect(fake.docs.has(`${DELETED_ACCOUNTS_COLLECTION}/u1`)).toBe(true);
  });

  it('should withdraw the tombstone and rethrow when the auth deletion fails', async () => {
    // given an auth backend that errors
    const fake = new FakeFirestore();
    const auth = {
      deleteUser: async () => {
        throw Object.assign(new Error('boom'), { code: 'auth/internal-error' });
      },
    };

    // when / then — the account survives, so its entry triggers must work
    await expect(deleteAccountWithData(deps(fake, auth), 'u1')).rejects.toThrow(
      'boom'
    );
    expect(fake.docs.has(`${DELETED_ACCOUNTS_COLLECTION}/u1`)).toBe(false);
  });
});
