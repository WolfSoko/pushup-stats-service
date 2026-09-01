import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { By } from '@angular/platform-browser';

import type { CategoryComparison } from '../../analysis/analysis.types';
import type { ExerciseChoice } from '../exercise-breakdown-controls/exercise-breakdown-controls.component';
import { CategoryComparisonChartComponent } from './category-comparison-chart.component';

@Component({
  selector: 'app-host',
  standalone: true,
  imports: [CategoryComparisonChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-category-comparison-chart
    [data]="data()"
    [exercises]="exercises()"
  />`,
})
class HostComponent {
  readonly data = signal<CategoryComparison>({
    labels: [],
    entries: [],
    parts: [],
  });
  readonly exercises = signal<ExerciseChoice[]>([]);
}

function chart(
  fixture: ComponentFixture<HostComponent>
): CategoryComparisonChartComponent {
  return fixture.debugElement.query(
    By.directive(CategoryComparisonChartComponent)
  ).componentInstance;
}

describe('CategoryComparisonChartComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
  });

  it('renders the empty state when there are no categories', () => {
    fixture.componentInstance.data.set({ labels: [], entries: [], parts: [] });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector('[data-testid="category-comparison-empty"]')
    ).toBeTruthy();
    expect(
      host.querySelector('[data-testid="category-comparison-bars"]')
    ).toBeNull();
  });

  it('renders one bar per category sized by training count', () => {
    // Bar metric is intentionally a count of trainings — reps,
    // seconds and meters live on different scales, so the redesign
    // dropped the reps/sets toggle in favour of a single measurement-
    // agnostic axis.
    fixture.componentInstance.data.set({
      labels: ['Pushups', 'Abs', 'Cardio'],
      entries: [12, 4, 2],
      parts: [],
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const rows = host.querySelectorAll('.bar-row');
    expect(rows).toHaveLength(3);

    const labels = Array.from(host.querySelectorAll('.bar-label')).map((el) =>
      el.textContent?.trim()
    );
    expect(labels).toEqual(['Pushups', 'Abs', 'Cardio']);

    const fills = Array.from(
      host.querySelectorAll('.bar-fill')
    ) as HTMLElement[];
    expect(fills[0].style.width).toBe('100%');
    expect(fills[1].style.width).toBe(`${(4 / 12) * 100}%`);
    expect(fills[2].style.width).toBe(`${(2 / 12) * 100}%`);

    const values = Array.from(host.querySelectorAll('.bar-value')).map((el) =>
      el.textContent?.trim()
    );
    expect(values).toEqual(['12', '4', '2']);
  });

  it('renders zero-width fills without dividing by zero when every value is zero', () => {
    fixture.componentInstance.data.set({
      labels: ['Pushups'],
      entries: [0],
      parts: [],
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const fill = host.querySelector('.bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('should explain why the bars count trainings instead of volume', () => {
    // given
    fixture.componentInstance.data.set({
      labels: ['Pushups', 'Cardio'],
      entries: [3, 1],
      parts: [],
    });

    // when
    fixture.detectChanges();

    // then
    const host: HTMLElement = fixture.nativeElement;
    const note = host.querySelector(
      '[data-testid="category-comparison-metric-note"]'
    );
    expect(note?.textContent).toContain('nicht das Volumen');
    expect(note?.textContent).toContain('60 Sekunden Plank');
  });

  it('should split a category bar into one segment per exercise when stacked', () => {
    // given
    fixture.componentInstance.exercises.set([
      { id: 'abs.situps', label: 'Sit-ups', color: '#111111' },
      { id: 'abs.crunches', label: 'Crunches', color: '#222222' },
    ]);
    fixture.componentInstance.data.set({
      labels: ['Rumpf'],
      entries: [4],
      parts: [
        [
          { exerciseId: 'abs.situps', entries: 3 },
          { exerciseId: 'abs.crunches', entries: 1 },
        ],
      ],
    });

    // when
    fixture.detectChanges();

    // then — widths are shares of the largest bar, so they sum to it
    const host: HTMLElement = fixture.nativeElement;
    const situps = host.querySelector<HTMLElement>(
      '[data-testid="category-comparison-part-abs.situps"]'
    );
    const crunches = host.querySelector<HTMLElement>(
      '[data-testid="category-comparison-part-abs.crunches"]'
    );
    expect(situps?.style.width).toBe(`${(3 / 4) * 100}%`);
    expect(crunches?.style.width).toBe(`${(1 / 4) * 100}%`);
    expect(host.querySelector('.bar-track.grouped')).toBeNull();
  });

  it('should give each exercise its own bar when grouped', () => {
    // given
    fixture.componentInstance.exercises.set([
      { id: 'abs.situps', label: 'Sit-ups', color: '#111111' },
      { id: 'abs.crunches', label: 'Crunches', color: '#222222' },
    ]);
    fixture.componentInstance.data.set({
      labels: ['Rumpf'],
      entries: [4],
      parts: [
        [
          { exerciseId: 'abs.situps', entries: 3 },
          { exerciseId: 'abs.crunches', entries: 1 },
        ],
      ],
    });
    fixture.detectChanges();
    chart(fixture).barMode.set('grouped');

    // when
    fixture.detectChanges();

    // then
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.bar-track.grouped')).toBeTruthy();
    expect(host.querySelectorAll('.grouped-fill')).toHaveLength(2);
  });

  it('should name and colour every exercise it drew, once', () => {
    // given
    fixture.componentInstance.exercises.set([
      { id: 'abs.situps', label: 'Sit-ups', color: '#111111' },
      { id: 'abs.crunches', label: 'Crunches', color: '#222222' },
    ]);
    fixture.componentInstance.data.set({
      labels: ['Rumpf', 'Beine'],
      entries: [4, 2],
      parts: [
        [
          { exerciseId: 'abs.situps', entries: 3 },
          { exerciseId: 'abs.crunches', entries: 1 },
        ],
        [{ exerciseId: 'abs.situps', entries: 2 }],
      ],
    });

    // when
    fixture.detectChanges();

    // then
    const legend = fixture.nativeElement.querySelector(
      '[data-testid="category-comparison-legend"]'
    ) as HTMLElement;
    expect(legend.textContent).toContain('Sit-ups');
    expect(legend.textContent).toContain('Crunches');
    expect(legend.querySelectorAll('button')).toHaveLength(2);
  });

  it('should keep the plain bar when no category holds more than one exercise', () => {
    // given — splitting here would only recolour whole bars
    fixture.componentInstance.exercises.set([
      { id: 'pushup', label: 'Liegestütze', color: '#111111' },
    ]);
    fixture.componentInstance.data.set({
      labels: ['Liegestütze'],
      entries: [4],
      parts: [[{ exerciseId: 'pushup', entries: 4 }]],
    });

    // when
    fixture.detectChanges();

    // then
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector('[data-testid="category-comparison-part-pushup"]')
    ).toBeNull();
    expect(
      host.querySelector('[data-testid="category-comparison-legend"]')
    ).toBeNull();
    expect(host.querySelectorAll('.bar-fill')).toHaveLength(1);
  });

  it('shows the metric label so users can read the axis without a legend', () => {
    fixture.componentInstance.data.set({
      labels: ['Pushups'],
      entries: [3],
      parts: [],
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    // German source locale.
    expect(host.textContent).toContain('Trainingseinheiten');
  });

  it('should emit the exercise id when its legend entry is clicked', () => {
    // given
    fixture.componentInstance.exercises.set([
      { id: 'abs.situps', label: 'Sit-ups', color: '#111111' },
      { id: 'abs.crunches', label: 'Crunches', color: '#222222' },
    ]);
    fixture.componentInstance.data.set({
      labels: ['Rumpf'],
      entries: [4],
      parts: [
        [
          { exerciseId: 'abs.situps', entries: 3 },
          { exerciseId: 'abs.crunches', entries: 1 },
        ],
      ],
    });
    fixture.detectChanges();

    // when
    const host: HTMLElement = fixture.nativeElement;
    host
      .querySelector<HTMLButtonElement>(
        '[data-testid="category-comparison-legend-abs.situps"]'
      )
      ?.click();
    fixture.detectChanges();

    // then — the click hides the exercise in this chart only; the
    // page-wide filter belongs to the checkbox bar above it
    expect(
      host
        .querySelector('[data-testid="category-comparison-legend-abs.situps"]')
        ?.getAttribute('aria-checked')
    ).toBe('false');
    expect(host.querySelectorAll('.stacked-fill')).toHaveLength(1);
  });

  it('should keep a hidden exercise in the legend, switched off, so the click that undoes it survives', () => {
    // given — crunches carry no bar any more once they are hidden
    fixture.componentInstance.exercises.set([
      { id: 'abs.situps', label: 'Sit-ups', color: '#111111' },
      { id: 'abs.crunches', label: 'Crunches', color: '#222222' },
    ]);
    fixture.componentInstance.data.set({
      labels: ['Rumpf', 'Beine'],
      entries: [3, 2],
      parts: [
        [
          { exerciseId: 'abs.situps', entries: 2 },
          { exerciseId: 'abs.crunches', entries: 1 },
        ],
        [{ exerciseId: 'abs.situps', entries: 2 }],
      ],
    });
    fixture.detectChanges();

    // when
    fixture.nativeElement
      .querySelector('[data-testid="category-comparison-legend-abs.crunches"]')
      ?.click();
    fixture.detectChanges();

    // then
    const host: HTMLElement = fixture.nativeElement;
    const crunches = host.querySelector(
      '[data-testid="category-comparison-legend-abs.crunches"]'
    );
    expect(crunches?.getAttribute('aria-checked')).toBe('false');
    expect(
      host
        .querySelector('[data-testid="category-comparison-legend-abs.situps"]')
        ?.getAttribute('aria-checked')
    ).toBe('true');
  });

  it('should keep the legend order stable when an exercise is switched off', () => {
    // given — hidden entries used to be appended at the end, so every
    // click reshuffled the legend under the pointer
    fixture.componentInstance.exercises.set([
      { id: 'abs.situps', label: 'Sit-ups', color: '#111111' },
      { id: 'abs.crunches', label: 'Crunches', color: '#222222' },
    ]);
    fixture.componentInstance.data.set({
      labels: ['Rumpf'],
      entries: [3],
      parts: [
        [
          { exerciseId: 'abs.situps', entries: 2 },
          { exerciseId: 'abs.crunches', entries: 1 },
        ],
      ],
    });
    fixture.detectChanges();
    const before = chart(fixture)
      .legend()
      .map((item) => item.id);

    // when
    fixture.nativeElement
      .querySelector('[data-testid="category-comparison-legend-abs.situps"]')
      ?.click();
    fixture.detectChanges();

    // then
    expect(
      chart(fixture)
        .legend()
        .map((item) => item.id)
    ).toEqual(before);
  });
});
