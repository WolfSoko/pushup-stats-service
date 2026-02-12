import { Component, Input, Directive } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AnalysisPageComponent } from './analysis-page.component';
import { StatsApiService } from '@nx-temp/stats-data-access';
import { BaseChartDirective } from 'ng2-charts';

@Directive({
  selector: '[baseChart]',
  standalone: true
})
class MockBaseChartDirective {
  @Input() data: any;
  @Input() type: any;
  @Input() options: any;
}

describe('AnalysisPageComponent', () => {
  let fixture: ComponentFixture<AnalysisPageComponent>;

  const apiMock = {
    listPushups: jest.fn().mockReturnValue(
      of([
        { _id: '1', timestamp: '2026-02-09T08:00:00', reps: 10, source: 'wa' }, // Mo
        { _id: '2', timestamp: '2026-02-10T08:00:00', reps: 12, source: 'web' }, // Di
        { _id: '3', timestamp: '2026-02-11T08:00:00', reps: 20, source: 'wa' }, // Mi
        { _id: '4', timestamp: '2026-02-12T08:00:00', reps: 8, source: 'web' }, // Do
        { _id: '5', timestamp: '2026-02-13T08:00:00', reps: 25, source: 'wa' }, // Fr
        { _id: '6', timestamp: '2026-02-15T08:00:00', reps: 18, source: 'web' }, // So
      ]),
    ),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalysisPageComponent],
      providers: [{ provide: StatsApiService, useValue: apiMock }],
    })
    .overrideComponent(AnalysisPageComponent, {
      remove: { imports: [BaseChartDirective] },
      add: { imports: [MockBaseChartDirective] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnalysisPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('builds week and month trend series', () => {
    const component = fixture.componentInstance;
    expect(component.weekTrend().length).toBeGreaterThan(0);
    expect(component.monthTrend().length).toBeGreaterThan(0);
  });

  it('computes best values', () => {
    const component = fixture.componentInstance;
    // best single is 25 (id 5)
    expect(component.bestSingleEntry()?.reps).toBe(25);
    // best day is also 25 (id 5, date 2026-02-13)
    expect(component.bestDay()?.total).toBe(25);
  });

  it('computes streak stats', () => {
    const component = fixture.componentInstance;
    // Dates: 9, 10, 11, 12, 13 (streak 5), then skip 14, then 15
    // Longest streak: 5 (9-13)
    expect(component.longestStreak()).toBe(5);
    // Current streak: 1 (15, gap before)
    expect(component.currentStreak()).toBe(1);
  });

  it('builds heatmap chart data', () => {
    const component = fixture.componentInstance;
    const data = component.heatmapChartData();
    
    expect(data.datasets.length).toBe(1);
    expect(data.datasets[0].data.length).toBe(24 * 7); // 24 hours * 7 days
    
    // Check if data points exist
    const points = data.datasets[0].data as any[];
    // Find entry for Monday 08:00 (id 1, reps 10)
    // 2026-02-09 is Monday. 08:00.
    // x should be 'Mo', y should be '08'
    const entry = points.find(p => p.x === 'Mo' && p.y === '08');
    expect(entry).toBeDefined();
    expect(entry.v).toBe(10);
  });
});
