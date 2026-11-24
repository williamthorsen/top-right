import type { RelationGraph } from '@top-right/model';

import type { CellCallouts } from './callout-layout.ts';
import type { EdgeEnd } from './edge-path.ts';
import { focusItem, mergeChainEdges, type WeightedEdge } from './Edges.tsx';
import { type Ghost, type GhostBoard, layoutGhosts } from './Ghosts.tsx';
import type { CellLayout } from './layout.ts';
import type { Fade } from './ScoredCircle.tsx';
import type { ChainView } from './useChainView.ts';
import type { Review } from './useReview.ts';

/** What the board draws around the focused item: its edges, their ends, its ghosts, and the fade of every item. */
export interface FocusView {
  edges: WeightedEdge[];
  ends: Map<string, EdgeEnd>;
  ghosts: Ghost[];
  ghostOwner: string | undefined;
  fadeOf: (key: string) => Fade | undefined;
}

/** What decides the focus view besides the board. */
export interface FocusState {
  graph: RelationGraph;
  /** The previewed or selected item. */
  focusKey: string | undefined;
  /** The item of the hovered table row or relation row. */
  highlightedKey: string | undefined;
  showAllEdges: boolean;
  chainView: ChainView;
  review: Review;
  callouts: CellCallouts | undefined;
}

/** Lays out the edges and ghosts of the focused item, and returns the fade that governs each item. */
export function buildFocusView(
  { graph, focusKey, highlightedKey, showAllEdges, chainView, review, callouts }: FocusState,
  cells: readonly CellLayout[],
  board: GhostBoard,
  cellSize: number,
): FocusView {
  const focus = focusItem(graph, focusKey, showAllEdges);
  const edges = chainView.isShown ? mergeChainEdges(focus.edges, chainView.chain) : focus.edges;
  const { ends, ghosts, ghostOwner } = layoutGhosts(cells, edges, focusKey, board, cellSize);
  const ghostKeys = new Set(ghosts.map((ghost) => ghost.id));
  const focusRelated = findShownRelated(focus.related, focusKey, board.visibleKeys, ghostKeys);
  // A hovered row fades the board only while the board shows its item, since otherwise the fade emphasises nothing.
  const shownHighlightKey =
    highlightedKey !== undefined && isShown(highlightedKey, board.visibleKeys, ghostKeys) ? highlightedKey : undefined;
  // A running review's fade governs, then the chain's, so that the queue or the chain stays legible under hover; then a
  // hovered cell's, so that its callouts read over the rest; then a hovered row's, so that its item can be found.
  function fadeOf(key: string): Fade | undefined {
    if (review.kind !== undefined) return review.isFaded(key) ? 'strong' : undefined;
    if (chainView.isShown) return chainView.isFaded(key) ? 'strong' : undefined;
    if (callouts) return callouts.cell.ids.includes(key) ? undefined : 'soft';
    if (shownHighlightKey !== undefined) return key === shownHighlightKey ? undefined : 'soft';
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
  ghostKeys: ReadonlySet<string>,
): ReadonlySet<string> | undefined {
  const isAnyShown = related?.values().some((key) => key !== focusKey && isShown(key, visibleKeys, ghostKeys));
  return isAnyShown ? related : undefined;
}

/** Returns whether the board shows the item, as a circle, a gutter row, or a ghost. */
function isShown(key: string, visibleKeys: ReadonlySet<string>, ghostKeys: ReadonlySet<string>): boolean {
  return visibleKeys.has(key) || ghostKeys.has(key);
}
// endregion | Helpers
