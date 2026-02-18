import { NotFoundException } from '@nestjs/common';
import { PushupsController } from './pushups.controller';
import { PushupDbService } from './pushup-db.service';

describe('PushupsController', () => {
  const db: Pick<PushupDbService, 'findAll' | 'findById' | 'create' | 'update' | 'remove'> = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const controller = new PushupsController(db as PushupDbService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists entries', async () => {
    (db.findAll as jest.Mock).mockResolvedValue([{ _id: '1', timestamp: '2026-02-11T10:00:00', reps: 10, source: 'wa' }]);
    const out = await controller.list();
    expect(out).toHaveLength(1);
  });

  it('returns one entry by id', async () => {
    (db.findById as jest.Mock).mockResolvedValue({ _id: '1', timestamp: '2026-02-11T10:00:00', reps: 10, source: 'wa' });

    await expect(controller.getOne('1')).resolves.toEqual({ _id: '1', timestamp: '2026-02-11T10:00:00', reps: 10, source: 'wa' });
  });

  it('throws on missing entry', async () => {
    (db.findById as jest.Mock).mockResolvedValue(null);
    await expect(controller.getOne('404')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates entry with defaults for source/type', async () => {
    (db.create as jest.Mock).mockResolvedValue({
      _id: '1',
      timestamp: '2026-02-11T10:00:00',
      reps: 10,
      source: 'api',
      type: 'Standard',
    });

    await controller.create({ timestamp: '2026-02-11T10:00:00', reps: 10 });

    expect(db.create).toHaveBeenCalledWith({ timestamp: '2026-02-11T10:00:00', reps: 10, source: 'api', type: 'Standard' });
  });

  it('creates entry with explicit source/type and numeric conversion', async () => {
    (db.create as jest.Mock).mockResolvedValue({
      _id: '2',
      timestamp: '2026-02-11T10:00:00',
      reps: 12,
      source: 'web',
      type: 'Diamond',
    });

    await controller.create({ timestamp: '2026-02-11T10:00:00', reps: '12' as unknown as number, source: 'web', type: 'Diamond' });

    expect(db.create).toHaveBeenCalledWith({ timestamp: '2026-02-11T10:00:00', reps: 12, source: 'web', type: 'Diamond' });
  });

  it('updates only provided fields and converts reps', async () => {
    (db.update as jest.Mock).mockResolvedValue({ _id: '1', timestamp: '2026-02-11T10:00:00', reps: 14, source: 'web', type: 'Wide' });

    const out = await controller.update('1', {
      reps: '14' as unknown as number,
      source: 'web',
      type: 'Wide',
    });

    expect(db.update).toHaveBeenCalledWith('1', { reps: 14, source: 'web', type: 'Wide' });
    expect(out).toEqual({ _id: '1', timestamp: '2026-02-11T10:00:00', reps: 14, source: 'web', type: 'Wide' });
  });

  it('updates timestamp when provided', async () => {
    (db.update as jest.Mock).mockResolvedValue({ _id: '1', timestamp: '2026-02-11T11:00:00', reps: 10, source: 'wa' });

    await controller.update('1', { timestamp: '2026-02-11T11:00:00' });

    expect(db.update).toHaveBeenCalledWith('1', { timestamp: '2026-02-11T11:00:00' });
  });

  it('throws when update target does not exist', async () => {
    (db.update as jest.Mock).mockResolvedValue(null);

    await expect(controller.update('404', { reps: 10 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes entry', async () => {
    (db.remove as jest.Mock).mockResolvedValue(1);
    await expect(controller.remove('1')).resolves.toEqual({ ok: true });
  });

  it('throws when delete target does not exist', async () => {
    (db.remove as jest.Mock).mockResolvedValue(0);
    await expect(controller.remove('404')).rejects.toBeInstanceOf(NotFoundException);
  });
});
