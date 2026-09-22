import { render, screen } from '@testing-library/angular';

import { PushStatusPanelComponent } from './push-status-panel.component';

describe('PushStatusPanelComponent', () => {
  it('should reserve the panel with a skeleton until the push status is known', async () => {
    // given
    const { fixture } = await render(PushStatusPanelComponent, {
      inputs: { status: 'loading', deviceCount: 0, busyKeys: new Set() },
    });
    const host = fixture.nativeElement as HTMLElement;

    // then
    expect(screen.getByTestId('push-status-skeleton')).toBeTruthy();
    expect(host.querySelectorAll('pu-skeleton')).toHaveLength(3);
    expect(host.querySelector('section')?.getAttribute('aria-busy')).toBe(
      'true'
    );
    expect(screen.queryByTestId('push-subscribe')).toBeNull();
    expect(screen.queryByTestId('push-unsubscribe')).toBeNull();

    // when
    fixture.componentRef.setInput('status', 'not-subscribed');
    await fixture.whenStable();

    // then
    expect(host.querySelector('pu-skeleton')).toBeNull();
    expect(host.querySelector('section')?.getAttribute('aria-busy')).toBeNull();
    expect(screen.getByTestId('push-subscribe')).toBeTruthy();
  });

  it('should keep the pressed subscribe button while its request flips the status to loading', async () => {
    // given
    await render(PushStatusPanelComponent, {
      inputs: {
        status: 'loading',
        deviceCount: 0,
        busyKeys: new Set(['subscribe' as const]),
      },
    });

    // then
    expect(screen.queryByTestId('push-status-skeleton')).toBeNull();
    expect(screen.getByTestId('push-subscribe').getAttribute('aria-busy')).toBe(
      'true'
    );
  });

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
