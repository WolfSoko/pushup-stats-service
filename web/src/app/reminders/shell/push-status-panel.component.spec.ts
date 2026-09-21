import { render, screen } from '@testing-library/angular';

import { PushStatusPanelComponent } from './push-status-panel.component';

describe('PushStatusPanelComponent', () => {
  it('should show the subscribe button busy while its request runs', async () => {
    // given
    await render(PushStatusPanelComponent, {
      inputs: {
        status: 'not-subscribed',
        deviceCount: 0,
        busyKeys: new Set(['subscribe' as const]),
      },
    });

    // then — busy, not greyed out
    const button = screen.getByTestId('push-subscribe') as HTMLButtonElement;
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.disabled).toBe(false);
  });

  it('should keep the unsubscribe button still while nothing is pressed', async () => {
    // given
    await render(PushStatusPanelComponent, {
      inputs: { status: 'subscribed', deviceCount: 1, busyKeys: new Set() },
    });

    // then
    expect(
      screen.getByTestId('push-unsubscribe').getAttribute('aria-busy')
    ).toBeNull();
  });

  it('should show the unsubscribe button busy once it was pressed', async () => {
    // given
    await render(PushStatusPanelComponent, {
      inputs: {
        status: 'subscribed',
        deviceCount: 1,
        busyKeys: new Set(['unsubscribe' as const]),
      },
    });

    // then
    expect(
      screen.getByTestId('push-unsubscribe').getAttribute('aria-busy')
    ).toBe('true');
  });
});
