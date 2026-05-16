import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  MAX_QUICK_ADDS,
  QuickAddConfig,
  UserConfigUpdate,
} from '@pu-stats/models';
import { QuickAddConfigDialogComponent } from './quick-add-config-dialog.component';
import { UserConfigStore } from '../../../core/user-config.store';
import { signal } from '@angular/core';

describe('QuickAddConfigDialogComponent', () => {
  let fixture: ComponentFixture<QuickAddConfigDialogComponent>;
  let closeSpy: ReturnType<typeof vitest.fn>;
  let saveSpy: ReturnType<typeof vitest.fn>;
  let snackBarSpy: ReturnType<typeof vitest.fn>;

  const quickAdds = signal<QuickAddConfig[]>([]);

  function setup(
    initial: QuickAddConfig[] = [],
    saveImpl: (patch: UserConfigUpdate) => Promise<unknown> = (patch) => {
      if (patch.ui?.quickAdds) quickAdds.set(patch.ui.quickAdds);
      return Promise.resolve({ userId: 'u1', ...patch });
    }
  ): void {
    quickAdds.set(initial);
    closeSpy = vitest.fn();
    saveSpy = vitest.fn(saveImpl);
    snackBarSpy = vitest.fn();

    TestBed.configureTestingModule({
      imports: [QuickAddConfigDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: { close: closeSpy } },
        { provide: MatSnackBar, useValue: { open: snackBarSpy } },
        {
          provide: UserConfigStore,
          useValue: {
            quickAdds: quickAdds.asReadonly(),
            config: () => ({ userId: 'u1' }),
            save: saveSpy,
          },
        },
      ],
    });

    fixture = TestBed.createComponent(QuickAddConfigDialogComponent);
    fixture.detectChanges();
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('Given the dialog opens with no previously configured buttons', () => {
    it(`Then ${MAX_QUICK_ADDS} empty rows are rendered`, () => {
      setup();
      const rows = fixture.nativeElement.querySelectorAll(
        '[data-testid^="quick-add-row-"]'
      );
      expect(rows.length).toBe(MAX_QUICK_ADDS);
    });
  });

  describe('Given the dialog opens with two configured buttons', () => {
    it('Then the first two rows are prefilled and the rest are empty', () => {
      setup([
        { reps: 15, inSpeedDial: true },
        { reps: 25, inSpeedDial: false },
      ]);
      const inputs = fixture.nativeElement.querySelectorAll(
        'input[type="number"]'
      );
      expect((inputs[0] as HTMLInputElement).value).toBe('15');
      expect((inputs[1] as HTMLInputElement).value).toBe('25');
      expect((inputs[2] as HTMLInputElement).value).toBe('');
    });
  });

  describe('When save is clicked', () => {
    it('Then it persists only rows with reps > 0 via UserConfigStore.save', async () => {
      setup();
      const inputs = fixture.nativeElement.querySelectorAll(
        'input[type="number"]'
      ) as NodeListOf<HTMLInputElement>;

      // Fill row 0 with 15 reps, leave row 1 empty, fill row 2 with 40 reps
      inputs[0].value = '15';
      inputs[0].dispatchEvent(new Event('input'));
      inputs[2].value = '40';
      inputs[2].dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const saveBtn = fixture.nativeElement.querySelector(
        '[data-testid="quick-add-config-save"]'
      ) as HTMLButtonElement;
      saveBtn.click();
      await fixture.whenStable();

      expect(saveSpy).toHaveBeenCalledTimes(1);
      const patch = saveSpy.mock.calls[0][0] as UserConfigUpdate;
      // Each persisted row carries the legacy pushup default for
      // backwards-compat with configs created before the multi-exercise
      // schema landed.
      expect(patch.ui?.quickAdds).toEqual([
        { reps: 15, inSpeedDial: false, exerciseId: 'pushup', mode: 'reps' },
        { reps: 40, inSpeedDial: false, exerciseId: 'pushup', mode: 'reps' },
      ]);
      expect(closeSpy).toHaveBeenCalled();
    });

    it('Given save fails, Then a snackbar error is shown and the dialog stays open', async () => {
      setup([], () => Promise.reject(new Error('network')));
      const inputs = fixture.nativeElement.querySelectorAll(
        'input[type="number"]'
      ) as NodeListOf<HTMLInputElement>;
      inputs[0].value = '20';
      inputs[0].dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const saveBtn = fixture.nativeElement.querySelector(
        '[data-testid="quick-add-config-save"]'
      ) as HTMLButtonElement;
      saveBtn.click();
      await fixture.whenStable();

      expect(snackBarSpy).toHaveBeenCalled();
      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('Then clearing all rows saves an empty array (revert to defaults)', async () => {
      setup([{ reps: 15, inSpeedDial: true }]);
      const inputs = fixture.nativeElement.querySelectorAll(
        'input[type="number"]'
      ) as NodeListOf<HTMLInputElement>;
      inputs[0].value = '';
      inputs[0].dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const saveBtn = fixture.nativeElement.querySelector(
        '[data-testid="quick-add-config-save"]'
      ) as HTMLButtonElement;
      saveBtn.click();
      await fixture.whenStable();

      const patch = saveSpy.mock.calls[0][0] as UserConfigUpdate;
      expect(patch.ui?.quickAdds).toEqual([]);
    });
  });

  // Regression: prior to the multi-exercise extension the dialog only
  // captured reps + speedDial. The new exercise picker must propagate
  // the chosen exerciseId into the persisted QuickAddConfig so the
  // dashboard renders the right label and the click routes to the
  // exerciseEntries collection rather than the legacy pushups one.
  describe('When the user picks a non-pushup exercise', () => {
    it('Then save persists exerciseId on that row', async () => {
      setup([{ reps: 12, inSpeedDial: false }]);
      const component = fixture.componentInstance as unknown as {
        setExerciseId(i: number, id: string): void;
      };
      component.setExerciseId(0, 'abs.situps');
      fixture.detectChanges();

      const saveBtn = fixture.nativeElement.querySelector(
        '[data-testid="quick-add-config-save"]'
      ) as HTMLButtonElement;
      saveBtn.click();
      await fixture.whenStable();

      const patch = saveSpy.mock.calls[0][0] as UserConfigUpdate;
      expect(patch.ui?.quickAdds).toEqual([
        {
          reps: 12,
          inSpeedDial: false,
          exerciseId: 'abs.situps',
          mode: 'reps',
        },
      ]);
    });
  });

  describe('When the user enables Auto-Messung on an auto-count-capable exercise', () => {
    it('Then the row persists as mode "auto-count" with reps=0', async () => {
      setup([{ reps: 10, inSpeedDial: false }]); // default exerciseId=pushup, which IS auto-count-capable
      const component = fixture.componentInstance as unknown as {
        setAutoCount(i: number, checked: boolean): void;
      };
      component.setAutoCount(0, true);
      fixture.detectChanges();

      const saveBtn = fixture.nativeElement.querySelector(
        '[data-testid="quick-add-config-save"]'
      ) as HTMLButtonElement;
      saveBtn.click();
      await fixture.whenStable();

      const patch = saveSpy.mock.calls[0][0] as UserConfigUpdate;
      expect(patch.ui?.quickAdds).toEqual([
        {
          reps: 0,
          inSpeedDial: false,
          exerciseId: 'pushup',
          mode: 'auto-count',
        },
      ]);
    });
  });

  describe('When the selected exercise is not auto-count-capable', () => {
    it('Then the auto-count checkbox is hidden and mode resets to reps', async () => {
      setup([
        {
          reps: 15,
          inSpeedDial: false,
          exerciseId: 'pushup',
          mode: 'auto-count',
        },
      ]);
      // pick a rep-based exercise without a detector profile
      const component = fixture.componentInstance as unknown as {
        setExerciseId(i: number, id: string): void;
      };
      component.setExerciseId(0, 'hinge.goodmorning');
      fixture.detectChanges();

      // checkbox for row 0 should not be present
      const autoCountCheckbox = fixture.nativeElement.querySelector(
        '[data-testid="quick-add-autocount-0"]'
      );
      expect(autoCountCheckbox).toBeNull();

      // and a save must coerce mode back to 'reps' so we don't persist
      // an unreachable auto-count config for an unsupported exercise.
      const saveBtn = fixture.nativeElement.querySelector(
        '[data-testid="quick-add-config-save"]'
      ) as HTMLButtonElement;
      saveBtn.click();
      await fixture.whenStable();

      const patch = saveSpy.mock.calls[0][0] as UserConfigUpdate;
      expect(patch.ui?.quickAdds?.[0]).toEqual(
        expect.objectContaining({
          exerciseId: 'hinge.goodmorning',
          mode: 'reps',
        })
      );
    });
  });
});
