import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { of } from 'rxjs';
import { type ExerciseEntry } from '@pu-stats/models';
import { AdminUser } from './admin-page.models';
import { CallableFunctionsService } from './callable-functions.service';
import {
  CallableRecord,
  createCallablesMock,
} from './callable-functions.testing';
import { UserEntriesDialogComponent } from './user-entries-dialog.component';

const { callablesMock, setupCallables } = createCallablesMock();

describe('UserEntriesDialogComponent', () => {
  let fixture: ComponentFixture<UserEntriesDialogComponent>;
  let component: UserEntriesDialogComponent;
  let dialogOpenSpy: ReturnType<typeof vi.spyOn>;

  const user: AdminUser = {
    uid: 'user-1',
    displayName: 'Alice',
    email: 'alice@example.com',
    anonymous: false,
    entryCount: 2,
    lastEntry: '2026-04-02T08:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    role: null,
  };

  const entry: ExerciseEntry = {
    _id: 'e1',
    userId: 'user-1',
    exerciseId: 'legs.squats',
    timestamp: '2026-04-01T10:00:00.000Z',
    reps: 30,
    source: 'web',
  };

  function stubDialogRef<T>(result: T): MatDialogRef<unknown, T> {
    return { afterClosed: () => of(result) } as MatDialogRef<unknown, T>;
  }

  async function createComponent(
    entries: ExerciseEntry[] = [entry],
    extraCallables: CallableRecord[] = []
  ): Promise<void> {
    setupCallables([
      { name: 'adminListUserEntries', impl: async () => ({ data: entries }) },
      ...extraCallables,
    ]);

    await TestBed.configureTestingModule({
      imports: [UserEntriesDialogComponent, MatDialogModule],
      providers: [
        { provide: CallableFunctionsService, useValue: callablesMock },
        { provide: MAT_DIALOG_DATA, useValue: { user } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserEntriesDialogComponent);
    component = fixture.componentInstance;
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

  it('should load the user entries via the adminListUserEntries callable', async () => {
    // given / when
    await createComponent();

    // then
    expect(callablesMock.call).toHaveBeenCalledWith('adminListUserEntries');
    expect(component.entries().length).toBe(1);
  });

  it('should render a row per entry', async () => {
    // given / when
    await createComponent();

    // then
    const rows = fixture.nativeElement.querySelectorAll('mat-row');
    expect(rows.length).toBe(1);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Kniebeugen');
  });

  it('should show the empty message when the user has no entries', async () => {
    // given / when
    await createComponent([]);

    // then
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Keine Einträge');
  });

  it('should patch an entry via adminUpdateUserEntry and update the local row', async () => {
    // given
    const updateSpy = vi.fn(async () => ({ data: { ok: true } }));
    await createComponent(
      [entry],
      [{ name: 'adminUpdateUserEntry', impl: updateSpy }]
    );
    dialogOpenSpy.mockReturnValue(stubDialogRef({ reps: 45 }));

    // when
    await component.openEditDialog(entry);

    // then
    expect(updateSpy).toHaveBeenCalledWith({
      uid: 'user-1',
      entryId: 'e1',
      patch: { reps: 45 },
    });
    expect(component.entries()[0].reps).toBe(45);
  });

  it('should not call the update callable when the edit dialog is dismissed', async () => {
    // given
    const updateSpy = vi.fn(async () => ({ data: { ok: true } }));
    await createComponent(
      [entry],
      [{ name: 'adminUpdateUserEntry', impl: updateSpy }]
    );
    dialogOpenSpy.mockReturnValue(stubDialogRef(undefined));

    // when
    await component.openEditDialog(entry);

    // then
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
