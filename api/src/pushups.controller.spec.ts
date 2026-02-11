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

  it('creates entry', async () => {
    (db.create as jest.Mock).mockResolvedValue({ _id: '1', timestamp: '2026-02-11T10:00:00', reps: 10, source: 'api' });
    await controller.create({ timestamp: '2026-02-11T10:00:00', reps: 10 });
    expect(db.create).toHaveBeenCalledWith({ timestamp: '2026-02-11T10:00:00', reps: 10, source: 'api' });
  });

  it('throws on missing entry', async () => {
    (db.findById as jest.Mock).mockResolvedValue(null);
    await expect(controller.getOne('404')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes entry', async () => {
    (db.remove as jest.Mock).mockResolvedValue(1);
    await expect(controller.remove('1')).resolves.toEqual({ ok: true });
  });
});
