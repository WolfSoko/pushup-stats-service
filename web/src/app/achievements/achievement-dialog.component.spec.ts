import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ShareService } from '../core/share.service';
import { AchievementDialogComponent } from './achievement-dialog.component';

const badge = {
  id: 'plan-days-10',
  label: '10 Plantage',
  icon: 'workspace_premium',
};

async function setup() {
  const share = vi.fn().mockResolvedValue('shared');
  const close = vi.fn();
  const view = await render(AchievementDialogComponent, {
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: { badge, shareUrl: 'https://pushup-stats.com' },
      },
      { provide: MatDialogRef, useValue: { close } },
      { provide: ShareService, useValue: { share } },
    ],
  });
  return { view, share, close };
}

describe('AchievementDialogComponent', () => {
  it('should show the badge label', async () => {
    // when
    await setup();

    // then
    expect(screen.getByText('10 Plantage')).toBeTruthy();
  });

  it('should hand the badge and url to the share service', async () => {
    // given
    const { share } = await setup();

    // when
    await userEvent.click(screen.getByTestId('achievement-share'));

    // then — this wiring is the whole point of the dialog; a silent break
    // would leave a button that does nothing
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://pushup-stats.com' })
    );
    expect(share.mock.calls[0][0].text).toContain('10 Plantage');
  });

  it('should close after sharing', async () => {
    // given
    const { close } = await setup();

    // when
    await userEvent.click(screen.getByTestId('achievement-share'));

    // then
    expect(close).toHaveBeenCalled();
  });
});
