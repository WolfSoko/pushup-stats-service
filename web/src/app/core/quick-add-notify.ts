import type { MatSnackBar } from '@angular/material/snack-bar';
import { pushupValidationMessage } from '@pu-stats/data-access';

const SNACKBAR_POSITION = {
  horizontalPosition: 'center',
  verticalPosition: 'bottom',
} as const;

export function notifyEntrySaved(snackBar: MatSnackBar): void {
  snackBar.open(
    $localize`:@@quickAdd.success.create:Eintrag gespeichert.`,
    '',
    {
      duration: 2000,
      ...SNACKBAR_POSITION,
    }
  );
}

export function notifyGoalReached(snackBar: MatSnackBar): void {
  snackBar.open(
    $localize`:@@quickAdd.success.goalReached:Tagesziel erreicht 🎉`,
    '',
    { duration: 2500, ...SNACKBAR_POSITION }
  );
}

export function notifyError(snackBar: MatSnackBar, err?: unknown): void {
  snackBar.open(pushupValidationMessage(err), '', {
    duration: 4000,
    ...SNACKBAR_POSITION,
  });
}
