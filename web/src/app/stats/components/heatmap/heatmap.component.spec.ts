import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeatmapComponent } from './heatmap.component';

describe('HeatmapComponent', () => {
  let fixture: ComponentFixture<HeatmapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeatmapComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HeatmapComponent);
  });

  it('builds heatmap chart data with top-down hours and correct values', () => {
    fixture.componentRef.setInput('entries', [
      { _id: '1', timestamp: '2026-02-09T08:00:00', reps: 10, source: 'wa' }, // Mo
      { _id: '2', timestamp: '2026-02-10T23:00:00', reps: 12, source: 'web' }, // Di
    ] as any);

    fixture.detectChanges();

    const component = fixture.componentInstance;
    const data = component.chartData();

    expect(data.datasets.length).toBe(1);
    expect(data.datasets[0].data.length).toBe(24 * 7);

    const points = data.datasets[0].data as any[];
    const mo8 = points.find((p) => p.x === 'Mo' && p.y === '08');
    expect(mo8).toBeDefined();
    expect(mo8.v).toBe(10);

    const di23 = points.find((p) => p.x === 'Di' && p.y === '23');
    expect(di23).toBeDefined();
    expect(di23.v).toBe(12);

    const yLabels = (component.chartOptions as any).scales.y.labels;
    expect(yLabels[0]).toBe('23');
    expect(yLabels[yLabels.length - 1]).toBe('00');
  });

  it('shows datalabels only for non-zero heatmap cells', () => {
    fixture.componentRef.setInput('entries', [
      { _id: '1', timestamp: '2026-02-09T08:00:00', reps: 10, source: 'wa' },
    ] as any);

    fixture.detectChanges();

    const component = fixture.componentInstance;
    const data = component.chartData();
    const dl = (component.chartOptions as any).plugins.datalabels;

    const dataset = data.datasets[0];
    const points = dataset.data as any[];
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
});
