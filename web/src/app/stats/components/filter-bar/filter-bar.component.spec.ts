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

  it('maps input ISO dates to local date signals', () => {
    const from = component.fromDateValue();
    const to = component.toDateValue();

    expect(from?.getFullYear()).toBe(2026);
    expect(from?.getMonth()).toBe(1);
    expect(from?.getDate()).toBe(1);

    expect(to?.getFullYear()).toBe(2026);
    expect(to?.getMonth()).toBe(1);
    expect(to?.getDate()).toBe(7);
  });

  it('emits ISO dates on picker change handlers', () => {
    const fromSpy = jest.fn();
    const toSpy = jest.fn();
    component.fromChange.subscribe(fromSpy);
    component.toChange.subscribe(toSpy);

    component.onFromDateChange({ value: new Date(2026, 1, 11) } as any);
    component.onToDateChange({ value: new Date(2026, 1, 12) } as any);

    expect(fromSpy).toHaveBeenCalledWith('2026-02-11');
    expect(toSpy).toHaveBeenCalledWith('2026-02-12');
  });
});
