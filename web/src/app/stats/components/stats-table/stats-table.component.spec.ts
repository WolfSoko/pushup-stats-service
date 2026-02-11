import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatsTableComponent } from './stats-table.component';

describe('StatsTableComponent', () => {
  let fixture: ComponentFixture<StatsTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsTableComponent);
  });

  it('renders entry date with date pipe', () => {
    fixture.componentRef.setInput('entries', [{ _id: '1', timestamp: '2026-02-10T13:45:00', reps: 8, source: 'wa' }]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('10.02.2026, 13:45');
  });

  it('emits create event from form submit', () => {
    const component = fixture.componentInstance;
    const createSpy = jest.fn();
    component.create.subscribe(createSpy);

    component.newTimestamp.set('2026-02-11T07:00');
    component.newReps.set('12');
    component.newSource.set('web');
    component.submitCreate(new Event('submit'));

    expect(createSpy).toHaveBeenCalledWith({ timestamp: '2026-02-11T07:00', reps: 12, source: 'web' });
  });
});
