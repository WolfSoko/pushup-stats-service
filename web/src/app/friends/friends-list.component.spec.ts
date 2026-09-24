import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';

import type { FriendRow } from './friends-api.service';
import { FriendsListComponent } from './friends-list.component';

const FRIEND: FriendRow = {
  id: 'me__b',
  uid: 'b',
  since: '2026-09-01T10:00:00.000Z',
  displayName: 'Bob',
  photoURL: null,
};

async function setup(
  inputs: { rows: ReadonlyArray<FriendRow>; loading?: boolean } = { rows: [] }
) {
  const view = await render(FriendsListComponent, {
    inputs,
    providers: [provideRouter([])],
  });
  return view;
}

describe('FriendsListComponent', () => {
  it('should hold three card-shaped skeletons and no empty text while the friends load', async () => {
    // given / when
    const { container } = await setup({ rows: [], loading: true });

    // then
    const loading = screen.getByTestId('friends-loading');
    expect(loading.getAttribute('aria-busy')).toBe('true');
    const cards = loading.querySelectorAll('mat-card.friend-card');
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.querySelector('pu-skeleton')).not.toBeNull();
    }
    expect(container.querySelector('mat-spinner')).toBeNull();
    expect(container.querySelector('.friends-empty')).toBeNull();
    expect(container.textContent).not.toContain('Noch keine Freunde');
  });

  it('should offer an invite once the list is there and empty', async () => {
    // given / when
    const { container } = await setup({ rows: [], loading: false });

    // then
    expect(screen.queryByTestId('friends-loading')).toBeNull();
    expect(container.querySelector('pu-skeleton')).toBeNull();
    expect(container.querySelector('.friends-empty')).not.toBeNull();
    expect(container.textContent).toContain('Noch keine Freunde');
  });

  it('should list the friends once loaded', async () => {
    // given / when
    const { container } = await setup({ rows: [FRIEND], loading: false });

    // then
    expect(screen.queryByTestId('friends-loading')).toBeNull();
    expect(container.querySelector('.friends-empty')).toBeNull();
    expect(screen.getAllByTestId('friend-row')).toHaveLength(1);
    expect(container.textContent).toContain('Bob');
  });

  it('should swap the skeletons for the rows when loading ends', async () => {
    // given
    const { container, fixture } = await setup({
      rows: [FRIEND],
      loading: true,
    });
    expect(screen.getByTestId('friends-loading')).toBeTruthy();

    // when
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    await fixture.whenStable();

    // then
    expect(screen.queryByTestId('friends-loading')).toBeNull();
    expect(container.querySelector('pu-skeleton')).toBeNull();
    expect(screen.getAllByTestId('friend-row')).toHaveLength(1);
  });

  it('should emit the row id when its remove button is pressed', async () => {
    // given
    const remove = vitest.fn();
    await render(FriendsListComponent, {
      inputs: { rows: [FRIEND], loading: false },
      on: { remove },
      providers: [provideRouter([])],
    });

    // when
    screen.getByTestId('friend-remove').click();

    // then
    expect(remove).toHaveBeenCalledWith('me__b');
  });
});
