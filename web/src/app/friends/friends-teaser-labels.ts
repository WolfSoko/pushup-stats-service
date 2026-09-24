import type { FriendsBoardEntry } from './friends-api.service';

export function standingLabel(board: ReadonlyArray<FriendsBoardEntry>): string {
  const rank = board.findIndex((entry) => entry.isViewer) + 1;
  const total = board.length;
  if (rank === 1) {
    return $localize`:@@dashboard.friends.leading:Du führst diese Woche unter ${total}:total: Freunden.`;
  }
  return $localize`:@@dashboard.friends.rank:Du bist diese Woche auf Platz ${rank}:rank: von ${total}:total:.`;
}

export function pendingLabel(count: number): string {
  return count === 1
    ? $localize`:@@dashboard.friends.pendingOne:Eine Anfrage wartet auf dich`
    : $localize`:@@dashboard.friends.pending:${count}:count: Anfragen warten auf dich`;
}

export function invitationsLabel(count: number): string {
  return count === 1
    ? $localize`:@@dashboard.friends.invitationOne:Eine Challenge-Einladung wartet`
    : $localize`:@@dashboard.friends.invitations:${count}:count: Challenge-Einladungen warten`;
}

export function challengesLabel(count: number): string {
  return count === 1
    ? $localize`:@@dashboard.friends.activeChallengeOne:Eine Challenge läuft`
    : $localize`:@@dashboard.friends.activeChallenges:${count}:count: Challenges laufen`;
}
