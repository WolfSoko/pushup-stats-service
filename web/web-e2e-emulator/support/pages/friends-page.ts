import { expect, type Locator, type Page } from '@playwright/test';

/** `/freunde` — requests waiting for an answer, and confirmed friends. */
export class FriendsPage {
  readonly heading: Locator;
  readonly addFriendButton: Locator;
  readonly inviteLink: Locator;
  readonly incomingRequests: Locator;
  readonly acceptButtons: Locator;
  readonly declineButtons: Locator;
  readonly friendRows: Locator;
  readonly outgoingRequests: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Freunde' });
    this.addFriendButton = page.getByTestId('friends-add');
    this.inviteLink = page.getByTestId('invite-link');
    this.incomingRequests = page.getByTestId('friend-incoming');
    this.acceptButtons = page.getByTestId('friend-accept');
    this.declineButtons = page.getByRole('button', { name: 'Ablehnen' });
    this.friendRows = page.getByTestId('friend-row');
    this.outgoingRequests = page.getByTestId('friend-outgoing');
  }

  async goto(): Promise<void> {
    await this.page.goto('/freunde');
    await expect(this.heading).toBeVisible();
  }

  /**
   * Opens the invite dialog and returns the token from the link it
   * shows. The link points at the production origin, so a test cannot
   * follow it as is — the token is the part that carries the invitation,
   * and {@link invitePathFor} puts it back on the origin under test.
   */
  async readInviteToken(): Promise<string> {
    await this.addFriendButton.click();
    await expect(this.inviteLink).toBeVisible({ timeout: 20_000 });
    const url = await this.inviteLink.inputValue();
    const token = new URL(url).searchParams.get('fi');
    if (!token) throw new Error(`Invite link carries no token: ${url}`);
    return token;
  }

  /**
   * Follows an invite link and waits until the request it carries is
   * waiting on this page.
   *
   * Both halves are retried together on purpose. The token is parked in
   * `localStorage` while the app boots and redeemed afterwards from a
   * post-auth hook, and neither step shows on screen — so there is no
   * point at which navigating on is known to be safe, and leaving too
   * early throws the only copy of the token away. Re-opening the link is
   * idempotent (the server upserts the same friendship), so a retry
   * costs one round trip and nothing else.
   */
  async redeemInvite(path: string): Promise<void> {
    await expect(async () => {
      await this.page.goto(path);
      await this.goto();
      await expect(this.incomingRequests).toHaveCount(1, { timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
  }

  /** Reopens the page until it shows `count` confirmed friends. */
  async expectFriendCount(count: number, timeout = 20_000): Promise<void> {
    await this.reloadUntil(this.friendRows, count, timeout);
  }

  /** Reopens the page until it shows `count` requests this user sent. */
  async expectOutgoingCount(count: number, timeout = 20_000): Promise<void> {
    await this.reloadUntil(this.outgoingRequests, count, timeout);
  }

  /**
   * Reopens the page until `rows` has `count` entries.
   *
   * The lists are read once per visit — everything on this screen is
   * somebody else's doing, so the page re-reads on becoming visible
   * again, not on a timer. A change that lands while the page is already
   * open is therefore only seen on the next visit, which is what the
   * reload reproduces.
   */
  private async reloadUntil(
    rows: Locator,
    count: number,
    timeout: number
  ): Promise<void> {
    await expect(async () => {
      await this.goto();
      await expect(rows).toHaveCount(count, { timeout: 5_000 });
    }).toPass({ timeout });
  }
}

/** The path a recipient opens to redeem `token` on the app under test. */
export function invitePathFor(token: string, referrerUid: string): string {
  return `/?fi=${encodeURIComponent(token)}&ref=${encodeURIComponent(referrerUid)}`;
}
