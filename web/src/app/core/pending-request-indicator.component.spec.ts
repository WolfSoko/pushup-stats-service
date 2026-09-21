import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { PendingRequestsService } from '@pu-stats/data-access';
import { PendingRequestIndicatorComponent } from './pending-request-indicator.component';

describe('PendingRequestIndicatorComponent', () => {
  const visible = signal(false);

  beforeEach(() => {
    visible.set(false);
  });

  async function setup() {
    return render(PendingRequestIndicatorComponent, {
      providers: [{ provide: PendingRequestsService, useValue: { visible } }],
    });
  }

  it('should render nothing while no request is slow', async () => {
    // given
    await setup();

    // then
    expect(screen.queryByTestId('pending-request-indicator')).toBeNull();
  });

  it('should render the spinner once a request is flagged as slow', async () => {
    // given
    const { fixture } = await setup();

    // when
    visible.set(true);
    await fixture.whenStable();

    // then
    const spinner = screen.getByTestId('pending-request-indicator');
    expect(spinner.getAttribute('aria-label')).toBe('Anfrage wird verarbeitet');
  });

  it('should remove the spinner again once every request has settled', async () => {
    // given
    visible.set(true);
    const { fixture } = await setup();
    expect(screen.queryByTestId('pending-request-indicator')).not.toBeNull();

    // when
    visible.set(false);
    await fixture.whenStable();

    // then
    expect(screen.queryByTestId('pending-request-indicator')).toBeNull();
  });
});
