import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { levelProgress } from '@pu-stats/models';
import { vi } from 'vitest';

import { XpGainedDialogComponent } from './xp-gained-dialog.component';
import type { XpGainedDialogData } from './xp-gained.models';

function render(before: number, xp: number, reducedMotion = true) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reducedMotion }))
  );
  const close = vi.fn();
  const data: XpGainedDialogData = {
    xp,
    before: levelProgress(before),
    after: levelProgress(before + xp),
    lines: [{ label: 'Liegestütze', value: '20 Wdh.', xp }],
    titleId: 'xp-title',
  };
  TestBed.configureTestingModule({
    imports: [XpGainedDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(XpGainedDialogComponent);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, close };
}

describe('XpGainedDialogComponent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('should show the gained XP and the entry summary', () => {
    // given / when
    const { el } = render(10, 20);

    // then
    expect(el.querySelector('#xp-title')?.textContent).toContain('20');
    expect(el.querySelector('.line')?.textContent).toContain('Liegestütze');
    expect(el.querySelector('.level-up')).toBeNull();
  });

  it('should announce the new level when the XP cross a level', () => {
    // given / when
    const { el } = render(90, 30);

    // then
    expect(el.querySelector('.level-up')?.textContent).toContain('2');
  });

  it('should switch to the level-up phase after the fill animation', () => {
    // given
    vi.useFakeTimers();
    const { el, fixture } = render(90, 30, false);
    expect(el.querySelector('.level-up')).toBeNull();

    // when
    vi.advanceTimersByTime(1200);
    fixture.detectChanges();

    // then
    expect(el.querySelector('.level-up')).not.toBeNull();
  });

  it('should close on Weiter', () => {
    // given
    const { el, close } = render(0, 5);

    // when
    (el.querySelector('button.continue') as HTMLButtonElement).click();

    // then
    expect(close).toHaveBeenCalled();
  });

  it('should close when the countdown bar finishes', () => {
    // given
    const { el, close } = render(0, 5);
    const countdown = el.querySelector('.countdown') as HTMLElement;

    // when
    countdown.dispatchEvent(new Event('animationend', { bubbles: true }));

    // then
    expect(close).toHaveBeenCalled();
  });

  it('should ignore other animations ending', () => {
    // given
    const { el, close } = render(0, 5);

    // when
    el.querySelector('.gain')?.dispatchEvent(
      new Event('animationend', { bubbles: true })
    );

    // then
    expect(close).not.toHaveBeenCalled();
  });
});
