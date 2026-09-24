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
  it('should show skeleton rows instead of the empty text until the inbox has loaded', async () => {
    // given
    const { view, store } = await setup();
    store.setRows([]);
    store.setLoaded(false);
    view.fixture.detectChanges();
    const page = view.container.querySelector('.page') as HTMLElement;

    // then
    expect(
      page.querySelectorAll('[data-testid="notifications-skeleton-row"]')
    ).toHaveLength(4);
    expect(page.querySelectorAll('pu-skeleton').length).toBeGreaterThan(0);
    expect(page.getAttribute('aria-busy')).toBe('true');
    expect(page.querySelector('.empty')).toBeNull();
    expect(page.textContent).not.toContain('Hier landen');

    // when
    store.setLoaded(true);
    view.fixture.detectChanges();

    // then
    expect(page.querySelector('pu-skeleton')).toBeNull();
    expect(page.getAttribute('aria-busy')).toBeNull();
    expect(page.querySelector('.empty')?.textContent).toContain('Hier landen');
  });

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
