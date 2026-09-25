import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { XpCelebrationService } from './xp-celebration.service';
import { holdXpUntilDone } from './xp-session-hold';

function setup() {
  const release = vi.fn();
  const hold = vi.fn(() => ({ release }));
  TestBed.configureTestingModule({
    providers: [{ provide: XpCelebrationService, useValue: { hold } }],
  });
  const done = signal(false);
  TestBed.runInInjectionContext(() => holdXpUntilDone(done, ['plan-session']));
  TestBed.tick();
  return { done, hold, release };
}

describe('holdXpUntilDone', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('should hold the session sources from the start', () => {
    // given / when
    const { hold, release } = setup();

    // then
    expect(hold).toHaveBeenCalledWith(['plan-session']);
    expect(release).not.toHaveBeenCalled();
  });

  it('should release the hold on the done screen', () => {
    // given
    const { done, release } = setup();

    // when
    done.set(true);
    TestBed.tick();

    // then
    expect(release).toHaveBeenCalled();
  });

  it('should release the hold when the session is left early', () => {
    // given
    const { release } = setup();

    // when
    TestBed.resetTestingModule();

    // then
    expect(release).toHaveBeenCalled();
  });
});
