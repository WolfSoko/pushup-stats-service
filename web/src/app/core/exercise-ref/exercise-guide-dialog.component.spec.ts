import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';

import {
  ExerciseGuideDialogComponent,
  type ExerciseGuideDialogData,
} from './exercise-guide-dialog.component';

async function setup(data: ExerciseGuideDialogData) {
  await render(ExerciseGuideDialogComponent, {
    providers: [
      provideRouter([]),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close: vitest.fn() } },
    ],
  });
}

describe('ExerciseGuideDialogComponent', () => {
  it('should show the steps of an exercise and link its wiki article', async () => {
    // given / when
    await setup({ exerciseId: 'legs.squats' });

    // then
    expect(screen.getByTestId('exercise-guide-title').textContent).toContain(
      'Kniebeugen'
    );
    expect(
      screen.getByTestId('exercise-guide-steps').querySelectorAll('li').length
    ).toBeGreaterThan(0);
    expect(screen.getByTestId('exercise-guide-wiki').getAttribute('href')).toBe(
      '/wiki/uebungen/squats'
    );
  });

  it('should link a pushup type to its own page in the pushup wiki', async () => {
    // given / when
    await setup({ exerciseId: 'pushup', variantId: 'diamond' });

    // then
    expect(screen.getByTestId('exercise-guide-wiki').getAttribute('href')).toBe(
      '/wiki/liegestuetz-typen/diamant'
    );
  });

  it('should say so when an exercise has no guide yet', async () => {
    // given / when
    await setup({ exerciseId: 'pushup' });

    // then
    expect(screen.queryByTestId('exercise-guide-steps')).toBeNull();
    expect(screen.getByText(/noch keine Anleitung/)).toBeTruthy();
  });
});
