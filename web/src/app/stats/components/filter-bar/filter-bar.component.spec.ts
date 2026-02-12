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
    fixture.detectChanges();
  });

  it('normalizes initial range to week mode (Mon-Sun)', () => {
    const start = component.range.controls.start.value;
    const end = component.range.controls.end.value;

    expect(start?.getFullYear()).toBe(2026);
    expect(start?.getMonth()).toBe(1);
    expect(start?.getDate()).toBe(2);

    expect(end?.getFullYear()).toBe(2026);
    expect(end?.getMonth()).toBe(1);
    expect(end?.getDate()).toBe(8);
  });

  it('emits ISO dates when reactive range controls change', () => {
    const fromSpy = jest.fn();
    const toSpy = jest.fn();
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

  it('maps empty and invalid ISO input values to null dates', () => {
    fixture.componentRef.setInput('from', '');
    fixture.componentRef.setInput('to', '2026-xx-07');
    fixture.detectChanges();

    expect(component.range.controls.start.value).toBeNull();
    expect(component.range.controls.end.value).toBeNull();
  });

  it('emits empty string when date controls are cleared', () => {
    const fromSpy = jest.fn();
    const toSpy = jest.fn();
    component.fromChange.subscribe(fromSpy);
    component.toChange.subscribe(toSpy);

    component.range.controls.start.setValue(null);
    component.range.controls.end.setValue(null);

    expect(fromSpy).toHaveBeenCalledWith('');
    expect(toSpy).toHaveBeenCalledWith('');
  });

  it('sets day range from anchor date', () => {
    component.range.patchValue({ start: new Date(2026, 1, 11), end: new Date(2026, 1, 11) });

    component.setMode('day');

    expect(component.range.controls.start.value?.getDate()).toBe(11);
    expect(component.range.controls.end.value?.getDate()).toBe(11);
  });

  it('sets week range (Mon-Sun) from anchor date', () => {
    component.range.patchValue({ start: new Date(2026, 1, 11), end: new Date(2026, 1, 11) }); // Wed

    component.setMode('week');

    expect(component.range.controls.start.value?.getDay()).toBe(1);
    expect(component.range.controls.end.value?.getDay()).toBe(0);
  });

  it('shifts week range forward and backward', () => {
    component.setMode('week');
    const fromSpy = jest.fn();
    const toSpy = jest.fn();
    component.fromChange.subscribe(fromSpy);
    component.toChange.subscribe(toSpy);

    component.shiftRange(1);
    component.shiftRange(-1);

    expect(fromSpy).toHaveBeenCalled();
    expect(toSpy).toHaveBeenCalled();
  });

  it('jumps to current week with today button helper', () => {
    component.setMode('week');
    component.jumpToToday();

    expect(component.range.controls.start.value?.getDay()).toBe(1);
    expect(component.range.controls.end.value?.getDay()).toBe(0);
  });
});
