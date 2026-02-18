import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

describe('StatsController', () => {
  it('delegates health endpoint to service', () => {
    const service: Pick<StatsService, 'getHealth' | 'getStats'> = {
      getHealth: jest.fn().mockReturnValue({ ok: true, storage: 'nedb' }),
      getStats: jest.fn(),
    };

    const controller = new StatsController(service as StatsService);
    expect(controller.getHealth()).toEqual({ ok: true, storage: 'nedb' });
    expect(service.getHealth).toHaveBeenCalled();
  });

  it('passes nullable query params to stats service', async () => {
    const service: Pick<StatsService, 'getHealth' | 'getStats'> = {
      getHealth: jest.fn(),
      getStats: jest.fn().mockResolvedValue({ meta: { total: 0 } }),
    };

    const controller = new StatsController(service as StatsService);
    await controller.getStats(undefined, '2026-02-11');

    expect(service.getStats).toHaveBeenCalledWith(null, '2026-02-11');
  });
});
