import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { Firestore } from 'firebase-admin/firestore';

import {
  readXpConfig,
  resetXpConfigCache,
  XP_CONFIG_TTL_MS,
} from './config-read';

function fakeDb(data: unknown) {
  const get = jest.fn(async () => ({ exists: true, data: () => data }));
  const db = { doc: jest.fn(() => ({ get })) } as unknown as Firestore;
  return { db, get };
}

describe('readXpConfig', () => {
  beforeEach(() => resetXpConfigCache());

  it('should parse the rates and drop invalid ones', async () => {
    // given
    const { db } = fakeDb({ rates: { pushup: 2, bad: -1 } });

    // when
    const config = await readXpConfig(db, 0);

    // then
    expect(config).toEqual({ rates: { pushup: 2 } });
  });

  it('should reuse the cached config within the TTL', async () => {
    // given
    const { db, get } = fakeDb({ rates: { pushup: 2 } });
    await readXpConfig(db, 0);

    // when
    await readXpConfig(db, XP_CONFIG_TTL_MS - 1);

    // then
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('should read again once the TTL expired', async () => {
    // given
    const { db, get } = fakeDb({ rates: { pushup: 2 } });
    await readXpConfig(db, 0);

    // when
    await readXpConfig(db, XP_CONFIG_TTL_MS);

    // then
    expect(get).toHaveBeenCalledTimes(2);
  });
});
