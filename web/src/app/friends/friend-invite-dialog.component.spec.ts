import { signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { render, screen } from '@testing-library/angular';

import { InviteService } from '../core/invite.service';
import { ShareService } from '../core/share.service';
import { FriendInviteDialogComponent } from './friend-invite-dialog.component';

const URL = 'https://example.test/de/?ref=me&invite=tok';

async function setup(options: { token?: string | null } = {}) {
  let answer: (token: string | null) => void = () => undefined;
  const canAddFriend = signal(false);
  const inviteUrl = signal(URL);
  const invites = {
    canAddFriend: canAddFriend.asReadonly(),
    inviteUrl: inviteUrl.asReadonly(),
    ensureToken: vitest.fn(
      () =>
        new Promise<string | null>((resolve) => {
          answer = (token) => {
            canAddFriend.set(token !== null);
            resolve(token);
          };
        })
    ),
    inviteFriend: vitest.fn().mockResolvedValue('native'),
  };
  const clipboard = { copyLink: vitest.fn().mockResolvedValue(undefined) };
  const dialogRef = { close: vitest.fn() };
  const view = await render(FriendInviteDialogComponent, {
    providers: [
      { provide: InviteService, useValue: invites },
      { provide: ShareService, useValue: clipboard },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });
  // `whenStable()` would wait for the pending resource — the very state
  // the loading tests look at — so only change detection runs here.
  view.fixture.detectChanges();

  async function resolveToken(token: string | null = options.token ?? 'tok') {
    answer(token);
    await view.fixture.whenStable();
    view.fixture.detectChanges();
  }

  return { ...view, invites, clipboard, dialogRef, resolveToken };
}

describe('FriendInviteDialogComponent', () => {
  it('should hold the link and the share button as skeletons while the token is minted', async () => {
    // given / when
    const { container, invites } = await setup();

    // then
    expect(invites.ensureToken).toHaveBeenCalled();
    const loading = screen.getByTestId('invite-loading');
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(loading.querySelectorAll('pu-skeleton').length).toBeGreaterThan(0);
    expect(
      container.querySelector('mat-dialog-actions pu-skeleton')
    ).not.toBeNull();
    expect(container.querySelector('mat-spinner')).toBeNull();
    expect(screen.queryByTestId('invite-link')).toBeNull();
    expect(screen.queryByTestId('invite-share')).toBeNull();
    expect(screen.queryByTestId('invite-unavailable')).toBeNull();
  });

  it('should swap the skeletons for the link and the share button once the token is there', async () => {
    // given
    const { container, resolveToken } = await setup();

    // when
    await resolveToken('tok');

    // then
    expect(screen.queryByTestId('invite-loading')).toBeNull();
    expect(container.querySelector('pu-skeleton')).toBeNull();
    expect((screen.getByTestId('invite-link') as HTMLInputElement).value).toBe(
      URL
    );
    expect(screen.getByTestId('invite-share')).toBeTruthy();
    expect(screen.getByTestId('invite-copy')).toBeTruthy();
  });

  it('should tell a guest to sign up when no token can be minted', async () => {
    // given
    const { container, resolveToken } = await setup();

    // when
    await resolveToken(null);

    // then
    expect(screen.queryByTestId('invite-loading')).toBeNull();
    expect(container.querySelector('pu-skeleton')).toBeNull();
    expect(screen.getByTestId('invite-unavailable')).toBeTruthy();
    expect(screen.queryByTestId('invite-link')).toBeNull();
    expect(screen.queryByTestId('invite-share')).toBeNull();
  });

  it('should copy the link to the clipboard', async () => {
    // given
    const { clipboard, resolveToken } = await setup();
    await resolveToken('tok');

    // when
    screen.getByTestId('invite-copy').click();

    // then
    expect(clipboard.copyLink).toHaveBeenCalledWith(URL);
  });

  it('should hand the link to the share sheet', async () => {
    // given
    const { invites, resolveToken } = await setup();
    await resolveToken('tok');

    // when
    screen.getByTestId('invite-share').click();

    // then
    expect(invites.inviteFriend).toHaveBeenCalled();
  });
});
