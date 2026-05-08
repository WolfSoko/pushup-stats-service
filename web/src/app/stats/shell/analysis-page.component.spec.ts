import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
          // New canonical id form (post-refactor write).
          type: 'diamond',
        }, // Di
        {
          _id: '3',
          timestamp: '2026-02-11T08:00:00',
          reps: 20,
          sets: [10, 5, 5],
          source: 'wa',
          // Legacy English entryLabel form (older Firestore docs). Mixing
          // it with the new "diamond" id above exercises the bucket-collapse
          // guarantee — both rows must land in the same breakdown entry.
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
    // Lock the clock to Sun Feb 15 2026 so the fixed-window trend filters
    // include the mock entries (Feb 9–15 2026). Real "now" would push the
    // window months ahead and make every bucket empty.
    vitest.useFakeTimers({
      toFake: ['Date'],
    });
    vitest.setSystemTime(new Date(2026, 1, 15, 12));

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

  afterEach(() => {
    vitest.useRealTimers();
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

  it('renders fixed-window labels for trend cards', () => {
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const trends = host.querySelector(
      '[data-testid="analysis-trends-section"]'
    );
    expect(trends?.textContent).toContain('Wochentrend');
    expect(trends?.textContent).toContain('Letzte 8 Wochen');
    expect(trends?.textContent).toContain('Monatstrend');
    expect(trends?.textContent).toContain('Letzte 6 Monate');
  });

  it('positions trend cards below the heatmap so they only render on viewport', () => {
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const heatmap = host.querySelector('.heatmap-full');
    const trends = host.querySelector(
      '[data-testid="analysis-trends-section"]'
    );
    expect(heatmap).toBeTruthy();
    expect(trends).toBeTruthy();
    if (!heatmap || !trends) return;
    expect(
      heatmap.compareDocumentPosition(trends) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('computes type breakdown, treating missing type as Standard', () => {
    const { store } = fixture.componentInstance;
    const breakdown = store.typeBreakdown();

    // The store canonicalizes the stored value (legacy entryLabel OR new
    // id) and renders the localized name. TestBed default locale is `de`
    // (the app source locale), so labels appear in German.
    // Totals: Standard 10 + 25 + 18 = 53, Diamond ("diamond" + "Diamond"
    // collapse to one bucket) 12 + 20 = 32, Wide 8.
    expect(breakdown.map(({ label, value }) => ({ label, value }))).toEqual([
      { label: 'Standard-Liegestütze', value: 53 },
      { label: 'Diamant-Liegestütze', value: 32 },
      { label: 'Weite Liegestütze', value: 8 },
    ]);
  });

  it('collapses legacy entryLabel and new canonical id into one bucket', () => {
    // Regression: rows with type "diamond" (new) and "Diamond" (legacy)
    // must yield exactly one Diamond bucket, not two. The mock dataset
    // above intentionally mixes both forms.
    const { store } = fixture.componentInstance;
    const diamondBuckets = store
      .typeBreakdown()
      .filter((b) => b.label === 'Diamant-Liegestütze');
    expect(diamondBuckets).toHaveLength(1);
    expect(diamondBuckets[0].value).toBe(32);
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
    const standard = breakdown.find((t) => t.label === 'Standard-Liegestütze');
    expect(standard?.avgSetSize).toBeGreaterThan(0);
    // Wide: no sets → avgSetSize = 0
    const wide = breakdown.find((t) => t.label === 'Weite Liegestütze');
    expect(wide?.avgSetSize).toBe(0);
  });

  it('places the heatmap reps/sets toggle inside the heatmap card header so the mobile stacked layout applies', () => {
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    const heatmapCard = host.querySelector('.heatmap-full');
    expect(heatmapCard).toBeTruthy();

    const headerToggle = heatmapCard?.querySelector(
      'mat-card-header .heatmap-toggle'
    );
    expect(headerToggle).toBeTruthy();
    expect(headerToggle?.tagName.toLowerCase()).toBe('mat-button-toggle-group');
  });

  it('keeps the date range filter sticky so it stays visible while scrolling', () => {
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const filterSection = host.querySelector('.filter-section');
    expect(filterSection).toBeTruthy();
    const computed = window.getComputedStyle(filterSection as Element);
    expect(computed.position).toBe('sticky');
    // The sticky offset must derive from --top-nav-height +
    // --desktop-nav-height so it stays in sync with the toolbar layout.
    // jsdom returns the raw calc()/var() expression rather than resolving
    // it to pixels, which is exactly what we want to verify here — a
    // hardcoded magic number (e.g. `top: 64px`) would silently overlap or
    // gap relative to the nav once the variables change.
    expect(computed.top).toMatch(/var\(--top-nav-height/);
    expect(computed.top).toMatch(/var\(--desktop-nav-height/);
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

describe('AnalysisPageComponent empty-state CTA gating', () => {
  // Regression guard: `showEmptyCta` was introduced specifically to avoid
  // an ExpressionChangedAfterItHasBeenCheckedError thrown when reading
  // `store.rows().length` while `entriesResource` was still in its
  // initial undefined→[] transition. The CTA must stay hidden until the
  // resource resolves, then surface for empty datasets.
  let fixture: ComponentFixture<AnalysisPageComponent>;

  const emptyApiMock = {
    load: vitest.fn().mockReturnValue(
      of({
        meta: {
          from: null,
          to: null,
          entries: 0,
          days: 0,
          total: 0,
          granularity: 'daily',
        },
        series: [],
      })
    ),
    listPushups: vitest.fn().mockReturnValue(of([])),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalysisPageComponent],
      providers: [
        provideRouter([]),
        { provide: StatsApiService, useValue: emptyApiMock },
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
  });

  it('hides the empty-state CTA while the entries resource has not resolved', () => {
    // Pre-stabilization: resource status is still 'loading', so even
    // though `rows()` would coalesce to `[]`, the CTA must stay hidden
    // to avoid the false-positive flicker that triggered the original
    // NG0100 error.
    expect(fixture.componentInstance.showEmptyCta()).toBe(false);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('[data-testid="analysis-empty-cta"]')).toBeNull();
  });

  it('renders the empty-state CTA after the entries resource resolves with no data', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.showEmptyCta()).toBe(true);

    const host: HTMLElement = fixture.nativeElement;
    const cta = host.querySelector(
      '[data-testid="analysis-empty-cta-plans"]'
    ) as HTMLAnchorElement | null;
    expect(cta).not.toBeNull();
    // RouterLink resolves `routerLink="/training-plans"` to `/training-plans`
    // when provideRouter([]) is in scope.
    expect(cta?.getAttribute('href')).toBe('/training-plans');
  });
});

describe('AnalysisPageComponent empty-state vs populated trends', () => {
  // Regression guard: when the page filter has no entries but the fixed
  // 8-week / 6-month trend windows do, the CTA must stay hidden so the
  // "Letzte 8 Wochen" cards don't render alongside a contradictory
  // "noch keine Daten" message.
  let fixture: ComponentFixture<AnalysisPageComponent>;

  const splitApiMock = {
    load: vitest.fn().mockReturnValue(
      of({
        meta: {
          from: null,
          to: null,
          entries: 0,
          days: 0,
          total: 0,
          granularity: 'daily',
        },
        series: [],
      })
    ),
    listPushups: vitest.fn().mockImplementation((params: { from: string }) => {
      // Filter resource (rows) is empty; week/month resources resolve to
      // historical entries — exercises the populated-trend gate.
      const isFiltered = params.from && params.from > '2026-04-01';
      if (isFiltered) return of([]);
      const today = new Date();
      const recent = new Date(today.getFullYear(), today.getMonth(), 1);
      return of([
        {
          _id: 'h1',
          timestamp: recent.toISOString(),
          reps: 30,
          sets: [10, 10, 10],
          source: 'web',
          type: 'Standard',
        },
      ]);
    }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalysisPageComponent],
      providers: [
        provideRouter([]),
        { provide: StatsApiService, useValue: splitApiMock },
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
    // Force the page filter to a far-future empty range so only the
    // fixed-window trends produce data.
    fixture.componentInstance.store.setRange('2026-12-01', '2026-12-07');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('hides the empty CTA when fixed-window trends have data', () => {
    expect(fixture.componentInstance.store.rows().length).toBe(0);
    const week = fixture.componentInstance.store.weekTrend();
    expect(week.some((w) => w.total > 0)).toBe(true);
    expect(fixture.componentInstance.showEmptyCta()).toBe(false);
  });
});

describe('AnalysisStore fixed-window trend filters', () => {
  // Direct boundary tests for the fixed-window filter computeds. These
  // are sensitive to ISO week + month rollovers and to JS Date's
  // Sunday-as-0 convention; lock the system clock to specific edge dates
  // and assert the exact ISO output.
  let fixture: ComponentFixture<AnalysisPageComponent>;

  const apiMock = {
    load: vitest.fn().mockReturnValue(
      of({
        meta: {
          from: null,
          to: null,
          entries: 0,
          days: 0,
          total: 0,
          granularity: 'daily',
        },
        series: [],
      })
    ),
    listPushups: vitest.fn().mockReturnValue(of([])),
  };

  async function createAt(date: Date): Promise<void> {
    vitest.setSystemTime(date);
    await TestBed.configureTestingModule({
      imports: [AnalysisPageComponent],
      providers: [
        provideRouter([]),
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
  }

  beforeEach(() => {
    // Only fake Date — leaving setTimeout/setInterval real keeps Angular's
    // resource() and TestBed.compileComponents() pipelines unblocked.
    vitest.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vitest.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('weekFilter spans 8 ISO weeks Mon–Sun for a mid-week anchor', async () => {
    await createAt(new Date(2026, 0, 14, 12)); // Wed Jan 14 2026
    const wf = fixture.componentInstance.store.weekFilter();
    expect(wf.from).toBe('2025-11-24'); // Monday 7 weeks before this Monday
    expect(wf.to).toBe('2026-01-18'); // Sunday of current ISO week
  });

  it('weekFilter handles Sunday correctly (getDay() === 0)', async () => {
    await createAt(new Date(2026, 0, 18, 23, 30)); // Sun Jan 18 2026 night
    const wf = fixture.componentInstance.store.weekFilter();
    // Sunday belongs to the week starting Mon Jan 12, so the window
    // ends on its Sunday and starts 7 weeks earlier.
    expect(wf.from).toBe('2025-11-24');
    expect(wf.to).toBe('2026-01-18');
  });

  it('weekFilter rolls across the year boundary', async () => {
    await createAt(new Date(2026, 0, 1, 9)); // Thu Jan 1 2026
    const wf = fixture.componentInstance.store.weekFilter();
    // Week of Jan 1 2026 starts Mon Dec 29 2025; 7 weeks earlier is
    // Mon Nov 10 2025.
    expect(wf.from).toBe('2025-11-10');
    expect(wf.to).toBe('2026-01-04');
  });

  it('monthFilter spans 6 calendar months ending current month', async () => {
    await createAt(new Date(2026, 0, 14, 12)); // Jan 14 2026
    const mf = fixture.componentInstance.store.monthFilter();
    expect(mf.from).toBe('2025-08-01');
    expect(mf.to).toBe('2026-01-31');
  });

  it('monthFilter handles February correctly in leap and non-leap years', async () => {
    await createAt(new Date(2028, 1, 15, 12)); // Feb 15 2028 (leap year)
    const mf = fixture.componentInstance.store.monthFilter();
    expect(mf.from).toBe('2027-09-01');
    expect(mf.to).toBe('2028-02-29');
  });

  it('weekTrend always emits 8 buckets even with zero entries', async () => {
    await createAt(new Date(2026, 0, 14, 12));
    const week = fixture.componentInstance.store.weekTrend();
    expect(week).toHaveLength(8);
    expect(week.every((w) => w.total === 0)).toBe(true);
  });

  it('monthTrend always emits 6 buckets even with zero entries', async () => {
    await createAt(new Date(2026, 0, 14, 12));
    const month = fixture.componentInstance.store.monthTrend();
    expect(month).toHaveLength(6);
    expect(month.every((m) => m.total === 0)).toBe(true);
  });

  it('weekFilter re-evaluates after tickClock when the day changes', async () => {
    await createAt(new Date(2026, 0, 18, 23, 59)); // Sun Jan 18
    const before = fixture.componentInstance.store.weekFilter();
    expect(before.to).toBe('2026-01-18');

    // Move clock past midnight into the next ISO week.
    vitest.setSystemTime(new Date(2026, 0, 19, 0, 5)); // Mon Jan 19
    fixture.componentInstance.store.tickClock();

    const after = fixture.componentInstance.store.weekFilter();
    expect(after.from).toBe('2025-12-01');
    expect(after.to).toBe('2026-01-25');
  });
});
