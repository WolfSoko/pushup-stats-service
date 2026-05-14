import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Component, input, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AnalysisTeaserCardComponent } from './analysis-teaser-card.component';
import { LiveDataStore, StatsApiService } from '@pu-stats/data-access';
import { AuthStore } from '@pu-auth/auth';
import { makeAuthStoreMock } from '@pu-stats/testing';
import { StatsChartComponent } from '../stats-chart/stats-chart.component';

@Component({
  selector: 'app-stats-chart',
  standalone: true,
  template: '',
})
class StubStatsChartComponent {
  readonly series = input<unknown[]>([]);
  readonly granularity = input<string>('daily');
  readonly rangeMode = input<string>('week');
  readonly from = input<string>('');
  readonly to = input<string>('');
  readonly entries = input<unknown[]>([]);
  readonly kindLabel = input<string>('');
}

function makeLiveStoreMock(
  overrides: {
    connected?: boolean;
    entries?: unknown[];
    exerciseEntries?: unknown[];
  } = {}
) {
  return {
    connected: signal(overrides.connected ?? false),
    entries: signal(overrides.entries ?? []),
    exerciseEntries: signal(overrides.exerciseEntries ?? []),
    updateTick: signal(0),
  };
}

describe('AnalysisTeaserCardComponent', () => {
  let fixture: ComponentFixture<AnalysisTeaserCardComponent>;
  let component: AnalysisTeaserCardComponent;
  let routerSpy: { navigate: ReturnType<typeof vitest.fn> };

  const apiMock = {
    load: vitest.fn().mockReturnValue(
      of({
        meta: {
          from: null,
          to: null,
          entries: 5,
          days: 5,
          total: 100,
          granularity: 'daily',
        },
        series: [{ bucket: '2026-03-30', total: 20, dayIntegral: 20 }],
      })
    ),
  };

  async function setupWithLiveStore(
    liveStoreOverrides: Parameters<typeof makeLiveStoreMock>[0] = {}
  ) {
    routerSpy = { navigate: vitest.fn() };

    await TestBed.configureTestingModule({
      imports: [AnalysisTeaserCardComponent],
      providers: [
        { provide: StatsApiService, useValue: apiMock },
        { provide: Router, useValue: routerSpy },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
        {
          provide: LiveDataStore,
          useValue: makeLiveStoreMock(liveStoreOverrides),
        },
      ],
    })
      .overrideComponent(AnalysisTeaserCardComponent, {
        remove: { imports: [StatsChartComponent] },
        add: { imports: [StubStatsChartComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AnalysisTeaserCardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  // Frozen "today" so week-boundary helpers below don't flake around
  // midnight / timezone rollovers. 2026-04-08 is a Wednesday — the Monday
  // of its ISO week is 2026-04-06.
  const FROZEN_TODAY = new Date(2026, 3, 8, 12, 0, 0);

  beforeEach(async () => {
    vitest.clearAllMocks();
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    vitest.setSystemTime(FROZEN_TODAY);
    await setupWithLiveStore();
  });

  afterEach(() => {
    vitest.useRealTimers();
  });

  describe('Given the component is rendered', () => {
    describe('When navigateToAnalysis is called', () => {
      it('Then it should navigate to /analysis', () => {
        // When
        component.navigateToAnalysis();

        // Then
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/analysis']);
      });
    });

    describe('When enter key is pressed on the card', () => {
      it('Then it should navigate to /analysis', () => {
        // Given
        fixture.detectChanges();
        const card = fixture.nativeElement.querySelector('mat-card');

        // When
        card.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );

        // Then
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/analysis']);
      });
    });

    describe('When space key is pressed on the card', () => {
      it('Then it should navigate to /analysis', () => {
        // Given
        fixture.detectChanges();
        const card = fixture.nativeElement.querySelector('mat-card');

        // When
        card.dispatchEvent(
          new KeyboardEvent('keyup', { key: ' ', bubbles: true })
        );

        // Then
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/analysis']);
      });
    });

    describe('When the card is clicked', () => {
      it('Then it should navigate to /analysis', () => {
        // Given
        fixture.detectChanges();
        const card = fixture.nativeElement.querySelector('mat-card');

        // When
        card.click();

        // Then
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/analysis']);
      });
    });
  });

  describe('Given the component has accessibility attributes', () => {
    it('Then the card should have role="link"', () => {
      // Given
      fixture.detectChanges();

      // When
      const card = fixture.nativeElement.querySelector('mat-card');

      // Then
      expect(card.getAttribute('role')).toBe('link');
    });

    it('Then the card should have tabindex="0"', () => {
      // Given
      fixture.detectChanges();

      // When
      const card = fixture.nativeElement.querySelector('mat-card');

      // Then
      expect(card.getAttribute('tabindex')).toBe('0');
    });

    it('Then the card should have an aria-label', () => {
      // Given
      fixture.detectChanges();

      // When
      const card = fixture.nativeElement.querySelector('mat-card');

      // Then
      expect(card.getAttribute('aria-label')).toBeTruthy();
    });
  });

  describe('Given the API returns data successfully', () => {
    it('Then it should display the chart', async () => {
      // Given
      await fixture.whenStable();
      fixture.detectChanges();

      // When
      const chart = fixture.nativeElement.querySelector('app-stats-chart');

      // Then
      expect(chart).toBeTruthy();
    });

    it('Then chartSeries should contain the loaded data', async () => {
      // Given / When
      fixture.detectChanges();
      await fixture.whenStable();

      // Then
      expect(component.chartSeries().length).toBeGreaterThan(0);
    });
  });

  describe('Given the mini-chart container sizing', () => {
    it('Then .mini-chart should be rendered when data loads', async () => {
      // Given
      await fixture.whenStable();
      fixture.detectChanges();

      // When
      const miniChart: HTMLElement =
        fixture.nativeElement.querySelector('.mini-chart');

      // Then
      expect(miniChart).toBeTruthy();
    });

    it('Then .mini-chart height must use responsive clamp, not a fixed 180px', () => {
      // Regression guard: the old 180px height cut off the chart.
      // We verify the component's compiled styles contain the correct clamp().
      const cmpDef = (
        AnalysisTeaserCardComponent as unknown as {
          ɵcmp?: { styles?: string[] };
        }
      ).ɵcmp;
      const allStyles: string[] = cmpDef?.styles ?? [];
      const joined = allStyles.join(' ');

      // The compiled styles must reference the responsive height
      expect(joined).toContain('clamp(260px');
      // Must NOT contain the old fixed 180px for mini-chart
      expect(joined).not.toMatch(/\.mini-chart[^}]*height:\s*180px/);
    });

    it('Then .mini-chart must not clip the embedded chart bottom/right', () => {
      // Regression guard: the embedded <app-stats-chart> renders its own
      // header (title + subtitle) plus a chart-host sized to
      // clamp(260px, 34vw, 360px) plus a legend. A fixed `height` combined
      // with `overflow: hidden` on .mini-chart clipped the legend and the
      // x-axis ticks. Use `min-height` (reserve, allow growth) and do not
      // clip.
      const cmpDef = (
        AnalysisTeaserCardComponent as unknown as {
          ɵcmp?: { styles?: string[] };
        }
      ).ɵcmp;
      const allStyles: string[] = cmpDef?.styles ?? [];
      const joined = allStyles.join(' ');

      expect(joined).not.toMatch(/\.mini-chart[^}]*overflow:\s*hidden/);
      expect(joined).toMatch(/\.mini-chart[^}]*min-height:\s*clamp\(260px/);
    });
  });

  describe('Given the chart range computation', () => {
    // FROZEN_TODAY = 2026-04-08 (Wed). Trailing 7-day window (inclusive)
    // → 2026-04-02 .. 2026-04-08.
    it('Then to is today', () => {
      expect(component.to()).toBe('2026-04-08');
    });

    it('Then from is six days before today (inclusive 7-day window)', () => {
      expect(component.from()).toBe('2026-04-02');
    });

    it('Then the window covers exactly 7 calendar days', () => {
      const [fy, fm, fd] = component.from().split('-').map(Number);
      const [ty, tm, td] = component.to().split('-').map(Number);
      const fromDate = new Date(Date.UTC(fy, fm - 1, fd));
      const toDate = new Date(Date.UTC(ty, tm - 1, td));
      const days = Math.round(
        (toDate.getTime() - fromDate.getTime()) / 86_400_000
      );
      expect(days).toBe(6); // 0..6 inclusive ⇒ 7 days
    });
  });

  describe('Given the chart heading', () => {
    it('Then chartKindLabel returns a non-empty string', () => {
      expect(component.chartKindLabel()).toBeTruthy();
      expect(typeof component.chartKindLabel()).toBe('string');
    });

    it('Then the kindLabel is forwarded to the stats chart', () => {
      fixture.detectChanges();
      const chart = fixture.debugElement.query(
        By.directive(StubStatsChartComponent)
      );
      const stub = chart?.componentInstance as
        | StubStatsChartComponent
        | undefined;
      expect(stub?.kindLabel()).toBe(component.chartKindLabel());
    });
  });

  describe('Given the live store has not connected yet', () => {
    it('Then chartSeries falls back to the REST resource (pushup-only)', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      // REST mock returns one bucket; live store is disconnected.
      expect(component.chartSeries()).toEqual([
        { bucket: '2026-03-30', total: 20, dayIntegral: 20 },
      ]);
    });

    it('Then chartKindLabel names the pushup-only REST source', () => {
      // Disconnected ⇒ REST data only ⇒ label must not claim "all exercises".
      expect(component.chartKindLabel()).not.toBe('');
      expect(component.chartKindLabel()).not.toMatch(/Alle Übungen/i);
    });
  });

  describe('Given the live store has connected with unified entries', () => {
    // Deterministic — derived from FROZEN_TODAY above so the asserted bucket
    // dates match what the component computes.
    const weekStart = '2026-04-06'; // Monday
    const weekMid = '2026-04-08'; // Wednesday (== FROZEN_TODAY)

    beforeEach(async () => {
      TestBed.resetTestingModule();
      await setupWithLiveStore({
        connected: true,
        entries: [
          { _id: 'p1', timestamp: `${weekStart}T08:00:00+01:00`, reps: 10 },
        ],
        exerciseEntries: [
          {
            _id: 'e1',
            exerciseId: 'abs.situps',
            timestamp: `${weekMid}T12:00:00+01:00`,
            reps: 15,
            source: 'web',
          },
          {
            _id: 'e2',
            exerciseId: 'plank.standard',
            timestamp: `${weekMid}T13:00:00+01:00`,
            durationSec: 60,
            source: 'web',
          },
        ],
      });
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('Then chartSeries combines pushups and exercise reps per day', () => {
      const series = component.chartSeries();
      // Pushups on Monday: 10 reps
      // Situps on Wednesday: 15 reps (plank has no reps → excluded)
      const monday = series.find((s) => s.bucket === weekStart);
      const wednesday = series.find((s) => s.bucket === weekMid);
      expect(monday?.total).toBe(10);
      expect(wednesday?.total).toBe(15);
    });

    it('Then dayIntegral is cumulative across the merged days', () => {
      const series = component.chartSeries();
      // 10 on Monday, +15 on Wednesday → 25 cumulative on Wednesday
      const cumulativeTotals = series.map((s) => s.dayIntegral);
      expect(cumulativeTotals[cumulativeTotals.length - 1]).toBe(25);
    });

    it('Then chartKindLabel reports "Alle Übungen" when multiple kinds contribute reps', () => {
      expect(component.chartKindLabel()).toMatch(/Alle Übungen/i);
    });

    it('Then entries outside the week range are excluded', async () => {
      TestBed.resetTestingModule();
      await setupWithLiveStore({
        connected: true,
        entries: [
          { _id: 'p-old', timestamp: '2020-01-01T08:00:00+01:00', reps: 999 },
        ],
        exerciseEntries: [],
      });
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.chartSeries()).toEqual([]);
      // No reps in the current week ⇒ label collapses to empty.
      expect(component.chartKindLabel()).toBe('');
    });
  });

  describe('Given the live store has connected with only pushup entries this week', () => {
    const weekStart = '2026-04-06';

    beforeEach(async () => {
      TestBed.resetTestingModule();
      await setupWithLiveStore({
        connected: true,
        entries: [
          { _id: 'p1', timestamp: `${weekStart}T08:00:00+01:00`, reps: 10 },
        ],
        exerciseEntries: [],
      });
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('Then chartKindLabel names pushups and does not claim "Alle Übungen"', () => {
      const label = component.chartKindLabel();
      expect(label).not.toBe('');
      expect(label).not.toMatch(/Alle Übungen/i);
    });
  });

  describe('Given the REST resource errored but live data is connected', () => {
    beforeEach(async () => {
      TestBed.resetTestingModule();
      apiMock.load.mockReturnValueOnce(
        // Mimic a REST failure: emit nothing, then error.
        new Observable((subscriber) => {
          subscriber.error(new Error('boom'));
        })
      );
      await setupWithLiveStore({
        connected: true,
        entries: [
          { _id: 'p1', timestamp: '2026-04-06T08:00:00+01:00', reps: 12 },
        ],
        exerciseEntries: [],
      });
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('Then the chart still renders (error fallback suppressed while live is connected)', () => {
      const errorFallback =
        fixture.nativeElement.querySelector('.error-fallback');
      const chart = fixture.nativeElement.querySelector('app-stats-chart');
      expect(errorFallback).toBeFalsy();
      expect(chart).toBeTruthy();
    });
  });
});
