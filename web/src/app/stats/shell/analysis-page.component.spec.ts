import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AnalysisPageComponent } from './analysis-page.component';
import { StatsApiService } from '@pu-stats/data-access';
import { HeatmapComponent } from '../components/heatmap/heatmap.component';
import { TypePieComponent } from '../components/type-pie/type-pie.component';

// We don't want to render real chart components in unit tests.
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-heatmap',
  standalone: true,
  template: '',
})
class MockHeatmapComponent {
  readonly entries = input<any[]>([]);
}

@Component({
  selector: 'app-type-pie',
  standalone: true,
  template: '',
})
class MockTypePieComponent {
  readonly data = input<any[]>([]);
}

describe('AnalysisPageComponent', () => {
  let fixture: ComponentFixture<AnalysisPageComponent>;

  const apiMock = {
    listPushups: vitest.fn().mockReturnValue(
      of([
        {
          _id: '1',
          timestamp: '2026-02-09T08:00:00',
          reps: 10,
          source: 'wa',
          type: 'Standard',
        }, // Mo
        {
          _id: '2',
          timestamp: '2026-02-10T08:00:00',
          reps: 12,
          source: 'web',
          type: 'Diamond',
        }, // Di
        {
          _id: '3',
          timestamp: '2026-02-11T08:00:00',
          reps: 20,
          source: 'wa',
          type: 'Diamond',
        }, // Mi
        {
          _id: '4',
          timestamp: '2026-02-12T08:00:00',
          reps: 8,
          source: 'web',
          type: 'Wide',
        }, // Do
        {
          _id: '5',
          timestamp: '2026-02-13T08:00:00',
          reps: 25,
          source: 'wa',
          type: 'Standard',
        }, // Fr
        {
          _id: '6',
          timestamp: '2026-02-15T08:00:00',
          reps: 18,
          source: 'web',
        }, // So (missing type)
      ])
    ),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalysisPageComponent],
      providers: [{ provide: StatsApiService, useValue: apiMock }],
    })
      .overrideComponent(AnalysisPageComponent, {
        remove: { imports: [HeatmapComponent, TypePieComponent] },
        add: { imports: [MockHeatmapComponent, MockTypePieComponent] },
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

  it('computes type breakdown, treating missing type as Standard', () => {
    const component = fixture.componentInstance;
    const breakdown = component.typeBreakdown();

    // Standard: 10 + 25 + 18 = 53
    // Diamond: 12 + 20 = 32
    // Wide: 8
    expect(breakdown).toEqual([
      { label: 'Standard', value: 53 },
      { label: 'Diamond', value: 32 },
      { label: 'Wide', value: 8 },
    ]);
  });

  it('computes best values', () => {
    const component = fixture.componentInstance;
    expect(component.bestSingleEntry()?.reps).toBe(25);
    expect(component.bestDay()?.total).toBe(25);
  });

  it('computes streak stats', () => {
    const component = fixture.componentInstance;
    expect(component.longestStreak()).toBe(5);
    expect(component.currentStreak()).toBe(1);
  });
});
