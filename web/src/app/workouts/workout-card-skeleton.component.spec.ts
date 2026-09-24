import { render } from '@testing-library/angular';

import { WorkoutCardSkeletonComponent } from './workout-card-skeleton.component';

describe('WorkoutCardSkeletonComponent', () => {
  it('should render a workout card shape out of shimmer bars', async () => {
    // given / when
    const { container } = await render(WorkoutCardSkeletonComponent);

    // then
    expect(container.querySelector('mat-card.workout-card')).not.toBeNull();
    expect(
      container.querySelector('mat-card-title pu-skeleton')
    ).not.toBeNull();
    expect(
      container.querySelector('mat-card-subtitle pu-skeleton')
    ).not.toBeNull();
    expect(
      container.querySelectorAll('mat-card-actions pu-skeleton')
    ).toHaveLength(2);
    expect(container.querySelectorAll('pu-skeleton')).toHaveLength(5);
    expect(container.querySelector('mat-spinner')).toBeNull();
  });
});
