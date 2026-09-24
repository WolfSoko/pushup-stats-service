import type { MatSnackBar } from '@angular/material/snack-bar';
import { PushupValidationError } from '@pu-stats/data-access';

import {
  notifyEntrySaved,
  notifyEntrySavedWithXp,
  notifyError,
  notifyGoalReached,
} from './quick-add-notify';

function snackBarMock(): { open: ReturnType<typeof vitest.fn> } {
  return { open: vitest.fn() };
}

describe('notifyEntrySaved', () => {
  it('should open a short success snackbar centered at the bottom', () => {
    // given
    const snackBar = snackBarMock();

    // when
    notifyEntrySaved(snackBar as unknown as MatSnackBar);

    // then
    const [message, action, config] = snackBar.open.mock.calls[0];
    expect(message).toContain('gespeichert');
    expect(action).toBe('');
    expect(config).toMatchObject({
      duration: 2000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  });
});

describe('notifyGoalReached', () => {
  it('should open the celebratory goal message with a longer duration', () => {
    // given
    const snackBar = snackBarMock();

    // when
    notifyGoalReached(snackBar as unknown as MatSnackBar);

    // then
    const [message, , config] = snackBar.open.mock.calls[0];
    expect(message).toContain('Tagesziel erreicht');
    expect(config).toMatchObject({ duration: 2500 });
  });
});

describe('notifyError', () => {
  it('should surface the generic validation message when no error is given', () => {
    // given
    const snackBar = snackBarMock();

    // when
    notifyError(snackBar as unknown as MatSnackBar);

    // then
    const [message, , config] = snackBar.open.mock.calls[0];
    expect(message).toContain('konnte nicht');
    expect(config).toMatchObject({ duration: 4000 });
  });

  it('should surface a specific validation error message', () => {
    // given
    const snackBar = snackBarMock();

    // when
    notifyError(
      snackBar as unknown as MatSnackBar,
      new PushupValidationError('reps', 'out-of-range')
    );

    // then
    const message = snackBar.open.mock.calls[0][0] as string;
    expect(message).toMatch(/zwischen 1.*und 500.*liegen/);
  });
});

describe('notifyEntrySavedWithXp', () => {
  it('should skip the snackbar when the XP dialog opens', () => {
    // given
    const snackBar = snackBarMock();
    const celebrate = vitest.fn(() => true);

    // when
    notifyEntrySavedWithXp(snackBar as unknown as MatSnackBar, { celebrate }, [
      { exerciseId: 'pushup', reps: 5 },
    ]);

    // then
    expect(celebrate).toHaveBeenCalledWith([{ exerciseId: 'pushup', reps: 5 }]);
    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('should show the snackbar when no dialog opens', () => {
    // given
    const snackBar = snackBarMock();

    // when
    notifyEntrySavedWithXp(
      snackBar as unknown as MatSnackBar,
      { celebrate: () => false },
      []
    );

    // then
    expect(snackBar.open).toHaveBeenCalledTimes(1);
  });
});
