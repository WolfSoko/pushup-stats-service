import { render, screen } from '@testing-library/angular';

import { FriendAvatarComponent } from './friend-avatar.component';

describe('FriendAvatarComponent', () => {
  it('should show the picture when there is one', async () => {
    // given / when
    await render(FriendAvatarComponent, {
      inputs: { photoURL: 'https://example.test/a.jpg', displayName: 'Ada' },
    });

    // then
    const img = screen.getByTestId('friend-avatar-photo') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.test/a.jpg');
    // a Google photo is refused when a referrer is sent
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('should fall back to the initial without a picture', async () => {
    // given / when
    await render(FriendAvatarComponent, {
      inputs: { photoURL: null, displayName: 'ada lovelace' },
    });

    // then
    expect(screen.getByTestId('friend-avatar-initial').textContent).toBe('A');
    expect(screen.queryByTestId('friend-avatar-photo')).toBeNull();
  });

  it('should fall back to the initial when the picture fails to load', async () => {
    // given
    await render(FriendAvatarComponent, {
      inputs: { photoURL: 'https://example.test/gone.jpg', displayName: 'Bo' },
    });

    // when
    screen.getByTestId('friend-avatar-photo').dispatchEvent(new Event('error'));

    // then
    expect(await screen.findByTestId('friend-avatar-initial')).toBeTruthy();
  });

  it('should keep an initial that is an emoji whole', async () => {
    // given / when — half a surrogate pair renders as a replacement char
    await render(FriendAvatarComponent, {
      inputs: { photoURL: null, displayName: '\u{1f3cb}\u{fe0f} Wolf' },
    });

    // then
    expect(screen.getByTestId('friend-avatar-initial').textContent).toBe(
      '\u{1f3cb}'
    );
  });

  it('should show a neutral icon for a friend without a name', async () => {
    // given / when
    await render(FriendAvatarComponent, {
      inputs: { photoURL: null, displayName: null },
    });

    // then
    expect(screen.queryByTestId('friend-avatar-initial')).toBeNull();
    expect(document.body.textContent).toContain('person');
  });
});
