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
import {
  CallableRecord,
  createCallablesMock,
} from './callable-functions.testing';
import { TrainingEntryDialogComponent } from '../stats/components/training-entry-dialog/training-entry-dialog.component';
import { AdminUserDetails } from './admin-page.models';

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

  const sampleDetails: AdminUserDetails = {
    uid: 'user-1',
    displayName: 'Alice',
    email: 'alice@example.com',
    anonymous: false,
    role: 'admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    entryCount: 12,
    lastEntry: '2026-04-09T10:00:00.000Z',
    publicProfile: true,
    activePlan: { planId: 'recruit-6w', startDate: '2026-04-01' },
  };

  async function createComponent(
    entries: ExerciseEntry[] = [sampleEntry],
    extraCallables: CallableRecord[] = []
  ): Promise<void> {
    setupCallables([
      { name: 'adminListUserEntries', impl: async () => ({ data: entries }) },
      {
        name: 'adminGetUserDetails',
        impl: async () => ({ data: sampleDetails }),
      },
      ...extraCallables,
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

  it('should load user details for the header', async () => {
    // given / when
    await createComponent();

    // then
    expect(callablesMock.call).toHaveBeenCalledWith('adminGetUserDetails');
    expect(component.details()?.email).toBe('alice@example.com');
    // active plan id resolves to a catalog title (or the id as fallback)
    expect(component.activePlanTitle()).toBeTruthy();
  });

  it('should render the public-profile and admin badges from details', async () => {
    // given / when
    await createComponent();

    // then
    const chips = fixture.nativeElement.querySelectorAll(
      'mat-chip'
    ) as NodeListOf<HTMLElement>;
    const text = Array.from(chips)
      .map((c) => c.textContent ?? '')
      .join(' ');
    expect(text).toContain('Admin');
    expect(text).toContain('Öffentliches Profil');
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

  it('should open the shared training dialog for the clicked entry', async () => {
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

    // then — the pushup row opens the shared dialog in pushup mode
    expect(openSpy).toHaveBeenCalledWith(
      TrainingEntryDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'pushup',
          reps: 30,
          source: 'web',
        }),
      })
    );
  });

  it('should persist a dialog result via adminUpdateUserEntry and reload', async () => {
    // given
    const update = vi.fn(async () => ({ data: { ok: true } }));
    await createComponent(
      [sampleEntry],
      [{ name: 'adminUpdateUserEntry', impl: update }]
    );
    const dialog = fixture.debugElement.injector.get(MatDialog);
    vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () =>
        of({
          kind: 'pushup',
          timestamp: '2026-04-10T08:00:00.000+02:00',
          reps: 40,
          sets: [40],
          source: 'quick-add',
          type: '',
        }),
    } as MatDialogRef<unknown, unknown>);

    // when
    await component.openEditDialog(sampleEntry);

    // then
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'user-1',
        entryId: 'entry-1',
        patch: expect.objectContaining({
          reps: 40,
          source: 'quick-add',
          timestamp: '2026-04-10T08:00:00.000+02:00',
        }),
      })
    );
  });
});
