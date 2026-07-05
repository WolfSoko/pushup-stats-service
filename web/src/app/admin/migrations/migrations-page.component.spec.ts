import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CallableFunctionsService } from '../callable-functions.service';
import {
  CallableRecord,
  createCallablesMock,
} from '../callable-functions.testing';
import { MigrationsPageComponent } from './migrations-page.component';

const { callablesMock, setupCallables } = createCallablesMock();

describe('MigrationsPageComponent', () => {
  let fixture: ComponentFixture<MigrationsPageComponent>;
  let component: MigrationsPageComponent;

  async function createComponent(callables: CallableRecord[]): Promise<void> {
    setupCallables(callables);
    await TestBed.configureTestingModule({
      imports: [MigrationsPageComponent],
      providers: [
        { provide: CallableFunctionsService, useValue: callablesMock },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MigrationsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load migration statuses on init', async () => {
    // given a stored completed status for the pushup migration
    await createComponent([
      {
        name: 'getMigrationStatuses',
        impl: async () => ({
          data: {
            statuses: {
              'pushup-unification': {
                completed: true,
                completedAt: '2026-06-04T10:00:00.000Z',
                completedBy: 'admin-uid',
              },
            },
          },
        }),
      },
    ]);

    // then the page exposes it to the cards
    expect(component.statuses()['pushup-unification']?.completed).toBe(true);
    expect(callablesMock.call).toHaveBeenCalledWith('getMigrationStatuses');
  });

  it('should persist a status toggle via setMigrationStatus', async () => {
    // given an empty initial status set
    let setArg: unknown = null;
    await createComponent([
      {
        name: 'getMigrationStatuses',
        impl: async () => ({ data: { statuses: {} } }),
      },
      {
        name: 'setMigrationStatus',
        impl: async (data) => {
          setArg = data;
          return {
            data: {
              id: 'pushup-unification',
              completed: true,
              completedAt: '2026-06-04T10:00:00.000Z',
              completedBy: 'admin-uid',
            },
          };
        },
      },
    ]);

    // when a card requests completion
    await component.setStatus('pushup-unification', true);
    fixture.detectChanges();

    // then the callable is invoked and local state updates
    expect(setArg).toEqual({ id: 'pushup-unification', completed: true });
    expect(component.statuses()['pushup-unification']?.completed).toBe(true);
    expect(component.busyId()).toBeNull();
  });
});
