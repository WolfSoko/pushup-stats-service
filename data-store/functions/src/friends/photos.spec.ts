import { describe, expect, it, jest } from '@jest/globals';

import { friendPhotoUrls, type AccountPhotoLookup } from './photos';

describe('friendPhotoUrls', () => {
  const uploaded = { photoUpdatedAt: '2026-09-06T10:00:00.000Z' };
  const publicUi = { ui: { publicProfile: true } };

  function lookup(users: Array<{ uid: string; photoURL?: string }> = []) {
    return jest.fn<AccountPhotoLookup>().mockResolvedValue(users);
  }

  it('should take the account picture for a friend without an upload', async () => {
    // given
    const auth = lookup([{ uid: 'a', photoURL: 'https://g.test/a.jpg' }]);

    // when
    const { urls, failed } = await friendPhotoUrls(new Map([['a', {}]]), auth);

    // then
    expect(auth).toHaveBeenCalledWith(['a']);
    expect(urls.get('a')).toBe('https://g.test/a.jpg');
    expect(failed).toBe(0);
  });

  it('should not ask Auth about an upload it can already serve', async () => {
    // given
    const auth = lookup();

    // when
    const { urls } = await friendPhotoUrls(
      new Map([['a', { ...uploaded, ...publicUi }]]),
      auth
    );

    // then
    expect(auth).not.toHaveBeenCalled();
    expect(urls.get('a')).toContain('uid=a');
  });

  it('should leave out a friend whose Auth record carries no picture', async () => {
    // given — `getUsers` also simply omits a uid it cannot find
    const auth = lookup([{ uid: 'a' }]);

    // when
    const { urls } = await friendPhotoUrls(
      new Map([
        ['a', {}],
        ['b', {}],
      ]),
      auth
    );

    // then
    expect(urls.size).toBe(0);
  });

  it('should split the lookup into batches Auth accepts', async () => {
    // given — `getUsers` refuses more than 100 identifiers at once
    const uids = Array.from({ length: 250 }, (_, i) => `u${i}`);
    const auth = lookup();

    // when
    await friendPhotoUrls(new Map(uids.map((uid) => [uid, {}])), auth);

    // then
    expect(auth.mock.calls.map(([chunk]) => chunk.length)).toEqual([
      100, 100, 50,
    ]);
  });

  it('should still return the pictures it knows when Auth fails', async () => {
    // given — the list matters more than the avatars on it
    const auth = jest
      .fn<AccountPhotoLookup>()
      .mockRejectedValue(new Error('auth down'));

    // when
    const { urls, failed } = await friendPhotoUrls(
      new Map([
        ['a', { ...uploaded, ...publicUi }],
        ['b', {}],
      ]),
      auth
    );

    // then
    expect(urls.get('a')).toContain('uid=a');
    expect(urls.has('b')).toBe(false);
    expect(failed).toBe(1);
  });

  it('should give nothing for a friend whose config document is gone', async () => {
    // given — a half-deleted account: no config, Auth record still there
    const auth = lookup([{ uid: 'a', photoURL: 'https://g.test/a.jpg' }]);

    // when
    const { urls } = await friendPhotoUrls(new Map([['a', undefined]]), auth);

    // then — their profile page is not-found, so this must be too
    expect(auth).not.toHaveBeenCalled();
    expect(urls.size).toBe(0);
  });
});
