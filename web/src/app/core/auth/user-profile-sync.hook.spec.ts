import { TestBed } from '@angular/core/testing';
import { type User } from '@pu-auth/auth';
import { UserConfigApiService } from '@pu-stats/data-access';
import { of } from 'rxjs';

import { UserProfileSyncHook } from './user-profile-sync.hook';

describe('UserProfileSyncHook', () => {
  function setup(
    options: {
      user?: Partial<User>;
      existing?: { displayName?: string; email?: string };
    } = {}
  ) {
    const updateConfig = vitest.fn(() => of({}));
    const getConfig = vitest.fn(() => of(options.existing ?? {}));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        UserProfileSyncHook,
        {
          provide: UserConfigApiService,
          useValue: { getConfig, updateConfig },
        },
      ],
    });

    const hook = TestBed.inject(UserProfileSyncHook);
    const user = {
      uid: 'u1',
      email: 'someone@example.test',
      displayName: 'Someone',
      ...options.user,
    } as User;
    return { hook, user, updateConfig };
  }

  /**
   * The fields actually written.
   *
   * Asserted through the keys rather than with `toHaveBeenCalledWith`,
   * which treats a missing field and one set to `undefined` as the same
   * thing. Firestore does not: a write carrying `undefined` is rejected
   * outright, which is the whole point here.
   */
  function patchOf(updateConfig: { mock: { calls: unknown[][] } }): {
    keys: string[];
    value: Record<string, unknown>;
  } {
    const value = updateConfig.mock.calls[0][1] as Record<string, unknown>;
    return { keys: Object.keys(value).sort(), value };
  }

  it('should write the name the provider supplied', async () => {
    // given
    const { hook, user, updateConfig } = setup();

    // when
    await hook.onAuthenticated(user);

    // then
    const patch = patchOf(updateConfig);
    expect(patch.keys).toEqual(['displayName', 'email']);
    expect(patch.value).toEqual({
      email: 'someone@example.test',
      displayName: 'Someone',
    });
  });

  it('should keep a name the user set over the one the provider supplies', async () => {
    // given
    const { hook, user, updateConfig } = setup({
      existing: { displayName: '  Selbst gewählt  ' },
    });

    // when
    await hook.onAuthenticated(user);

    // then
    expect(patchOf(updateConfig).value['displayName']).toBe('Selbst gewählt');
  });

  /**
   * E-Mail registration creates the account before the username step, so
   * the hook runs while neither side has a name yet. The `undefined` that
   * left behind made Firestore reject the write, and the sync took the
   * e-mail address down with it.
   */
  it('should leave out a display name nobody has supplied yet', async () => {
    // given
    const { hook, user, updateConfig } = setup({ user: { displayName: null } });

    // when
    await hook.onAuthenticated(user);

    // then
    expect(patchOf(updateConfig).keys).toEqual(['email']);
  });

  it('should leave out an address the account does not have', async () => {
    // given
    const { hook, user, updateConfig } = setup({
      user: { email: null, displayName: 'Someone' },
    });

    // when
    await hook.onAuthenticated(user);

    // then
    expect(patchOf(updateConfig).keys).toEqual(['displayName']);
  });

  it('should not write at all when there is nothing to sync', async () => {
    // given
    const { hook, user, updateConfig } = setup({
      user: { email: null, displayName: null },
    });

    // when
    await hook.onAuthenticated(user);

    // then
    expect(updateConfig).not.toHaveBeenCalled();
  });
});
