import { expect, type Locator, type Page } from '@playwright/test';

/** Where `FriendInviteService` parks a captured token until it is redeemed. */
const PENDING_INVITE_KEY = 'pu:friendInvite:pending';

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
    await expect(this.inviteLink).toBeVisible({ timeout: 30_000 });
    const url = await this.inviteLink.inputValue();
    const token = new URL(url).searchParams.get('fi');
    if (!token) throw new Error(`Invite link carries no token: ${url}`);
    return token;
  }

  /**
   * Reopens the page until it shows `count` incoming requests.
   *
   * The lists are read once per visit — everything on this screen is
   * somebody else's doing, so the page re-reads on becoming visible
   * again, not on a timer. A request that lands while the page is
   * already open is therefore only seen on the next visit, which is
   * exactly what a reload reproduces.
   */
  async expectIncomingCount(count: number, timeout = 60_000): Promise<void> {
    await this.reloadUntil(this.incomingRequests, count, timeout);
  }

  /** Same as {@link expectIncomingCount}, for confirmed friends. */
  async expectFriendCount(count: number, timeout = 60_000): Promise<void> {
    await this.reloadUntil(this.friendRows, count, timeout);
  }

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

/**
 * Resolves once the app has handed the captured token to the server.
 *
 * Redeeming happens in a post-auth hook, off the navigation the link
 * triggered, so nothing on screen marks it done. The parked token being
 * dropped is the one observable end of that round trip — and without
 * waiting for it a cold Functions emulator is slow enough that the
 * friends page gets read before the request exists.
 */
export async function waitForInviteRedeemed(page: Page): Promise<void> {
  await expect(async () => {
    const pending = await page.evaluate(
      (key) => localStorage.getItem(key),
      PENDING_INVITE_KEY
    );
    expect(pending).toBeNull();
  }).toPass({ timeout: 60_000 });
}
