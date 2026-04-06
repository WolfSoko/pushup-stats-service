import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StatsTableComponent } from './stats-table.component';
import { UserConfigApiService } from '@pu-stats/data-access';
import { UserContextService } from '@pu-auth/auth';
import { CreateEntryResult } from '../create-entry-dialog/create-entry-dialog.component';

describe('StatsTableComponent', () => {
  let fixture: ComponentFixture<StatsTableComponent>;

  const userMock = {
    userIdSafe: () => 'u1',
  } as unknown as UserContextService;

  const userConfigApiMock = {
    getConfig: vitest
      .fn()
      .mockReturnValue(
        of({ userId: 'u1', dailyGoal: 100, ui: { showSourceColumn: false } })
      ),
    updateConfig: vitest
      .fn()
      .mockReturnValue(of({ userId: 'u1', ui: { showSourceColumn: true } })),
  } as unknown as UserConfigApiService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsTableComponent],
      providers: [
        { provide: UserContextService, useValue: userMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsTableComponent);
  });

  it('binds entry data to table dataSource', async () => {
    const entries = [
      { _id: '1', timestamp: '2026-02-10T13:45:00', reps: 8, source: 'wa' },
    ];
    fixture.componentRef.setInput('entries', entries);
    await fixture.whenStable();

    expect(fixture.componentInstance.dataSource.data).toEqual(entries);
  });

  it('binds all entries to dataSource for virtual viewport rendering', async () => {
    const component = fixture.componentInstance;
    const entries = Array.from({ length: 60 }).map((_, i) => ({
      _id: String(i + 1),
      timestamp: `2026-02-10T10:${String(i % 60).padStart(2, '0')}:00`,
      reps: i + 1,
      source: 'wa',
    }));

    fixture.componentRef.setInput('entries', entries);
    await fixture.whenStable();

    expect(component.dataSource.data.length).toBe(60);
  });

  it('is read-only by default and switches to edit mode', () => {
    const component = fixture.componentInstance;
    const entry = {
      _id: '1',
      timestamp: '2026-02-10T13:45:00',
      reps: 8,
      source: 'wa',
    };

    expect(component.isEditing(entry._id)).toBe(false);
    component.startEdit(entry);
    expect(component.isEditing(entry._id)).toBe(true);
    expect(component.editReps(entry)).toBe('8');
    expect(component.editSource(entry)).toBe('whatsapp');

    component.cancelEdit();
    expect(component.isEditing(entry._id)).toBe(false);
  });

  it('updates local edit state', () => {
    const component = fixture.componentInstance;
    const entry = {
      _id: '1',
      timestamp: '2026-02-10T13:45:00',
      reps: 8,
      source: 'wa',
    };

    component.startEdit(entry);
    component.setEditReps(entry, '12');
    component.setEditSource(entry, 'web');

    expect(component.editReps(entry)).toBe('12');
    expect(component.editSource(entry)).toBe('web');
  });

  describe('openCreateDialog()', () => {
    it('opens CreateEntryDialogComponent and emits create when dialog closes with result', () => {
      const component = fixture.componentInstance;
      const createSpy = vitest.fn();
      component.create.subscribe(createSpy);

      const result: CreateEntryResult = {
        timestamp: '2026-02-11T07:00',
        reps: 12,
        sets: [12],
        source: 'web',
        type: 'Standard',
      };
      vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(result),
      } as never);

      component.openCreateDialog();

      expect(createSpy).toHaveBeenCalledWith(result);
    });

    it('does not emit create when dialog is cancelled', () => {
      const component = fixture.componentInstance;
      const createSpy = vitest.fn();
      component.create.subscribe(createSpy);

      vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(undefined),
      } as never);

      component.openCreateDialog();

      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  it('emits update on valid save and exits edit mode', () => {
    const component = fixture.componentInstance;
    const updateSpy = vitest.fn();
    component.update.subscribe(updateSpy);

    const entry = {
      _id: '1',
      timestamp: '2026-02-10T13:45:00',
      reps: 8,
      source: 'wa',
    };
    component.startEdit(entry);
    component.setEditReps(entry, '15');
    component.setEditSource(entry, 'web');

    component.save(entry);

    expect(updateSpy).toHaveBeenCalledWith({
      id: '1',
      timestamp: '2026-02-10T13:45:00',
      reps: 15,
      sets: [15],
      source: 'web',
      type: 'Standard',
    });
    expect(component.isEditing('1')).toBe(false);
  });

  it('does not emit update on invalid reps', () => {
    const component = fixture.componentInstance;
    const updateSpy = vitest.fn();
    component.update.subscribe(updateSpy);

    const entry = {
      _id: '1',
      timestamp: '2026-02-10T13:45:00',
      reps: 8,
      source: 'wa',
    };
    component.startEdit(entry);
    component.setEditReps(entry, '0');
    component.save(entry);

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('opens edit dialog and stores edit values', async () => {
    fixture.componentRef.setInput('entries', [
      { _id: '1', timestamp: '2026-02-10T13:45:00', reps: 8, source: 'wa' },
    ]);
    await fixture.whenStable();

    const component = fixture.componentInstance;
    const openSpy = vitest
      .spyOn(component.dialog, 'open')
      .mockReturnValue({} as never);
    const entry = {
      _id: '1',
      timestamp: '2026-02-10T13:45:00',
      reps: 8,
      source: 'wa',
      type: 'Diamond Tempo',
    };

    component.openEditDialog(entry);

    expect(component.editingId()).toBe('1');
    expect(component.editTypeControl.value).toBe('Diamond Tempo');
    expect(openSpy).toHaveBeenCalled();
  });

  it('submits update via dialog using selected type', async () => {
    fixture.componentRef.setInput('entries', [
      { _id: '1', timestamp: '2026-02-10T13:45:00', reps: 8, source: 'wa' },
    ]);
    await fixture.whenStable();

    const component = fixture.componentInstance;
    const updateSpy = vitest.fn();
    component.update.subscribe(updateSpy);

    const entry = {
      _id: '1',
      timestamp: '2026-02-10T13:45:00',
      reps: 8,
      source: 'wa',
    };
    component.startEdit(entry);
    component.setEditRepsById('14');
    component.editSourceControl.setValue('web');
    component.editTypeControl.setValue('Diamond');

    component.saveFromDialog();

    expect(updateSpy).toHaveBeenCalledWith({
      id: '1',
      timestamp: '2026-02-10T13:45:00',
      reps: 14,
      sets: [14],
      source: 'web',
      type: 'Diamond',
    });
  });

  it('cancelEdit closes dialog and clears editing id', () => {
    const component = fixture.componentInstance;
    const closeSpy = vitest
      .spyOn(component.dialog, 'closeAll')
      .mockReturnValue(undefined);

    component.startEdit({
      _id: '1',
      timestamp: '2026-02-10T13:45:00',
      reps: 8,
      source: 'wa',
    });
    component.cancelEdit();

    expect(component.editingId()).toBeNull();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('handles missing edit dialog and missing edit id safely', () => {
    const component = fixture.componentInstance;

    component.openEditDialog({
      _id: 'x',
      timestamp: '2026-02-10T13:45:00',
      reps: 8,
      source: 'wa',
    });

    expect(component.editingId()).toBe('x');
    expect(component.editRepsById()).toBe('8');

    component.setEditRepsById('12');
    component.setEditSourceById('web');
    component.saveFromDialog();

    expect(component.editBusyId()).toBe('x');
  });

  it('sets edit type control when editing known type', () => {
    const component = fixture.componentInstance;
    component.startEdit({
      _id: '2',
      timestamp: '2026-02-10T13:45:00',
      reps: 8,
      source: 'wa',
      type: 'Diamond',
    });

    expect(component.editTypeControl.value).toBe('Diamond');
  });

  it('falls back to Standard type label if edit type is emptied', async () => {
    fixture.componentRef.setInput('entries', [
      { _id: '1', timestamp: '2026-02-10T13:45:00', reps: 8, source: 'wa' },
    ]);
    await fixture.whenStable();

    const component = fixture.componentInstance;
    const updateSpy = vitest.fn();
    component.update.subscribe(updateSpy);

    component.startEdit({
      _id: '1',
      timestamp: '2026-02-10T13:45:00',
      reps: 8,
      source: 'wa',
    });
    component.editTypeControl.setValue('');
    component.saveFromDialog();

    expect(updateSpy).toHaveBeenCalledWith({
      id: '1',
      timestamp: '2026-02-10T13:45:00',
      reps: 8,
      source: 'whatsapp',
      type: 'Standard',
    });
  });

  it('exposes busy helper state for update/delete spinner rendering', async () => {
    fixture.componentRef.setInput('busyAction', 'delete');
    fixture.componentRef.setInput('busyId', '1');
    await fixture.whenStable();

    const component = fixture.componentInstance;
    expect(component.isBusy('delete', '1')).toBe(true);
    expect(component.isBusy('update', '1')).toBe(false);
  });

  describe('formatSets', () => {
    it('Given uniform sets When formatSets is called Then returns "count×reps"', () => {
      // Given
      const component = fixture.componentInstance;
      // When
      const result = component.formatSets([10, 10, 10]);
      // Then
      expect(result).toBe('3×10');
    });

    it('Given mixed sets When formatSets is called Then returns "a + b + c"', () => {
      // Given
      const component = fixture.componentInstance;
      // When
      const result = component.formatSets([10, 15, 5]);
      // Then
      expect(result).toBe('10 + 15 + 5');
    });

    it('Given empty array When formatSets is called Then returns empty string', () => {
      // Given
      const component = fixture.componentInstance;
      // When
      const result = component.formatSets([]);
      // Then
      expect(result).toBe('');
    });

    it('Given single set When formatSets is called Then returns "1×reps"', () => {
      // Given
      const component = fixture.componentInstance;
      // When
      const result = component.formatSets([20]);
      // Then
      expect(result).toBe('1×20');
    });
  });

  it('renders non-virtual table fallback on server platform', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [StatsTableComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: UserContextService, useValue: userMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
      ],
    }).compileComponents();

    const serverFixture = TestBed.createComponent(StatsTableComponent);
    serverFixture.componentRef.setInput('entries', [
      { _id: 's1', timestamp: '2026-02-11T10:00:00', reps: 12, source: 'web' },
    ]);

    await serverFixture.whenStable();

    expect(serverFixture.componentInstance.isBrowser).toBe(false);
    const host = serverFixture.nativeElement as HTMLElement;
    expect(host.querySelector('cdk-virtual-scroll-viewport')).toBeNull();
    expect(host.querySelector('mat-table')).toBeTruthy();
  });
});
