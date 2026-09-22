import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';

import { CallableFunctionsService } from '../callable-functions.service';
import { FriendshipNetworkPageComponent } from './friendship-network-page.component';
import type { FriendshipGraph } from './friendship-graph.models';

describe('FriendshipNetworkPageComponent', () => {
  const graph: FriendshipGraph = {
    nodes: [
      { uid: 'a', displayName: 'Ada', friends: 1 },
      { uid: 'b', displayName: 'Wolf', friends: 1 },
      { uid: 'c', displayName: null, friends: 0 },
    ],
    edges: [
      { source: 'a', target: 'b', status: 'accepted' },
      { source: 'a', target: 'c', status: 'pending' },
    ],
    isolated: [{ uid: 'z', displayName: 'Grace' }],
    truncated: false,
  };

  async function renderPage(
    response: FriendshipGraph | Error = graph
  ): Promise<{ fixture: { whenStable: () => Promise<unknown> } }> {
    const callable =
      response instanceof Error
        ? vitest.fn().mockRejectedValue(response)
        : vitest.fn().mockResolvedValue({ data: response });
    const { fixture } = await render(FriendshipNetworkPageComponent, {
      providers: [
        provideRouter([]),
        {
          provide: CallableFunctionsService,
          useValue: { call: () => callable },
        },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture };
  }

  it('should reserve the graph and table with skeletons while the network loads', async () => {
    // given
    let resolve: (value: { data: FriendshipGraph }) => void = () => undefined;
    const pending = new Promise<{ data: FriendshipGraph }>((r) => {
      resolve = r;
    });
    const { fixture } = await render(FriendshipNetworkPageComponent, {
      providers: [
        provideRouter([]),
        {
          provide: CallableFunctionsService,
          useValue: { call: () => () => pending },
        },
      ],
    });
    const host = fixture.nativeElement as HTMLElement;

    // then
    const skeleton = host.querySelector('[data-testid="network-skeleton"]');
    expect(skeleton?.getAttribute('aria-busy')).toBe('true');
    expect(
      skeleton?.querySelector('pu-skeleton.pu-skeleton--rect')
    ).toBeTruthy();
    expect(skeleton?.querySelector('pu-skeleton-table')).toBeTruthy();
    expect(host.querySelector('mat-spinner')).toBeNull();
    expect(host.textContent).not.toContain('Noch niemand ist mit jemandem');

    // when
    resolve({ data: graph });
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(host.querySelector('pu-skeleton-table')).toBeNull();
    expect(screen.getByTestId('friendship-graph')).toBeTruthy();
  });

  it('should draw a node per connected account', async () => {
    // given
    await renderPage();

    // then
    expect(screen.getByTestId('graph-node-a')).toBeTruthy();
    expect(screen.getByTestId('graph-node-b')).toBeTruthy();
    expect(screen.getByTestId('friendship-graph')).toBeTruthy();
  });

  it('should count the relationships by kind', async () => {
    // given
    await renderPage();

    // then
    const stats = screen.getByTestId('network-stats').textContent ?? '';
    expect(stats).toContain('3');
    expect(stats).toContain('Freundschaften');
    expect(stats).toContain('offene Anfragen');
  });

  it('should name every edge kind in the legend', async () => {
    // given — colour alone is not an encoding anyone can rely on
    await renderPage();

    // then
    const text = document.body.textContent ?? '';
    expect(text).toContain('Bestätigte Freundschaft');
    expect(text).toContain('Offene Anfrage');
    expect(text).toContain('Abgelehnt');
  });

  it('should offer the same data as a table', async () => {
    // given — the edge colours sit below 3:1 on the light surface, so a
    // readable fallback is owed, not optional
    const { fixture } = await renderPage();

    // when
    screen.getByTestId('toggle-table').click();
    await fixture.whenStable();

    // then
    const table = screen.getByTestId('network-table').textContent ?? '';
    expect(table).toContain('Ada');
    expect(table).toContain('befreundet mit');
    expect(table).toContain('Wolf');
  });

  it('should list the accounts nobody is connected to', async () => {
    // given — they are counted rather than drawn, so the list is where
    // an admin finds them
    const { fixture } = await renderPage();

    // when
    screen.getByTestId('toggle-isolated').click();
    await fixture.whenStable();

    // then
    expect(screen.getByTestId('isolated-list').textContent).toContain('Grace');
  });

  it('should say so when the picture is only a section', async () => {
    // given
    await renderPage({ ...graph, truncated: true });

    // then
    expect(document.body.textContent).toContain('nur einen Ausschnitt');
  });

  it('should explain a failed load instead of showing an empty network', async () => {
    // given
    await renderPage(new Error('boom'));

    // then
    expect(screen.getByTestId('network-error').textContent).toContain('boom');
    expect(document.body.textContent).not.toContain('Noch niemand');
  });

  it('should say when nobody is connected yet', async () => {
    // given
    await renderPage({
      nodes: [],
      edges: [],
      isolated: [],
      truncated: false,
    });

    // then
    expect(document.body.textContent).toContain('Noch niemand');
  });
});
