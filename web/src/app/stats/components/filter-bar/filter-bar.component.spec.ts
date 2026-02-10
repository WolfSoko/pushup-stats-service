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

  it('maps input ISO dates into reactive form controls', () => {
    const start = component.range.controls.start.value;
    const end = component.range.controls.end.value;

    expect(start?.getFullYear()).toBe(2026);
    expect(start?.getMonth()).toBe(1);
    expect(start?.getDate()).toBe(1);

    expect(end?.getFullYear()).toBe(2026);
    expect(end?.getMonth()).toBe(1);
    expect(end?.getDate()).toBe(7);
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

  it('renders form-style date range picker without manual action buttons', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Zeitraum auswählen');
    expect(text).not.toContain('Aktualisieren');
    expect(text).not.toContain('Zurücksetzen');
  });
});
