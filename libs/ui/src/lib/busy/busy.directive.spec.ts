import { Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BUSY_SPINNER_CLASS, BusyDirective } from './busy.directive';

@Component({
  imports: [BusyDirective, MatButtonModule, MatIconModule],
  template: `
    <button
      mat-flat-button
      type="button"
      [puBusy]="busy()"
      (click)="clicks.set(clicks() + 1)"
    >
      <mat-icon>save</mat-icon>
      Speichern
    </button>
  `,
})
class HostComponent {
  readonly busy = signal(false);
  readonly clicks = signal(0);
}

describe('BusyDirective', () => {
  async function setup() {
    const view = await render(HostComponent);
    const host = view.fixture.componentInstance;
    const button = screen.getByRole('button', { name: /Speichern/ });
    const spinner = () => button.querySelector(`.${BUSY_SPINNER_CLASS}`);
    return { view, host, button, spinner };
  }

  it('should render an idle button without spinner or busy markers', async () => {
    // given / when
    const { button, spinner } = await setup();

    // then
    expect(spinner()).toBeNull();
    expect(button.getAttribute('aria-busy')).toBeNull();
    expect(button.classList.contains('pu-busy')).toBe(false);
  });

  it('should show a spinner and mark the host busy while busy', async () => {
    // given
    const { view, host, button, spinner } = await setup();

    // when
    host.busy.set(true);
    await view.fixture.whenStable();

    // then
    const element = spinner();
    expect(element).not.toBeNull();
    expect(element?.getAttribute('aria-hidden')).toBe('true');
    expect(button.firstElementChild).toBe(element);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.classList.contains('pu-busy')).toBe(true);
    expect(button.textContent).toContain('Speichern');
  });

  it('should remove the spinner again once the work is done', async () => {
    // given
    const { view, host, button, spinner } = await setup();
    host.busy.set(true);
    await view.fixture.whenStable();
    expect(spinner()).not.toBeNull();

    // when
    host.busy.set(false);
    await view.fixture.whenStable();

    // then
    expect(spinner()).toBeNull();
    expect(button.getAttribute('aria-busy')).toBeNull();
  });

  it('should swallow clicks while busy and let them through again afterwards', async () => {
    // given
    const { view, host, button } = await setup();
    const user = userEvent.setup();
    host.busy.set(true);
    await view.fixture.whenStable();

    // when — pointer-events are off in the real stylesheet, so this mimics a
    // keyboard activation reaching the element
    button.click();

    // then
    expect(host.clicks()).toBe(0);

    // when
    host.busy.set(false);
    await view.fixture.whenStable();
    await user.click(button);

    // then
    expect(host.clicks()).toBe(1);
  });
});
