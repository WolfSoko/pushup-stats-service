import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

import { CelebrationQueueService } from './celebration-queue.service';

function fakeRef() {
  const closed = new Subject<void>();
  return {
    ref: { afterClosed: () => closed } as never,
    close: () => {
      closed.next();
      closed.complete();
    },
  };
}

function setup(openDialogs: unknown[] = []) {
  const allClosed = new Subject<void>();
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: 'browser' },
      {
        provide: MatDialog,
        useValue: { openDialogs, afterAllClosed: allClosed },
      },
    ],
  });
  const queue = TestBed.inject(CelebrationQueueService);
  return { queue, allClosed, body: TestBed.inject(DOCUMENT).body };
}

const tick = () => new Promise((resolve) => setTimeout(resolve));

describe('CelebrationQueueService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('should open the next celebration only after the previous closed', async () => {
    // given
    const { queue } = setup();
    const first = fakeRef();
    const second = fakeRef();
    const openSecond = vi.fn(() => second.ref);
    void queue.enqueue(() => first.ref);
    void queue.enqueue(openSecond);
    await tick();

    // then
    expect(openSecond).not.toHaveBeenCalled();

    // when
    first.close();
    await tick();

    // then
    expect(openSecond).toHaveBeenCalledOnce();
  });

  it('should wait for a dialog that is already open', async () => {
    // given
    const { queue, allClosed } = setup([{}]);
    const open = vi.fn(() => null);

    // when
    void queue.enqueue(open);
    await tick();

    // then
    expect(open).not.toHaveBeenCalled();

    // when
    allClosed.next();
    await tick();

    // then
    expect(open).toHaveBeenCalledOnce();
  });

  it('should mark the body busy until the queue drained', async () => {
    // given
    const { queue, body } = setup();
    const dialog = fakeRef();

    // when
    const done = queue.enqueue(() => dialog.ref);
    TestBed.tick();

    // then
    expect(queue.busy()).toBe(true);
    expect(body.hasAttribute('data-celebration-busy')).toBe(true);

    // when
    await tick();
    dialog.close();
    await done;
    TestBed.tick();

    // then
    expect(queue.busy()).toBe(false);
    expect(body.hasAttribute('data-celebration-busy')).toBe(false);
  });

  it('should keep going after a celebration failed to open', async () => {
    // given
    const { queue } = setup();
    const next = vi.fn(() => null);

    // when
    await queue
      .enqueue(() => {
        throw new Error('boom');
      })
      .catch(() => undefined);
    await queue.enqueue(next);

    // then
    expect(next).toHaveBeenCalledOnce();
  });
});
