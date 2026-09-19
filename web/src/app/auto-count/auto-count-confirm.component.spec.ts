import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AutoCountConfirmComponent } from './auto-count-confirm.component';

describe('AutoCountConfirmComponent', () => {
  const render = (detectedReps: number) => {
    const fixture = TestBed.createComponent(AutoCountConfirmComponent);
    fixture.componentRef.setInput('detectedReps', detectedReps);
    fixture.detectChanges();
    const confirmed = vi.fn();
    const dismissed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.componentInstance.dismissed.subscribe(dismissed);
    const click = (testId: string): void => {
      const button = fixture.nativeElement.querySelector(
        `[data-testid="${testId}"]`
      ) as HTMLButtonElement;
      button.click();
      fixture.detectChanges();
    };
    return { fixture, confirmed, dismissed, click };
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AutoCountConfirmComponent] });
  });

  it('given the detected count was right, when confirmed, then it is emitted unchanged', () => {
    // given
    const { confirmed, click } = render(12);

    // when
    click('auto-count-confirm-yes');

    // then
    expect(confirmed).toHaveBeenCalledWith(12);
  });

  it('given the user starts a correction, when the stepper opens, then it starts at the detected count', () => {
    // given
    const { fixture, click } = render(12);

    // when
    click('auto-count-confirm-correct');

    // then
    const value = fixture.nativeElement.querySelector(
      '[data-testid="auto-count-confirm-value"]'
    ) as HTMLElement;
    expect(value.textContent?.trim()).toBe('12');
  });

  it('given a correction, when saved, then the corrected count is emitted', () => {
    // given
    const { fixture, confirmed, click } = render(12);
    click('auto-count-confirm-correct');
    const [minus] = fixture.nativeElement.querySelectorAll(
      '.confirm-stepper button'
    ) as NodeListOf<HTMLButtonElement>;

    // when
    minus.click();
    minus.click();
    fixture.detectChanges();
    click('auto-count-confirm-save');

    // then
    expect(confirmed).toHaveBeenCalledWith(10);
  });

  it('given a count of zero, when stepping down, then it does not go negative', () => {
    // given
    const { fixture, confirmed, click } = render(0);
    click('auto-count-confirm-correct');
    const [minus] = fixture.nativeElement.querySelectorAll(
      '.confirm-stepper button'
    ) as NodeListOf<HTMLButtonElement>;

    // when
    minus.click();
    fixture.detectChanges();
    click('auto-count-confirm-save');

    // then
    expect(confirmed).toHaveBeenCalledWith(0);
  });

  it('given the user does not want to be asked again, when dismissed, then that is emitted', () => {
    // given
    const { dismissed, click } = render(12);

    // when
    click('auto-count-confirm-dismiss');

    // then
    expect(dismissed).toHaveBeenCalledTimes(1);
  });
});
