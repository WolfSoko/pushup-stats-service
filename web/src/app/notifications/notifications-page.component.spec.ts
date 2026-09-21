import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';

import { notificationStoreMock } from './notification-store.testing';
import { NotificationStore } from './notification.store';
import { NotificationsPageComponent } from './notifications-page.component';

async function setup() {
  const store = notificationStoreMock();
  const view = await render(NotificationsPageComponent, {
    providers: [
      provideRouter([]),
      { provide: NotificationStore, useValue: store },
    ],
  });
  return { view, store };
}

describe('NotificationsPageComponent', () => {
  it('should mark "Alle gelesen" busy while the store marks everything read', async () => {
    // given
    const { view, store } = await setup();
    const button = screen.getByTestId('notifications-mark-all');

    // when
    store.setMarkingAllRead(true);
    view.fixture.detectChanges();

    // then
    expect(button.getAttribute('aria-busy')).toBe('true');

    // when
    store.setMarkingAllRead(false);
    view.fixture.detectChanges();

    // then
    expect(button.getAttribute('aria-busy')).toBeNull();
  });

  it('should pass the per-row busy flags down to the item', async () => {
    // given
    const { view, store } = await setup();
    const main = view.container.querySelector('button.main') as HTMLElement;
    const remove = view.container.querySelector('button.delete') as HTMLElement;

    // when
    store.setBusyKeys(['remove:n1']);
    view.fixture.detectChanges();

    // then
    expect(remove.getAttribute('aria-busy')).toBe('true');
    expect(main.getAttribute('aria-busy')).toBeNull();

    // when
    store.setBusyKeys(['open:n1']);
    view.fixture.detectChanges();

    // then
    expect(main.getAttribute('aria-busy')).toBe('true');
    expect(remove.getAttribute('aria-busy')).toBeNull();
  });
});
