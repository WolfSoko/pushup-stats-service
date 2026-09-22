import { signal } from '@angular/core';
import { render } from '@testing-library/angular';

import type { AchievementCollectionView } from './achievement-collection';
import { AchievementsPageComponent } from './achievements-page.component';
import { AchievementsStore } from './achievements.store';

const EMPTY: AchievementCollectionView = {
  groups: [],
  earnedCount: 0,
  totalCount: 0,
  next: null,
};

const LOADED: AchievementCollectionView = {
  earnedCount: 1,
  totalCount: 2,
  next: {
    id: 'plan-days-10',
    icon: 'star',
    label: '10 Trainingstage',
    earnedAt: null,
    progress: { current: 4, target: 10 },
  },
  groups: [
    {
      kind: 'plan-days',
      tiles: [
        {
          id: 'plan-days-1',
          icon: 'star',
          label: '1 Trainingstag',
          earnedAt: '2026-09-01T10:00:00.000Z',
          progress: null,
        },
      ],
    },
  ],
};

async function setup() {
  const loading = signal(true);
  const collection = signal<AchievementCollectionView>(EMPTY);
  const view = await render(AchievementsPageComponent, {
    providers: [
      {
        provide: AchievementsStore,
        useValue: {
          loading: loading.asReadonly(),
          collection: collection.asReadonly(),
        },
      },
    ],
  });
  return { view, loading, collection };
}

describe('AchievementsPageComponent', () => {
  it('should hold the count and the grid with skeletons while the collection loads', async () => {
    // given
    const { view } = await setup();

    // then
    const page = view.container.querySelector('.page');
    expect(page?.getAttribute('aria-busy')).toBe('true');
    expect(view.container.querySelector('mat-progress-bar')).toBeNull();
    expect(view.container.textContent).not.toContain('freigeschaltet');
    expect(
      view.container.querySelectorAll('app-achievement-tile-skeleton').length
    ).toBe(7);
    expect(view.container.querySelector('.grid pu-skeleton')).not.toBeNull();
  });

  it('should swap the skeletons for the badges once the collection is there', async () => {
    // given
    const { view, loading, collection } = await setup();

    // when
    collection.set(LOADED);
    loading.set(false);
    view.fixture.detectChanges();
    await view.fixture.whenStable();

    // then
    expect(
      view.container.querySelector('.page')?.getAttribute('aria-busy')
    ).toBeNull();
    expect(
      view.container.querySelector('app-achievement-tile-skeleton')
    ).toBeNull();
    expect(view.container.querySelector('pu-skeleton')).toBeNull();
    expect(view.container.textContent).toContain('freigeschaltet');
    expect(view.container.querySelectorAll('app-achievement-tile').length).toBe(
      2
    );
  });
});
