import { Component, input, model, PLATFORM_ID, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import {
  LiveDataStore,
  StatsApiService,
  UserStatsApiService,
} from '@pu-stats/data-access';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { makeAuthStoreMock } from '@pu-stats/testing';
import { ExerciseEntry, RangeModes } from '@pu-stats/models';

import { AnalysisStore } from '../analysis.store';
import { AnalysisGroupViewComponent } from './analysis-group-view.component';
import { HeatmapComponent } from '../components/heatmap/heatmap.component';
import { TypePieComponent } from '../components/type-pie/type-pie.component';
import { StatsChartComponent } from '../components/stats-chart/stats-chart.component';
import { SetsDistributionComponent } from '../components/sets-distribution/sets-distribution.component';

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
  readonly rangeMode = input<RangeModes>('week' as RangeModes);
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
  template: '',
})
class MockSetsDistributionComponent {
  readonly data = input<unknown[]>([]);
}

// Wraps the group-view in a provider context so its `inject(AnalysisStore)`
// resolves without going through the analysis-page shell (and its
// mat-tab-group, which doesn't hydrate its lazy body template reliably
// under PLATFORM_ID=server in jsdom). Tests can manipulate the store
// directly to drive view filters.
@Component({
  selector: 'app-host',
  standalone: true,
  imports: [AnalysisGroupViewComponent],
  providers: [AnalysisStore],
  template: '<app-analysis-group-view />',
})
class HostComponent {}

describe('AnalysisGroupViewComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
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
          entries: 1,
          days: 1,
          total: 25,
          granularity: 'daily',
        },
        series: [],
      })
    ),
    listPushups: vitest.fn().mockReturnValue(
      of([
        {
          _id: '1',
          timestamp: '2026-02-13T08:00:00',
          reps: 25,
          sets: [10, 8, 7],
          source: 'web',
          type: 'Standard',
        },
      ])
    ),
  };

  beforeEach(async () => {
    vitest.useFakeTimers({ toFake: ['Date'] });
    vitest.setSystemTime(new Date(2026, 1, 15, 12));
    liveExerciseEntries.set([]);

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
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

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    vitest.useRealTimers();
  });

  it('renders fixed-window labels for trend cards', () => {
    const host: HTMLElement = fixture.nativeElement;
    const trends = host.querySelector(
      '[data-testid="analysis-trends-section"]'
    );
    expect(trends?.textContent).toContain('Wochentrend');
    expect(trends?.textContent).toContain('Letzte 8 Wochen');
    expect(trends?.textContent).toContain('Monatstrend');
    expect(trends?.textContent).toContain('Letzte 6 Monate');
  });

  it('places the trend section after the heatmap card in the DOM', () => {
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

  it('places the heatmap reps/sets toggle inside the heatmap card header so the mobile stacked layout applies', () => {
    const host: HTMLElement = fixture.nativeElement;

    const heatmapCard = host.querySelector('.heatmap-full');
    expect(heatmapCard).toBeTruthy();

    const headerToggle = heatmapCard?.querySelector(
      'mat-card-header .heatmap-toggle'
    );
    expect(headerToggle).toBeTruthy();
    expect(headerToggle?.tagName.toLowerCase()).toBe('mat-button-toggle-group');
  });

  it('viewChartSeries includes durationSec for time-measured exercises (regression: planks rendered as zero-height bars)', async () => {
    // Regression: time-measured exercises (`plank.standard`,
    // `core.hollowhold`, …) store their primary value on
    // `durationSec`, not `reps`. The chart aggregation used to sum
    // `row.reps` unconditionally, which made these entries surface as
    // zero on the analysis graph — the user-visible bug.
    liveExerciseEntries.set([
      {
        _id: 'e1',
        userId: 'u1',
        exerciseId: 'plank.standard',
        timestamp: '2026-02-10T08:00:00.000Z',
        durationSec: 60,
        source: 'web',
      } as ExerciseEntry,
      {
        _id: 'e2',
        userId: 'u1',
        exerciseId: 'plank.standard',
        timestamp: '2026-02-12T09:00:00.000Z',
        durationSec: 90,
        source: 'web',
      } as ExerciseEntry,
    ]);
    const groupViewEl = fixture.debugElement.query(
      By.directive(AnalysisGroupViewComponent)
    );
    const store = groupViewEl.injector.get(AnalysisStore);
    store.setRange('2026-02-09', '2026-02-15');
    store.setActiveView('core');
    fixture.detectChanges();
    await fixture.whenStable();

    const series = store.viewChartSeries();
    const totals = Object.fromEntries(series.map((s) => [s.bucket, s.total]));
    expect(totals['2026-02-10']).toBe(60);
    expect(totals['2026-02-12']).toBe(90);
  });

  it('viewMeasurement reports "time" for a plank-only view so the chart knows the unit', async () => {
    liveExerciseEntries.set([
      {
        _id: 'e1',
        userId: 'u1',
        exerciseId: 'plank.standard',
        timestamp: '2026-02-10T08:00:00.000Z',
        durationSec: 60,
        source: 'web',
      } as ExerciseEntry,
    ]);
    const groupViewEl = fixture.debugElement.query(
      By.directive(AnalysisGroupViewComponent)
    );
    const store = groupViewEl.injector.get(AnalysisStore);
    store.setRange('2026-02-09', '2026-02-15');
    store.setActiveView('core');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.viewMeasurement()).toBe('time');
  });

  it('viewMeasurement collapses to "mixed" when a category contains different measurements', async () => {
    liveExerciseEntries.set([
      {
        _id: 'e1',
        userId: 'u1',
        exerciseId: 'abs.situps',
        timestamp: '2026-02-10T08:00:00.000Z',
        reps: 30,
        source: 'web',
      } as ExerciseEntry,
      {
        _id: 'e2',
        userId: 'u1',
        exerciseId: 'plank.standard',
        timestamp: '2026-02-11T08:00:00.000Z',
        durationSec: 60,
        source: 'web',
      } as ExerciseEntry,
    ]);
    const groupViewEl = fixture.debugElement.query(
      By.directive(AnalysisGroupViewComponent)
    );
    const store = groupViewEl.injector.get(AnalysisStore);
    store.setRange('2026-02-09', '2026-02-15');
    store.setActiveView('core');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.viewMeasurement()).toBe('mixed');
  });

  it('viewChartSeries scales distance entries from meters to km so the bar axis reads naturally', async () => {
    // Regression: distance-measured runs are stored in meters
    // (`distanceM: 5000`). Showing 5000 on the chart axis is awkward —
    // the store divides by 1000 so the bar shows 5 (km) and the
    // legend's "(km)" unit lines up.
    liveExerciseEntries.set([
      {
        _id: 'e1',
        userId: 'u1',
        exerciseId: 'cardio.running',
        timestamp: '2026-02-10T08:00:00.000Z',
        distanceM: 5000,
        durationSec: 1500,
        source: 'web',
      } as ExerciseEntry,
    ]);
    const groupViewEl = fixture.debugElement.query(
      By.directive(AnalysisGroupViewComponent)
    );
    const store = groupViewEl.injector.get(AnalysisStore);
    store.setRange('2026-02-09', '2026-02-15');
    store.setActiveView('cardio');
    fixture.detectChanges();
    await fixture.whenStable();

    const series = store.viewChartSeries();
    const totals = Object.fromEntries(series.map((s) => [s.bucket, s.total]));
    expect(totals['2026-02-10']).toBe(5);
  });

  it('viewPaceSeries returns min/km pace for distance-time entries, aligned with the bar buckets', async () => {
    // 5 km in 25 min → 5 min/km
    liveExerciseEntries.set([
      {
        _id: 'e1',
        userId: 'u1',
        exerciseId: 'cardio.running',
        timestamp: '2026-02-10T08:00:00.000Z',
        distanceM: 5000,
        durationSec: 1500,
        source: 'web',
      } as ExerciseEntry,
    ]);
    const groupViewEl = fixture.debugElement.query(
      By.directive(AnalysisGroupViewComponent)
    );
    const store = groupViewEl.injector.get(AnalysisStore);
    store.setRange('2026-02-09', '2026-02-15');
    store.setActiveView('cardio');
    fixture.detectChanges();
    await fixture.whenStable();

    const pace = store.viewPaceSeries();
    const entry = pace.find((p) => p.bucket === '2026-02-10');
    expect(entry).toBeDefined();
    expect(entry?.pace).toBeCloseTo(5, 5);
  });

  it('viewPaceSeries returns pace=null for distance entries without duration so the chart does not render a bogus zero-pace line', async () => {
    // Regression for a distance-only carry exercise (or a future
    // `distance` exercise with no paired duration): totalSec stays 0,
    // so dividing by it would produce pace=0. The chart's paceMode()
    // would flip true on the non-null value and we'd show an
    // impossible "0 min/km" line in place of the day integral.
    liveExerciseEntries.set([
      {
        _id: 'e1',
        userId: 'u1',
        exerciseId: 'cardio.running',
        timestamp: '2026-02-10T08:00:00.000Z',
        distanceM: 5000,
        // durationSec deliberately omitted
        source: 'web',
      } as ExerciseEntry,
    ]);
    const groupViewEl = fixture.debugElement.query(
      By.directive(AnalysisGroupViewComponent)
    );
    const store = groupViewEl.injector.get(AnalysisStore);
    store.setRange('2026-02-09', '2026-02-15');
    store.setActiveView('cardio');
    fixture.detectChanges();
    await fixture.whenStable();

    const entry = store.viewPaceSeries().find((p) => p.bucket === '2026-02-10');
    expect(entry?.pace).toBeNull();
  });

  it('viewPaceSeries is empty for non-distance views (reps/time) — the chart keeps the day-integral line', async () => {
    liveExerciseEntries.set([
      {
        _id: 'e1',
        userId: 'u1',
        exerciseId: 'plank.standard',
        timestamp: '2026-02-10T08:00:00.000Z',
        durationSec: 60,
        source: 'web',
      } as ExerciseEntry,
    ]);
    const groupViewEl = fixture.debugElement.query(
      By.directive(AnalysisGroupViewComponent)
    );
    const store = groupViewEl.injector.get(AnalysisStore);
    store.setRange('2026-02-09', '2026-02-15');
    store.setActiveView('core');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.viewPaceSeries()).toEqual([]);
  });

  it('viewChartEntries surfaces durationSec on `reps` for time-measured rows so the stacked-bar layer also sees the volume', async () => {
    liveExerciseEntries.set([
      {
        _id: 'e1',
        userId: 'u1',
        exerciseId: 'plank.standard',
        timestamp: '2026-02-10T08:00:00.000Z',
        durationSec: 75,
        source: 'web',
      } as ExerciseEntry,
    ]);
    const groupViewEl = fixture.debugElement.query(
      By.directive(AnalysisGroupViewComponent)
    );
    const store = groupViewEl.injector.get(AnalysisStore);
    store.setRange('2026-02-09', '2026-02-15');
    store.setActiveView('core');
    fixture.detectChanges();
    await fixture.whenStable();

    const entries = store.viewChartEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].reps).toBe(75);
  });

  it('renders the "Keine Einträge im gewählten Zeitraum" notice when the active category has no entries in the range', async () => {
    // Regression: when the user shifts the filter past the last entry
    // in their active category, the tab body needs an explicit empty
    // copy instead of zero-state KPI cards. The pinned tab keeps the
    // user's selection (see analysis-page.component.spec.ts) and this
    // copy explains *why* nothing is rendered.
    const groupViewEl = fixture.debugElement.query(
      By.directive(AnalysisGroupViewComponent)
    );
    const store = groupViewEl.injector.get(AnalysisStore);
    // Mobility has no entries in the seeded mock, so switching to it
    // collapses viewFilteredRows() to [].
    store.setActiveView('mobility');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const empty = host.querySelector(
      '[data-testid="analysis-group-view-empty"]'
    );
    expect(empty).toBeTruthy();
    expect(empty?.textContent).toContain(
      'Keine Einträge im gewählten Zeitraum'
    );
    // The trend section stays visible — it spans a fixed window
    // independent of the page filter.
    expect(
      host.querySelector('[data-testid="analysis-trends-section"]')
    ).toBeTruthy();
    // The chart and KPI grid are gone so the page doesn't read as
    // "0 reps everywhere".
    expect(host.querySelector('app-stats-chart')).toBeNull();
    expect(host.querySelector('.grid')).toBeNull();
  });

  it('typeBreakdownDisplay localises bare exerciseIds in kind mode', async () => {
    // Regression: in kind mode (a non-pushup active view, or a kinds
    // filter that excludes pushups) the store emits raw catalog ids
    // like `abs.situps`. The component wraps them in `kindDisplayName`
    // so the pie legend reads "Sit-ups" instead of the developer id.
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
    const groupViewEl = fixture.debugElement.query(
      By.directive(AnalysisGroupViewComponent)
    );
    // Pull the store from the group-view's own injector — the HostComponent
    // provides AnalysisStore on its own tree, so TestBed.inject would
    // resolve a different (or missing) instance.
    const store = groupViewEl.injector.get(AnalysisStore);
    store.setRange('2026-02-09', '2026-02-15');
    store.setActiveView('core');
    fixture.detectChanges();
    await fixture.whenStable();

    const groupView =
      groupViewEl.componentInstance as AnalysisGroupViewComponent;
    const breakdown = groupView.typeBreakdownDisplay();
    expect(breakdown).toHaveLength(1);
    expect(breakdown[0]).toMatchObject({
      id: 'abs.situps',
      label: 'Sit-ups',
    });
  });
});
