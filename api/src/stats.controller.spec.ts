import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

describe('StatsController', () => {
  it('delegates health endpoint to service', () => {
    const service: Pick<StatsService, 'getHealth' | 'getStats'> = {
      getHealth: jest.fn().mockReturnValue({ ok: true }),
      getStats: jest.fn(),
    };

    const controller = new StatsController(service as StatsService);
    expect(controller.getHealth()).toEqual({ ok: true });
    expect(service.getHealth).toHaveBeenCalled();
  });

  it('passes nullable query params to stats service', () => {
    const service: Pick<StatsService, 'getHealth' | 'getStats'> = {
      getHealth: jest.fn(),
      getStats: jest.fn().mockReturnValue({ meta: { total: 0 } }),
    };

    const controller = new StatsController(service as StatsService);
    controller.getStats(undefined, '2026-02-11');

    expect(service.getStats).toHaveBeenCalledWith(null, '2026-02-11');
  });
});
