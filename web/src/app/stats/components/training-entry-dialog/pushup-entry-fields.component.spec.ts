import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PushupEntryFieldsComponent } from './pushup-entry-fields.component';
import {
  PushupEntryDialogResult,
  TrainingEntryDialogData,
} from './training-entry-dialog.models';

@Component({
  selector: 'app-host',
  imports: [PushupEntryFieldsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<app-pushup-entry-fields [data]="data" />',
})
class HostComponent {
  data: TrainingEntryDialogData | null = null;
}

describe('PushupEntryFieldsComponent', () => {
  function render(data: TrainingEntryDialogData | null): {
    component: PushupEntryFieldsComponent;
    fixture: ComponentFixture<HostComponent>;
  } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.data = data;
    fixture.detectChanges();
    const component = fixture.debugElement.children[0]
      .componentInstance as PushupEntryFieldsComponent;
    return { component, fixture };
  }

  describe('create mode', () => {
    it('should default to a single empty set and the standard type/source', () => {
      // given / when
      const { component } = render(null);

      // then
      expect(component.sets()).toEqual([0]);
      expect(component.pushupTypeControl.value).toBe('standard');
      expect(component.sourceControl.value).toBe('web');
      expect(component.canSubmit()).toBe(false);
    });

    it('should report canSubmit once reps are entered', () => {
      // given
      const { component } = render(null);

      // when
      component.updateSet(0, '20');

      // then
      expect(component.totalReps()).toBe(20);
      expect(component.canSubmit()).toBe(true);
      expect(component.overCap()).toBe(false);
    });

    it('should cap reps at the shared 500 per-entry ceiling', () => {
      // given
      const { component } = render(null);

      // when
      component.updateSet(0, '9999');

      // then
      expect(component.sets()[0]).toBe(500);
      expect(component.overCap()).toBe(false);
    });

    it('should build a pushup result resolving type + source', () => {
      // given
      const { component } = render(null);
      component.updateSet(0, '20');
      component.pushupTypeControl.setValue('diamond');
      component.sourceControl.setValue('web');

      // when
      const result = component.buildResult(
        '2026-02-10T13:45'
      ) as PushupEntryDialogResult;

      // then
      expect(result).toMatchObject({
        kind: 'pushup',
        reps: 20,
        sets: [20],
        type: 'diamond',
        source: 'web',
        timestamp: '2026-02-10T13:45',
      });
    });

    it('should add and remove sets, collapsing back to a single row', () => {
      // given
      const { component } = render(null);
      component.updateSet(0, '10');

      // when
      component.addSet();

      // then
      expect(component.sets().length).toBe(2);
      expect(component.hasMultipleSets()).toBe(true);

      // when
      component.removeSet(1);

      // then
      expect(component.sets()).toEqual([10]);
    });

    it('should expose a wiki query param for the selected type', () => {
      // given
      const { component } = render(null);

      // when
      component.pushupTypeControl.setValue('diamond');

      // then — the query param carries the resolved type slug.
      const params = component.pushupWikiQueryParams() as { type?: string };
      expect(params.type).toBeTruthy();
    });
  });

  describe('edit mode', () => {
    it('should populate sets, type and source from a pushup payload', () => {
      // given / when
      const { component } = render({
        kind: 'pushup',
        timestamp: '2026-02-10T13:45:00+01:00',
        reps: 30,
        sets: [10, 10, 10],
        source: 'whatsapp',
        type: 'diamond',
      });

      // then
      expect(component.sets()).toEqual([10, 10, 10]);
      expect(component.pushupTypeControl.value).toBe('diamond');
      expect(component.sourceControl.value).toBe('whatsapp');
    });
  });
});
