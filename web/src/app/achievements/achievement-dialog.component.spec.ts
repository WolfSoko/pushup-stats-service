import { PLATFORM_ID } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SNAP_QUALITY_PARTICLES } from '@pu-stats/models';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  vaporizeSpy: vi.fn<(el: HTMLElement) => unknown>(),
  capturedOptions: { last: null as Record<string, unknown> | null },
}));

// The real package has unresolved extensionless imports under Node ESM.
vi.mock('@wolsok/thanos', async () => {
  const { InjectionToken } = await import('@angular/core');
  class WsThanosService {
    vaporize(el: HTMLElement): unknown {
      return mocks.vaporizeSpy(el);
    }
  }
  return {
    WsThanosService,
    WS_THANOS_OPTIONS_TOKEN: new InjectionToken('WS_THANOS_OPTIONS_TOKEN'),
    createWsThanosOptions: (opts?: Record<string, unknown>) => {
      mocks.capturedOptions.last = { ...opts };
      return mocks.capturedOptions.last;
    },
  };
});

import { ShareService } from '../core/share.service';
import {
  AchievementDialogComponent,
  type AchievementDialogData,
} from './achievement-dialog.component';

const badge = {
  id: 'plan-days-10',
  label: '10 Plantage',
  icon: 'workspace_premium',
};

async function setup(
  options: {
    data?: Partial<AchievementDialogData>;
    platform?: string;
  } = {}
) {
  const share = vi.fn().mockResolvedValue('native');
  const close = vi.fn();
  const view = await render(AchievementDialogComponent, {
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          badge,
          shareUrl: 'https://pushup-stats.com',
          titleId: 'achievement-title-7',
          ...options.data,
        },
      },
      { provide: MatDialogRef, useValue: { close } },
      { provide: ShareService, useValue: { share } },
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
    ],
  });
  return { view, share, close };
}

describe('AchievementDialogComponent', () => {
  let vaporize$: Subject<unknown>;

  beforeEach(() => {
    vaporize$ = new Subject<unknown>();
    mocks.capturedOptions.last = null;
    mocks.vaporizeSpy.mockReset();
    mocks.vaporizeSpy.mockImplementation(() => vaporize$.asObservable());
  });

  it('should show the badge label and icon', async () => {
    // when
    await setup();

    // then
    expect(screen.getByTestId('achievement-label').textContent).toContain(
      '10 Plantage'
    );
    expect(screen.getByTestId('achievement-icon').textContent?.trim()).toBe(
      'workspace_premium'
    );
  });

  it('should give the title the id the dialog is labelled by', async () => {
    // when
    await setup();

    // then
    expect(screen.getByRole('heading', { level: 2 }).id).toBe(
      'achievement-title-7'
    );
  });

  it('should hand the badge and url to the share service', async () => {
    // given
    const { share } = await setup();

    // when
    await userEvent.click(screen.getByTestId('achievement-share'));

    // then
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

  it('should close without snapping from the close button', async () => {
    // given
    const { close } = await setup();

    // when
    await userEvent.click(screen.getByTestId('achievement-close'));

    // then
    expect(close).toHaveBeenCalledTimes(1);
    expect(mocks.vaporizeSpy).not.toHaveBeenCalled();
  });

  it('should vaporize the card on snap and close once the animation ends', async () => {
    // given
    const { close, view } = await setup();
    const card = screen.getByTestId('achievement-card');

    // when
    await userEvent.click(screen.getByTestId('achievement-snap'));
    await view.fixture.whenStable();

    // then
    expect(mocks.vaporizeSpy).toHaveBeenCalledWith(card);
    expect(card.classList.contains('is-snapping')).toBe(true);
    expect(close).not.toHaveBeenCalled();

    // when
    vaporize$.complete();

    // then
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('should still close when the vaporize fails', async () => {
    // given — html2canvas throws on CSS it cannot parse
    const { close, view } = await setup();
    await userEvent.click(screen.getByTestId('achievement-snap'));
    await view.fixture.whenStable();

    // when
    vaporize$.error(new Error('Unsupported color function'));

    // then
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('should ignore share and close while a snap is running', async () => {
    // given
    const { share, close, view } = await setup();
    await userEvent.click(screen.getByTestId('achievement-snap'));
    await view.fixture.whenStable();

    // when
    await userEvent.click(screen.getByTestId('achievement-share'));
    await userEvent.click(screen.getByTestId('achievement-close'));
    await userEvent.click(screen.getByTestId('achievement-snap'));

    // then
    expect(share).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(mocks.vaporizeSpy).toHaveBeenCalledTimes(1);
  });

  it('should snap with the particle count of the user preset', async () => {
    // given
    const { view } = await setup({
      data: { maxParticleCount: SNAP_QUALITY_PARTICLES.high },
    });

    // when
    await userEvent.click(screen.getByTestId('achievement-snap'));
    await view.fixture.whenStable();

    // then
    expect(mocks.capturedOptions.last).toEqual(
      expect.objectContaining({
        maxParticleCount: SNAP_QUALITY_PARTICLES.high,
      })
    );
  });

  it('should close without vaporizing on the server', async () => {
    // given
    const { close } = await setup({ platform: 'server' });

    // when
    await userEvent.click(screen.getByTestId('achievement-snap'));

    // then
    expect(mocks.vaporizeSpy).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
