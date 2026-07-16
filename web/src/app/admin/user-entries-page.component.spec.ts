import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { of } from 'rxjs';
import { type ExerciseEntry } from '@pu-stats/models';
import { UserEntriesPageComponent } from './user-entries-page.component';
import { CallableFunctionsService } from './callable-functions.service';
import { createCallablesMock } from './callable-functions.testing';
import { AdminEntryEditDialogComponent } from './entry-edit-dialog.component';

const { callablesMock, setupCallables } = createCallablesMock();

describe('UserEntriesPageComponent', () => {
  let fixture: ComponentFixture<UserEntriesPageComponent>;
  let component: UserEntriesPageComponent;

  const sampleEntry: ExerciseEntry = {
    _id: 'entry-1',
    userId: 'user-1',
    exerciseId: 'pushup',
    timestamp: '2026-04-09T10:00:00.000Z',
    reps: 30,
    source: 'web',
  };

  async function createComponent(
    entries: ExerciseEntry[] = [sampleEntry]
  ): Promise<void> {
    setupCallables([
      { name: 'adminListUserEntries', impl: async () => ({ data: entries }) },
    ]);

    await TestBed.configureTestingModule({
      imports: [UserEntriesPageComponent, MatDialogModule],
      providers: [
        { provide: CallableFunctionsService, useValue: callablesMock },
        provideRouter([]),
        // Listed after provideRouter so this stub wins — the router provides
        // its own ActivatedRoute otherwise, and the page reads `uid` from it.
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ uid: 'user-1' }) },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserEntriesPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should read the uid from the route and load that user’s entries', async () => {
    // given / when
    await createComponent();

    // then
    expect(component.uid).toBe('user-1');
    expect(callablesMock.call).toHaveBeenCalledWith('adminListUserEntries');
    expect(component.entries().length).toBe(1);
  });

  it('should render one table row per entry', async () => {
    // given / when
    await createComponent();

    // then
    const rows = fixture.nativeElement.querySelectorAll(
      'mat-row'
    ) as NodeListOf<HTMLElement>;
    expect(rows.length).toBe(1);
  });

  it('should show the empty message when there are no entries', async () => {
    // given / when
    await createComponent([]);

    // then
    const empty = fixture.nativeElement.querySelector('.empty-text');
    expect(empty).toBeTruthy();
  });

  it('should open the edit dialog for the clicked entry', async () => {
    // given
    await createComponent();
    const dialog = fixture.debugElement.injector.get(MatDialog);
    const openSpy = vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of(undefined),
    } as MatDialogRef<unknown, unknown>);

    // when
    const editButton = fixture.nativeElement.querySelector(
      'mat-cell.mat-column-actions button'
    ) as HTMLButtonElement | null;
    expect(editButton).toBeTruthy();
    editButton?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );
    await fixture.whenStable();

    // then
    expect(openSpy).toHaveBeenCalledWith(
      AdminEntryEditDialogComponent,
      expect.objectContaining({ data: sampleEntry })
    );
  });
});
