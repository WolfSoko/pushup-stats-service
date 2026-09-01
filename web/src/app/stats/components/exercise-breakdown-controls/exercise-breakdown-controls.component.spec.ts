import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import type { BarMode } from '../../analysis/exercise-breakdown';
import {
  ExerciseBreakdownControlsComponent,
  type ExerciseChoice,
} from './exercise-breakdown-controls.component';

@Component({
  selector: 'app-host',
  standalone: true,
  imports: [ExerciseBreakdownControlsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-exercise-breakdown-controls
    [exercises]="exercises()"
    [hidden]="hidden()"
    [barMode]="barMode()"
    (barModeChange)="lastMode.set($event)"
    (toggleExercise)="lastToggled.set($event)"
    (showAll)="showAllCalls.set(showAllCalls() + 1)"
  />`,
})
class HostComponent {
  readonly exercises = signal<ExerciseChoice[]>([
    { id: 'abs.situps', label: 'Sit-ups', color: '#111111' },
    { id: 'abs.crunches', label: 'Crunches', color: '#222222' },
  ]);
  readonly hidden = signal<string[]>([]);
  readonly barMode = signal<BarMode>('stacked');
  readonly lastMode = signal<BarMode | null>(null);
  readonly lastToggled = signal<string | null>(null);
  readonly showAllCalls = signal(0);
}

describe('ExerciseBreakdownControlsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('should offer one legend toggle per exercise, switched on while the exercise is visible', () => {
    // given / when
    const host: HTMLElement = fixture.nativeElement;

    // then
    const situps = host.querySelector(
      '[data-testid="exercise-breakdown-choice-abs.situps"]'
    );
    expect(situps?.getAttribute('aria-checked')).toBe('true');
    expect(
      host.querySelector(
        '[data-testid="exercise-breakdown-choice-abs.crunches"]'
      )
    ).toBeTruthy();
  });

  it('should switch a hidden exercise off so its marker reads as a hollow ring', () => {
    // given
    fixture.componentInstance.hidden.set(['abs.crunches']);

    // when
    fixture.detectChanges();

    // then
    const host: HTMLElement = fixture.nativeElement;
    const crunches = host.querySelector(
      '[data-testid="exercise-breakdown-choice-abs.crunches"]'
    );
    expect(crunches?.getAttribute('aria-checked')).toBe('false');
    const dot = crunches?.querySelector<HTMLElement>('.dot');
    expect(dot?.style.background).toBe('transparent');
  });

  it('should emit the exercise id when a legend entry is clicked', () => {
    // given
    const host: HTMLElement = fixture.nativeElement;
    const toggle = host.querySelector<HTMLButtonElement>(
      '[data-testid="exercise-breakdown-choice-abs.situps"]'
    );

    // when
    toggle?.click();
    fixture.detectChanges();

    // then
    expect(fixture.componentInstance.lastToggled()).toBe('abs.situps');
  });

  it('should offer "show all" only while something is hidden', () => {
    // given
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector('[data-testid="exercise-breakdown-show-all"]')
    ).toBeNull();

    // when
    fixture.componentInstance.hidden.set(['abs.crunches']);
    fixture.detectChanges();
    host
      .querySelector<HTMLButtonElement>(
        '[data-testid="exercise-breakdown-show-all"]'
      )
      ?.click();
    fixture.detectChanges();

    // then
    expect(fixture.componentInstance.showAllCalls()).toBe(1);
  });

  it('should stay hidden below two exercises — a lone exercise has nothing to lay out or filter', () => {
    // given
    fixture.componentInstance.exercises.set([
      { id: 'pushup', label: 'Liegestütze', color: '#111111' },
    ]);

    // when
    fixture.detectChanges();

    // then
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector('[data-testid="exercise-breakdown-controls"]')
    ).toBeNull();
  });

  it('should stay reachable when a hidden exercise leaves only one choice behind', () => {
    // Regression: `hiddenExerciseIds` is page-wide and survives tab and
    // range changes, so hiding the block on choice count alone could
    // strand the user on an empty view with no way to undo the hide.
    // given
    fixture.componentInstance.exercises.set([
      { id: 'pushup', label: 'Liegestütze', color: '#111111' },
    ]);
    fixture.componentInstance.hidden.set(['pushup']);

    // when
    fixture.detectChanges();

    // then
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector('[data-testid="exercise-breakdown-controls"]')
    ).toBeTruthy();
    expect(
      host.querySelector('[data-testid="exercise-breakdown-show-all"]')
    ).toBeTruthy();
  });

  it('should render both bar layouts as a choice', () => {
    // given / when
    const host: HTMLElement = fixture.nativeElement;

    // then — German source locale
    const toggle = host.querySelector(
      '[data-testid="exercise-breakdown-mode"]'
    );
    expect(toggle?.textContent).toContain('Gestapelt');
    expect(toggle?.textContent).toContain('Nebeneinander');
  });
});
