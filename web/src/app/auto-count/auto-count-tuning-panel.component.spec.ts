import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AutoCountTuningPanelComponent } from './auto-count-tuning-panel.component';
import { AutoCountTuningStore } from './auto-count-tuning.store';

const DEFAULTS = {
  upAngleDeg: 150,
  downAngleDeg: 90,
  minDwellMs: 200,
  minConfidence: 0.6,
  maxFrameGapMs: 500,
};

describe('AutoCountTuningPanelComponent', () => {
  let values: Record<string, number>;
  let store: {
    valuesFor: ReturnType<typeof vi.fn>;
    publishedFor: ReturnType<typeof vi.fn>;
    hasDraft: ReturnType<typeof vi.fn>;
    isTuned: ReturnType<typeof vi.fn>;
    setValue: ReturnType<typeof vi.fn>;
    clearValue: ReturnType<typeof vi.fn>;
    resetToDefaults: ReturnType<typeof vi.fn>;
    discardDraft: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    error: () => string | null;
  };

  const render = () => {
    const fixture = TestBed.createComponent(AutoCountTuningPanelComponent);
    fixture.componentRef.setInput('exerciseId', 'pushup');
    fixture.componentRef.setInput('kind', 'angle');
    fixture.componentRef.setInput('defaults', DEFAULTS);
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    fixture.detectChanges();
    const click = (testId: string): void => {
      (
        fixture.nativeElement.querySelector(
          `[data-testid="${testId}"]`
        ) as HTMLButtonElement
      ).click();
      fixture.detectChanges();
    };
    return { fixture, changed, click };
  };

  beforeEach(() => {
    values = {};
    store = {
      valuesFor: vi.fn(() => values),
      publishedFor: vi.fn(() => false),
      hasDraft: vi.fn(() => false),
      isTuned: vi.fn(() => Object.keys(values).length > 0),
      setValue: vi.fn(),
      clearValue: vi.fn(),
      resetToDefaults: vi.fn(),
      discardDraft: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      error: () => null,
    };
    TestBed.configureTestingModule({
      imports: [AutoCountTuningPanelComponent],
      providers: [{ provide: AutoCountTuningStore, useValue: store }],
    });
  });

  it('given no override, when rendered, then each slider shows the catalog default', () => {
    // given / when
    const { fixture } = render();

    // then
    expect(fixture.nativeElement.textContent).toContain('150°');
    expect(fixture.nativeElement.textContent).toContain('90°');
  });

  it('given a stored override, when rendered, then it replaces the default value', () => {
    // given
    values = { downAngleDeg: 75 };

    // when
    const { fixture } = render();

    // then
    expect(fixture.nativeElement.textContent).toContain('75°');
    expect(fixture.nativeElement.textContent).not.toContain('90°');
  });

  it('given a slider move, when it settles, then the store is updated and a restart is requested', () => {
    // given
    const { fixture, changed } = render();
    const input = fixture.nativeElement.querySelector(
      '#tune-upAngleDeg'
    ) as HTMLInputElement;

    // when
    input.value = '160';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    // then
    expect(store.setValue).toHaveBeenCalledWith(
      'pushup',
      'angle',
      'upAngleDeg',
      160
    );
    expect(changed).toHaveBeenCalled();
  });

  it('given an overridden threshold, when its undo button is used, then only that key is cleared', () => {
    // given
    values = { downAngleDeg: 75 };
    const { fixture, changed } = render();
    const undo = fixture.nativeElement.querySelector(
      '.tuning-clear'
    ) as HTMLButtonElement;

    // when
    undo.click();
    fixture.detectChanges();

    // then
    expect(store.clearValue).toHaveBeenCalledWith(
      'pushup',
      'angle',
      'downAngleDeg'
    );
    expect(changed).toHaveBeenCalled();
  });

  it('given tuned values, when saved, then they are stored unpublished', async () => {
    // given
    values = { downAngleDeg: 75 };
    const { click } = render();

    // when
    click('auto-count-tuning-save');

    // then
    expect(store.save).toHaveBeenCalledWith('pushup', 'angle', false);
  });

  it('given tuned values, when published, then they are stored for everyone', async () => {
    // given
    values = { downAngleDeg: 75 };
    const { click } = render();

    // when
    click('auto-count-tuning-publish');

    // then
    expect(store.save).toHaveBeenCalledWith('pushup', 'angle', true);
  });

  it('given a published profile, when rendered, then that is flagged', () => {
    // given
    store.publishedFor = vi.fn(() => true);

    // when
    const { fixture } = render();

    // then
    expect(fixture.nativeElement.textContent).toContain('für alle aktiv');
  });

  it('given a failed save, when the error is set, then it is shown rather than swallowed', () => {
    // given
    store.error = () => 'permission denied';

    // when
    const { fixture } = render();

    // then
    const error = fixture.nativeElement.querySelector(
      '[data-testid="auto-count-tuning-error"]'
    ) as HTMLElement;
    expect(error.textContent).toContain('permission denied');
  });
  it('given a profile that is live for everyone, when saved, then it stays live', () => {
    // given
    values = { downAngleDeg: 75 };
    store.publishedFor = vi.fn(() => true);
    const { click } = render();

    // when
    click('auto-count-tuning-save');

    // then — saving persists the edit, it does not roll anyone back
    expect(store.save).toHaveBeenCalledWith('pushup', 'angle', true);
  });

  it('given a published profile, when the admin wants it back to themselves, then it can be unpublished', () => {
    // given
    values = { downAngleDeg: 75 };
    store.publishedFor = vi.fn(() => true);
    const { click } = render();

    // when
    click('auto-count-tuning-unpublish');

    // then
    expect(store.save).toHaveBeenCalledWith('pushup', 'angle', false);
  });

  it('given an unpublished profile, when rendered, then the rollout button offers publishing', () => {
    // given / when
    const { fixture } = render();

    // then
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="auto-count-tuning-publish"]'
      )
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="auto-count-tuning-unpublish"]'
      )
    ).toBeNull();
  });
});
