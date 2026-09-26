import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { UserContextService } from '@pu-auth/auth';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { ProfileXpIntroDialogComponent } from './profile-xp-intro-dialog.component';

async function setup() {
  const dialogRef = { close: vitest.fn() };
  const navigateByUrl = vitest.fn().mockResolvedValue(true);
  await render(ProfileXpIntroDialogComponent, {
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: Router, useValue: { navigateByUrl } },
      { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
    ],
  });
  return { dialogRef, navigateByUrl };
}

function stepTitle(): string | undefined {
  return screen.getByTestId('intro-step-title').textContent?.trim();
}

describe('ProfileXpIntroDialogComponent', () => {
  it('should walk through the XP card, the cross-exercise stats and who sees them', async () => {
    // given
    await setup();
    const user = userEvent.setup();
    expect(stepTitle()).toBe('Dein Level ganz oben');

    // when
    await user.click(screen.getByTestId('intro-next'));
    expect(stepTitle()).toBe('Jede Übung zählt');
    await user.click(screen.getByTestId('intro-next'));

    // then
    expect(stepTitle()).toBe('Du entscheidest, wer es sieht');
    expect(screen.getByTestId('intro-start')).toBeTruthy();
  });

  it('should land the user on their own profile from the last step', async () => {
    // given
    const { dialogRef, navigateByUrl } = await setup();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('intro-next'));
    await user.click(screen.getByTestId('intro-next'));

    // when
    await user.click(screen.getByTestId('intro-start'));

    // then
    expect(dialogRef.close).toHaveBeenCalledWith('start');
    expect(navigateByUrl).toHaveBeenCalledWith('/u/u1');
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
