import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';

import { layoutGraph, type PositionedNode } from './friendship-graph-layout';
import type {
  GraphEdge,
  GraphEdgeStatus,
  GraphNode,
} from './friendship-graph.models';

const WIDTH = 900;
const HEIGHT = 620;
/** Only the best-connected get a name on the canvas; the rest would collide. */
const LABELLED = 12;
/** Roughly a short name's box, used to keep two labels off each other. */
const LABEL_GAP_X = 70;
const LABEL_GAP_Y = 18;

interface StatusStyle {
  readonly status: GraphEdgeStatus;
  readonly label: string;
  readonly directed: boolean;
}

/**
 * The friendship network as a node-link diagram.
 *
 * Status is carried by line style as well as colour — dashes for an open
 * request, dots for a refused one — because colour alone is not an
 * encoding anyone can rely on. The layout is computed once and does not
 * animate: this is a picture to read, not a toy to watch settle.
 */
@Component({
  selector: 'app-friendship-graph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="graph">
      <figcaption class="legend">
        @for (style of styles; track style.status) {
          <span class="legend-item">
            <svg class="swatch" viewBox="0 0 28 8" aria-hidden="true">
              <line
                x1="1"
                y1="4"
                x2="27"
                y2="4"
                [attr.class]="'edge edge-' + style.status"
              />
            </svg>
            {{ style.label }}
          </span>
        }
      </figcaption>

      <svg
        [attr.viewBox]="'0 0 ' + width + ' ' + height"
        role="img"
        [attr.aria-label]="summary()"
        data-testid="friendship-graph"
      >
        <defs>
          @for (style of styles; track style.status) {
            <marker
              [attr.id]="'arrow-' + style.status"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                [attr.class]="'head-' + style.status"
              />
            </marker>
          }
        </defs>

        <g>
          @for (edge of layout().edges; track $index) {
            <line
              [attr.x1]="edge.x1"
              [attr.y1]="edge.y1"
              [attr.x2]="edge.x2"
              [attr.y2]="edge.y2"
              [attr.class]="'edge edge-' + edge.status"
              [attr.marker-end]="markerFor(edge)"
              [attr.opacity]="dim(edge) ? 0.12 : null"
            />
          }
        </g>

        <g>
          @for (node of layout().nodes; track node.uid) {
            <circle
              [attr.cx]="node.x"
              [attr.cy]="node.y"
              [attr.r]="node.r"
              class="node"
              [class.node-lonely]="node.friends === 0"
              [attr.opacity]="dimNode(node) ? 0.2 : null"
              [attr.data-testid]="'graph-node-' + node.uid"
              tabindex="0"
              (mouseenter)="hovered.set(node.uid)"
              (mouseleave)="hovered.set(null)"
              (focus)="hovered.set(node.uid)"
              (blur)="hovered.set(null)"
            >
              <title>{{ tooltip(node) }}</title>
            </circle>
          }
        </g>

        <g class="labels" aria-hidden="true">
          @for (node of labelled(); track node.uid) {
            <text [attr.x]="node.x" [attr.y]="node.y - node.r - 5">
              {{ node.displayName ?? node.uid.slice(0, 6) }}
            </text>
          }
        </g>
      </svg>
    </figure>
  `,
  styles: `
    :host {
      --edge-accepted: #199e70;
      --edge-pending: #d95926;
      --edge-declined: #9085e9;
      --node-fill: #7ba4ff;
      --node-lonely: #5a6b8c;
      --node-ring: #0e1423;
      display: block;
    }
    :host-context(html.light-theme) {
      --edge-accepted: #1baf7a;
      --edge-pending: #eb6834;
      --edge-declined: #4a3aa7;
      --node-fill: #2a78d6;
      --node-lonely: #94a3b8;
      --node-ring: #f8fafc;
    }
    .graph {
      margin: 0;
      display: grid;
      gap: 12px;
    }
    svg {
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      color: var(--text-body-secondary);
      font-size: 0.9rem;
    }
    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .swatch {
      width: 28px;
      height: 8px;
      flex: none;
    }
    .edge {
      stroke-width: 2;
      fill: none;
    }
    .edge-accepted {
      stroke: var(--edge-accepted);
    }
    .edge-pending {
      stroke: var(--edge-pending);
      stroke-dasharray: 6 4;
    }
    .edge-declined {
      stroke: var(--edge-declined);
      stroke-dasharray: 1 5;
      stroke-linecap: round;
    }
    .head-pending {
      fill: var(--edge-pending);
    }
    .head-declined {
      fill: var(--edge-declined);
    }
    .head-accepted {
      fill: none;
    }
    .node {
      fill: var(--node-fill);
      /* A 2px surface ring keeps overlapping nodes countable. */
      stroke: var(--node-ring);
      stroke-width: 2;
      cursor: pointer;
    }
    .node-lonely {
      fill: var(--node-lonely);
    }
    .node:hover,
    .node:focus-visible {
      stroke: var(--text-heading-secondary);
      outline: none;
    }
    .labels text {
      fill: var(--text-body-secondary);
      font-size: 12px;
      text-anchor: middle;
      pointer-events: none;
    }
  `,
})
export class FriendshipGraphComponent {
  readonly nodes = input.required<ReadonlyArray<GraphNode>>();
  readonly edges = input.required<ReadonlyArray<GraphEdge>>();

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly hovered = signal<string | null>(null);

  protected readonly styles: ReadonlyArray<StatusStyle> = [
    {
      status: 'accepted',
      label: $localize`:@@admin.network.legend.accepted:Bestätigte Freundschaft`,
      directed: false,
    },
    {
      status: 'pending',
      label: $localize`:@@admin.network.legend.pending:Offene Anfrage (Pfeil: wer gefragt hat)`,
      directed: true,
    },
    {
      status: 'declined',
      label: $localize`:@@admin.network.legend.declined:Abgelehnt`,
      directed: true,
    },
  ];

  protected readonly layout = computed(() =>
    layoutGraph(this.nodes(), this.edges(), {
      width: WIDTH,
      height: HEIGHT,
    })
  );

  /**
   * The hubs worth naming. Best-connected first, and a name is dropped
   * when it would land on one already placed — two labels on top of each
   * other name nobody.
   */
  protected readonly labelled = computed(() => {
    const candidates = [...this.layout().nodes]
      .filter((node) => node.friends > 0)
      .sort((a, b) => b.friends - a.friends || a.uid.localeCompare(b.uid));

    const placed: PositionedNode[] = [];
    for (const node of candidates) {
      if (placed.length >= LABELLED) break;
      const clear = placed.every(
        (other) =>
          Math.abs(other.x - node.x) > LABEL_GAP_X ||
          Math.abs(other.y - node.y) > LABEL_GAP_Y
      );
      if (clear) placed.push(node);
    }
    return placed;
  });

  protected readonly summary = computed(
    () =>
      $localize`:@@admin.network.summary:Netzwerk aus ${this.nodes().length}:count: Nutzern und ${this.edges().length}:edges: Verbindungen`
  );

  protected markerFor(edge: GraphEdge): string | null {
    return edge.status === 'accepted' ? null : `url(#arrow-${edge.status})`;
  }

  /** Hovering somebody pushes everything they are not part of into the background. */
  protected dim(edge: GraphEdge): boolean {
    const active = this.hovered();
    return active !== null && edge.source !== active && edge.target !== active;
  }

  protected dimNode(node: PositionedNode): boolean {
    const active = this.hovered();
    if (active === null || node.uid === active) return false;
    return !this.edges().some(
      (edge) =>
        (edge.source === active && edge.target === node.uid) ||
        (edge.target === active && edge.source === node.uid)
    );
  }

  protected tooltip(node: GraphNode): string {
    const name = node.displayName ?? node.uid;
    return `${name} · ${node.friends}`;
  }
}
