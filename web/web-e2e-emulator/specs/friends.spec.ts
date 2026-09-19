import { createAccount } from '../support/emulator';
import {
  FriendsPage,
  invitePathFor,
  waitForInviteRedeemed,
} from '../support/pages/friends-page';
import { LoginPage } from '../support/pages/login-page';
import { expect, test } from '../support/test-fixtures';

/**
 * Adding a friend takes two people, so these run two browser contexts:
 * the fixtures' `page` belongs to the inviter, the invitee gets one of
 * their own. Sharing a context would share the session — the second
 * sign-in would just replace the first.
 */
test.describe('Friends', () => {
  test('should turn an invite link into a request the other side accepts', async ({
    loginPage,
    friendsPage,
    browser,
  }) => {
    // given — the inviter, signed in on their friends page
    const inviter = await createAccount('inviter');
    const invitee = await createAccount('invitee');
    await loginPage.signIn(inviter);
    await friendsPage.goto();

    // when — the inviter hands over their link and the invitee opens it
    const token = await friendsPage.readInviteToken();

    const inviteeContext = await browser.newContext({ locale: 'de-DE' });
    try {
      const inviteePage = await inviteeContext.newPage();
      await new LoginPage(inviteePage).signIn(invitee);
      await inviteePage.goto(invitePathFor(token, inviter.uid));
      await waitForInviteRedeemed(inviteePage);

      // then — the invitation is waiting, named after the inviter
      const inviteeFriends = new FriendsPage(inviteePage);
      await inviteeFriends.expectIncomingCount(1);
      await expect(inviteeFriends.incomingRequests.first()).toContainText(
        inviter.displayName
      );

      // when — they accept
      await inviteeFriends.acceptButtons.first().click();

      // then — the request becomes a friendship on their side
      await expect(inviteeFriends.friendRows).toHaveCount(1, {
        timeout: 30_000,
      });
      await expect(inviteeFriends.friendRows.first()).toContainText(
        inviter.displayName
      );
      await expect(inviteeFriends.incomingRequests).toHaveCount(0);
    } finally {
      await inviteeContext.close();
    }

    // and — on the inviter's side too
    await friendsPage.expectFriendCount(1);
    await expect(friendsPage.friendRows.first()).toContainText(
      invitee.displayName
    );
    await expect(friendsPage.outgoingRequests).toHaveCount(0);
  });

  test('should leave a declined request out of both friend lists', async ({
    loginPage,
    friendsPage,
    browser,
  }) => {
    // given
    const inviter = await createAccount('decline-inviter');
    const invitee = await createAccount('decline-invitee');
    await loginPage.signIn(inviter);
    await friendsPage.goto();
    const token = await friendsPage.readInviteToken();

    // when — the invitee turns the request down
    const inviteeContext = await browser.newContext({ locale: 'de-DE' });
    try {
      const inviteePage = await inviteeContext.newPage();
      await new LoginPage(inviteePage).signIn(invitee);
      await inviteePage.goto(invitePathFor(token, inviter.uid));
      await waitForInviteRedeemed(inviteePage);

      const inviteeFriends = new FriendsPage(inviteePage);
      await inviteeFriends.expectIncomingCount(1);
      await inviteeFriends.declineButtons.first().click();

      // then
      await expect(inviteeFriends.incomingRequests).toHaveCount(0, {
        timeout: 30_000,
      });
      await expect(inviteeFriends.friendRows).toHaveCount(0);
    } finally {
      await inviteeContext.close();
    }

    await friendsPage.expectFriendCount(0);
  });
});
