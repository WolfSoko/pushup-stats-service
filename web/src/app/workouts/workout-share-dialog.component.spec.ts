import { signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { FriendsStore } from '../friends/friends.store';
import { WorkoutShareDialogComponent } from './workout-share-dialog.component';

async function setup(
  friends: Array<{ uid: string; displayName: string | null }>,
  options: { loading?: boolean } = {}
) {
  const store = {
    friends: signal(
      friends.map((f) => ({ ...f, id: f.uid, since: '', photoURL: null }))
    ),
    loading: signal(options.loading ?? false),
    reload: vitest.fn().mockResolvedValue(undefined),
  };
  const dialogRef = { close: vitest.fn() };
  const { fixture } = await render(WorkoutShareDialogComponent, {
    providers: [
      provideRouter([]),
      { provide: FriendsStore, useValue: store },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });
  return { store, dialogRef, fixture };
}

describe('WorkoutShareDialogComponent', () => {
  it('should reload the friends list when it opens', async () => {
    const { store } = await setup([]);
    expect(store.reload).toHaveBeenCalled();
  });

  it('should hold three list-row skeletons while the friends are still loading', async () => {
    // given / when
    const { fixture } = await setup([], { loading: true });

    // then
    const loading = screen.getByTestId('workout-share-loading');
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(loading.querySelectorAll('.skeleton-row')).toHaveLength(3);
    expect(loading.querySelectorAll('pu-skeleton')).toHaveLength(6);
    expect(fixture.nativeElement.querySelector('mat-spinner')).toBeNull();
    expect(screen.queryByText(/noch keine bestätigten Freunde/)).toBeNull();
    expect(screen.queryByTestId('workout-share-friends')).toBeNull();
  });

  it('should keep the list on screen while it is refreshed', async () => {
    // given / when
    await setup([{ uid: 'f1', displayName: 'Anna' }], { loading: true });

    // then
    expect(screen.queryByTestId('workout-share-loading')).toBeNull();
    expect(screen.getByText('Anna')).toBeTruthy();
  });

  it('should swap the skeletons for the no-friends text once the empty list is there', async () => {
    // given
    const { store, fixture } = await setup([], { loading: true });

    // when
    store.loading.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    // then
    expect(screen.queryByTestId('workout-share-loading')).toBeNull();
    expect(fixture.nativeElement.querySelector('pu-skeleton')).toBeNull();
    expect(screen.getByText(/noch keine bestätigten Freunde/)).toBeTruthy();
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
