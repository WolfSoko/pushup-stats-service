import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AnalysisPageComponent } from './analysis-page.component';
import { StatsApiService } from '@pu-stats/data-access';
import { AuthStore } from '@pu-auth/auth';
import { makeAuthStoreMock } from '@pu-stats/testing';
import { FilterBarComponent } from '../components/filter-bar/filter-bar.component';
import { HeatmapComponent } from '../components/heatmap/heatmap.component';
import { TypePieComponent } from '../components/type-pie/type-pie.component';
import { StatsChartComponent } from '../components/stats-chart/stats-chart.component';

// We don't want to render real components in unit tests.
import { Component, input, output } from '@angular/core';
import { RangeModes } from '@pu-stats/models';

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  template: '',
})
class MockFilterBarComponent {
  readonly from = input<string>('');
  readonly to = input<string>('');
  readonly fromChange = output<string>();
  readonly toChange = output<string>();
  readonly modeChange = output<RangeModes>();
}

@Component({
  selector: 'app-heatmap',
  standalone: true,
  template: '',
})
class MockHeatmapComponent {
  readonly entries = input<unknown[]>([]);
}

@Component({
  selector: 'app-type-pie',
  standalone: true,
  template: '',
})
class MockTypePieComponent {
  readonly data = input<unknown[]>([]);
}

@Component({
  selector: 'app-stats-chart',
  standalone: true,
  template: '',
})
class MockStatsChartComponent {
  readonly series = input<unknown[]>([]);
  readonly granularity = input<string>('daily');
  readonly rangeMode = input<string>('week');
  readonly from = input<string>('');
  readonly to = input<string>('');
}

describe('AnalysisPageComponent', () => {
  let fixture: ComponentFixture<AnalysisPageComponent>;

  const apiMock = {
    load: jest.fn().mockReturnValue(
      of({
        meta: {
          from: null,
          to: null,
          entries: 6,
          days: 6,
          total: 93,
          granularity: 'daily',
        },
        series: [],
      })
    ),
    listPushups: jest.fn().mockReturnValue(
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
      providers: [
        { provide: StatsApiService, useValue: apiMock },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
      ],
    })
      .overrideComponent(AnalysisPageComponent, {
        remove: {
          imports: [
            FilterBarComponent,
            HeatmapComponent,
            TypePieComponent,
            StatsChartComponent,
          ],
        },
        add: {
          imports: [
            MockFilterBarComponent,
            MockHeatmapComponent,
            MockTypePieComponent,
            MockStatsChartComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AnalysisPageComponent);
    await fixture.whenStable();
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
