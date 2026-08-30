import { TREND_MONTHS, TREND_WEEKS } from './trend-math';
import { monthTrendWindow, weekTrendWindow } from './trend-windows';

describe('weekTrendWindow', () => {
  it('should span TREND_WEEKS weeks and end on the Sunday of the anchor week', () => {
    // given — Monday 2026-02-09
    const monday = new Date(2026, 1, 9);

    // when
    const window = weekTrendWindow(monday);

    // then
    expect(window.to).toBe('2026-02-15');
    const from = new Date(`${window.from}T00:00:00`);
    const days = Math.round(
      (monday.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)
    );
    expect(days).toBe(7 * (TREND_WEEKS - 1));
  });
});

describe('monthTrendWindow', () => {
  it('should span TREND_MONTHS months and end on the last day of the anchor month', () => {
    // given — March 2026
    const monthStart = new Date(2026, 2, 1);

    // when
    const window = monthTrendWindow(monthStart);

    // then
    expect(window.to).toBe('2026-03-31');
    expect(window.from).toBe('2025-10-01');
    expect(TREND_MONTHS).toBe(6);
  });

  it('should land on the right last day for a February anchor', () => {
    // given
    const monthStart = new Date(2026, 1, 1);

    // when / then — 2026 is not a leap year
    expect(monthTrendWindow(monthStart).to).toBe('2026-02-28');
  });
});
