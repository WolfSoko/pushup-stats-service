import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { of } from 'rxjs';
import { type ExerciseEntry } from '@pu-stats/models';
import { UserEntriesTableComponent } from './user-entries-table.component';
import { CallableFunctionsService } from './callable-functions.service';
import {
  CallableRecord,
  createCallablesMock,
} from './callable-functions.testing';
import { DeleteEntriesDialogComponent } from './delete-entries-dialog.component';

const { callablesMock, setupCallables } = createCallablesMock();

describe('UserEntriesTableComponent', () => {
  let fixture: ComponentFixture<UserEntriesTableComponent>;
  let component: UserEntriesTableComponent;
  let dialogOpenSpy: ReturnType<typeof vi.spyOn>;

  function stubDialogRef<T>(result: T): MatDialogRef<unknown, T> {
    return { afterClosed: () => of(result) } as MatDialogRef<unknown, T>;
  }

  const entryOne: ExerciseEntry = {
    _id: 'entry-1',
    userId: 'user-1',
    exerciseId: 'pushup',
    timestamp: '2026-04-09T10:00:00.000Z',
    reps: 30,
    source: 'web',
  };
  const entryTwo: ExerciseEntry = {
    _id: 'entry-2',
    userId: 'user-1',
    exerciseId: 'pushup',
    timestamp: '2026-04-08T10:00:00.000Z',
    reps: 20,
    source: 'web',
  };

  async function createComponent(
    entries: ExerciseEntry[] = [entryOne, entryTwo],
    extraCallables: CallableRecord[] = []
  ): Promise<void> {
    setupCallables(extraCallables);

    await TestBed.configureTestingModule({
      imports: [UserEntriesTableComponent, MatDialogModule],
      providers: [
        { provide: CallableFunctionsService, useValue: callablesMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserEntriesTableComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('entries', entries);
    fixture.componentRef.setInput('uid', 'user-1');
    dialogOpenSpy = vi.spyOn(
      fixture.debugElement.injector.get(MatDialog),
      'open'
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render one row per entry', async () => {
    // given / when
    await createComponent();

    // then
    const rows = fixture.nativeElement.querySelectorAll('mat-row');
    expect(rows.length).toBe(2);
  });

  it('should emit edit with the clicked entry', async () => {
    // given
    await createComponent();
    const editSpy = vi.fn();
    component.edit.subscribe(editSpy);

    // when
    const editButton = fixture.nativeElement.querySelector(
      'mat-cell.mat-column-actions button'
    ) as HTMLButtonElement;
    editButton.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );
    fixture.detectChanges();

    // then
    expect(editSpy).toHaveBeenCalledWith(entryOne);
  });

  describe('row selection', () => {
    it('should select all rows when the header checkbox is toggled on', async () => {
      // given
      await createComponent();

      // when
      component.toggleAll(true);

      // then
      expect(component.isSelected(entryOne)).toBe(true);
      expect(component.isSelected(entryTwo)).toBe(true);
      expect(component.allSelected()).toBe(true);
    });

    it('should mark someSelected (indeterminate) when only some rows are checked', async () => {
      // given
      await createComponent();

      // when
      component.toggleRow(entryOne, true);

      // then
      expect(component.someSelected()).toBe(true);
      expect(component.allSelected()).toBe(false);
    });

    it('should clear the selection when the header checkbox is toggled off', async () => {
      // given
      await createComponent();
      component.toggleAll(true);

      // when
      component.toggleAll(false);

      // then
      expect(component.hasSelection()).toBe(false);
    });
  });

  describe('deleteOne', () => {
    it('should open the confirmation dialog for a single entry', async () => {
      // given
      await createComponent();
      dialogOpenSpy.mockReturnValue(stubDialogRef(false));

      // when
      await component.deleteOne(entryOne);

      // then
      expect(dialogOpenSpy).toHaveBeenCalledWith(
        DeleteEntriesDialogComponent,
        expect.objectContaining({ data: { count: 1 } })
      );
    });

    it('should NOT call adminDeleteUserEntries when the user cancels', async () => {
      // given
      const deleteCallable = vi.fn(async () => ({
        data: { deleted: 1, skipped: 0 },
      }));
      await createComponent(
        [entryOne, entryTwo],
        [{ name: 'adminDeleteUserEntries', impl: deleteCallable }]
      );
      dialogOpenSpy.mockReturnValue(stubDialogRef(false));

      // when
      await component.deleteOne(entryOne);

      // then
      expect(deleteCallable).not.toHaveBeenCalled();
    });

    it('should call adminDeleteUserEntries and emit refresh when the user confirms', async () => {
      // given
      const deleteCallable = vi.fn(async () => ({
        data: { deleted: 1, skipped: 0 },
      }));
      await createComponent(
        [entryOne, entryTwo],
        [{ name: 'adminDeleteUserEntries', impl: deleteCallable }]
      );
      dialogOpenSpy.mockReturnValue(stubDialogRef(true));
      const refreshSpy = vi.fn();
      component.refresh.subscribe(refreshSpy);

      // when
      await component.deleteOne(entryOne);

      // then
      expect(deleteCallable).toHaveBeenCalledWith({
        uid: 'user-1',
        entryIds: ['entry-1'],
      });
      expect(refreshSpy).toHaveBeenCalled();
      expect(component.error()).toBeNull();
    });

    it('should show an error and NOT emit refresh when the Cloud Function fails', async () => {
      // given
      const deleteCallable = vi.fn(async () => {
        throw new Error('permission-denied');
      });
      await createComponent(
        [entryOne, entryTwo],
        [{ name: 'adminDeleteUserEntries', impl: deleteCallable }]
      );
      dialogOpenSpy.mockReturnValue(stubDialogRef(true));
      const refreshSpy = vi.fn();
      component.refresh.subscribe(refreshSpy);

      // when
      await component.deleteOne(entryOne);

      // then
      expect(component.error()).toBe('permission-denied');
      expect(refreshSpy).not.toHaveBeenCalled();
    });
  });

  describe('deleteSelected', () => {
    it('should call adminDeleteUserEntries with all selected ids', async () => {
      // given
      const deleteCallable = vi.fn(async () => ({
        data: { deleted: 2, skipped: 0 },
      }));
      await createComponent(
        [entryOne, entryTwo],
        [{ name: 'adminDeleteUserEntries', impl: deleteCallable }]
      );
      component.toggleAll(true);
      dialogOpenSpy.mockReturnValue(stubDialogRef(true));

      // when
      await component.deleteSelected();

      // then
      expect(dialogOpenSpy).toHaveBeenCalledWith(
        DeleteEntriesDialogComponent,
        expect.objectContaining({ data: { count: 2 } })
      );
      expect(deleteCallable).toHaveBeenCalledWith({
        uid: 'user-1',
        entryIds: ['entry-1', 'entry-2'],
      });
    });

    it('should do nothing when nothing is selected', async () => {
      // given
      await createComponent();

      // when
      await component.deleteSelected();

      // then
      expect(dialogOpenSpy).not.toHaveBeenCalled();
    });

    it('should chunk a selection larger than the 500-entry delete batch cap', async () => {
      // given — the page can load up to 1000 entries, above the server's
      // per-call limit, so a full select-all must split into multiple calls
      const manyEntries: ExerciseEntry[] = Array.from(
        { length: 600 },
        (_, i) => ({
          _id: `entry-${i}`,
          userId: 'user-1',
          exerciseId: 'pushup',
          timestamp: '2026-04-09T10:00:00.000Z',
          reps: 10,
          source: 'web',
        })
      );
      const deleteCallable = vi.fn(async (_req: unknown) => ({
        data: { deleted: 500, skipped: 0 },
      }));
      await createComponent(manyEntries, [
        { name: 'adminDeleteUserEntries', impl: deleteCallable },
      ]);
      component.toggleAll(true);
      dialogOpenSpy.mockReturnValue(stubDialogRef(true));

      // when
      await component.deleteSelected();

      // then
      expect(deleteCallable).toHaveBeenCalledTimes(2);
      const requests = deleteCallable.mock.calls as [
        { uid: string; entryIds: string[] },
      ][];
      const [firstCall, secondCall] = requests;
      expect(firstCall[0].entryIds.length).toBe(500);
      expect(secondCall[0].entryIds.length).toBe(100);
      expect(requests.every(([{ uid }]) => uid === 'user-1')).toBe(true);
      expect(requests.flatMap(([{ entryIds }]) => entryIds).sort()).toEqual(
        manyEntries.map(({ _id }) => _id).sort()
      );
    });

    it('should still emit refresh after a later chunk fails, so earlier deletions are reflected', async () => {
      // given
      const manyEntries: ExerciseEntry[] = Array.from(
        { length: 600 },
        (_, i) => ({
          _id: `entry-${i}`,
          userId: 'user-1',
          exerciseId: 'pushup',
          timestamp: '2026-04-09T10:00:00.000Z',
          reps: 10,
          source: 'web',
        })
      );
      const deleteCallable = vi
        .fn()
        .mockResolvedValueOnce({ data: { deleted: 500, skipped: 0 } })
        .mockRejectedValueOnce(new Error('internal'));
      await createComponent(manyEntries, [
        { name: 'adminDeleteUserEntries', impl: deleteCallable },
      ]);
      component.toggleAll(true);
      dialogOpenSpy.mockReturnValue(stubDialogRef(true));
      const refreshSpy = vi.fn();
      component.refresh.subscribe(refreshSpy);

      // when
      await component.deleteSelected();

      // then
      expect(component.error()).toBe('internal');
      expect(refreshSpy).toHaveBeenCalled();
    });
  });
});
