import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';

import { NotificationBellComponent } from './notification-bell.component';
import { notificationStoreMock } from './notification-store.testing';
import { NotificationStore } from './notification.store';

async function setup() {
  const store = notificationStoreMock();
  const view = await render(NotificationBellComponent, {
    providers: [
      provideRouter([]),
      { provide: NotificationStore, useValue: store },
    ],
  });
  screen.getByTestId('notification-bell').click();
  await view.fixture.whenStable();
  return { view, store };
}

describe('NotificationBellComponent', () => {
  it('should mark "Alle gelesen" in the panel busy while the store marks everything read', async () => {
    // given
    const { view, store } = await setup();
    const button = screen.getByTestId('notification-panel-mark-all');

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

  it('should pass the per-row busy flags down to the panel rows', async () => {
    // given
    const { view, store } = await setup();
    const main = document.querySelector(
      '.notification-panel button.main'
    ) as HTMLElement;
    const remove = document.querySelector(
      '.notification-panel button.delete'
    ) as HTMLElement;

    // when
    store.setBusyKeys(['open:n1']);
    view.fixture.detectChanges();

    // then
    expect(main.getAttribute('aria-busy')).toBe('true');
    expect(remove.getAttribute('aria-busy')).toBeNull();
  });
});
