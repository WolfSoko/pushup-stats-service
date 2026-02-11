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

  it('binds entry data to table dataSource', () => {
    const entries = [{ _id: '1', timestamp: '2026-02-10T13:45:00', reps: 8, source: 'wa' }];
    fixture.componentRef.setInput('entries', entries);
    fixture.detectChanges();

    expect(fixture.componentInstance.dataSource.data).toEqual(entries);
  });

  it('sorts rows by selected column and direction', () => {
    const component = fixture.componentInstance;
    const rows = [
      { _id: '1', timestamp: '2026-02-10T13:45:00', reps: 8, source: 'wa' },
      { _id: '2', timestamp: '2026-02-10T10:00:00', reps: 20, source: 'web' },
    ];

    const asc = component.dataSource.sortData(rows, { active: 'reps', direction: 'asc' });
    expect(asc.map((x) => x._id)).toEqual(['1', '2']);

    const desc = component.dataSource.sortData(rows, { active: 'reps', direction: 'desc' });
    expect(desc.map((x) => x._id)).toEqual(['2', '1']);
  });

  it('binds all entries to dataSource for virtual viewport rendering', () => {
    const component = fixture.componentInstance;
    const entries = Array.from({ length: 60 }).map((_, i) => ({
      _id: String(i + 1),
      timestamp: `2026-02-10T10:${String(i % 60).padStart(2, '0')}:00`,
      reps: i + 1,
      source: 'wa',
    }));

    fixture.componentRef.setInput('entries', entries);
    fixture.detectChanges();

    expect(component.dataSource.data.length).toBe(60);
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
    component.submitCreate();

    expect(createSpy).toHaveBeenCalledWith({ timestamp: '2026-02-11T07:00', reps: 12, source: 'web' });
  });

  it('does not emit create on invalid input', () => {
    const component = fixture.componentInstance;
    const createSpy = jest.fn();
    component.create.subscribe(createSpy);

    component.newTimestamp.set('');
    component.newReps.set('0');
    component.submitCreate();

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

  it('prefills datetime when opening create dialog and value is empty', () => {
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const openSpy = jest.spyOn(component.dialog, 'open').mockReturnValue({} as never);

    component.newTimestamp.set('');
    component.openCreateDialog();

    expect(component.newTimestamp()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(openSpy).toHaveBeenCalled();
  });

  it('keeps existing datetime when opening create dialog', () => {
    fixture.detectChanges();
    const component = fixture.componentInstance;
    jest.spyOn(component.dialog, 'open').mockReturnValue({} as never);

    component.newTimestamp.set('2026-02-11T08:15');
    component.openCreateDialog();

    expect(component.newTimestamp()).toBe('2026-02-11T08:15');
  });
});
