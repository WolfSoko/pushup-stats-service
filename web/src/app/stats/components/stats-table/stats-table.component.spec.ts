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

  it('sorts rows by selected column and direction', () => {
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('entries', [
      { _id: '1', timestamp: '2026-02-10T13:45:00', reps: 8, source: 'wa' },
      { _id: '2', timestamp: '2026-02-10T10:00:00', reps: 20, source: 'web' },
    ]);

    component.setSort('reps');
    expect(component.sortedEntries().map((x) => x._id)).toEqual(['1', '2']);

    component.setSort('reps');
    expect(component.sortedEntries().map((x) => x._id)).toEqual(['2', '1']);
  });

  it('is read-only by default and switches to edit mode', () => {
    const component = fixture.componentInstance;
    const entry = { _id: '1', timestamp: '2026-02-10T13:45:00', reps: 8, source: 'wa' };

    expect(component.isEditing(entry._id)).toBe(false);
    component.startEdit(entry);
    expect(component.isEditing(entry._id)).toBe(true);
    expect(component.editReps(entry)).toBe('8');
    expect(component.editSource(entry)).toBe('wa');

    component.cancelEdit();
    expect(component.isEditing(entry._id)).toBe(false);
  });

  it('updates local edit state', () => {
    const component = fixture.componentInstance;
    const entry = { _id: '1', timestamp: '2026-02-10T13:45:00', reps: 8, source: 'wa' };

    component.startEdit(entry);
    component.setEditReps(entry, '12');
    component.setEditSource(entry, 'web');

    expect(component.editReps(entry)).toBe('12');
    expect(component.editSource(entry)).toBe('web');
  });

  it('emits create event from valid form submit', () => {
    const component = fixture.componentInstance;
    const createSpy = jest.fn();
    component.create.subscribe(createSpy);

    component.newTimestamp.set('2026-02-11T07:00');
    component.newReps.set('12');
    component.newSource.set('web');
    component.submitCreate(new Event('submit'));

    expect(createSpy).toHaveBeenCalledWith({ timestamp: '2026-02-11T07:00', reps: 12, source: 'web' });
  });

  it('does not emit create on invalid input', () => {
    const component = fixture.componentInstance;
    const createSpy = jest.fn();
    component.create.subscribe(createSpy);

    component.newTimestamp.set('');
    component.newReps.set('0');
    component.submitCreate(new Event('submit'));

    expect(createSpy).not.toHaveBeenCalled();
  });

  it('emits update on valid save and exits edit mode', () => {
    const component = fixture.componentInstance;
    const updateSpy = jest.fn();
    component.update.subscribe(updateSpy);

    const entry = { _id: '1', timestamp: '2026-02-10T13:45:00', reps: 8, source: 'wa' };
    component.startEdit(entry);
    component.setEditReps(entry, '15');
    component.setEditSource(entry, 'web');

    component.save(entry);

    expect(updateSpy).toHaveBeenCalledWith({ id: '1', reps: 15, source: 'web' });
    expect(component.isEditing('1')).toBe(false);
  });

  it('does not emit update on invalid reps', () => {
    const component = fixture.componentInstance;
    const updateSpy = jest.fn();
    component.update.subscribe(updateSpy);

    const entry = { _id: '1', timestamp: '2026-02-10T13:45:00', reps: 8, source: 'wa' };
    component.startEdit(entry);
    component.setEditReps(entry, '0');
    component.save(entry);

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('exposes busy helper state for spinner rendering', () => {
    fixture.componentRef.setInput('busyAction', 'delete');
    fixture.componentRef.setInput('busyId', '1');
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.isBusy('delete', '1')).toBe(true);
    expect(component.isBusy('update', '1')).toBe(false);

    fixture.componentRef.setInput('busyAction', 'create');
    fixture.detectChanges();
    expect(component.isCreateBusy()).toBe(true);
  });
});
