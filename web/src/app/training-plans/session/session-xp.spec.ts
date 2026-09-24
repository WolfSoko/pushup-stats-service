import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { XpCelebrationService } from '../../core/xp/xp-celebration.service';
import { celebrateSessionXpOnDone } from './session-xp';
import type { SessionPhase } from './training-session.store';

const phase = signal<SessionPhase>('exercise');
let saved: Array<{ exerciseId: string; reps: number }> = [];
let held: Array<{ exerciseId: string; reps: number }> = [];

@Component({ template: '' })
class HostComponent {
  constructor() {
    celebrateSessionXpOnDone(phase, {
      takeSaved: () => saved.splice(0) as never,
    });
  }
}

function setup() {
  const release = vi.fn();
  const celebrate = vi.fn();
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [
      {
        provide: XpCelebrationService,
        useValue: {
          celebrate,
          hold: () => ({ take: () => held.splice(0), release }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(HostComponent);
  TestBed.tick();
  return { fixture, celebrate, release };
}

describe('celebrateSessionXpOnDone', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    phase.set('exercise');
    saved = [];
    held = [];
  });

  it('should not celebrate while the session is still running', () => {
    // given
    saved = [{ exerciseId: 'pushup', reps: 10 }];

    // when
    const { celebrate } = setup();

    // then
    expect(celebrate).not.toHaveBeenCalled();
  });

  it('should celebrate captured and held entries together on done', () => {
    // given
    const { celebrate, release } = setup();
    saved = [{ exerciseId: 'pushup', reps: 10 }];
    held = [{ exerciseId: 'abs.situps', reps: 20 }];

    // when
    phase.set('done');
    TestBed.tick();

    // then
    expect(release).toHaveBeenCalled();
    expect(celebrate).toHaveBeenCalledWith([
      { exerciseId: 'pushup', reps: 10 },
      { exerciseId: 'abs.situps', reps: 20 },
    ]);
  });

  it('should show what was earned when the session is left early', () => {
    // given
    const { fixture, celebrate } = setup();
    saved = [{ exerciseId: 'pushup', reps: 5 }];

    // when
    fixture.destroy();

    // then
    expect(celebrate).toHaveBeenCalledWith([{ exerciseId: 'pushup', reps: 5 }]);
  });

  it('should stay silent when nothing was saved', () => {
    // given
    const { fixture, celebrate } = setup();

    // when
    phase.set('done');
    TestBed.tick();
    fixture.destroy();

    // then
    expect(celebrate).not.toHaveBeenCalled();
  });
});
