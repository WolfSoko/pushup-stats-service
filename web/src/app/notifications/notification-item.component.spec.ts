import { render } from '@testing-library/angular';

import type { InboxRow } from './inbox-rows';
import { NotificationItemComponent } from './notification-item.component';

const ROW: InboxRow = {
  id: 'n1',
  kind: 'notification',
  category: 'social',
  icon: 'favorite',
  text: 'Anna feuert dich an',
  createdAt: '2026-09-20T08:00:00.000Z',
  unread: true,
  url: '/freunde',
};

describe('NotificationItemComponent', () => {
  it('should mark the row button busy while it is being opened', async () => {
    // given
    const view = await render(NotificationItemComponent, {
      inputs: { row: ROW, opening: false, removing: false },
    });
    const main = view.container.querySelector(
      'button.main'
    ) as HTMLButtonElement;
    const remove = view.container.querySelector(
      'button.delete'
    ) as HTMLButtonElement;

    // when
    view.fixture.componentRef.setInput('opening', true);
    view.fixture.detectChanges();

    // then
    expect(main.getAttribute('aria-busy')).toBe('true');
    expect(remove.getAttribute('aria-busy')).toBeNull();

    // when
    view.fixture.componentRef.setInput('opening', false);
    view.fixture.detectChanges();

    // then
    expect(main.getAttribute('aria-busy')).toBeNull();
  });

  it('should mark the delete button busy while the row is being removed', async () => {
    // given
    const view = await render(NotificationItemComponent, {
      inputs: { row: ROW, opening: false, removing: true },
    });

    // then
    const remove = view.container.querySelector(
      'button.delete'
    ) as HTMLButtonElement;
    expect(remove.getAttribute('aria-busy')).toBe('true');
    expect(remove.disabled).toBe(false);
    expect(
      view.container.querySelector('button.main')?.getAttribute('aria-busy')
    ).toBeNull();
  });
});
