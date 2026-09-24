import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Auth } from '@angular/fire/auth';
import { DEMO_USER_ID } from '@pu-stats/data-access';
import { XpStore } from '@pu-stats/data-access-state';
import type { XpEntryInput } from '@pu-stats/models';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

import { XpCelebrationService } from './xp-celebration.service';

function setup(
  options: {
    uid?: string;
    guest?: boolean;
    platform?: string;
    openDialogs?: unknown[];
  } = {}
) {
  const closed = new Subject<void>();
  const allClosed = new Subject<void>();
  const close = vi.fn(() => closed.next());
  const open = vi.fn((_component: unknown, _config: unknown) => ({
    afterClosed: () => closed,
    close,
  }));
  const dialog = {
    open,
    openDialogs: options.openDialogs ?? [],
    afterAllClosed: allClosed,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
      { provide: MatDialog, useValue: dialog },
      { provide: DEMO_USER_ID, useValue: 'demo' },
      {
        provide: XpStore,
        useValue: {
          previewXp: (e: XpEntryInput) => e.reps ?? 0,
          totalXp: () => 90,
        },
      },
      {
        provide: Auth,
        useValue: {
          currentUser: {
            uid: options.uid ?? 'u1',
            isAnonymous: options.guest ?? false,
          },
        },
      },
    ],
  });
  const service = TestBed.inject(XpCelebrationService);
  return { service, open, closed, allClosed, dialog };
}

const PUSHUPS = [{ exerciseId: 'pushup', reps: 20 }];

describe('XpCelebrationService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('should open the dialog with the gained XP and the level-up', () => {
    // given
    const { service, open } = setup();

    // when
    const opened = service.celebrate(PUSHUPS);

    // then
    expect(opened).toBe(true);
    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        panelClass: 'xp-gained-dialog-panel',
        data: expect.objectContaining({
          xp: 20,
          before: expect.objectContaining({ level: 1 }),
          after: expect.objectContaining({ level: 2 }),
        }),
      })
    );
  });

  it.each([
    ['a guest', { guest: true }],
    ['the demo user', { uid: 'demo' }],
    ['the server', { platform: 'server' }],
  ])('should not open for %s', (_case, options) => {
    // given
    const { service, open } = setup(options);

    // when
    const opened = service.celebrate(PUSHUPS);

    // then
    expect(opened).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('should not open when the entries are worth nothing', () => {
    // given
    const { service, open } = setup();

    // then
    expect(service.celebrate([{ exerciseId: 'pushup', reps: 0 }])).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('should collect held entries into one dialog', () => {
    // given
    const { service, open } = setup();
    const hold = service.hold();

    // when
    service.celebrate(PUSHUPS);
    service.celebrate(PUSHUPS);
    const held = hold.take();
    hold.release();

    // then
    expect(open).not.toHaveBeenCalled();
    expect(held).toHaveLength(2);
  });

  it('should open a single dialog after a batch', async () => {
    // given
    const { service, open } = setup();

    // when
    await service.batch(async () => {
      service.celebrate(PUSHUPS);
      service.celebrate(PUSHUPS);
    });

    // then
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][1]).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ xp: 40 }) })
    );
  });

  it('should queue behind a dialog that is already open', async () => {
    // given
    const { service, open, allClosed } = setup({ openDialogs: [{}] });

    // when
    service.celebrate(PUSHUPS);
    await Promise.resolve();

    // then
    expect(open).not.toHaveBeenCalled();
    allClosed.next();
    await Promise.resolve();
    await Promise.resolve();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('should run afterIdle work only once the dialog closed', async () => {
    // given
    const { service, closed } = setup();
    const work = vi.fn();
    service.celebrate(PUSHUPS);

    // when
    service.afterIdle(work);
    await Promise.resolve();

    // then
    expect(work).not.toHaveBeenCalled();
    closed.next();
    await service.whenIdle();
    await Promise.resolve();
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('should run afterIdle work immediately when idle', () => {
    // given
    const { service } = setup();
    const work = vi.fn();

    // when
    service.afterIdle(work);

    // then
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('should open a preview regardless of the user', () => {
    // given
    const { service, open } = setup({ guest: true });

    // when
    service.showPreview(true);

    // then
    expect(open).toHaveBeenCalledTimes(1);
  });
});
