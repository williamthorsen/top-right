import type { Edge, RelationGraph } from '@top-right/model';
import type { ReactElement } from 'react';

import { buildEdgePath, type EdgeEnd } from './edge-path.ts';
import type { CellLayout } from './layout.ts';

/** How strongly an edge draws: the focused item's own edges, its blocker chain, or every other edge under All edges. */
export type EdgeWeight = 'chain' | 'direct' | 'faint';

/** An edge with its weight, ready to draw. */
export interface WeightedEdge extends Edge {
  weight: EdgeWeight;
}

/** What focusing an item shows: the edges to draw and the items that stay unfaded. */
export interface Focus {
  edges: WeightedEdge[];
  /** The focused item, its direct neighbours, and its blocker chain; undefined without a focused item. */
  related: ReadonlySet<string> | undefined;
}

export interface EdgesProps {
  edges: readonly WeightedEdge[];
  /** Each matrix circle's centre and radius, by key; an edge with an end outside it is not drawn. */
  ends: ReadonlyMap<string, EdgeEnd>;
}

const WEIGHT_RANK: Readonly<Record<EdgeWeight, number>> = { faint: 0, chain: 1, direct: 2 };

/** The relation edges between matrix circles, stronger edges drawn over weaker ones; the pane lists them for readers. */
export function Edges({ edges, ends }: EdgesProps): ReactElement {
  return (
    <g aria-hidden="true" className="tr-edges">
      <defs>
        <marker
          id="tr-arrow"
          markerHeight="8"
          markerUnits="userSpaceOnUse"
          markerWidth="8"
          orient="auto"
          refX="2"
          refY="4"
          viewBox="0 0 8 8"
        >
          <path className="tr-edge-arrow" d="M0 0 L8 4 L0 8 Z" />
        </marker>
      </defs>
      {edges
        .toSorted((a, b) => WEIGHT_RANK[a.weight] - WEIGHT_RANK[b.weight])
        .map((edge) => {
          const from = ends.get(edge.from);
          const to = ends.get(edge.to);
          const path = from && to ? buildEdgePath(from, to, edge.kind === 'blocker') : undefined;
          if (path === undefined) return null;
          return (
            <g
              className="tr-edge"
              data-ends={`${edge.from}>${edge.to}`}
              data-kind={edge.kind}
              data-weight={edge.weight}
              key={`${edge.kind}:${edge.from}:${edge.to}`}
            >
              <path className="tr-edge-halo" d={path} />
              <path
                className="tr-edge-line"
                d={path}
                markerEnd={edge.kind === 'blocker' ? 'url(#tr-arrow)' : undefined}
              />
            </g>
          );
        })}
    </g>
  );
}

/**
 * Returns what focusing `key` shows. Its own edges of either kind draw at full weight; a blocker edge whose two ends lie
 * on the same side of its blocker chain draws at reduced weight; with `showAll`, every other edge draws faintly.
 */
export function focusItem(graph: RelationGraph, key: string | undefined, showAll: boolean): Focus {
  if (key === undefined) {
    return { edges: showAll ? graph.edges.map((edge) => ({ ...edge, weight: 'faint' })) : [], related: undefined };
  }
  const { upstream, downstream } = graph.findBlockerChain(key);
  const related = new Set([key, ...upstream, ...downstream]);
  const edges: WeightedEdge[] = [];
  for (const edge of graph.edges) {
    if (edge.from === key || edge.to === key) {
      related.add(edge.from).add(edge.to);
      edges.push({ ...edge, weight: 'direct' });
    } else if (edge.kind === 'blocker' && (isWithin(edge, upstream, key) || isWithin(edge, downstream, key))) {
      edges.push({ ...edge, weight: 'chain' });
    } else if (showAll) {
      edges.push({ ...edge, weight: 'faint' });
    }
  }
  return { edges, related };
}

/** Returns the centre and radius of every circle in the matrix, by key, in matrix units. */
export function listEdgeEnds(cells: readonly CellLayout[]): Map<string, EdgeEnd> {
  const ends = new Map<string, EdgeEnd>();
  for (const cell of cells) {
    for (const circle of cell.circles)
      ends.set(circle.id, { x: cell.x + circle.cx, y: cell.y + circle.cy, r: circle.r });
  }
  return ends;
}

/**
 * Returns `edges` with a full-weight blocker edge for each consecutive pair of `chain`; an edge that `edges` already
 * contains takes full weight rather than drawing twice.
 */
export function mergeChainEdges(edges: readonly WeightedEdge[], chain: readonly string[]): WeightedEdge[] {
  const merged = new Map(edges.map((edge) => [identifyEdge(edge), edge]));
  for (let index = 1; index < chain.length; index++) {
    const from = chain[index - 1];
    const to = chain[index];
    if (from === undefined || to === undefined) continue;
    const edge: WeightedEdge = { kind: 'blocker', from, to, weight: 'direct' };
    merged.set(identifyEdge(edge), edge);
  }
  return merged.values().toArray();
}

// region | Helpers
function identifyEdge(edge: Edge): string {
  return `${edge.kind}:${edge.from}:${edge.to}`;
}

function isWithin(edge: Edge, side: ReadonlySet<string>, key: string): boolean {
  return (side.has(edge.from) || edge.from === key) && (side.has(edge.to) || edge.to === key);
}
// endregion | Helpers
