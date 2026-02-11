import { StatsService } from './stats.service';
import { PushupDbService } from './pushup-db.service';

describe('StatsService', () => {
  const db: Pick<PushupDbService, 'findAll'> = {
    findAll: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns health payload', () => {
    const service = new StatsService(db as PushupDbService);
    expect(service.getHealth()).toEqual({ ok: true, storage: 'nedb' });
  });

  it('builds stats from database rows', async () => {
    const service = new StatsService(db as PushupDbService);
    (db.findAll as jest.Mock).mockResolvedValue([{ timestamp: '2026-02-10T10:00:00.000Z', reps: 10, source: 'wa' }]);

    const result = await service.getStats('2026-02-10', '2026-02-10');
    expect(db.findAll).toHaveBeenCalled();
    expect(result.meta.total).toBe(10);
    expect(result.meta.from).toBe('2026-02-10');
    expect(result.meta.to).toBe('2026-02-10');
  });
});
