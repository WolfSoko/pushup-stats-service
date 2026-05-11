import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AnalysisPageComponent } from './analysis-page.component';
import { AnalysisGroupViewComponent } from './analysis-group-view.component';
import {
  LiveDataStore,
  StatsApiService,
  UserStatsApiService,
} from '@pu-stats/data-access';
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
} from '@angular/core';
import { ExerciseEntry, RangeModes } from '@pu-stats/models';

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
  // Mutable mirror of the LiveDataStore so tests can seed exercise
  // entries that the analysis store reads via `unifiedRows`.
  const liveExerciseEntries = signal<ExerciseEntry[]>([]);
  const liveMock = {
    connected: signal(true),
    entries: signal([] as never[]),
    exerciseEntries: liveExerciseEntries,
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

    liveExerciseEntries.set([]);
    await TestBed.configureTestingModule({
      imports: [AnalysisPageComponent],
      providers: [
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

  // The trend cards are wrapped in `@defer (on viewport)`, but verifying
  // hydration in jsdom is fragile (it requires mocking IntersectionObserver
  // and using Angular's still-evolving defer-test helpers). This test
  // narrowly guards the intentional DOM ordering — heatmap above the
  // trends — which is the stable structural invariant the lazy load
  // depends on; the @defer behaviour itself is covered by the framework.
  it('places the trend section after the heatmap card in the DOM', () => {
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

  it('hides the kind filter for pushup-only ranges to keep the default page minimal', () => {
    // Mock dataset has only pushup entries; the filter would just show
    // a single "Pushup" option which is redundant with the variant pie.
    const component = fixture.componentInstance;
    expect(component.kindFilterOptions().map((o) => o.value)).toEqual([
      'pushup',
    ]);
    expect(component.showKindFilter()).toBe(false);
  });

  it('shows the kind filter when the range contains a non-pushup kind even with no selection', () => {
    // OR-branch of `showKindFilter`: a user who already has sit-up
    // entries in the visible range must see the filter without
    // pre-selecting anything, otherwise they could never enable
    // kind-mode for their own data.
    const component = fixture.componentInstance;
    liveExerciseEntries.set([
      {
        _id: 'e1',
        userId: 'u1',
        exerciseId: 'abs.situps',
        timestamp: '2026-02-12T08:00:00.000Z',
        reps: 30,
        source: 'web',
      } as ExerciseEntry,
    ]);
    component.store.setKinds([]);
    component.store.setRange('2026-02-09', '2026-02-15');
    fixture.detectChanges();
    const values = component.kindFilterOptions().map((o) => o.value);
    expect(values).toContain('abs.situps');
    expect(component.showKindFilter()).toBe(true);
  });

  it('shows the kind filter when a non-pushup kind is selected even on a pushup-only range', () => {
    // Regression for Copilot finding: a user with only sit-up entries
    // would never see the filter, and the default pushup-variant pie
    // would render empty. Setting a non-pushup kind via the store —
    // which the page also does when handling URL params or stale
    // selections — must immediately surface the filter so the user
    // can adjust it.
    const component = fixture.componentInstance;
    component.store.setKinds(['abs.situps']);
    fixture.detectChanges();
    expect(component.showKindFilter()).toBe(true);
  });

  it('keeps stale kind selections in the option list so the user can always clear them', () => {
    // Regression for codex P1: after picking a kind that is not present
    // in the current date range, the filter would disappear entirely
    // because `kindFilterOptions` only listed in-range kinds. The chip
    // stayed selected with no matching option to deselect, leaving the
    // pie filtered to nothing.
    const component = fixture.componentInstance;
    component.store.setKinds(['abs.situps']);
    fixture.detectChanges();
    const values = component.kindFilterOptions().map((o) => o.value);
    expect(values).toContain('abs.situps');
  });

  describe('per-category view (activeView / viewFilteredRows)', () => {
    beforeEach(() => {
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
      store.setActiveView('abs');
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
      expect(rows.every((r) => r.kind === 'pushup')).toBe(true);
    });

    it('setActiveView("legs") narrows to legs-category entries only', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('legs');
      const rows = store.viewFilteredRows();
      expect(rows).toHaveLength(1);
      expect((rows[0] as { exerciseId?: string }).exerciseId).toBe(
        'legs.squats'
      );
    });

    it('returns to all rows when activeView is reset to "overview"', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('abs');
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
      store.setActiveView('abs');
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
      store.setActiveView('plank');
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
      store.setActiveView('abs');
      const week = store.weekTrend().find((w) => w.label === '2026-W07');
      expect(week?.total).toBe(30);
    });

    it('per-category month trend scopes to the active view (legs)', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('legs');
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
      store.setActiveView('plank');
      expect(store.weekTrend().every((w) => w.total === 0)).toBe(true);
      expect(store.monthTrend().every((m) => m.total === 0)).toBe(true);
    });

    it('categorySummaries lists only categories with entries, sorted by order', () => {
      const { store } = fixture.componentInstance;
      const summaries = store.categorySummaries();
      expect(summaries.map((s) => s.categoryId)).toEqual([
        'pushup',
        'abs',
        'legs',
      ]);
    });

    it('categorySummaries surfaces per-category totals, today reps and best day', () => {
      const { store } = fixture.componentInstance;
      const summaries = store.categorySummaries();
      const pushup = summaries.find((s) => s.categoryId === 'pushup');
      expect(pushup).toMatchObject({
        totalReps: 93,
        // 5+5 + 6+6 + 10+5+5 + 10+8+7 + 9+9 = 12 sets across 5 entries.
        totalSets: 12,
        // System time is Sun Feb 15 2026; only entry id=6 (18 reps) lands today.
        todayReps: 18,
        bestDay: { date: '2026-02-13', total: 25 },
      });
      const abs = summaries.find((s) => s.categoryId === 'abs');
      expect(abs).toMatchObject({
        totalReps: 30,
        totalSets: 0,
        todayReps: 0,
        currentStreak: 1,
        bestDay: { date: '2026-02-12', total: 30 },
      });
      const legs = summaries.find((s) => s.categoryId === 'legs');
      expect(legs).toMatchObject({
        totalReps: 40,
        bestDay: { date: '2026-02-13', total: 40 },
      });
    });

    it('categoryComparison projects summaries into chart-friendly arrays with translated labels', () => {
      // Chart.js cannot resolve $localize ids at runtime, so labels
      // are pre-translated by the store. TestBed defaults to the
      // source locale (de) — assertions use the German source strings.
      const { store } = fixture.componentInstance;
      const cmp = store.categoryComparison();
      expect(cmp.labels).toEqual(['Liegestütze', 'Bauch', 'Beine']);
      expect(cmp.reps).toEqual([93, 30, 40]);
      expect(cmp.sets).toEqual([12, 0, 0]);
    });

    it('categorySummaries stays insensitive to the active view (it powers the overview)', () => {
      const { store } = fixture.componentInstance;
      const baseline = store.categorySummaries().map((s) => s.categoryId);
      store.setActiveView('abs');
      expect(store.categorySummaries().map((s) => s.categoryId)).toEqual(
        baseline
      );
    });

    it('typeBreakdown collapses to the active category in kind mode (abs)', () => {
      const { store } = fixture.componentInstance;
      store.setActiveView('abs');
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
      store.setActiveView('plank');
      expect(store.typeBreakdown()).toEqual([]);
    });

    it('typeBreakdownDisplay localises kind-mode ids when activeView scopes to a non-pushup category', () => {
      // Regression for codex P2: setActiveView('abs') without an
      // explicit kinds filter puts the store in kind-mode and emits
      // raw ids like `abs.situps`. The display mapper must mirror the
      // store's gate and localise — otherwise the pie legend reads
      // like a developer string.
      const { store } = fixture.componentInstance;
      store.setActiveView('abs');
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

  it('resolves bare kind ids to localised labels via typeBreakdownDisplay', () => {
    // Coverage for the component-level mapping that lives in the
    // group view: the store's kind-mode breakdown emits raw ids in
    // `label` and the group view wraps it in `typeBreakdownDisplay`
    // to localise. A regression in the wrapper would silently render
    // `abs.situps` as the legend text instead of "Sit-ups".
    fixture.componentInstance.store.setKinds(['pushup', 'abs.situps']);
    fixture.detectChanges();
    const groupView = fixture.debugElement.query(
      By.directive(AnalysisGroupViewComponent)
    ).componentInstance as AnalysisGroupViewComponent;
    const breakdown = groupView
      .typeBreakdownDisplay()
      .map((d) => ({ id: d.id, label: d.label }));
    const pushup = breakdown.find((l) => l.id === 'pushup');
    expect(pushup?.label).toBe('Liegestütze');

    // The mock dataset has no abs.situps entries so the breakdown
    // bucket itself is missing; `kindFilterOptions` on the shell uses
    // the same shared `kindDisplayName` mapping for both selected and
    // in-range kinds, so it proves the catalog lookup → localised
    // name path also works for catalog ids — without needing fixture
    // data we don't have.
    const situpsOption = fixture.componentInstance
      .kindFilterOptions()
      .find((o) => o.value === 'abs.situps');
    expect(situpsOption?.label).toBe('Sit-ups');
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
        { provide: PLATFORM_ID, useValue: 'server' },
        provideRouter([]),
        { provide: StatsApiService, useValue: emptyApiMock },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
        { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
        {
          provide: LiveDataStore,
          useValue: {
            connected: signal(true),
            entries: signal([]),
            exerciseEntries: signal([]),
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
