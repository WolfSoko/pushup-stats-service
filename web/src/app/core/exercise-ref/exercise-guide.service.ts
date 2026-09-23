import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

/**
 * Opens the in-place exercise guide. The dialog is imported on demand
 * because it pulls in the generated wiki content, which no caller should
 * carry in its own chunk just for a button.
 */
@Injectable({ providedIn: 'root' })
export class ExerciseGuideService {
  private readonly dialog = inject(MatDialog);

  async open(exerciseId: string, variantId?: string | null): Promise<void> {
    const { ExerciseGuideDialogComponent } =
      await import('./exercise-guide-dialog.component');
    this.dialog.open(ExerciseGuideDialogComponent, {
      data: { exerciseId, variantId },
      width: '520px',
      maxWidth: '95vw',
      autoFocus: 'dialog',
    });
  }
}
