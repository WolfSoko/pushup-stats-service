import {
  ChangeDetectionStrategy,
  Component,
  signal,
  WritableSignal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ExercisePickerComponent } from './exercise-picker.component';
import { ExerciseSuggestions } from './training-entry-dialog.models';

@Component({
  selector: 'app-host',
  imports: [ExercisePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-exercise-picker
    [exerciseId]="exerciseId()"
    [suggestions]="suggestions()"
    [locked]="locked()"
    (exerciseIdChange)="picked.push($event)"
  />`,
})
class HostComponent {
  readonly exerciseId = signal('pushup');
  readonly suggestions: WritableSignal<ExerciseSuggestions> = signal({});
  readonly locked = signal(false);
  readonly picked: string[] = [];
}

describe('ExercisePickerComponent', () => {
  function render(): {
    component: ExercisePickerComponent;
    host: HostComponent;
    fixture: ComponentFixture<HostComponent>;
    input: HTMLInputElement;
  } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const component = fixture.debugElement.children[0]
      .componentInstance as ExercisePickerComponent;
    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="training-entry-exercise"]'
    );
    return { component, host: fixture.componentInstance, fixture, input };
  }

  it('should show the selected exercise name, not its id', async () => {
    // given / when
    const { fixture, input } = render();
    await fixture.whenStable();

    // then
    expect(input.value).toBe('Liegestütze');
  });

  it('should rank suggested exercises above the catalog groups', () => {
    // given
    const { component, host, fixture } = render();

    // when
    host.suggestions.set({ plannedExerciseIds: ['legs.squats'] });
    fixture.detectChanges();

    // then
    expect(component.filteredGroups()[0].label).toBe('Heute geplant');
    expect(component.filteredGroups()[0].options[0].id).toBe('legs.squats');
  });

  it('should narrow the panel to what was typed', () => {
    // given
    const { component, fixture, input } = render();

    // when
    input.value = 'sit-up';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // then
    const ids = component
      .filteredGroups()
      .flatMap((group) => group.options.map((option) => option.id));
    expect(ids).toEqual(['abs.situps']);
  });

  it('should list a whole category when its name is typed', () => {
    // given
    const { component, fixture, input } = render();

    // when
    input.value = 'kniebeuge';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // then
    const groups = component.filteredGroups();
    expect(groups.map((group) => group.key)).toEqual(['squat']);
    expect(groups[0].options.map((option) => option.id)).toContain(
      'legs.squats'
    );
  });

  it('should report when nothing matches', () => {
    // given
    const { component, fixture, input } = render();

    // when
    input.value = 'zzzz';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // then
    expect(component.hasMatches()).toBe(false);
  });

  it('should emit the picked exercise id and reopen the full list', () => {
    // given
    const { component, host, fixture, input } = render();
    input.value = 'kniebeuge';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // when
    component.onSelect('legs.squats');
    fixture.detectChanges();

    // then
    expect(host.picked).toEqual(['legs.squats']);
    expect(component.filteredGroups().length).toBeGreaterThan(1);
  });

  it('should follow the exercise the parent selects', async () => {
    // given
    const { component, host, fixture, input } = render();

    // when
    host.exerciseId.set('abs.situps');
    fixture.detectChanges();
    await fixture.whenStable();

    // then
    expect(component.control.value).toBe('abs.situps');
    expect(input.value).toBe('Sit-ups');
  });

  it('should disable the field and hide the wiki link in locked mode', () => {
    // given
    const { component, host, fixture, input } = render();

    // when
    host.locked.set(true);
    fixture.detectChanges();

    // then — pushups link to the type wiki from the type row instead.
    expect(input.disabled).toBe(true);
    expect(component.showWikiLink()).toBe(false);
  });

  it('should link a selected exercise to its wiki page', () => {
    // given
    const { component, host, fixture } = render();

    // when
    host.exerciseId.set('abs.situps');
    fixture.detectChanges();

    // then — abs.situps maps to slug 'sit-ups'.
    expect(component.showWikiLink()).toBe(true);
    expect(component.wikiLink()).toEqual(['/wiki/uebungen', 'sit-ups']);
  });
});
