import fs from 'node:fs';
import Datastore from 'nedb-promises';
import { UserConfigDbService } from './user-config-db.service';

jest.mock('nedb-promises', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}));

describe('UserConfigDbService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    (Datastore as any).create.mockReset?.();
  });

  it('creates db, ensures dir exists, and sets unique index on userId', () => {
    const mkdirSpy = jest
      .spyOn(fs, 'mkdirSync')
      .mockImplementation(() => undefined as never);

    const fakeDb = {
      ensureIndex: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    (Datastore as any).create.mockReturnValue(fakeDb);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const svc = new UserConfigDbService();

    expect(mkdirSpy).toHaveBeenCalledWith(expect.any(String), {
      recursive: true,
    });
    expect(fakeDb.ensureIndex).toHaveBeenCalledWith({
      fieldName: 'userId',
      unique: true,
    });
  });

  it('getByUserId returns existing doc', async () => {
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as never);

    const fakeDb = {
      ensureIndex: jest.fn(),
      findOne: jest.fn().mockResolvedValue({ userId: 'u1', dailyGoal: 123 }),
      update: jest.fn(),
    };
    (Datastore as any).create.mockReturnValue(fakeDb);

    const svc = new UserConfigDbService();
    await expect(svc.getByUserId('u1')).resolves.toEqual({
      userId: 'u1',
      dailyGoal: 123,
    });
  });

  it('upsert updates and returns the stored doc', async () => {
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as never);

    const fakeDb = {
      ensureIndex: jest.fn(),
      findOne: jest
        .fn()
        .mockResolvedValue({ userId: 'u1', displayName: 'Wolf' }),
      update: jest.fn().mockResolvedValue(1),
    };
    (Datastore as any).create.mockReturnValue(fakeDb);

    const svc = new UserConfigDbService();
    const out = await svc.upsert('u1', { displayName: 'Wolf' });

    expect(fakeDb.update).toHaveBeenCalledWith(
      { userId: 'u1' },
      {
        $set: { userId: 'u1', displayName: 'Wolf' },
      },
      { upsert: true }
    );
    expect(out).toEqual({ userId: 'u1', displayName: 'Wolf' });
  });

  it('upsert returns minimal deterministic doc when lookup fails (should not happen)', async () => {
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as never);

    const fakeDb = {
      ensureIndex: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(1),
    };
    (Datastore as any).create.mockReturnValue(fakeDb);

    const svc = new UserConfigDbService();
    await expect(svc.upsert('u-missing', { dailyGoal: 50 })).resolves.toEqual({
      userId: 'u-missing',
    });
  });
});
