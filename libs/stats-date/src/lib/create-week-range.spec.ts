import { createWeekRange } from './create-week-range';

describe('createWeekRange', () => {
  it('returns ISO date strings for from and to', () => {
    const { from, to } = createWeekRange();
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns a 7-day range (from is 6 days before to)', () => {
    const { from, to } = createWeekRange();
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffDays = Math.round(
      (toDate.getTime() - fromDate.getTime()) / 86_400_000
    );
    expect(diffDays).toBe(6);
  });
});
