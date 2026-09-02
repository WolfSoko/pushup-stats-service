import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StopwatchSignalService } from './stopwatch-signal.service';
import { StopwatchComponent } from './stopwatch.component';
import { StopwatchState } from './stopwatch.state';

@Component({
  selector: 'app-host',
  imports: [StopwatchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<app-stopwatch [state]="state" [targetSec]="targetSec()" (elapsedSecChange)="onElapsed($event)" />',
})
class HostComponent {
  readonly state = new StopwatchState(true, 100);
  readonly targetSec = signal(0);
  readonly elapsed: number[] = [];
  onElapsed(sec: number): void {
    this.elapsed.push(sec);
  }
}

describe('StopwatchComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  const play = vi.fn();

  function byTestId(id: string): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
  }

  beforeEach(async () => {
    vi.useFakeTimers({ now: 1_000 });
    play.mockClear();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: StopwatchSignalService, useValue: { play } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    host.state.destroy();
    vi.useRealTimers();
  });

  it('should start and pause the owned state from the toggle button', () => {
    // when
    byTestId('stopwatch-toggle').click();
    vi.advanceTimersByTime(2_000);
    fixture.detectChanges();

    // then
    expect(host.state.running()).toBe(true);
    expect(byTestId('stopwatch-value').textContent?.trim()).toBe('00:02');
    expect(byTestId('stopwatch-toggle').textContent).toContain('Pause');

    // when
    byTestId('stopwatch-toggle').click();
    fixture.detectChanges();

    // then
    expect(host.state.running()).toBe(false);
    expect(byTestId('stopwatch-toggle').textContent).toContain('Start');
  });

  it('should emit whole seconds as they change so a form can mirror them', () => {
    // when
    host.state.start();
    for (let i = 0; i < 2; i++) {
      vi.advanceTimersByTime(1_000);
      fixture.detectChanges();
    }

    // then
    expect(host.elapsed).toEqual([0, 1, 2]);
  });

  it('should show the target, flag it once reached and cue the signal exactly once', () => {
    // given
    host.targetSec.set(2);
    fixture.detectChanges();
    expect(byTestId('stopwatch-target').textContent).toContain('00:02');

    // when
    host.state.start();
    vi.advanceTimersByTime(1_000);
    fixture.detectChanges();

    // then
    expect(play).not.toHaveBeenCalled();

    // when
    vi.advanceTimersByTime(2_000);
    fixture.detectChanges();

    // then
    expect(play).toHaveBeenCalledTimes(1);
    expect(byTestId('stopwatch-target').textContent).toContain('check_circle');
  });

  it('should reset to zero and disable the reset button when idle', () => {
    // given
    expect((byTestId('stopwatch-reset') as HTMLButtonElement).disabled).toBe(
      true
    );
    host.state.start();
    vi.advanceTimersByTime(3_000);
    fixture.detectChanges();

    // when
    byTestId('stopwatch-reset').click();
    fixture.detectChanges();

    // then
    expect(host.state.elapsedSec()).toBe(0);
    expect(byTestId('stopwatch-value').textContent?.trim()).toBe('00:00');
    expect((byTestId('stopwatch-reset') as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});
