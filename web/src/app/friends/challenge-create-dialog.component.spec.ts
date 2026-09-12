import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { render, screen } from '@testing-library/angular';

import { ChallengeCreateDialogComponent } from './challenge-create-dialog.component';
import type { FriendRow } from './friends-api.service';

describe('ChallengeCreateDialogComponent', () => {
  const friends: FriendRow[] = [
    { id: 'me__b', uid: 'b', since: 'x', displayName: 'Bob' },
    { id: 'me__c', uid: 'c', since: 'x', displayName: null },
  ];

  async function renderDialog() {
    const close = vitest.fn();
    const { fixture } = await render(ChallengeCreateDialogComponent, {
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { friends } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    return { close, fixture };
  }

  it('should list the friends and refuse to submit with nobody picked', async () => {
    // given
    await renderDialog();

    // then
    const options = screen.getAllByTestId('challenge-friend');
    expect(options).toHaveLength(2);
    expect(options[1].textContent).toContain('Ohne Namen');
    expect(
      (screen.getByTestId('challenge-submit') as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('should hand back the challenge once a friend is picked', async () => {
    // given
    const { close, fixture } = await renderDialog();

    // when
    screen.getAllByTestId('challenge-friend')[0].click();
    await fixture.whenStable();
    fixture.detectChanges();
    screen.getByTestId('challenge-submit').click();

    // then
    expect(close).toHaveBeenCalledWith({
      friendUids: ['b'],
      exerciseId: 'pushup',
      exerciseName: 'Liegestütze',
      target: 500,
      days: 7,
    });
  });

  it('should refuse a target outside the bounds', async () => {
    // given
    const { fixture } = await renderDialog();
    screen.getAllByTestId('challenge-friend')[0].click();
    const target = screen.getByTestId('challenge-target') as HTMLInputElement;

    // when
    target.value = '5';
    target.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(
      (screen.getByTestId('challenge-submit') as HTMLButtonElement).disabled
    ).toBe(true);
  });
});
