import { ComponentFixture, TestBed } from '@angular/core/testing';
import type {
  UnifiedExerciseEntry,
  UnifiedPushupEntry,
} from '@pu-stats/models';
import { IntervalsDistributionComponent } from './intervals-distribution.component';

function exerciseEntry(
  overrides: Partial<UnifiedExerciseEntry> & {
    exerciseId: string;
    intervals?: number[];
  }
): UnifiedExerciseEntry {
  return {
    kind: 'exercise',
    _id: overrides._id ?? `e-${Math.random()}`,
    timestamp: overrides.timestamp ?? '2026-05-14T10:00:00.000Z',
    reps: overrides.reps ?? 0,
    source: overrides.source ?? 'test',
    exerciseId: overrides.exerciseId,
    ...(overrides.intervals ? { intervals: overrides.intervals } : {}),
    ...(overrides.durationSec !== undefined
      ? { durationSec: overrides.durationSec }
      : {}),
    ...(overrides.distanceM !== undefined
      ? { distanceM: overrides.distanceM }
      : {}),
  };
}

function pushupEntry(intervals?: number[]): UnifiedPushupEntry {
  return {
    kind: 'pushup',
    _id: `p-${Math.random()}`,
    timestamp: '2026-05-14T10:00:00.000Z',
    reps: 30,
    source: 'test',
    variantType: 'Diamond',
    ...(intervals ? { intervals } : {}),
  };
}

describe('IntervalsDistributionComponent', () => {
  let fixture: ComponentFixture<IntervalsDistributionComponent>;
  let component: IntervalsDistributionComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IntervalsDistributionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IntervalsDistributionComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('measurement', 'time');
  });

  describe('Given no entries with intervals', () => {
    it('renders the empty state', () => {
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.empty')).toBeTruthy();
      expect(el.querySelector('.bars')).toBeNull();
    });

    it('renders the empty state when entries exist but none carry intervals', () => {
      fixture.componentRef.setInput('entries', [
        exerciseEntry({ exerciseId: 'core.hollowhold', durationSec: 90 }),
      ]);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.empty')).toBeTruthy();
    });
  });

  describe('Given time-measurement entries with intervals', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('measurement', 'time');
      fixture.componentRef.setInput('entries', [
        exerciseEntry({
          exerciseId: 'core.hollowhold',
          intervals: [30, 30, 60],
        }),
        exerciseEntry({
          exerciseId: 'core.hollowhold',
          intervals: [30, 60],
        }),
        pushupEntry(),
      ]);
      fixture.detectChanges();
    });

    it('bins individual interval values across all entries', () => {
      expect(component.data()).toEqual([
        { value: 30, count: 3, percent: 60 },
        { value: 60, count: 2, percent: 40 },
      ]);
    });

    it('renders one bar per unique interval value, sorted ascending', () => {
      const el = fixture.nativeElement as HTMLElement;
      const rows = el.querySelectorAll('.bar-row');
      expect(rows.length).toBe(2);
      expect(rows[0].querySelector('.label')?.textContent?.trim()).toBe('30s');
      expect(rows[1].querySelector('.label')?.textContent?.trim()).toBe('1:00');
    });

    it('formats sub-minute values as Xs and >=60s values as m:ss', () => {
      expect(component.formatValue(30)).toBe('30s');
      expect(component.formatValue(59)).toBe('59s');
      expect(component.formatValue(60)).toBe('1:00');
      expect(component.formatValue(90)).toBe('1:30');
      expect(component.formatValue(125)).toBe('2:05');
    });
  });

  describe('Given distance-time entries with intervals', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('measurement', 'distance-time');
      fixture.componentRef.setInput('entries', [
        exerciseEntry({
          exerciseId: 'cardio.running',
          intervals: [400, 400, 800],
        }),
        exerciseEntry({
          exerciseId: 'cardio.running',
          intervals: [400, 1500],
        }),
      ]);
      fixture.detectChanges();
    });

    it('bins meter values across all entries', () => {
      expect(component.data()).toEqual([
        { value: 400, count: 3, percent: 60 },
        { value: 800, count: 1, percent: 20 },
        { value: 1500, count: 1, percent: 20 },
      ]);
    });

    it('formats <=1000m as "X m" and >1000m as kilometres', () => {
      expect(component.formatValue(400)).toBe('400 m');
      expect(component.formatValue(1000)).toBe('1000 m');
      expect(component.formatValue(1500)).toBe('1.5 km');
      expect(component.formatValue(1234)).toBe('1.3 km');
    });
  });

  it('ignores entries whose measurement does not match the chart input', () => {
    fixture.componentRef.setInput('measurement', 'time');
    fixture.componentRef.setInput('entries', [
      exerciseEntry({
        exerciseId: 'core.hollowhold',
        intervals: [45, 45],
      }),
      exerciseEntry({
        exerciseId: 'cardio.running',
        intervals: [400, 400, 400],
      }),
    ]);
    fixture.detectChanges();
    expect(component.data()).toEqual([{ value: 45, count: 2, percent: 100 }]);
  });

  it('uses absolute percent for bar width', () => {
    expect(component.barWidth(60)).toBe(60);
    expect(component.barWidth(40)).toBe(40);
  });
});
