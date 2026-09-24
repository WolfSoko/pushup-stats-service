import { render, screen } from '@testing-library/angular';

import { UnsubscribeAllSectionComponent } from './unsubscribe-all-section.component';

describe('UnsubscribeAllSectionComponent', () => {
  it('should show the button busy while the devices are being unsubscribed', async () => {
    // given
    const { fixture } = await render(UnsubscribeAllSectionComponent, {
      inputs: { busy: true },
    });

    // then
    const button = screen.getByTestId(
      'push-unsubscribe-all'
    ) as HTMLButtonElement;
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.disabled).toBe(false);

    // when
    fixture.componentRef.setInput('busy', false);
    fixture.detectChanges();

    // then
    expect(button.getAttribute('aria-busy')).toBeNull();
  });
});
