import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AnalysisPageComponent } from './analysis-page.component';
import { AnalysisGroupViewComponent } from './analysis-group-view.component';
import { StatsApiService, UserStatsApiService } from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { makeAuthStoreMock } from '@pu-stats/testing';
import { FilterBarComponent } from '../components/filter-bar/filter-bar.component';
import { HeatmapComponent } from '../components/heatmap/heatmap.component';
import { TypePieComponent } from '../components/type-pie/type-pie.component';
import { StatsChartComponent } from '../components/stats-chart/stats-chart.component';
import { SetsDistributionComponent } from '../components/sets-distribution/sets-distribution.component';

// We don't want to render real components in unit tests.
import {
  Component,
  input,
  model,
  output,
  PLATFORM_ID,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ExerciseDefinition, ExerciseEntry } from '@pu-stats/models';
import { RangeModes } from '@pu-stats/date';

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class MockHeatmapComponent {
  readonly entries = input<unknown[]>([]);
  readonly mode = input<string>('reps');
}

@Component({
  selector: 'app-type-pie',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class MockTypePieComponent {
  readonly data = input<unknown[]>([]);
}

@Component({
  selector: 'app-stats-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class MockStatsChartComponent {
  readonly series = input<unknown[]>([]);
  readonly granularity = input<string>('daily');
  readonly rangeMode = input<string>('week');
  readonly from = input<string>('');
  readonly to = input<string>('');
  readonly entries = input<unknown[]>([]);
  readonly measurement = input<unknown>(null);
  readonly paceSeries = input<unknown[]>([]);
  readonly dayChartMode = model<string>('14h');
}

@Component({
  selector: 'app-sets-distribution',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class MockSetsDistributionComponent {
  readonly data = input<unknown[]>([]);
}

describe('AnalysisPageComponent', () => {
  let fixture: ComponentFixture<AnalysisPageComponent>;
  // Mutable mirror of the LiveDataStore so tests can seed exercise
  // entries that the analysis store reads via `unifiedRows`.
  const liveExerciseEntries = signal<ExerciseEntry[]>([]);
  // Mutable mirror of user-defined exercise definitions. The analysis
  // store passes these to `unifiedEntryCategoryId` when bucketing rows
  // into per-category tabs, so seeding them here lets a test exercise
  // the custom-id branch that the standard catalog cannot reach.
  const liveExerciseDefinitions = signal<ExerciseDefinition[]>([]);
  const liveMock = {
    connected: signal(true),
    entries: signal([] as never[]),
    exerciseEntries: liveExerciseEntries,
    exerciseDefinitions: liveExerciseDefinitions,
    updateTick: signal(0),
  };

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

    liveExerciseEntries.set([
      {
        _id: '1',
        userId: 'u1',
        exerciseId: 'pushup',
        timestamp: '2026-02-09T08:00:00',
        reps: 10,
        sets: [5, 5],
        source: 'wa',
        variantId: 'standard',
      } as ExerciseEntry,
      {
        _id: '2',
        userId: 'u1',
        exerciseId: 'pushup',
        timestamp: '2026-02-10T08:00:00',
        reps: 12,
        sets: [6, 6],
        source: 'web',
        variantId: 'diamond',
      } as ExerciseEntry,
      {
        _id: '3',
        userId: 'u1',
        exerciseId: 'pushup',
        timestamp: '2026-02-11T08:00:00',
        reps: 20,
        sets: [10, 5, 5],
        source: 'wa',
        variantId: 'Diamond',
      } as ExerciseEntry,
      {
        _id: '4',
        userId: 'u1',
        exerciseId: 'pushup',
        timestamp: '2026-02-12T08:00:00',
        reps: 8,
        source: 'web',
        variantId: 'Wide',
      } as ExerciseEntry,
      {
        _id: '5',
        userId: 'u1',
        exerciseId: 'pushup',
        timestamp: '2026-02-13T08:00:00',
        reps: 25,
        sets: [10, 8, 7],
        source: 'wa',
        variantId: 'standard',
      } as ExerciseEntry,
      {
        _id: '6',
        userId: 'u1',
        exerciseId: 'pushup',
        timestamp: '2026-02-15T08:00:00',
        reps: 18,
        sets: [9, 9],
        source: 'web',
      } as ExerciseEntry,
    ]);
    liveExerciseDefinitions.set([]);
    await TestBed.configureTestingModule({
      imports: [AnalysisPageComponent],
      providers: [
        provideRouter([]),
        // 'server' skips the component's setInterval-based clock tick
        // and the URL history effect; both depend on browser-only APIs
        // and otherwise risk leaking timers across TestBed resets.
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: StatsApiService, useValue: apiMock },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
        { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
        { provide: LiveDataStore, useValue: liveMock },
        {
          provide: UserStatsApiService,
          useValue: {
            getUserStats: vitest.fn().mockReturnValue(of(null)),
          },
        },
      ],
    })
      .overrideComponent(AnalysisPageComponent, {
        remove: { imports: [FilterBarComponent] },
        add: { imports: [MockFilterBarComponent] },
      })
      .overrideComponent(AnalysisGroupViewComponent, {
        remove: {
          imports: [
            HeatmapComponent,
            TypePieComponent,
            StatsChartComponent,
            SetsDistributionComponent,
          ],
        },
        add: {
          imports: [
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

  // NOTE: DOM-level group-view tests (trend section ordering, heatmap
  // toggle position, kind-id localisation via `typeBreakdownDisplay`)
  // live in `analysis-group-view.component.spec.ts`. They render the
  // group-view directly because mat-tab's lazy body template doesn't
  // hydrate reliably under PLATFORM_ID=server in jsdom.

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

  it('constrains the page-wrap grid track so the tab row cannot widen the page', () => {
    // Regression: without an explicit `minmax(0, 1fr)` track, the grid
    // child mat-tab-group's intrinsic width (all tab labels side-by-side)
    // overflows max-width: 1200px and Material's tab-header pagination
    // never engages — making the entire Analyse page horizontally
    // scrollable. The track constraint lets the tab-group shrink to the
    // viewport so mat-tab-header switches to its scrollable/paginated
    // mode instead.
    //
    // We assert against Angular's compiled component styles
    // (`ɵcmp.styles`) rather than walking `document.styleSheets` — the
    // codebase already uses this pattern (see
    // analysis-teaser-card.component.spec.ts) and it's resilient to
    // jsdom CSSOM quirks.
    const cmpDef = (
      AnalysisPageComponent as unknown as { ɵcmp: { styles: string[] } }
    ).ɵcmp;
    const styles = (cmpDef?.styles ?? []).join(' ');
    expect(styles).toMatch(
      /\.page-wrap[^}]*grid-template-columns:\s*minmax\(\s*0(px)?\s*,\s*1fr\s*\)/
    );
    expect(styles).toMatch(/\.analysis-tabs[^}]*min-width:\s*0/);
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

  it('keeps typeBreakdown in pushup-variant mode while no kinds filter is active', () => {
    const { store } = fixture.componentInstance;
    expect(store.kinds()).toEqual([]);
    const labels = store.typeBreakdown().map((b) => b.label);
    // Locale-aware variant names (German source locale).
    expect(labels).toContain('Standard-Liegestütze');
    expect(labels).toContain('Diamant-Liegestütze');
  });

  it('switches typeBreakdown to kind-mode when a non-pushup kind is selected', () => {
    const { store } = fixture.componentInstance;
    store.setKinds(['abs.situps']);
    // Mock dataset has no exercise entries, so the breakdown collapses to
    // an empty list — no "abs.situps" bucket without source data, no
    // pushup variants either because the filter excludes pushups.
    expect(store.typeBreakdown()).toEqual([]);
  });

  describe('per-category view (activeView / viewFilteredRows)', () => {
    beforeEach(() => {
      liveExerciseEntries.update((entries) => [
        ...entries,
        {
          _id: 'ex-abs',
          userId: 'u1',
          exerciseId: 'abs.situps',
          timestamp: '2026-02-12T08:00:00.000Z',
          reps: 30,
          source: 'web',
        } as ExerciseEntry,
        {
          _id: 'ex-legs',
          userId: 'u1',
          exerciseId: 'legs.squats',
          timestamp: '2026-02-13T08:00:00.000Z',
          reps: 40,
          source: 'web',
        } as ExerciseEntry,
      ]);
      const component = fixture.componentInstance;
      component.store.setRange('2026-02-09', '2026-02-15');
    });

    it('defaults activeView to "overview" so existing behaviour is preserved', () => {
      const { store } = fixture.componentInstance;
      expect(store.activeView()).toBe('overview');
    });

    it('viewFilteredRows returns every unified row in overview mode', () => {
      const { store } = fixture.componentInstance;
      // 6 pushups + 2 exercises in the seeded range
      expect(store.viewFilteredRows()).toHaveLength(8);
    });

    it('setActiveView("abs") narrows viewFilteredRows to abs-category entries only', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('core');
      const rows = store.viewFilteredRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].kind).toBe('exercise');
      expect((rows[0] as { exerciseId?: string }).exerciseId).toBe(
        'abs.situps'
      );
    });

    it('setActiveView("pushup") collapses to pushup entries only', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('pushup');
      const rows = store.viewFilteredRows();
      expect(rows).toHaveLength(6);
      expect(
        rows.every((r) => r.kind === 'exercise' && r.exerciseId === 'pushup')
      ).toBe(true);
    });

    it('setActiveView("legs") narrows to legs-category entries only', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('squat');
      const rows = store.viewFilteredRows();
      expect(rows).toHaveLength(1);
      expect((rows[0] as { exerciseId?: string }).exerciseId).toBe(
        'legs.squats'
      );
    });

    it('returns to all rows when activeView is reset to "overview"', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('core');
      expect(store.viewFilteredRows()).toHaveLength(1);
      store.setActiveView('overview');
      expect(store.viewFilteredRows()).toHaveLength(8);
    });

    it('overview KPIs include exercise entries alongside pushups', () => {
      const { store } = fixture.componentInstance;
      // Overview = 6 pushups (max 25) + 2 exercises (max 40 legs.squats)
      expect(store.bestSingleEntry()?.reps).toBe(40);
      // Best day = Feb 13: 25 reps (pushup id 5) + 40 reps (legs ex)
      expect(store.bestDay()).toEqual({ date: '2026-02-13', total: 65 });
    });

    it('per-category KPIs scope to the active view (abs)', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('core');
      expect(store.bestSingleEntry()?.reps).toBe(30);
      expect(store.bestDay()).toEqual({ date: '2026-02-12', total: 30 });
      // 1 abs entry, no consecutive day → streak length 1
      expect(store.currentStreak()).toBe(1);
      expect(store.longestStreak()).toBe(1);
      // The seeded abs entry has no sets array → distribution stays empty
      expect(store.avgSetSize()).toBe(0);
      expect(store.setsDistribution()).toEqual([]);
      expect(store.bestSingleSet()).toBe(0);
    });

    it('per-category KPIs scope to the active view (pushup)', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('pushup');
      // Same numbers as the original pushup-only tests because the
      // seeded mock is the pushup-only dataset.
      expect(store.bestSingleEntry()?.reps).toBe(25);
      expect(store.bestDay()?.total).toBe(25);
      expect(store.longestStreak()).toBe(5);
      expect(store.avgSetSize()).toBe(7.1);
      expect(store.bestSingleSet()).toBe(10);
    });

    it('KPIs collapse to zero/null when the active view has no entries', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('mobility');
      expect(store.bestSingleEntry()).toBeNull();
      expect(store.bestDay()).toBeNull();
      expect(store.currentStreak()).toBe(0);
      expect(store.longestStreak()).toBe(0);
      expect(store.avgSetSize()).toBe(0);
      expect(store.setsDistribution()).toEqual([]);
      expect(store.bestSingleSet()).toBe(0);
    });

    // The trend windows span 8 ISO weeks / 6 months ending on the
    // locked clock (Sun Feb 15 2026). Every seeded entry lives in
    // 2026-W07 / 2026-02, so the assertions below pick out that
    // single non-empty bucket.
    it('overview week trend aggregates pushups + exercises', () => {
      const { store } = fixture.componentInstance;
      const week = store.weekTrend().find((w) => w.label === '2026-W07');
      // 6 pushups summing 93 reps + 30 abs + 40 legs = 163
      expect(week?.total).toBe(163);
    });

    it('per-category week trend scopes to the active view (abs)', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('core');
      const week = store.weekTrend().find((w) => w.label === '2026-W07');
      expect(week?.total).toBe(30);
    });

    it('per-category month trend scopes to the active view (legs)', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('squat');
      const month = store.monthTrend().find((m) => m.label === '2026-02');
      expect(month?.total).toBe(40);
    });

    it('per-category pushup trend matches the legacy pushup-only totals', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('pushup');
      const week = store.weekTrend().find((w) => w.label === '2026-W07');
      expect(week?.total).toBe(93);
    });

    it('empty-category trends report zero totals across the window', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('mobility');
      expect(store.weekTrend().every((w) => w.total === 0)).toBe(true);
      expect(store.monthTrend().every((m) => m.total === 0)).toBe(true);
    });

    it('categorySummaries lists only categories with entries, sorted by order', () => {
      const { store } = fixture.componentInstance;
      const summaries = store.categorySummaries();
      expect(summaries.map((s) => s.categoryId)).toEqual([
        'pushup',
        'squat',
        'core',
      ]);
    });

    it('categorySummaries surfaces per-category totals, today reps and best day', () => {
      const { store } = fixture.componentInstance;
      const summaries = store.categorySummaries();
      const pushup = summaries.find((s) => s.categoryId === 'pushup');
      expect(pushup?.entries).toBe(6);
      expect(pushup?.volume).toEqual({
        kind: 'reps',
        totalReps: 93,
        // 5+5 + 6+6 + 10+5+5 + 10+8+7 + 9+9 = 12 sets across 5 entries.
        totalSets: 12,
        // System time is Sun Feb 15 2026; only entry id=6 (18 reps) lands today.
        todayReps: 18,
        bestDay: { date: '2026-02-13', total: 25 },
      });
      const abs = summaries.find((s) => s.categoryId === 'core');
      expect(abs?.currentStreak).toBe(1);
      expect(abs?.volume).toEqual({
        kind: 'reps',
        totalReps: 30,
        totalSets: 0,
        todayReps: 0,
        bestDay: { date: '2026-02-12', total: 30 },
      });
      const legs = summaries.find((s) => s.categoryId === 'squat');
      expect(legs?.volume).toMatchObject({
        kind: 'reps',
        totalReps: 40,
        bestDay: { date: '2026-02-13', total: 40 },
      });
    });

    it('categoryComparison projects summaries into chart-friendly arrays with translated labels', () => {
      // Chart bar metric is `entries` — a measurement-agnostic count
      // of logged trainings — so the chart can compare reps-, time-
      // and distance-categories without mixing dimensions on one axis.
      // TestBed defaults to the source locale (de).
      const { store } = fixture.componentInstance;
      const cmp = store.categoryComparison();
      expect(cmp.labels).toEqual(['Liegestütze', 'Kniebeuge', 'Rumpf']);
      // 6 pushups + 1 legs ex + 1 abs ex
      expect(cmp.entries).toEqual([6, 1, 1]);
    });

    it('categorySummaries stays insensitive to the active view (it powers the overview)', () => {
      const { store } = fixture.componentInstance;
      const baseline = store.categorySummaries().map((s) => s.categoryId);
      store.setActiveView('core');
      expect(store.categorySummaries().map((s) => s.categoryId)).toEqual(
        baseline
      );
    });

    it('categorySummaries emits a mixed volume when a category combines reps and time entries', () => {
      // `core` collects both sit-ups (reps) and plank (time). Pre-redesign
      // the roll-up summed `r.reps` across both — pushing plank's true
      // `durationSec` volume into a `0` reps row and showing "0 Reps
      // gesamt" on a card that actually had 3.5 min of plank.
      liveExerciseEntries.set([
        {
          _id: 'ex-abs',
          userId: 'u1',
          exerciseId: 'abs.situps',
          timestamp: '2026-02-12T08:00:00.000Z',
          reps: 30,
          source: 'web',
        } as ExerciseEntry,
        {
          _id: 'ex-plank-1',
          userId: 'u1',
          exerciseId: 'plank.standard',
          timestamp: '2026-02-13T08:00:00.000Z',
          reps: 0,
          durationSec: 90,
          source: 'web',
        } as ExerciseEntry,
        {
          _id: 'ex-plank-2',
          userId: 'u1',
          exerciseId: 'plank.standard',
          timestamp: '2026-02-15T08:00:00.000Z',
          reps: 0,
          durationSec: 120,
          source: 'web',
        } as ExerciseEntry,
      ]);
      const { store } = fixture.componentInstance;
      const summaries = store.categorySummaries();
      const core = summaries.find((s) => s.categoryId === 'core');
      expect(core?.entries).toBe(3);
      expect(core?.volume.kind).toBe('mixed');
      if (core?.volume.kind !== 'mixed') return;
      // Stable facet order: reps before time.
      expect(core.volume.facets.map((f) => f.kind)).toEqual(['reps', 'time']);
      // Facet kinds must stay unique — the card template tracks
      // `@for … track facet.kind`, so duplicates would trigger
      // Angular NG0955 (e.g. if a future `weight`-measurement entry
      // were ever placed alongside reps without collapsing first).
      const kinds = core.volume.facets.map((f) => f.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
      expect(core.volume.facets[0]).toEqual({
        kind: 'reps',
        totalReps: 30,
        totalSets: 0,
        todayReps: 0,
        bestDay: { date: '2026-02-12', total: 30 },
      });
      expect(core.volume.facets[1]).toEqual({
        kind: 'time',
        totalSec: 210,
        // Locked clock is Sun Feb 15 2026 → only the 120 s entry is "today".
        todaySec: 120,
        bestDay: { date: '2026-02-15', totalSec: 120 },
      });
    });

    it('categorySummaries emits a distance-time facet for cardio runs', () => {
      liveExerciseEntries.set([
        {
          _id: 'ex-run-1',
          userId: 'u1',
          exerciseId: 'cardio.running',
          timestamp: '2026-02-13T08:00:00.000Z',
          reps: 0,
          durationSec: 1500,
          distanceM: 5000,
          source: 'web',
        } as ExerciseEntry,
      ]);
      const { store } = fixture.componentInstance;
      const summaries = store.categorySummaries();
      const cardio = summaries.find((s) => s.categoryId === 'cardio');
      expect(cardio?.entries).toBe(1);
      expect(cardio?.volume).toEqual({
        kind: 'distance-time',
        totalM: 5000,
        totalSec: 1500,
        todayM: 0,
        todaySec: 0,
        bestDay: { date: '2026-02-13', totalM: 5000, totalSec: 1500 },
      });
    });

    it('categorySummaries collapses to a single facet when every entry shares one measurement (mobility/time)', () => {
      liveExerciseEntries.set([
        {
          _id: 'ex-mob-1',
          userId: 'u1',
          exerciseId: 'mobility.stretching',
          timestamp: '2026-02-13T08:00:00.000Z',
          reps: 0,
          durationSec: 45,
          source: 'web',
        } as ExerciseEntry,
        {
          _id: 'ex-mob-2',
          userId: 'u1',
          exerciseId: 'mobility.stretching',
          timestamp: '2026-02-14T08:00:00.000Z',
          reps: 0,
          durationSec: 60,
          source: 'web',
        } as ExerciseEntry,
      ]);
      const { store } = fixture.componentInstance;
      const summaries = store.categorySummaries();
      const mobility = summaries.find((s) => s.categoryId === 'mobility');
      expect(mobility?.volume).toEqual({
        kind: 'time',
        totalSec: 105,
        todaySec: 0,
        bestDay: { date: '2026-02-14', totalSec: 60 },
      });
    });

    it('typeBreakdown collapses to the active category in kind mode (abs)', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('core');
      const breakdown = store.typeBreakdown();
      expect(breakdown).toHaveLength(1);
      expect(breakdown[0]).toMatchObject({
        id: 'abs.situps',
        value: 30,
      });
    });

    it('typeBreakdown stays in pushup-variant mode when the active view is pushup', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('pushup');
      const labels = store.typeBreakdown().map((b) => b.label);
      expect(labels).toContain('Standard-Liegestütze');
      expect(labels).toContain('Diamant-Liegestütze');
      // Wide pushups are in the seed (id=4, 8 reps); a non-pushup
      // category would yield none.
      expect(labels).toContain('Weite Liegestütze');
    });

    it('typeBreakdown is empty for a category that has no entries', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('mobility');
      expect(store.typeBreakdown()).toEqual([]);
    });

    it('viewChartSeries aggregates pushups + exercises in overview mode', () => {
      // Regression for the analysis-graph-tab bug: the chart used to
      // bind to `store.chartSeries()` (pushup-only REST series) which
      // ignored exercise entries and never re-aggregated per active
      // view. The new view-scoped computed must include both source
      // collections in overview mode.
      const { store } = fixture.componentInstance;
      const series = store.viewChartSeries();
      const byBucket = new Map(series.map((s) => [s.bucket, s.total]));
      // Feb 12: pushup id=4 (8) + abs sit-ups (30) = 38
      expect(byBucket.get('2026-02-12')).toBe(38);
      // Feb 13: pushup id=5 (25) + legs squats (40) = 65
      expect(byBucket.get('2026-02-13')).toBe(65);
      // dayIntegral on the last bucket totals everything in range
      const last = series[series.length - 1];
      expect(last.dayIntegral).toBe(163);
    });

    it('viewChartSeries narrows to the active category (abs)', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('core');
      const series = store.viewChartSeries();
      expect(series).toEqual([
        { bucket: '2026-02-12', total: 30, dayIntegral: 30 },
      ]);
    });

    it('viewChartSeries narrows to the active category (legs)', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('squat');
      const series = store.viewChartSeries();
      expect(series).toEqual([
        { bucket: '2026-02-13', total: 40, dayIntegral: 40 },
      ]);
    });

    it('viewChartSeries scoped to pushup matches the legacy pushup-only daily totals', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('pushup');
      const series = store.viewChartSeries();
      // Seeded pushups: Feb 9 → 15 with one skipped day, totals
      // [10,12,20,8,25,18] and cumulative dayIntegral [10,22,42,50,75,93].
      expect(series.map((s) => s.bucket)).toEqual([
        '2026-02-09',
        '2026-02-10',
        '2026-02-11',
        '2026-02-12',
        '2026-02-13',
        '2026-02-15',
      ]);
      expect(series.map((s) => s.total)).toEqual([10, 12, 20, 8, 25, 18]);
      expect(series.map((s) => s.dayIntegral)).toEqual([
        10, 22, 42, 50, 75, 93,
      ]);
    });

    it('viewChartSeries collapses to an empty array for a category with no entries', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('mobility');
      expect(store.viewChartSeries()).toEqual([]);
    });

    it('viewGranularity tracks from===to without waiting on the REST resource', () => {
      // The REST-backed `granularity()` lags the resource during cold
      // start / filter swaps; `viewGranularity()` must derive the mode
      // from the page filter directly so the chart's axis stays in
      // lockstep with `viewChartSeries()` bucketing.
      const { store } = fixture.componentInstance;
      expect(store.viewGranularity()).toBe('daily');
      store.setRange('2026-02-12', '2026-02-12');
      expect(store.viewGranularity()).toBe('hourly');
      store.setRange('2026-02-09', '2026-02-15');
      expect(store.viewGranularity()).toBe('daily');
    });

    it('viewChartSeries switches to hourly buckets when the page filter is a single day', () => {
      // Single-day ranges flip the API to hourly granularity. The
      // view-scoped chart must mirror that bucketing on view-filtered
      // rows so the per-category tab still renders a populated chart
      // for that day. Exact hour placement depends on the runner's
      // timezone (the seeded abs entry is in UTC), so we assert the
      // shape and the total — both timezone-agnostic.
      const { store } = fixture.componentInstance;
      store.setRange('2026-02-12', '2026-02-12');
      store.setActiveView('core');
      store.setDayChartMode('24h');
      const series = store.viewChartSeries();
      expect(series).toHaveLength(24);
      // All 24 buckets sum to the single abs entry's reps.
      expect(series.reduce((acc, s) => acc + s.total, 0)).toBe(30);
      // Final cumulative dayIntegral equals the day's total.
      expect(series[series.length - 1].dayIntegral).toBe(30);
    });

    it('viewChartSeries collapses 00-07 into a single night bucket in 14h mode', () => {
      // 14h mode mirrors `StatsApiService.toStatsResponse`: one night
      // bucket "00-07" followed by hours 8..21 → 15 buckets total.
      // CI runs in UTC, so the abs entry's hour (08:00 UTC) lands in
      // the 08 slot, keeping the day's reps inside the 14h window.
      const { store } = fixture.componentInstance;
      store.setRange('2026-02-12', '2026-02-12');
      store.setActiveView('core');
      store.setDayChartMode('14h');
      const series = store.viewChartSeries();
      expect(series).toHaveLength(15);
      expect(series[0]).toMatchObject({ bucketLabel: '00-07' });
      expect(series[series.length - 1].dayIntegral).toBe(30);
    });

    it('viewChartEntries shapes view-filtered rows for the chart sets-stacking layer', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('core');
      const entries = store.viewChartEntries();
      expect(entries).toEqual([
        { timestamp: '2026-02-12T08:00:00.000Z', reps: 30 },
      ]);
    });

    it('viewChartEntries preserves the sets array on entries that have one', () => {
      // The chart's stacked-bar layer keys off `entry.sets[]` to colour
      // the "with sets" portion separately. If the store dropped the
      // array on the way through, every pushup tab would silently lose
      // its purple "Mit Sets" segment.
      const { store } = fixture.componentInstance;
      store.setActiveView('pushup');
      const entries = store.viewChartEntries();
      expect(
        entries.some((e) => Array.isArray(e.sets) && e.sets.length > 1)
      ).toBe(true);
    });

    describe('custom-exercise resolver', () => {
      // `mobility` is in the picker but the parent `beforeEach` seeds
      // no mobility rows, so it isolates the contribution of the
      // custom definition from the catalog rows already in scope.
      const customDef: ExerciseDefinition = {
        id: 'custom.foam-roll',
        categoryId: 'mobility',
        ownerId: 'u1',
        measurement: 'reps',
        min: 1,
        max: 500,
        unit: 'reps',
        customName: 'Foam Rolling',
      };

      beforeEach(() => {
        liveExerciseEntries.update((entries) => [
          ...entries,
          {
            _id: 'ex-custom',
            userId: 'u1',
            exerciseId: 'custom.foam-roll',
            timestamp: '2026-02-14T08:00:00.000Z',
            reps: 50,
            source: 'web',
          } as ExerciseEntry,
        ]);
      });

      it('drops custom-exercise rows from per-category tabs without a resolver', () => {
        const { store } = fixture.componentInstance;
        store.setActiveView('mobility');
        expect(
          store
            .viewFilteredRows()
            .some(
              (r) =>
                r.kind === 'exercise' && r.exerciseId === 'custom.foam-roll'
            )
        ).toBe(false);
      });

      it('routes custom-exercise rows into the user-defined category when the definition is exposed', () => {
        liveExerciseDefinitions.set([customDef]);
        const { store } = fixture.componentInstance;
        store.setActiveView('mobility');
        expect(
          store
            .viewFilteredRows()
            .some(
              (r) =>
                r.kind === 'exercise' && r.exerciseId === 'custom.foam-roll'
            )
        ).toBe(true);
      });

      it('feeds custom-exercise reps into categorySummaries via the resolver', () => {
        liveExerciseDefinitions.set([customDef]);
        const { store } = fixture.componentInstance;
        const mobility = store
          .categorySummaries()
          .find((s) => s.categoryId === 'mobility');
        expect(mobility?.entries).toBe(1);
        expect(mobility?.volume).toMatchObject({
          kind: 'reps',
          totalReps: 50,
        });
      });

      it('extends the per-category week trend to include custom-exercise reps', () => {
        liveExerciseDefinitions.set([customDef]);
        const { store } = fixture.componentInstance;
        store.setActiveView('mobility');
        const week = store.weekTrend().find((w) => w.label === '2026-W07');
        expect(week?.total).toBe(50);
      });

      it('lets the catalog win on id collision with a user-defined definition', () => {
        // The standard catalog maps `legs.squats` to `squat`. A
        // user-defined definition reusing the id with a different
        // category must not steal the row.
        liveExerciseDefinitions.set([
          {
            ...customDef,
            id: 'legs.squats',
            categoryId: 'mobility',
          },
        ]);
        const { store } = fixture.componentInstance;
        store.setActiveView('mobility');
        expect(
          store
            .viewFilteredRows()
            .some(
              (r) => r.kind === 'exercise' && r.exerciseId === 'legs.squats'
            )
        ).toBe(false);
      });
    });

    it('typeBreakdownDisplay localises kind-mode ids when activeView scopes to a non-pushup category', () => {
      // Regression for codex P2: setActiveView('core') without an
      // explicit kinds filter puts the store in kind-mode and emits
      // raw ids like `abs.situps`. The display mapper must mirror the
      // store's gate and localise — otherwise the pie legend reads
      // like a developer string.
      const { store } = fixture.componentInstance;
      store.setActiveView('core');
      fixture.detectChanges();
      const groupView = fixture.debugElement.query(
        By.directive(AnalysisGroupViewComponent)
      ).componentInstance as AnalysisGroupViewComponent;
      const breakdown = groupView.typeBreakdownDisplay();
      expect(breakdown).toHaveLength(1);
      expect(breakdown[0]).toMatchObject({
        id: 'abs.situps',
        label: 'Sit-ups',
      });
    });
  });

  describe('tabs + URL sync', () => {
    it('shows only the Overview tab plus one tab per category with entries', () => {
      const component = fixture.componentInstance;
      // Seeded dataset has only pushup entries → one visible category tab,
      // routed under the `push` movement-pattern category.
      expect(component.visibleTabs().map((t) => t.id)).toEqual(['pushup']);

      liveExerciseEntries.update((entries) => [
        ...entries,
        {
          _id: 'e1',
          userId: 'u1',
          exerciseId: 'abs.situps',
          timestamp: '2026-02-12T08:00:00.000Z',
          reps: 30,
          source: 'web',
        } as ExerciseEntry,
        {
          _id: 'e2',
          userId: 'u1',
          exerciseId: 'legs.squats',
          timestamp: '2026-02-13T08:00:00.000Z',
          reps: 40,
          source: 'web',
        } as ExerciseEntry,
      ]);
      component.store.setRange('2026-02-09', '2026-02-15');
      fixture.detectChanges();

      // Order follows EXERCISE_CATEGORIES.order
      // (pushup=5, squat=30, core=70 → legs.squats → squat, abs.situps → core).
      expect(component.visibleTabs().map((t) => t.id)).toEqual([
        'pushup',
        'squat',
        'core',
      ]);
    });

    it('switches activeView when a tab is selected', () => {
      const component = fixture.componentInstance;
      // Overview = 0, push tab = 1 (the only category visible by default).
      component.onTabIndexChange(1);
      expect(component.store.activeView()).toBe('pushup');

      component.onTabIndexChange(0);
      expect(component.store.activeView()).toBe('overview');
    });

    it('maps activeView back to the matching tab index for the mat-tab-group binding', () => {
      const component = fixture.componentInstance;
      component.store.setActiveView('pushup');
      expect(component.selectedTabIndex()).toBe(1);
      component.store.setActiveView('overview');
      expect(component.selectedTabIndex()).toBe(0);
    });

    it('preserves the active category tab when the filter shifts to a range with no entries for that category', () => {
      // Regression: walking the filter forward/back used to drop the
      // tab back to Overview the moment the new range fell outside the
      // active category's entries — `categorySummaries()` shrunk,
      // `selectedTabIndex()` defaulted to 0, mat-tab-group fired
      // `selectedIndexChange(0)`, and `onTabIndexChange(0)` clobbered
      // `activeView`. The fix pins the active category in `visibleTabs`
      // so the index keeps pointing at it.
      const component = fixture.componentInstance;
      component.store.setActiveView('pushup');
      expect(component.store.activeView()).toBe('pushup');

      // Shift the range somewhere with zero pushup entries. The seeded
      // mock only has data in Feb 9–15 2026, so January is empty.
      component.store.setRange('2026-01-05', '2026-01-11');
      fixture.detectChanges();

      expect(component.store.activeView()).toBe('pushup');
      expect(component.visibleTabs().map((t) => t.id)).toContain('pushup');
      const pushupIdx = component
        .visibleTabs()
        .findIndex((t) => t.id === 'pushup');
      expect(component.selectedTabIndex()).toBe(pushupIdx + 1);
    });

    it('keeps the active category tab visible even when it has no entries in the current range', () => {
      // Regression: when the user shifts the filter past the last entry
      // in their active category, the tab used to fall back to Overview
      // and the user lost their selection. The tab must stay pinned and
      // the body surfaces a "Keine Einträge im gewählten Zeitraum"
      // notice instead, so navigating back and forth in the filter is
      // non-destructive.
      const component = fixture.componentInstance;
      component.store.setActiveView('mobility');
      fixture.detectChanges();
      expect(component.visibleTabs().some((t) => t.id === 'mobility')).toBe(
        true
      );
      const mobilityIdx = component
        .visibleTabs()
        .findIndex((t) => t.id === 'mobility');
      expect(component.selectedTabIndex()).toBe(mobilityIdx + 1);
    });

    it('selecting an overview card emits the category and switches the active view', () => {
      const component = fixture.componentInstance;
      component.onOverviewSelect('pushup');
      expect(component.store.activeView()).toBe('pushup');
    });

    it('renders a mat-tab-group with the Overview tab plus the visible categories', () => {
      fixture.detectChanges();
      const host: HTMLElement = fixture.nativeElement;
      const tabGroup = host.querySelector('[data-testid="analysis-tabs"]');
      expect(tabGroup).toBeTruthy();
      const overviewTab = host.querySelector(
        '[data-testid="analysis-tab-overview"]'
      );
      const pushupTab = host.querySelector(
        '[data-testid="analysis-tab-pushup"]'
      );
      expect(overviewTab).toBeTruthy();
      expect(pushupTab).toBeTruthy();
    });
  });
});

describe('AnalysisPageComponent empty-state CTA gating', () => {
  // `showEmptyCta` must stay hidden when not yet connected (data still
  // loading), then surface once connected with an empty dataset.
  let fixture: ComponentFixture<AnalysisPageComponent>;
  const liveConnectedCta = signal(false);

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
    liveConnectedCta.set(false);
    await TestBed.configureTestingModule({
      imports: [AnalysisPageComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        provideRouter([]),
        { provide: StatsApiService, useValue: emptyApiMock },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
        { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
        {
          provide: LiveDataStore,
          useValue: {
            connected: liveConnectedCta,
            entries: signal([]),
            exerciseEntries: signal([]),
            exerciseDefinitions: signal([]),
            updateTick: signal(0),
          },
        },
        {
          provide: UserStatsApiService,
          useValue: {
            getUserStats: vitest.fn().mockReturnValue(of(null)),
          },
        },
      ],
    })
      .overrideComponent(AnalysisPageComponent, {
        remove: { imports: [FilterBarComponent] },
        add: { imports: [MockFilterBarComponent] },
      })
      .overrideComponent(AnalysisGroupViewComponent, {
        remove: {
          imports: [
            HeatmapComponent,
            TypePieComponent,
            StatsChartComponent,
            SetsDistributionComponent,
          ],
        },
        add: {
          imports: [
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

  it('hides the empty-state CTA while not yet connected (data still loading)', () => {
    // `connected=false` means the live data store hasn't established its
    // WebSocket yet; `showEmptyCta` short-circuits to false so the CTA
    // doesn't flash before the first payload arrives.
    expect(fixture.componentInstance.showEmptyCta()).toBe(false);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('[data-testid="analysis-empty-cta"]')).toBeNull();
  });

  it('renders the empty-state CTA after connecting with no data', async () => {
    liveConnectedCta.set(true);
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

  // Locked clock so the future-dated page filter stays after `today` and
  // the trend window stays before it, regardless of the real wall clock.
  const FROZEN_NOW = new Date(2026, 4, 8, 12); // Fri May 8 2026
  const PAGE_FILTER_FROM = '2026-12-01';

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
      // The page filter (rows resource) gets the explicit far-future
      // range; the fixed trend windows always start before the page
      // filter, so distinguish the two by exact prefix instead of a
      // wall-clock comparison.
      if (params.from === PAGE_FILTER_FROM) return of([]);
      const recent = new Date(
        FROZEN_NOW.getFullYear(),
        FROZEN_NOW.getMonth(),
        1
      );
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
    vitest.useFakeTimers({ toFake: ['Date'] });
    vitest.setSystemTime(FROZEN_NOW);

    await TestBed.configureTestingModule({
      imports: [AnalysisPageComponent],
      providers: [
        provideRouter([]),
        { provide: StatsApiService, useValue: splitApiMock },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
        { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
        {
          provide: LiveDataStore,
          useValue: {
            connected: signal(true),
            entries: signal([]),
            exerciseEntries: signal([
              {
                _id: 'h1',
                userId: 'u1',
                exerciseId: 'pushup',
                // May 1 2026 is within the 8-week trend window ending
                // FROZEN_NOW (May 8), but outside the Dec 2026 page filter.
                timestamp: new Date(
                  FROZEN_NOW.getFullYear(),
                  FROZEN_NOW.getMonth(),
                  1
                ).toISOString(),
                reps: 30,
                sets: [10, 10, 10],
                source: 'web',
              },
            ]),
            exerciseDefinitions: signal([]),
            updateTick: signal(0),
          },
        },
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
    fixture.componentInstance.store.setRange(PAGE_FILTER_FROM, '2026-12-07');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    vitest.useRealTimers();
  });

  it('hides the empty CTA when fixed-window trends have data', () => {
    expect(fixture.componentInstance.store.unifiedRows().length).toBe(0);
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
          provide: LiveDataStore,
          useValue: {
            connected: signal(true),
            entries: signal([]),
            exerciseEntries: signal([]),
            exerciseDefinitions: signal([]),
            updateTick: signal(0),
          },
        },
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

  it('weekTrend emits buckets newest → oldest', async () => {
    await createAt(new Date(2026, 0, 14, 12)); // Wed Jan 14 2026, ISO W03
    const labels = fixture.componentInstance.store
      .weekTrend()
      .map((w) => w.label);
    expect(labels).toEqual([
      '2026-W03',
      '2026-W02',
      '2026-W01',
      '2025-W52',
      '2025-W51',
      '2025-W50',
      '2025-W49',
      '2025-W48',
    ]);
  });

  it('monthTrend emits buckets newest → oldest', async () => {
    await createAt(new Date(2026, 0, 14, 12)); // Jan 2026
    const labels = fixture.componentInstance.store
      .monthTrend()
      .map((m) => m.label);
    expect(labels).toEqual([
      '2026-01',
      '2025-12',
      '2025-11',
      '2025-10',
      '2025-09',
      '2025-08',
    ]);
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
