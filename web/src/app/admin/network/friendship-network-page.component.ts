import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../../core/page-header/page-header.component';
import { errorMessage } from '../admin-page.helpers';
import {
  BusyDirective,
  SkeletonComponent,
  SkeletonTableComponent,
} from '@pu-stats/ui';
import { CallableFunctionsService } from '../callable-functions.service';
import { FriendshipGraphComponent } from './friendship-graph.component';
import {
  EMPTY_GRAPH,
  type FriendshipGraph,
  type GraphEdgeStatus,
} from './friendship-graph.models';

/**
 * Who is connected to whom, for an admin.
 *
 * The picture is the point, but it ships with the same data as a table:
 * the edge colours sit below 3:1 against the light surface, and a node
 * hidden under a hub is unreadable at any contrast.
 */
@Component({
  selector: 'app-friendship-network-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SkeletonComponent,
    SkeletonTableComponent,
    BusyDirective,
    FriendshipGraphComponent,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    PageHeaderComponent,
    RouterLink,
  ],
  templateUrl: './friendship-network-page.component.html',
  styleUrl: './friendship-network-page.component.scss',
})
export class FriendshipNetworkPageComponent implements OnInit {
  private readonly callables = inject(CallableFunctionsService);

  protected readonly graph = signal<FriendshipGraph>(EMPTY_GRAPH);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showIsolated = signal(false);
  protected readonly showTable = signal(false);

  protected readonly tableColumns = ['source', 'status', 'target'] as const;

  protected readonly counts = computed(() => {
    const edges = this.graph().edges;
    return {
      accepted: edges.filter((e) => e.status === 'accepted').length,
      pending: edges.filter((e) => e.status === 'pending').length,
      declined: edges.filter((e) => e.status === 'declined').length,
    };
  });

  /** Uid → name, so the table can read like the graph's tooltips. */
  private readonly nameByUid = computed(
    () =>
      new Map(
        [...this.graph().nodes, ...this.graph().isolated].map((node) => [
          node.uid,
          node.displayName,
        ])
      )
  );

  protected readonly rows = computed(() =>
    [...this.graph().edges].sort(
      (a, b) =>
        this.name(a.source).localeCompare(this.name(b.source)) ||
        this.name(a.target).localeCompare(this.name(b.target))
    )
  );

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.callables.call<
        Record<string, never>,
        FriendshipGraph
      >('adminFriendshipGraph')({});
      this.graph.set(result.data ?? EMPTY_GRAPH);
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected name(uid: string): string {
    return (
      this.nameByUid().get(uid) ??
      $localize`:@@admin.network.anonymous:Ohne Namen`
    );
  }

  protected statusLabel(status: GraphEdgeStatus): string {
    if (status === 'accepted') {
      return $localize`:@@admin.network.status.accepted:befreundet mit`;
    }
    if (status === 'pending') {
      return $localize`:@@admin.network.status.pending:hat angefragt`;
    }
    return $localize`:@@admin.network.status.declined:wurde abgelehnt von`;
  }
}
