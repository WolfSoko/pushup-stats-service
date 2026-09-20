import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { RebrandIntroDialogComponent } from './rebrand-intro-dialog.component';

async function setup() {
  const dialogRef = { close: vitest.fn() };
  const navigateByUrl = vitest.fn().mockResolvedValue(true);
  await render(RebrandIntroDialogComponent, {
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: Router, useValue: { navigateByUrl } },
    ],
  });
  return { dialogRef, navigateByUrl };
}

describe('RebrandIntroDialogComponent', () => {
  it('should announce the rename before promising what stays', async () => {
    // given the dialog on its first step
    await setup();
    const user = userEvent.setup();

    // then it leads with the news, and there is nothing to go back to
    expect(screen.getByTestId('intro-step-title').textContent?.trim()).toBe(
      'Ein neuer Name kommt'
    );
    expect(screen.queryByTestId('intro-back')).toBeNull();

    // when stepping forward
    await user.click(screen.getByTestId('intro-next'));

    // then the reassurance follows — a rename's first worry is loss, so it
    // is answered inside the same walkthrough rather than in the article
    expect(screen.getByTestId('intro-step-title').textContent?.trim()).toBe(
      'Dein Fortschritt bleibt'
    );
    expect(screen.queryByTestId('intro-next')).toBeNull();
    expect(screen.getByTestId('intro-start')).toBeTruthy();
  });

  it('should let the user step back', async () => {
    // given the dialog on its last step
    await setup();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('intro-next'));

    // when going back
    await user.click(screen.getByTestId('intro-back'));

    // then the first step is up again
    expect(screen.getByTestId('intro-step-title').textContent?.trim()).toBe(
      'Ein neuer Name kommt'
    );
  });

  it('should open the article from the last step', async () => {
    // given the dialog on its last step
    const { dialogRef, navigateByUrl } = await setup();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('intro-next'));

    // when confirming
    await user.click(screen.getByTestId('intro-start'));

    // then it closes and lands on the announcement post
    expect(dialogRef.close).toHaveBeenCalledWith('start');
    expect(navigateByUrl).toHaveBeenCalledWith('/blog/neuer-name-kommt');
  });

  it('should let the user put it off', async () => {
    // given the dialog
    const { dialogRef, navigateByUrl } = await setup();

    // when dismissing it
    await userEvent.setup().click(screen.getByTestId('intro-later'));

    // then nothing is opened
    expect(dialogRef.close).toHaveBeenCalledWith('later');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
