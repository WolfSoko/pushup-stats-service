import { render, screen } from '@testing-library/angular';

import { ActivePlanCardSkeletonComponent } from './active-plan-card-skeleton.component';

describe('ActivePlanCardSkeletonComponent', () => {
  it('should render a busy active-plan card shape out of shimmer bars', async () => {
    // given / when
    const { container } = await render(ActivePlanCardSkeletonComponent);

    // then
    const card = screen.getByTestId('active-plan-loading');
    expect(card.classList.contains('active-plan')).toBe(true);
    expect(card.getAttribute('aria-busy')).toBe('true');
    expect(card.querySelector('mat-card-title pu-skeleton')).not.toBeNull();
    expect(card.querySelectorAll('mat-card-actions pu-skeleton')).toHaveLength(
      2
    );
    expect(card.querySelectorAll('pu-skeleton')).toHaveLength(7);
    expect(container.querySelector('mat-spinner')).toBeNull();
  });
});
