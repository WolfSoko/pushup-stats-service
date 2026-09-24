import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { WorkoutRemindersIntroDialogComponent } from './workout-reminders-intro-dialog.component';

async function setup() {
  const dialogRef = { close: vitest.fn() };
  const navigateByUrl = vitest.fn().mockResolvedValue(true);
  await render(WorkoutRemindersIntroDialogComponent, {
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: Router, useValue: { navigateByUrl } },
    ],
  });
  return { dialogRef, navigateByUrl };
}

function stepTitle(): string | undefined {
  return screen.getByTestId('intro-step-title').textContent?.trim();
}

describe('WorkoutRemindersIntroDialogComponent', () => {
  it('should walk through what reminders are, how to set one and push', async () => {
    // given
    await setup();
    const user = userEvent.setup();
    expect(stepTitle()).toBe('Erinnerungen für deine Sessions');
    expect(screen.queryByTestId('intro-back')).toBeNull();

    // when
    await user.click(screen.getByTestId('intro-next'));
    expect(stepTitle()).toBe('So richtest du sie ein');
    await user.click(screen.getByTestId('intro-next'));

    // then
    expect(stepTitle()).toBe('Push aufs Handy');
    expect(screen.queryByTestId('intro-next')).toBeNull();
    expect(screen.getByTestId('intro-start')).toBeTruthy();
  });

  it('should land the user on the sessions list from the last step', async () => {
    // given
    const { dialogRef, navigateByUrl } = await setup();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('intro-next'));
    await user.click(screen.getByTestId('intro-next'));

    // when
    await user.click(screen.getByTestId('intro-start'));

    // then
    expect(dialogRef.close).toHaveBeenCalledWith('start');
    expect(navigateByUrl).toHaveBeenCalledWith('/workouts');
  });

  it('should let the user put it off', async () => {
    // given
    const { dialogRef, navigateByUrl } = await setup();

    // when
    await userEvent.setup().click(screen.getByTestId('intro-later'));

    // then
    expect(dialogRef.close).toHaveBeenCalledWith('later');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
