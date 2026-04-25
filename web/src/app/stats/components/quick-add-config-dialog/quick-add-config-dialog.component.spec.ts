import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { QuickAddConfig, UserConfigUpdate } from '@pu-stats/models';
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
    it('Then three empty rows are rendered', () => {
      setup();
      const rows = fixture.nativeElement.querySelectorAll(
        '[data-testid^="quick-add-row-"]'
      );
      expect(rows.length).toBe(3);
    });
  });

  describe('Given the dialog opens with two configured buttons', () => {
    it('Then the first two rows are prefilled and the third is empty', () => {
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
      expect(patch.ui?.quickAdds).toEqual([
        { reps: 15, inSpeedDial: false },
        { reps: 40, inSpeedDial: false },
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
});
