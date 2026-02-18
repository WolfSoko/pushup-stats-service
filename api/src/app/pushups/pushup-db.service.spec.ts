import fs from 'node:fs';
import Datastore from 'nedb-promises';
import { PushupDbService } from './pushup-db.service';

jest.mock('nedb-promises', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}));

describe('PushupDbService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    (Datastore as any).create.mockReset?.();
  });

  it('creates db and ensures data dir exists', async () => {
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as never);

    const fakeDb = {
      find: jest.fn(),
      findOne: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    (Datastore as any).create.mockReturnValue(fakeDb);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const svc = new PushupDbService();

    expect(mkdirSpy).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect((Datastore as any).create).toHaveBeenCalledWith(
      expect.objectContaining({ filename: expect.any(String), autoload: true, timestampData: true }),
    );
  });

  it('findAll returns rows sorted and fills default type', async () => {
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as never);

    const rows = [
      { _id: '1', timestamp: '2026-02-10T10:00:00.000Z', reps: 10, source: 'wa' },
      { _id: '2', timestamp: '2026-02-10T11:00:00.000Z', reps: 5, source: 'wa', type: 'Knee' },
    ];

    const sort = jest.fn().mockResolvedValue(rows);
    const fakeDb = {
      find: jest.fn().mockReturnValue({ sort }),
      findOne: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    (Datastore as any).create.mockReturnValue(fakeDb);

    const svc = new PushupDbService();
    const all = await svc.findAll();

    expect(fakeDb.find).toHaveBeenCalledWith({});
    expect(sort).toHaveBeenCalledWith({ timestamp: 1 });

    expect(all).toEqual([
      { ...rows[0], type: 'Standard' },
      { ...rows[1], type: 'Knee' },
    ]);
  });

  it('findById returns null when missing and fills default type when present', async () => {
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as never);

    const fakeDb = {
      find: jest.fn(),
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ _id: '1', timestamp: 't', reps: 1, source: 'wa' }),
      insert: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    (Datastore as any).create.mockReturnValue(fakeDb);

    const svc = new PushupDbService();

    await expect(svc.findById('missing')).resolves.toBeNull();
    await expect(svc.findById('1')).resolves.toEqual({
      _id: '1',
      timestamp: 't',
      reps: 1,
      source: 'wa',
      type: 'Standard',
    });
  });

  it('create inserts and applies default type', async () => {
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as never);

    const fakeDb = {
      find: jest.fn(),
      findOne: jest.fn(),
      insert: jest.fn().mockImplementation(async (doc: any) => ({ ...doc, _id: '1' })),
      update: jest.fn(),
      remove: jest.fn(),
    };
    (Datastore as any).create.mockReturnValue(fakeDb);

    const svc = new PushupDbService();

    const out = await svc.create({ timestamp: 't', reps: 10, source: 'wa' });
    expect(fakeDb.insert).toHaveBeenCalledWith({ timestamp: 't', reps: 10, source: 'wa', type: 'Standard' });
    expect(out).toEqual({ _id: '1', timestamp: 't', reps: 10, source: 'wa', type: 'Standard' });
  });

  it('update patches and returns the updated row', async () => {
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as never);

    const fakeDb = {
      find: jest.fn().mockReturnValue({ sort: jest.fn() }),
      findOne: jest.fn().mockResolvedValue({ _id: '1', timestamp: 't', reps: 11, source: 'wa' }),
      insert: jest.fn(),
      update: jest.fn().mockResolvedValue(1),
      remove: jest.fn(),
    };
    (Datastore as any).create.mockReturnValue(fakeDb);

    const svc = new PushupDbService();
    const out = await svc.update('1', { reps: 11 });

    expect(fakeDb.update).toHaveBeenCalledWith({ _id: '1' }, { $set: { reps: 11 } });
    expect(out).toEqual({ _id: '1', timestamp: 't', reps: 11, source: 'wa', type: 'Standard' });
  });

  it('remove deletes by id', async () => {
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as never);

    const fakeDb = {
      find: jest.fn(),
      findOne: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      remove: jest.fn().mockResolvedValue(1),
    };
    (Datastore as any).create.mockReturnValue(fakeDb);

    const svc = new PushupDbService();
    await expect(svc.remove('1')).resolves.toBe(1);
    expect(fakeDb.remove).toHaveBeenCalledWith({ _id: '1' }, {});
  });
});
