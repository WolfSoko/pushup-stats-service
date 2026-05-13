import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  StatsChartComponent,
  type PaceSeriesEntry,
} from './stats-chart.component';

/**
 * Renders the chart under `PLATFORM_ID: 'server'` so the Chart.js
 * canvas path stays inert and we exercise the measurement-aware copy
 * (subtitle, legend labels, unit suffix, pace mode) directly off the
 * exposed signals.
 */
describe('StatsChartComponent', () => {
  let fixture: ComponentFixture<StatsChartComponent>;
  let component: StatsChartComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsChartComponent],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
    fixture = TestBed.createComponent(StatsChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Subtitle', () => {
    it('Given the default (reps) measurement, Then the subtitle keeps the legacy reps wording', () => {
      expect(component.subtitleText()).toContain('Wiederholungen');
    });

    it('Given measurement="time", Then the subtitle mentions Übungsdauer / seconds', () => {
      fixture.componentRef.setInput('measurement', 'time');
      fixture.detectChanges();
      expect(component.subtitleText()).toContain('Übungsdauer');
      expect(component.subtitleText()).toContain('(s)');
    });

    it('Given measurement="distance-time", Then the subtitle mentions Strecke / km and pace', () => {
      fixture.componentRef.setInput('measurement', 'distance-time');
      fixture.detectChanges();
      const text = component.subtitleText();
      expect(text).toContain('Strecke');
      expect(text).toContain('km');
      expect(text).toContain('Tempo');
    });

    it('Given measurement="mixed", Then the subtitle falls back to generic Trainingsvolumen copy', () => {
      fixture.componentRef.setInput('measurement', 'mixed');
      fixture.detectChanges();
      expect(component.subtitleText()).toContain('Trainingsvolumen');
    });
  });

  describe('Legend with units', () => {
    it('Given measurement="reps", Then the legend appends "(Reps)" to interval + moving-average labels', () => {
      fixture.componentRef.setInput('measurement', 'reps');
      fixture.detectChanges();
      expect(component.intervalLegendText()).toContain('(Reps)');
      expect(component.movingAvgLegendText()).toContain('(Reps)');
    });

    it('Given measurement="weight", Then the legend reports kilograms', () => {
      // Regression: an earlier version copied the reps wording for
      // weight ("(Reps)"). Weight has its own unit (kg) and subtitle.
      fixture.componentRef.setInput('measurement', 'weight');
      fixture.detectChanges();
      expect(component.intervalLegendText()).toContain('(kg)');
      expect(component.movingAvgLegendText()).toContain('(kg)');
      expect(component.subtitleText()).toContain('Trainingsgewicht');
    });

    it('Given measurement="time", Then the legend reports seconds', () => {
      fixture.componentRef.setInput('measurement', 'time');
      fixture.detectChanges();
      expect(component.intervalLegendText()).toContain('(s)');
      expect(component.movingAvgLegendText()).toContain('(s)');
    });

    it('Given measurement="distance-time" without pace data, Then the secondary legend falls back to the day-integral label with unit', () => {
      // Without usable pace buckets the chart keeps the cumulative
      // day-integral line; the legend should still announce the unit
      // for consistency with the other legend rows.
      fixture.componentRef.setInput('measurement', 'distance-time');
      fixture.componentRef.setInput('paceSeries', [] as PaceSeriesEntry[]);
      fixture.detectChanges();
      expect(component.secondaryLegendText()).toBe(
        `${component.dayIntegralLabel} (km)`
      );
    });

    it('Given measurement="reps" (no pace), Then the secondary legend reads "Tages-Integral (Reps)"', () => {
      fixture.componentRef.setInput('measurement', 'reps');
      fixture.detectChanges();
      expect(component.secondaryLegendText()).toBe(
        `${component.dayIntegralLabel} (Reps)`
      );
    });

    it('Given measurement="distance-time" with at least one non-null pace bucket, Then the secondary legend reads "km Tempo (min/km)"', () => {
      fixture.componentRef.setInput('measurement', 'distance-time');
      fixture.componentRef.setInput('paceSeries', [
        { bucket: '2026-02-10', pace: 5.5 },
      ] satisfies PaceSeriesEntry[]);
      fixture.detectChanges();
      expect(component.paceMode()).toBe(true);
      expect(component.secondaryLegendText()).toContain('km Tempo');
      expect(component.secondaryLegendText()).toContain('(min/km)');
    });

    it('Given measurement="mixed", Then the unit suffix is empty so legacy labels remain unchanged', () => {
      fixture.componentRef.setInput('measurement', 'mixed');
      fixture.detectChanges();
      expect(component.unitSuffix()).toBe('');
      expect(component.intervalLegendText()).toBe(component.intervalLabel);
    });
  });

  describe('Pace mode gating', () => {
    it('Given a reps view with a (defensively passed) pace series, Then paceMode stays false', () => {
      fixture.componentRef.setInput('measurement', 'reps');
      fixture.componentRef.setInput('paceSeries', [
        { bucket: '2026-02-10', pace: 5 },
      ] satisfies PaceSeriesEntry[]);
      fixture.detectChanges();
      expect(component.paceMode()).toBe(false);
    });

    it('Given a distance view whose pace buckets are all null, Then paceMode stays false (chart keeps day-integral)', () => {
      fixture.componentRef.setInput('measurement', 'distance-time');
      fixture.componentRef.setInput('paceSeries', [
        { bucket: '2026-02-10', pace: null },
      ] satisfies PaceSeriesEntry[]);
      fixture.detectChanges();
      expect(component.paceMode()).toBe(false);
    });
  });
});
