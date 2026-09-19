import { signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { FriendsStore } from '../friends/friends.store';
import { WorkoutShareDialogComponent } from './workout-share-dialog.component';

async function setup(
  friends: Array<{ uid: string; displayName: string | null }>
) {
  const store = {
    friends: signal(
      friends.map((f) => ({ ...f, id: f.uid, since: '', photoURL: null }))
    ),
    loading: signal(false),
    reload: vitest.fn().mockResolvedValue(undefined),
  };
  const dialogRef = { close: vitest.fn() };
  await render(WorkoutShareDialogComponent, {
    providers: [
      provideRouter([]),
      { provide: FriendsStore, useValue: store },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });
  return { store, dialogRef };
}

describe('WorkoutShareDialogComponent', () => {
  it('should reload the friends list when it opens', async () => {
    const { store } = await setup([]);
    expect(store.reload).toHaveBeenCalled();
  });

  it('should send the user off to make a friend when there is none', async () => {
    await setup([]);
    expect(screen.getByText(/noch keine bestätigten Freunde/)).toBeTruthy();
    expect(screen.queryByTestId('workout-share-submit')).toBeTruthy();
  });

  it('should close with the picked friends', async () => {
    // given
    const { dialogRef } = await setup([
      { uid: 'f1', displayName: 'Anna' },
      { uid: 'f2', displayName: null },
    ]);
    const user = userEvent.setup();
    const submit = screen.getByTestId('workout-share-submit');
    expect(submit.hasAttribute('disabled')).toBe(true);

    // when
    await user.click(screen.getByText('Anna'));
    await user.click(submit);

    // then
    expect(dialogRef.close).toHaveBeenCalledWith(['f1']);
  });
});
