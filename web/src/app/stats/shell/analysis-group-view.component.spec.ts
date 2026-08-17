import {
  Component,
  input,
  model,
  PLATFORM_ID,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { StatsApiService, UserStatsApiService } from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { makeAuthStoreMock } from '@pu-stats/testing';
import { ExerciseEntry } from '@pu-stats/models';
import { RangeModes } from '@pu-stats/date';

import { AnalysisStore } from '../analysis.store';
import { AnalysisGroupViewComponent } from './analysis-group-view.component';
import { AnalysisSegmentViewComponent } from './analysis-segment-view.component';
import { HeatmapComponent } from '../components/heatmap/heatmap.component';
import { TypePieComponent } from '../components/type-pie/type-pie.component';
import { StatsChartComponent } from '../components/stats-chart/stats-chart.component';
import { SetsDistributionComponent } from '../components/sets-distribution/sets-distribution.component';

@Component({
  selector: 'app-heatmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class MockHeatmapComponent {
  readonly entries = input<unknown[]>([]);
  readonly measurement = input<unknown>(null);
  readonly mode = input<string>('primary');
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
  readonly rangeMode = input<RangeModes>('week' as RangeModes);
  readonly from = input<string>('');
  readonly to = input<string>('');
  readonly entries = input<unknown[]>([]);
  readonly measurement = input<unknown>(null);
  readonly paceSeries = input<unknown[]>([]);
  readonly kindLabel = input<string>('');
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<app-analysis-group-view />',
})
class HostComponent {}

/** Chart title suffixes in DOM order, read off the mocked stats charts. */
function segmentChartLabels(
  fixture: ComponentFixture<HostComponent>
): string[] {
  return fixture.debugElement
    .queryAll(By.directive(MockStatsChartComponent))
    .map((el) => (el.componentInstance as MockStatsChartComponent).kindLabel());
}

describe('AnalysisGroupViewComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  const liveExerciseEntries = signal<ExerciseEntry[]>([]);
  const liveMock = {
    connected: signal(true),
    entries: signal([] as never[]),
    exerciseEntries: liveExerciseEntries,
    exerciseDefinitions: signal([]),
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
    // Seed a pushup entry within the default week range so heatmapMeasurement()
    // resolves to 'reps' and the toggle renders in structure tests.
    liveExerciseEntries.set([
      {
        _id: 'seed-pushup',
        userId: 'u1',
        exerciseId: 'pushup',
        timestamp: '2026-02-15T08:00:00.000+01:00',
        reps: 10,
        source: 'web',
      } as ExerciseEntry,
    ]);

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
        remove: { imports: [HeatmapComponent] },
        add: { imports: [MockHeatmapComponent] },
      })
      .overrideComponent(AnalysisSegmentViewComponent, {
        remove: {
          imports: [
            TypePieComponent,
            StatsChartComponent,
            SetsDistributionComponent,
          ],
        },
        add: {
          imports: [
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
    const trends = host.querySelector('[data-testid="analysis-trends-reps"]');
    expect(trends?.textContent).toContain('Wochentrend');
    expect(trends?.textContent).toContain('Letzte 8 Wochen');
    expect(trends?.textContent).toContain('Monatstrend');
    expect(trends?.textContent).toContain('Letzte 6 Monate');
  });

  it('keeps each measurement block together and the view-wide heatmap last', () => {
    const host: HTMLElement = fixture.nativeElement;
    const chart = host.querySelector('[data-testid="analysis-chart-reps"]');
    const trends = host.querySelector('[data-testid="analysis-trends-reps"]');
    const heatmap = host.querySelector('.heatmap-full');
    expect(chart).toBeTruthy();
    expect(trends).toBeTruthy();
    expect(heatmap).toBeTruthy();
    if (!chart || !trends || !heatmap) return;
    // chart → its own trends → heatmap
    expect(
      chart.compareDocumentPosition(trends) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      trends.compareDocumentPosition(heatmap) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('places the heatmap mode toggle inside the heatmap card header so the mobile stacked layout applies', () => {
    const host: HTMLElement = fixture.nativeElement;

    const heatmapCard = host.querySelector('.heatmap-full');
    expect(heatmapCard).toBeTruthy();

    const headerToggle = heatmapCard?.querySelector(
      'mat-card-header .heatmap-toggle'
    );
    expect(headerToggle).toBeTruthy();
    expect(headerToggle?.tagName.toLowerCase()).toBe('mat-button-toggle-group');
  });

  it('viewSegments includes durationSec for time-measured exercises (regression: planks rendered as zero-height bars)', async () => {
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

    const series = store.viewSegments()[0].series;
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

  it('viewSegments scales distance entries from meters to km so the bar axis reads naturally', async () => {
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

    const series = store.viewSegments()[0].series;
    const totals = Object.fromEntries(series.map((s) => [s.bucket, s.total]));
    expect(totals['2026-02-10']).toBe(5);
  });

  it('viewSegments pace returns min/km pace for distance-time entries, aligned with the bar buckets', async () => {
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

    const pace = store.viewSegments()[0].paceSeries;
    const entry = pace.find((p) => p.bucket === '2026-02-10');
    expect(entry).toBeDefined();
    expect(entry?.pace).toBeCloseTo(5, 5);
  });

  it('viewSegments pace returns pace=null for distance entries without duration so the chart does not render a bogus zero-pace line', async () => {
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

    const entry = store
      .viewSegments()[0]
      .paceSeries.find((p) => p.bucket === '2026-02-10');
    expect(entry?.pace).toBeNull();
  });

  it('viewSegments pace is empty for non-distance views (reps/time) — the chart keeps the day-integral line', async () => {
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

    expect(store.viewSegments()[0].paceSeries).toEqual([]);
  });

  it('heatmap toggle shows Reps/Sets for reps-measured views', async () => {
    liveExerciseEntries.set([
      {
        _id: 'e1',
        userId: 'u1',
        exerciseId: 'abs.situps',
        timestamp: '2026-02-10T08:00:00.000Z',
        reps: 30,
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
    fixture.detectChanges();

    const groupView =
      groupViewEl.componentInstance as AnalysisGroupViewComponent;
    expect(groupView.heatmapMeasurement()).toBe('reps');
    expect(groupView.heatmapToggleLabels()).toEqual({
      primary: 'Reps',
      breakdown: 'Sets',
    });

    const host: HTMLElement = fixture.nativeElement;
    const toggle = host.querySelector('.heatmap-toggle');
    expect(toggle?.textContent).toContain('Reps');
    expect(toggle?.textContent).toContain('Sets');
  });

  it('heatmap toggle shows Strecke/Intervalle for distance-time views', async () => {
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
    fixture.detectChanges();

    const groupView =
      groupViewEl.componentInstance as AnalysisGroupViewComponent;
    expect(groupView.heatmapMeasurement()).toBe('distance-time');
    expect(groupView.heatmapToggleLabels()).toEqual({
      primary: 'Strecke',
      breakdown: 'Intervalle',
    });

    const host: HTMLElement = fixture.nativeElement;
    const toggle = host.querySelector('.heatmap-toggle');
    expect(toggle?.textContent).toContain('Strecke');
    expect(toggle?.textContent).toContain('Intervalle');
  });

  it('heatmap toggle switches to Zeit/Intervalle for time-measured views', async () => {
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
    fixture.detectChanges();

    const groupView =
      groupViewEl.componentInstance as AnalysisGroupViewComponent;
    expect(groupView.heatmapMeasurement()).toBe('time');
    expect(groupView.heatmapToggleLabels()).toEqual({
      primary: 'Zeit',
      breakdown: 'Intervalle',
    });

    const host: HTMLElement = fixture.nativeElement;
    const toggle = host.querySelector('.heatmap-toggle');
    expect(toggle?.textContent).toContain('Zeit');
    expect(toggle?.textContent).toContain('Intervalle');
  });

  it('heatmap toggle is hidden for mixed-measurement views', async () => {
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
    fixture.detectChanges();

    const groupView =
      groupViewEl.componentInstance as AnalysisGroupViewComponent;
    expect(groupView.heatmapMeasurement()).toBe('mixed');
    expect(groupView.heatmapToggleLabels()).toBeNull();

    const host: HTMLElement = fixture.nativeElement;
    const heatmapCard = host.querySelector('.heatmap-full');
    const toggle = heatmapCard?.querySelector('.heatmap-toggle');
    expect(toggle).toBeNull();
  });

  it('viewSegments entries surfaces durationSec on `reps` for time-measured rows so the stacked-bar layer also sees the volume', async () => {
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

    const entries = store.viewSegments()[0].chartEntries;
    expect(entries).toHaveLength(1);
    expect(entries[0].reps).toBe(75);
  });

  it('renders one chart per measurement so timed and counted exercises of a category never share an axis', async () => {
    // given a `core` range mixing sit-ups (reps) and planks (seconds)
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
        timestamp: '2026-02-10T09:00:00.000Z',
        durationSec: 60,
        source: 'web',
      } as ExerciseEntry,
    ]);
    const groupViewEl = fixture.debugElement.query(
      By.directive(AnalysisGroupViewComponent)
    );
    const store = groupViewEl.injector.get(AnalysisStore);

    // when
    store.setRange('2026-02-09', '2026-02-15');
    store.setActiveView('core');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // then the reps chart carries 30 and the time chart 60 — not 90 on one
    const segments = store.viewSegments();
    expect(segments.map((s) => s.measurement)).toEqual(['reps', 'time']);
    expect(segments[0].series[0].total).toBe(30);
    expect(segments[1].series[0].total).toBe(60);

    const host: HTMLElement = fixture.nativeElement;
    const charts = host.querySelectorAll('app-stats-chart');
    expect(charts).toHaveLength(2);
    expect(
      host.querySelector('[data-testid="analysis-chart-reps"]')
    ).toBeTruthy();
    expect(
      host.querySelector('[data-testid="analysis-chart-time"]')
    ).toBeTruthy();
  });

  it('labels each chart of a multi-measurement view and leaves a single-measurement view unlabelled', async () => {
    // given
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
        timestamp: '2026-02-10T09:00:00.000Z',
        durationSec: 60,
        source: 'web',
      } as ExerciseEntry,
    ]);
    const groupViewEl = fixture.debugElement.query(
      By.directive(AnalysisGroupViewComponent)
    );
    const store = groupViewEl.injector.get(AnalysisStore);

    // when
    store.setRange('2026-02-09', '2026-02-15');
    store.setActiveView('core');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(segmentChartLabels(fixture)).toEqual(['Wiederholungen', 'Dauer']);

    // when only the plank remains, the lone chart needs no suffix
    liveExerciseEntries.set([
      {
        _id: 'e2',
        userId: 'u1',
        exerciseId: 'plank.standard',
        timestamp: '2026-02-10T09:00:00.000Z',
        durationSec: 60,
        source: 'web',
      } as ExerciseEntry,
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(segmentChartLabels(fixture)).toEqual(['']);
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
    // Nothing in the range *and* nothing in either trend window, so
    // there is no measurement to tabulate — the notice stands alone
    // instead of a table of zeros.
    expect(host.querySelector('[data-testid^="analysis-trends-"]')).toBeNull();
    // The chart and KPI grid are gone so the page doesn't read as
    // "0 reps everywhere".
    expect(host.querySelector('app-stats-chart')).toBeNull();
    expect(host.querySelector('.grid')).toBeNull();
  });

  it('keeps the trends of a measurement whose entries fall outside the selected range', async () => {
    // given a plank logged inside the 8-week trend window
    liveExerciseEntries.set([
      {
        _id: 'e1',
        userId: 'u1',
        exerciseId: 'plank.standard',
        timestamp: '2026-02-04T08:00:00.000Z',
        durationSec: 60,
        source: 'web',
      } as ExerciseEntry,
    ]);
    const groupViewEl = fixture.debugElement.query(
      By.directive(AnalysisGroupViewComponent)
    );
    const store = groupViewEl.injector.get(AnalysisStore);

    // when the filter moves past it
    store.setRange('2026-02-09', '2026-02-15');
    store.setActiveView('core');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // then the empty notice shows, but the fixed-window trends remain
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector('[data-testid="analysis-group-view-empty"]')
    ).toBeTruthy();
    expect(
      host.querySelector('[data-testid="analysis-trends-time"]')
    ).toBeTruthy();
    expect(
      host.querySelector('[data-testid="analysis-chart-time"]')
    ).toBeNull();
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

    fixture.detectChanges();
    const breakdown = fixture.debugElement
      .query(By.directive(AnalysisSegmentViewComponent))
      .componentInstance.typeBreakdownDisplay() as Array<{
      id: string;
      label: string;
    }>;
    expect(breakdown).toHaveLength(1);
    expect(breakdown[0]).toMatchObject({
      id: 'abs.situps',
      label: 'Sit-ups',
    });
  });
});
