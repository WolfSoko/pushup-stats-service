import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { WorkoutsIntroDialogComponent } from './workouts-intro-dialog.component';

async function setup() {
  const dialogRef = { close: vitest.fn() };
  const navigateByUrl = vitest.fn().mockResolvedValue(true);
  await render(WorkoutsIntroDialogComponent, {
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: Router, useValue: { navigateByUrl } },
    ],
  });
  return { dialogRef, navigateByUrl };
}

describe('WorkoutsIntroDialogComponent', () => {
  it('should walk through composing, running and sharing', async () => {
    // given
    await setup();
    const user = userEvent.setup();
    expect(screen.getByTestId('intro-step-title').textContent).toBe(
      'Zusammenstellen'
    );
    expect(screen.queryByTestId('intro-back')).toBeNull();

    // when
    await user.click(screen.getByTestId('intro-next'));
    expect(screen.getByTestId('intro-step-title').textContent).toBe(
      'Geführt durchführen'
    );
    await user.click(screen.getByTestId('intro-next'));

    // then — the last step offers the editor instead of "next"
    expect(screen.getByTestId('intro-step-title').textContent).toBe('Teilen');
    expect(screen.queryByTestId('intro-next')).toBeNull();
    expect(screen.getByTestId('intro-start')).toBeTruthy();

    await user.click(screen.getByTestId('intro-back'));
    expect(screen.getByTestId('intro-step-title').textContent).toBe(
      'Geführt durchführen'
    );
  });

  it('should land the user in the editor from the last step', async () => {
    // given
    const { dialogRef, navigateByUrl } = await setup();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('intro-next'));
    await user.click(screen.getByTestId('intro-next'));

    // when
    await user.click(screen.getByTestId('intro-start'));

    // then
    expect(dialogRef.close).toHaveBeenCalledWith('start');
    expect(navigateByUrl).toHaveBeenCalledWith('/workouts/new');
  });

  it('should let the user put it off', async () => {
    const { dialogRef, navigateByUrl } = await setup();
    await userEvent.setup().click(screen.getByTestId('intro-later'));
    expect(dialogRef.close).toHaveBeenCalledWith('later');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
