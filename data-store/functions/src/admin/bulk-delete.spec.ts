import { describe, expect, it, jest } from '@jest/globals';

import { deleteInactiveAccounts } from './bulk-delete';

describe('deleteInactiveAccounts', () => {
  it('should skip active accounts and delete inactive ones', async () => {
    // given
    const deleteAccount = jest.fn(async () => undefined);

    // when
    const counts = await deleteInactiveAccounts({
      uids: ['active', 'idle-1', 'idle-2'],
      limit: 10,
      isActive: async (uid) => uid === 'active',
      deleteAccount,
    });

    // then
    expect(counts).toEqual({ deleted: 2, skipped: 1, remaining: 0 });
    expect(deleteAccount.mock.calls).toEqual([['idle-1'], ['idle-2']]);
  });

  it('should stop at the limit and report the rest as remaining', async () => {
    // given more inactive accounts than one run may delete
    const deleteAccount = jest.fn(async () => undefined);

    // when
    const counts = await deleteInactiveAccounts({
      uids: ['a', 'b', 'c', 'd'],
      limit: 2,
      isActive: async () => false,
      deleteAccount,
    });

    // then
    expect(counts).toEqual({ deleted: 2, skipped: 0, remaining: 2 });
    expect(deleteAccount).toHaveBeenCalledTimes(2);
  });
});
