import type { RelationGraph } from '@top-right/model';

import type { CellCallouts } from './callout-layout.ts';
import type { EdgeEnd } from './edge-path.ts';
import { focusItem, mergeChainEdges, type WeightedEdge } from './Edges.tsx';
import { type GhostBoard, layoutGhosts } from './Ghosts.tsx';
import type { CellLayout, GhostPlacement } from './layout.ts';
import type { Fade } from './ScoredCircle.tsx';
import type { ChainView } from './useChainView.ts';
import type { Review } from './useReview.ts';

/** What the board draws around the focused item: its edges, their ends, its ghosts, and the fade of every item. */
export interface FocusView {
  edges: WeightedEdge[];
  ends: Map<string, EdgeEnd>;
  ghosts: GhostPlacement[];
  ghostOwner: string | undefined;
  fadeOf: (key: string) => Fade | undefined;
}

/** What decides the focus view besides the board. */
export interface FocusState {
  graph: RelationGraph;
  /** The previewed or selected item. */
  focusKey: string | undefined;
  showAllEdges: boolean;
  chainView: ChainView;
  review: Review;
  callouts: CellCallouts | undefined;
}

/** Lays out the edges and ghosts of the focused item, and returns the fade that governs each item. */
export function buildFocusView(
  { graph, focusKey, showAllEdges, chainView, review, callouts }: FocusState,
  cells: readonly CellLayout[],
  board: GhostBoard,
  cellSize: number,
): FocusView {
  const focus = focusItem(graph, focusKey, showAllEdges);
  const edges = chainView.isShown ? mergeChainEdges(focus.edges, chainView.chain) : focus.edges;
  const { ends, ghosts, ghostOwner } = layoutGhosts(cells, edges, focusKey, board, cellSize);
  const focusRelated = findShownRelated(focus.related, focusKey, board.visibleKeys, ghosts);
  // A running review's fade governs, then the chain's, so that the queue or the chain stays legible under hover; then a
  // hovered cell's, so that its callouts read over the rest.
  function fadeOf(key: string): Fade | undefined {
    if (review.kind !== undefined) return review.isFaded(key) ? 'strong' : undefined;
    if (chainView.isShown) return chainView.isFaded(key) ? 'strong' : undefined;
    if (callouts) return callouts.cell.ids.includes(key) ? undefined : 'soft';
    return focusRelated === undefined || focusRelated.has(key) ? undefined : 'soft';
  }
  return { edges, ends, ghosts, ghostOwner, fadeOf };
}

// region | Helpers
/**
 * Returns the focus's related items while the board shows one of them other than the focused item, as a circle, a
 * gutter row, or a ghost, since only then does the focus fade emphasise anything.
 */
function findShownRelated(
  related: ReadonlySet<string> | undefined,
  focusKey: string | undefined,
  visibleKeys: ReadonlySet<string>,
  ghosts: readonly GhostPlacement[],
): ReadonlySet<string> | undefined {
  const ghostKeys = new Set(ghosts.map((ghost) => ghost.id));
  const isShown = related?.values().some((key) => key !== focusKey && (visibleKeys.has(key) || ghostKeys.has(key)));
  return isShown ? related : undefined;
}
// endregion | Helpers
