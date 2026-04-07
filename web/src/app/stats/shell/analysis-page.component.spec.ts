import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AnalysisPageComponent } from './analysis-page.component';
import { StatsApiService, UserStatsApiService } from '@pu-stats/data-access';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { makeAuthStoreMock } from '@pu-stats/testing';
import { FilterBarComponent } from '../components/filter-bar/filter-bar.component';
import { HeatmapComponent } from '../components/heatmap/heatmap.component';
import { TypePieComponent } from '../components/type-pie/type-pie.component';
import { StatsChartComponent } from '../components/stats-chart/stats-chart.component';
import { SetsDistributionComponent } from '../components/sets-distribution/sets-distribution.component';

// We don't want to render real components in unit tests.
import { Component, input, model, output } from '@angular/core';
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
  readonly mode = input<string>('reps');
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
  readonly entries = input<unknown[]>([]);
  readonly dayChartMode = model<string>('14h');
}

@Component({
  selector: 'app-sets-distribution',
  standalone: true,
  template: '',
})
class MockSetsDistributionComponent {
  readonly data = input<unknown[]>([]);
}

describe('AnalysisPageComponent', () => {
  let fixture: ComponentFixture<AnalysisPageComponent>;

  const apiMock = {
    load: vitest.fn().mockReturnValue(
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
    listPushups: vitest.fn().mockReturnValue(
      of([
        {
          _id: '1',
          timestamp: '2026-02-09T08:00:00',
          reps: 10,
          sets: [5, 5],
          source: 'wa',
          type: 'Standard',
        }, // Mo
        {
          _id: '2',
          timestamp: '2026-02-10T08:00:00',
          reps: 12,
          sets: [6, 6],
          source: 'web',
          type: 'Diamond',
        }, // Di
        {
          _id: '3',
          timestamp: '2026-02-11T08:00:00',
          reps: 20,
          sets: [10, 5, 5],
          source: 'wa',
          type: 'Diamond',
        }, // Mi
        {
          _id: '4',
          timestamp: '2026-02-12T08:00:00',
          reps: 8,
          source: 'web',
          type: 'Wide',
        }, // Do (no sets)
        {
          _id: '5',
          timestamp: '2026-02-13T08:00:00',
          reps: 25,
          sets: [10, 8, 7],
          source: 'wa',
          type: 'Standard',
        }, // Fr
        {
          _id: '6',
          timestamp: '2026-02-15T08:00:00',
          reps: 18,
          sets: [9, 9],
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
        { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
        {
          provide: UserStatsApiService,
          useValue: {
            getUserStats: vitest.fn().mockReturnValue(of(null)),
          },
        },
      ],
    })
      .overrideComponent(AnalysisPageComponent, {
        remove: {
          imports: [
            FilterBarComponent,
            HeatmapComponent,
            TypePieComponent,
            StatsChartComponent,
            SetsDistributionComponent,
          ],
        },
        add: {
          imports: [
            MockFilterBarComponent,
            MockHeatmapComponent,
            MockTypePieComponent,
            MockStatsChartComponent,
            MockSetsDistributionComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AnalysisPageComponent);
    await fixture.whenStable();
  });

  it('builds week and month trend series from expanded ranges', () => {
    const { store } = fixture.componentInstance;
    expect(store.weekTrend().length).toBeGreaterThan(0);
    expect(store.monthTrend().length).toBeGreaterThan(0);
  });

  it('expands filter to full calendar weeks for weekTrend', () => {
    const { store } = fixture.componentInstance;
    // The week filter should always start on Monday and end on Sunday
    const wf = store.weekFilter();
    const fromDate = new Date(`${wf.from}T00:00:00`);
    const toDate = new Date(`${wf.to}T00:00:00`);
    expect(fromDate.getDay()).toBe(1); // Monday
    expect(toDate.getDay()).toBe(0); // Sunday
  });

  it('expands filter to full calendar months for monthTrend', () => {
    const { store } = fixture.componentInstance;
    const mf = store.monthFilter();
    const fromDate = new Date(`${mf.from}T00:00:00`);
    const toDate = new Date(`${mf.to}T00:00:00`);
    expect(fromDate.getDate()).toBe(1); // first of month
    // last day of month: next day should be 1st
    const nextDay = new Date(toDate);
    nextDay.setDate(nextDay.getDate() + 1);
    expect(nextDay.getDate()).toBe(1);
  });

  it('provides subtitle strings for trend cards', () => {
    const { store } = fixture.componentInstance;
    expect(store.weekTrendSubtitle()).toBeTruthy();
    expect(store.monthTrendSubtitle()).toBeTruthy();
    // Subtitles should contain a date separator
    expect(store.weekTrendSubtitle()).toContain('–');
  });

  it('computes type breakdown, treating missing type as Standard', () => {
    const { store } = fixture.componentInstance;
    const breakdown = store.typeBreakdown();

    // Standard: 10 + 25 + 18 = 53, Diamond: 12 + 20 = 32, Wide: 8
    expect(breakdown.map(({ label, value }) => ({ label, value }))).toEqual([
      { label: 'Standard', value: 53 },
      { label: 'Diamond', value: 32 },
      { label: 'Wide', value: 8 },
    ]);
  });

  it('computes best values', () => {
    const { store } = fixture.componentInstance;
    expect(store.bestSingleEntry()?.reps).toBe(25);
    expect(store.bestDay()?.total).toBe(25);
  });

  it('computes streak stats', () => {
    const { store } = fixture.componentInstance;
    expect(store.longestStreak()).toBe(5);
    expect(store.currentStreak()).toBe(1);
  });

  it('computes avgSetSize from all entries with sets', () => {
    const { store } = fixture.componentInstance;
    // sets: [5,5], [6,6], [10,5,5], [10,8,7], [9,9] → all sets = [5,5,6,6,10,5,5,10,8,7,9,9]
    // sum = 85, count = 12, avg = 7.1 (rounded to 1 decimal)
    expect(store.avgSetSize()).toBe(7.1);
  });

  it('computes setsDistribution grouped by set count', () => {
    const { store } = fixture.componentInstance;
    const dist = store.setsDistribution();
    // 2-set entries: 3 (ids 1,2,6), 3-set entries: 2 (ids 3,5)
    // total with sets = 5
    expect(dist).toEqual([
      { setCount: 2, count: 3, percent: 60 },
      { setCount: 3, count: 2, percent: 40 },
    ]);
  });

  it('computes bestSingleSet from max reps in any individual set', () => {
    const { store } = fixture.componentInstance;
    // max of [5,5,6,6,10,5,5,10,8,7,9,9] = 10
    expect(store.bestSingleSet()).toBe(10);
  });

  it('includes avgSetSize in typeBreakdown', () => {
    const { store } = fixture.componentInstance;
    const breakdown = store.typeBreakdown();
    // Standard: sets [5,5] + [10,8,7] + [9,9] = [5,5,10,8,7,9,9] → avg = 53/7 ≈ 7.6
    const standard = breakdown.find((t) => t.label === 'Standard');
    expect(standard?.avgSetSize).toBeGreaterThan(0);
    // Wide: no sets → avgSetSize = 0
    const wide = breakdown.find((t) => t.label === 'Wide');
    expect(wide?.avgSetSize).toBe(0);
  });

  it('includes avgSetsPerEntry in week and month trend', () => {
    const { store } = fixture.componentInstance;
    const week = store.weekTrend();
    expect(week.length).toBeGreaterThan(0);
    // All entries have at least some with sets
    const hasAvg = week.some((w) => (w.avgSetsPerEntry ?? 0) > 0);
    expect(hasAvg).toBe(true);

    const month = store.monthTrend();
    expect(month.length).toBeGreaterThan(0);
    const monthHasAvg = month.some((m) => (m.avgSetsPerEntry ?? 0) > 0);
    expect(monthHasAvg).toBe(true);
  });
});
