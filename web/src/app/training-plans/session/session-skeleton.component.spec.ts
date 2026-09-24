import { render, screen } from '@testing-library/angular';

import { SessionSkeletonComponent } from './session-skeleton.component';

describe('SessionSkeletonComponent', () => {
  it('should render a busy session card with a hidden status text and shimmer bars', async () => {
    // given / when
    const { container } = await render(SessionSkeletonComponent);

    // then
    const card = screen.getByTestId('session-loading');
    expect(card.classList.contains('session-card')).toBe(true);
    expect(card.getAttribute('aria-busy')).toBe('true');
    const status = card.querySelector('.pu-visually-hidden[role="status"]');
    expect(status?.textContent).toContain('Session wird geladen …');
    expect(card.querySelectorAll('.actions pu-skeleton')).toHaveLength(2);
    expect(card.querySelectorAll('pu-skeleton')).toHaveLength(6);
    expect(container.querySelector('mat-spinner')).toBeNull();
  });
});
