/* eslint-disable @typescript-eslint/no-explicit-any */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeatmapComponent, type HeatmapEntry } from './heatmap.component';

describe('HeatmapComponent', () => {
  let fixture: ComponentFixture<HeatmapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeatmapComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HeatmapComponent);
  });

  it('builds heatmap chart data with top-down hours and correct values', async () => {
    fixture.componentRef.setInput('entries', [
      { timestamp: '2026-02-09T08:00:00', reps: 10 }, // Mo
      { timestamp: '2026-02-10T23:00:00', reps: 12 }, // Di
    ] as HeatmapEntry[]);

    await fixture.whenStable();

    const component = fixture.componentInstance;
    const data = component.chartData();

    expect(data.datasets.length).toBe(1);
    expect(data.datasets[0].data.length).toBe(24 * 7);

    const points = data.datasets[0].data as Array<{
      x: string;
      y: string;
      v: number;
    }>;
    const mo8 = points.find((p) => p.x === 'Mo' && p.y === '08');
    expect(mo8?.v).toBe(10);

    const di23 = points.find((p) => p.x === 'Di' && p.y === '23');
    expect(di23?.v).toBe(12);

    const yLabels = (
      component.chartOptions() as { scales: { y: { labels: string[] } } }
    ).scales.y.labels;
    expect(yLabels[0]).toBe('23');
    expect(yLabels[yLabels.length - 1]).toBe('00');
  });

  it('shows datalabels only for non-zero heatmap cells', async () => {
    fixture.componentRef.setInput('entries', [
      { timestamp: '2026-02-09T08:00:00', reps: 10 },
    ] as HeatmapEntry[]);

    await fixture.whenStable();

    const component = fixture.componentInstance;
    const data = component.chartData();
    const dl = (component.chartOptions()?.plugins as any)
      .datalabels as unknown as {
      display: (ctx: { dataset: unknown; dataIndex: number }) => boolean;
      formatter: (value: unknown) => string;
    };

    const dataset = data.datasets[0];
    const points = dataset.data as Array<{ x: string; y: string; v: number }>;
    const nonZeroIndex = points.findIndex((p) => p.v > 0);
    const zeroIndex = points.findIndex((p) => p.v === 0);

    expect(nonZeroIndex).toBeGreaterThanOrEqual(0);
    expect(zeroIndex).toBeGreaterThanOrEqual(0);

    expect(dl.display({ dataset, dataIndex: nonZeroIndex })).toBe(true);
    expect(dl.display({ dataset, dataIndex: zeroIndex })).toBe(false);

    expect(dl.formatter(points[nonZeroIndex])).toBe(
      String(points[nonZeroIndex].v)
    );
    expect(dl.formatter(points[zeroIndex])).toBe('');
  });

  it('aggregates set count in breakdown mode and uses correct tooltip unit', async () => {
    fixture.componentRef.setInput('entries', [
      {
        timestamp: '2026-02-09T08:00:00',
        reps: 30,
        sets: [10, 10, 10],
      },
      {
        timestamp: '2026-02-09T08:30:00',
        reps: 20,
        sets: [10, 10],
      },
      {
        timestamp: '2026-02-10T23:00:00',
        reps: 12,
      },
    ] as HeatmapEntry[]);
    fixture.componentRef.setInput('mode', 'breakdown');

    await fixture.whenStable();

    const component = fixture.componentInstance;
    const data = component.chartData();
    const points = data.datasets[0].data as Array<{
      x: string;
      y: string;
      v: number;
    }>;

    // Mo 08: 3 sets + 2 sets = 5
    const mo8 = points.find((p) => p.x === 'Mo' && p.y === '08');
    expect(mo8?.v).toBe(5);

    const di23 = points.find((p) => p.x === 'Di' && p.y === '23');
    expect(di23?.v).toBe(0);

    const opts = component.chartOptions() as any;
    const label = opts.plugins.tooltip.callbacks.label({
      raw: { x: 'Mo', y: '08', v: 5 },
    });
    expect(label).toContain('Sätze');
    expect(label).not.toContain('Wiederholungen');
  });

  it('sums durationSec and formats mm:ss in tooltip when measurement is "time"', async () => {
    fixture.componentRef.setInput('entries', [
      { timestamp: '2026-02-09T08:00:00', durationSec: 60 }, // Mo
      { timestamp: '2026-02-09T08:30:00', durationSec: 90 }, // Mo same hour
    ] as HeatmapEntry[]);
    fixture.componentRef.setInput('measurement', 'time');

    await fixture.whenStable();

    const component = fixture.componentInstance;
    const data = component.chartData();
    const points = data.datasets[0].data as Array<{
      x: string;
      y: string;
      v: number;
    }>;

    const mo8 = points.find((p) => p.x === 'Mo' && p.y === '08');
    expect(mo8?.v).toBe(150);

    const opts = component.chartOptions() as any;
    const tooltip = opts.plugins.tooltip.callbacks.label({
      raw: { x: 'Mo', y: '08', v: 150 },
    });
    // The formatter already embeds the unit ("min"); the component
    // must not append it a second time — regression: previously
    // `2:30 min min`.
    expect(tooltip).toBe('Mo 08:00 - 2:30 min');

    const datalabel = opts.plugins.datalabels.formatter({
      x: 'Mo',
      y: '08',
      v: 150,
    });
    expect(datalabel).toBe('2:30');
  });

  it('sums distanceM and formats km in tooltip when measurement is "distance-time"', async () => {
    fixture.componentRef.setInput('entries', [
      { timestamp: '2026-02-09T08:00:00', distanceM: 5000, durationSec: 1500 },
    ] as HeatmapEntry[]);
    fixture.componentRef.setInput('measurement', 'distance-time');

    await fixture.whenStable();

    const component = fixture.componentInstance;
    const data = component.chartData();
    const points = data.datasets[0].data as Array<{
      x: string;
      y: string;
      v: number;
    }>;
    const mo8 = points.find((p) => p.x === 'Mo' && p.y === '08');
    expect(mo8?.v).toBe(5000);

    const opts = component.chartOptions() as any;
    const tooltip = opts.plugins.tooltip.callbacks.label({
      raw: { x: 'Mo', y: '08', v: 5000 },
    });
    // Tooltip must not append "Strecke" after the unit-bearing
    // formatted value (regression: previously `5.00 km Strecke`).
    expect(tooltip).toBe('Mo 08:00 - 5.0 km');

    const datalabel = opts.plugins.datalabels.formatter({
      x: 'Mo',
      y: '08',
      v: 5000,
    });
    expect(datalabel).toBe('5.0 km');
  });

  it('counts entries when measurement is "mixed"', async () => {
    fixture.componentRef.setInput('entries', [
      { timestamp: '2026-02-09T08:00:00', reps: 30 },
      { timestamp: '2026-02-09T08:30:00', durationSec: 60 },
      { timestamp: '2026-02-09T08:45:00', reps: 20 },
    ] as HeatmapEntry[]);
    fixture.componentRef.setInput('measurement', 'mixed');

    await fixture.whenStable();

    const component = fixture.componentInstance;
    const data = component.chartData();
    const points = data.datasets[0].data as Array<{
      x: string;
      y: string;
      v: number;
    }>;
    const mo8 = points.find((p) => p.x === 'Mo' && p.y === '08');
    expect(mo8?.v).toBe(3);

    const opts = component.chartOptions() as any;
    const tooltip = opts.plugins.tooltip.callbacks.label({
      raw: { x: 'Mo', y: '08', v: 3 },
    });
    expect(tooltip).toBe('Mo 08:00 - 3 Einträge');
  });
});
