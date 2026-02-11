import * as core from './stats.core';
import { StatsService } from './stats.service';

describe('StatsService', () => {
  it('returns health payload', () => {
    const service = new StatsService();
    expect(service.getHealth()).toEqual({ ok: true });
  });

  it('builds stats from parsed csv rows', () => {
    const service = new StatsService();
    const parseSpy = jest.spyOn(core, 'parseCsv').mockReturnValue([
      { timestamp: '2026-02-10T10:00:00.000Z', reps: 10, source: 'wa' },
    ]);

    const result = service.getStats('2026-02-10', '2026-02-10');
    expect(parseSpy).toHaveBeenCalled();
    expect(result.meta.total).toBe(10);
    expect(result.meta.from).toBe('2026-02-10');
    expect(result.meta.to).toBe('2026-02-10');

    parseSpy.mockRestore();
  });
});
