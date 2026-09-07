import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import type {
  PlanSwitchChoice,
  PlanSwitchDialogData,
} from './plan-switch-dialog.component';

/**
 * Opens the keep-or-discard prompt shown when a plan replaces another.
 *
 * A service rather than a direct `MatDialog.open` call so tests can
 * substitute the answer through Angular DI, matching how
 * `SessionDialogsService` seams the capture tools.
 */
@Injectable({ providedIn: 'root' })
export class PlanSwitchDialogService {
  private readonly dialog = inject(MatDialog);

  /** Resolves to `null` when the user dismissed the dialog. */
  async confirmSwitch(
    data: PlanSwitchDialogData
  ): Promise<PlanSwitchChoice | null> {
    const { PlanSwitchDialogComponent } =
      await import('./plan-switch-dialog.component');
    const ref = this.dialog.open(PlanSwitchDialogComponent, {
      data,
      width: '32rem',
      maxWidth: '92vw',
    });
    return (await firstValueFrom(ref.afterClosed())) ?? null;
  }
}
