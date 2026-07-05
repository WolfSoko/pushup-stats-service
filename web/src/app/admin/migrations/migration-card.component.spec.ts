import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CallableFunctionsService } from '../callable-functions.service';
import { MigrationCardComponent } from './migration-card.component';
import { MigrationDescriptor } from './migration-descriptors';

interface CallableRecord {
  name: string;
  impl: (data: unknown) => Promise<{ data: unknown }>;
}

// Faked via DI instead of vi.mock('@angular/fire/functions'): module
// mocks of the fire package break whenever the spec bundler moves it
// into a shared chunk (the mocked `Functions` token and the component's
// bundled one are then different classes -> NG0201), and which admin
// spec breaks shifts with the workspace's overall spec-file set.
const callablesMock = { call: vi.fn() };

function setupCallables(records: CallableRecord[]): void {
  callablesMock.call.mockImplementation((name: string) => {
    const match = records.find((r) => r.name === name);
    if (!match) {
      return async () => {
        throw new Error(`Unexpected callable: ${name}`);
      };
    }
    return match.impl;
  });
}

const WITH_ROLLBACK: MigrationDescriptor = {
  id: 'pushup-unification',
  title: 'Liegestütze vereinheitlichen',
  description: 'Kopiert pushups nach exerciseEntries.',
  migrate: { callable: 'migratePushupsToExerciseEntries' },
  rollback: { callable: 'rollbackPushupUnification' },
};

describe('MigrationCardComponent', () => {
  let fixture: ComponentFixture<MigrationCardComponent>;
  let component: MigrationCardComponent;

  async function createComponent(
    migration: MigrationDescriptor,
    callables: CallableRecord[]
  ): Promise<void> {
    setupCallables(callables);
    await TestBed.configureTestingModule({
      imports: [MigrationCardComponent],
      providers: [
        { provide: CallableFunctionsService, useValue: callablesMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MigrationCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('migration', migration);
    fixture.detectChanges();
  }

  /** Click the button whose visible label matches `label`. */
  async function clickButton(label: string): Promise<void> {
    const button = fixture.debugElement
      .queryAll(By.css('button'))
      .find((b) => (b.nativeElement.textContent ?? '').includes(label));
    if (!button) throw new Error(`Button not found: ${label}`);
    button.nativeElement.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function buttonByLabel(label: string): HTMLButtonElement {
    const button = fixture.debugElement
      .queryAll(By.css('button'))
      .find((b) => (b.nativeElement.textContent ?? '').includes(label));
    if (!button) throw new Error(`Button not found: ${label}`);
    return button.nativeElement as HTMLButtonElement;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run a dry-run migrate and render the returned counters', async () => {
    // given a migration whose dry-run reports what it would copy
    await createComponent(WITH_ROLLBACK, [
      {
        name: 'migratePushupsToExerciseEntries',
        impl: async () => ({
          data: { dryRun: true, wouldCopy: 12, wouldSkipExisting: 0 },
        }),
      },
    ]);

    // when the operator clicks the migrate "Probelauf"
    await clickButton('Probelauf');

    // then the callable is invoked with dryRun:true and counters render
    expect(callablesMock.call).toHaveBeenCalledWith(
      'migratePushupsToExerciseEntries',
      expect.objectContaining({ timeout: expect.any(Number) })
    );
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('wouldCopy');
    expect(text).toContain('12');
  });

  it('should keep the live migrate run disabled until a dry-run completes', async () => {
    // given a migration whose callable records the dryRun flag it received
    const calls: boolean[] = [];
    await createComponent(WITH_ROLLBACK, [
      {
        name: 'migratePushupsToExerciseEntries',
        impl: async (data) => {
          calls.push((data as { dryRun: boolean }).dryRun);
          return { data: { copied: 12 } };
        },
      },
    ]);

    // then the live "Ausführen" button starts disabled
    expect(buttonByLabel('Ausführen').disabled).toBe(true);

    // when a dry-run completes
    await clickButton('Probelauf');

    // then the live run is unlocked
    expect(buttonByLabel('Ausführen').disabled).toBe(false);

    // when the operator runs it for real
    await clickButton('Ausführen');

    // then the callable was called dry first, then live
    expect(calls).toEqual([true, false]);
  });

  it('should surface a callable error', async () => {
    // given a callable that rejects
    await createComponent(WITH_ROLLBACK, [
      {
        name: 'migratePushupsToExerciseEntries',
        impl: async () => {
          throw new Error('permission-denied');
        },
      },
    ]);

    // when the dry-run is attempted
    await clickButton('Probelauf');

    // then the error message is shown
    expect(fixture.nativeElement.textContent).toContain('permission-denied');
  });

  it('should render a rollback action when the descriptor declares one', async () => {
    // given a descriptor with a rollback callable
    await createComponent(WITH_ROLLBACK, [
      {
        name: 'rollbackPushupUnification',
        impl: async () => ({ data: { dryRun: true, wouldDelete: 5 } }),
      },
    ]);

    // when the rollback dry-run runs (second "Probelauf" group)
    const dryRunButtons = fixture.debugElement
      .queryAll(By.css('button'))
      .filter((b) => (b.nativeElement.textContent ?? '').includes('Probelauf'));
    expect(dryRunButtons.length).toBe(2);
    dryRunButtons[1].nativeElement.click();
    await fixture.whenStable();
    fixture.detectChanges();

    // then the rollback callable is invoked and its counter renders
    expect(callablesMock.call).toHaveBeenCalledWith(
      'rollbackPushupUnification',
      expect.objectContaining({ timeout: expect.any(Number) })
    );
    expect(fixture.nativeElement.textContent).toContain('wouldDelete');
  });

  it('should not render a rollback action when the descriptor omits one', async () => {
    // given a migration without a rollback callable
    const noRollback: MigrationDescriptor = {
      id: 'one-way',
      title: 'Einbahn-Migration',
      description: 'Keine Umkehr.',
      migrate: { callable: 'migratePushupsToExerciseEntries' },
    };
    await createComponent(noRollback, [
      {
        name: 'migratePushupsToExerciseEntries',
        impl: async () => ({ data: { copied: 1 } }),
      },
    ]);

    // then only the single (migrate) dry-run button exists
    const dryRunButtons = fixture.debugElement
      .queryAll(By.css('button'))
      .filter((b) => (b.nativeElement.textContent ?? '').includes('Probelauf'));
    expect(dryRunButtons.length).toBe(1);
    expect(component.migration().rollback).toBeUndefined();
  });

  it('should emit statusChange(true) when marking an open migration complete', async () => {
    // given an open (not-completed) migration
    await createComponent(WITH_ROLLBACK, []);
    const emitted: boolean[] = [];
    component.statusChange.subscribe((v) => emitted.push(v));

    // when the operator clicks "Als abgeschlossen markieren"
    await clickButton('Als abgeschlossen markieren');

    // then it requests completion
    expect(emitted).toEqual([true]);
  });

  it('should show a completed chip and emit statusChange(false) on reopen', async () => {
    // given a completed migration
    await createComponent(WITH_ROLLBACK, []);
    fixture.componentRef.setInput('status', {
      completed: true,
      completedAt: '2026-06-04T10:00:00.000Z',
      completedBy: 'admin-uid',
    });
    fixture.detectChanges();
    const emitted: boolean[] = [];
    component.statusChange.subscribe((v) => emitted.push(v));

    // then the completed chip is shown
    expect(fixture.nativeElement.textContent).toContain('Abgeschlossen');

    // when the operator reopens it
    await clickButton('Wieder öffnen');

    // then it requests reopening
    expect(emitted).toEqual([false]);
  });
});
