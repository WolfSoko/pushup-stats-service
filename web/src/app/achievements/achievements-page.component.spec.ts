import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import type { AchievementCollectionView } from './achievement-collection';
import { AchievementCelebrationService } from './achievement-celebration.service';
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
  const show = vi.fn();
  const view = await render(AchievementsPageComponent, {
    providers: [
      { provide: AchievementCelebrationService, useValue: { show } },
      {
        provide: AchievementsStore,
        useValue: {
          loading: loading.asReadonly(),
          collection: collection.asReadonly(),
        },
      },
    ],
  });
  return { view, loading, collection, show };
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

  it('should show the earned and total counts as plain numbers', async () => {
    // given
    const { view, loading, collection } = await setup();

    // when
    collection.set(LOADED);
    loading.set(false);
    view.fixture.detectChanges();
    await view.fixture.whenStable();

    // then — template i18n takes no `:name:` placeholder syntax; it used to
    // leak into the text as "1:earned: von 2:total:"
    const count = view.container.querySelector('.count')?.textContent ?? '';
    expect(count.replace(/\s+/g, ' ').trim()).toBe('1 von 2 freigeschaltet');
    expect(view.container.textContent).toContain('4 von 10');
    expect(view.container.textContent).not.toMatch(
      /:(earned|total|current|target):/
    );
  });

  it('should reopen the badge dialog when an earned badge is clicked', async () => {
    // given
    const { view, loading, collection, show } = await setup();
    collection.set(LOADED);
    loading.set(false);
    view.fixture.detectChanges();
    await view.fixture.whenStable();

    // when
    await userEvent.click(screen.getByTestId('achievement-tile-open'));

    // then — only the earned tile is a button; the locked "next" one is not
    expect(screen.getAllByTestId('achievement-tile-open')).toHaveLength(1);
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'plan-days-1', label: '1 Trainingstag' })
    );
  });
});
