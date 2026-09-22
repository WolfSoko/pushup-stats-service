import { render } from '@testing-library/angular';

import { FriendsTeaserSkeletonComponent } from './friends-teaser-skeleton.component';

describe('FriendsTeaserSkeletonComponent', () => {
  it('should mark itself busy and hold a standing line plus three board rows of shimmer bars', async () => {
    // given / when
    const { fixture } = await render(FriendsTeaserSkeletonComponent);
    const host = fixture.nativeElement as HTMLElement;

    // then
    expect(host.getAttribute('aria-busy')).toBe('true');
    expect(host.getAttribute('data-testid')).toBe('dashboard-friends-loading');
    expect(host.querySelector('.standing')).not.toBeNull();
    expect(host.querySelectorAll('.mini-board li')).toHaveLength(3);
    expect(host.querySelectorAll('pu-skeleton')).toHaveLength(10);
    expect(host.querySelector('mat-spinner')).toBeNull();
  });
});
