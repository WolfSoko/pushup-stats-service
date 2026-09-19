import { createAccount } from '../support/backend';
import { FriendsPage, invitePathFor } from '../support/pages/friends-page';
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

      const inviteeFriends = new FriendsPage(inviteePage);
      await inviteeFriends.redeemInvite(invitePathFor(token, inviter.uid));

      // then — the invitation is waiting, named after the inviter
      await expect(inviteeFriends.incomingRequests.first()).toContainText(
        inviter.displayName
      );

      // when — they accept
      await inviteeFriends.acceptButtons.first().click();

      // then — the request becomes a friendship on their side
      await expect(inviteeFriends.friendRows).toHaveCount(1, {
        timeout: 20_000,
      });
      await expect(inviteeFriends.friendRows.first()).toContainText(
        inviter.displayName
      );
      await expect(inviteeFriends.incomingRequests).toHaveCount(0);
    } finally {
      await inviteeContext.close();
    }

    // and — on the inviter's side too, with nothing left pending
    await friendsPage.expectFriendCount(1);
    await expect(friendsPage.friendRows.first()).toContainText(
      invitee.displayName
    );
    await expect(friendsPage.outgoingRequests).toHaveCount(0);
  });

  test('should settle a declined request on both sides', async ({
    loginPage,
    friendsPage,
    browser,
  }) => {
    // given — a request the inviter can see waiting
    const inviter = await createAccount('decline-inviter');
    const invitee = await createAccount('decline-invitee');
    await loginPage.signIn(inviter);
    await friendsPage.goto();
    const token = await friendsPage.readInviteToken();

    const inviteeContext = await browser.newContext({ locale: 'de-DE' });
    try {
      const inviteePage = await inviteeContext.newPage();
      await new LoginPage(inviteePage).signIn(invitee);

      const inviteeFriends = new FriendsPage(inviteePage);
      await inviteeFriends.redeemInvite(invitePathFor(token, inviter.uid));
      await friendsPage.expectOutgoingCount(1);

      // when — the invitee turns it down
      await inviteeFriends.declineButtons.first().click();

      // then — it is gone from their screen and never became a friendship
      await expect(inviteeFriends.incomingRequests).toHaveCount(0, {
        timeout: 20_000,
      });
      await expect(inviteeFriends.friendRows).toHaveCount(0);
    } finally {
      await inviteeContext.close();
    }

    // and — the inviter stops waiting on it, without gaining a friend
    await friendsPage.expectOutgoingCount(0);
    await expect(friendsPage.friendRows).toHaveCount(0);
  });
});
