import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilterBarComponent } from './filter-bar.component';

describe('FilterBarComponent', () => {
  let fixture: ComponentFixture<FilterBarComponent>;
  let component: FilterBarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FilterBarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('from', '2026-02-01');
    fixture.componentRef.setInput('to', '2026-02-07');
    await fixture.whenStable();
  });

  it('normalizes initial range to week mode using first selected day as anchor', () => {
    const start = component.range.controls.start.value;
    const end = component.range.controls.end.value;

    // from=2026-02-01 (Sunday) -> week anchor on first selected day => Mon 2026-01-26 .. Sun 2026-02-01
    expect(start?.getFullYear()).toBe(2026);
    expect(start?.getMonth()).toBe(0);
    expect(start?.getDate()).toBe(26);

    expect(end?.getFullYear()).toBe(2026);
    expect(end?.getMonth()).toBe(1);
    expect(end?.getDate()).toBe(1);
  });

  it('emits ISO dates when reactive range controls change', () => {
    const fromSpy = vitest.fn();
    const toSpy = vitest.fn();
    component.fromChange.subscribe(fromSpy);
    component.toChange.subscribe(toSpy);

    component.range.controls.start.setValue(new Date(2026, 1, 11));
    component.range.controls.end.setValue(new Date(2026, 1, 12));

    expect(fromSpy).toHaveBeenCalledWith('2026-02-11');
    expect(toSpy).toHaveBeenCalledWith('2026-02-12');
  });

  it('renders form-style date range picker and mode toggles', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Zeitraum auswählen');
    expect(text).toContain('Tag');
    expect(text).toContain('Woche');
    expect(text).toContain('Monat');
    expect(text).toContain('Zurück');
    expect(text).toContain('Heute');
    expect(text).toContain('Vor');
  });

  it('maps empty and invalid ISO input values to null dates', async () => {
    fixture.componentRef.setInput('from', '');
    fixture.componentRef.setInput('to', '2026-xx-07');
    await fixture.whenStable();

    expect(component.range.controls.start.value).toBeNull();
    expect(component.range.controls.end.value).toBeNull();
  });

  it('emits empty string when date controls are cleared', () => {
    const fromSpy = vitest.fn();
    const toSpy = vitest.fn();
    component.fromChange.subscribe(fromSpy);
    component.toChange.subscribe(toSpy);

    component.range.controls.start.setValue(null);
    component.range.controls.end.setValue(null);

    expect(fromSpy).toHaveBeenCalledWith('');
    expect(toSpy).toHaveBeenCalledWith('');
  });

  it('sets day range from anchor date', () => {
    component.range.patchValue({
      start: new Date(2026, 1, 11),
      end: new Date(2026, 1, 11),
    });

    component.setMode('day');

    expect(component.range.controls.start.value?.getDate()).toBe(11);
    expect(component.range.controls.end.value?.getDate()).toBe(11);
  });

  it('sets week range (Mon-Sun) from anchor date', () => {
    component.range.patchValue({
      start: new Date(2026, 1, 11),
      end: new Date(2026, 1, 11),
    }); // Wed

    component.setMode('week');

    expect(component.range.controls.start.value?.getDay()).toBe(1);
    expect(component.range.controls.end.value?.getDay()).toBe(0);
  });

  it('shifts week range forward and backward', () => {
    component.setMode('week');
    const fromSpy = vitest.fn();
    const toSpy = vitest.fn();
    component.fromChange.subscribe(fromSpy);
    component.toChange.subscribe(toSpy);

    component.shiftRange(1);
    component.shiftRange(-1);

    expect(fromSpy).toHaveBeenCalled();
    expect(toSpy).toHaveBeenCalled();
  });

  it('keeps month mode when navigating month range forward/backward', () => {
    component.setMode('month');

    component.shiftRange(1);
    expect(component.mode()).toBe('month');

    component.shiftRange(-1);
    expect(component.mode()).toBe('month');
  });

  it('jumps to current week with today button helper', () => {
    component.setMode('week');
    component.jumpToToday();

    expect(component.range.controls.start.value?.getDay()).toBe(1);
    expect(component.range.controls.end.value?.getDay()).toBe(0);
  });

  it('switches to day mode using today when today is inside current range', () => {
    vitest.useFakeTimers();
    vitest.setSystemTime(new Date(2026, 1, 14));

    component.range.patchValue({
      start: new Date(2026, 1, 10),
      end: new Date(2026, 1, 16),
    });

    component.setMode('day');

    expect(component.range.controls.start.value).toEqual(new Date(2026, 1, 14));
    expect(component.range.controls.end.value).toEqual(new Date(2026, 1, 14));

    vitest.useRealTimers();
  });

  it('switches to week mode using first day when today is outside current range', () => {
    vitest.useFakeTimers();
    vitest.setSystemTime(new Date(2026, 2, 14)); // today not inside February range

    component.range.patchValue({
      start: new Date(2026, 1, 1),
      end: new Date(2026, 1, 28),
    });

    component.setMode('week');

    // week of first day (01.02.2026 -> Monday 26.01.2026)
    expect(component.range.controls.start.value).toEqual(new Date(2026, 0, 26));
    expect(component.range.controls.end.value).toEqual(new Date(2026, 1, 1));

    vitest.useRealTimers();
  });
});
