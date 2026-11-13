import type { ReactElement, RefObject } from 'react';

import { DragProxy, DropTarget } from './DragMarks.tsx';
import type { EdgeEnd } from './edge-path.ts';
import { Edges, type WeightedEdge } from './Edges.tsx';
import { Grid, MARGIN_LEFT, MARGIN_TOP, measureFrame } from './Grid.tsx';
import { GutterCell } from './GutterCell.tsx';
import { ScoredCells, type ScoredCellsProps } from './ScoredCells.tsx';
import { Trail, type TrailProps } from './Trail.tsx';
import type { ItemDrag } from './useItemDrag.ts';

export interface ChartCanvasProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  cellSize: number;
  /** The scale from chart units to pixels. */
  scale: number;
  drag: ItemDrag | undefined;
  trails: ReadonlyArray<Omit<TrailProps, 'cellSize'> & { id: string }>;
  edges: readonly WeightedEdge[];
  /** Each circle's and ghost's centre and radius, by key. */
  ends: ReadonlyMap<string, EdgeEnd>;
  /** The props of the scored cells, which the gutter cells share. */
  scoredCells: ScoredCellsProps;
}

/** Where the matrix's origin sits in the SVG, past the axis margins. */
const MATRIX_ORIGIN = { x: MARGIN_LEFT, y: MARGIN_TOP };
const MATRIX_TRANSFORM = `translate(${MATRIX_ORIGIN.x} ${MATRIX_ORIGIN.y})`;

/**
 * The chart's scrolling drawing surface: the matrix with its trails, edges, and circles, the gutter cells, and the drag
 * proxy.
 */
export function ChartCanvas({
  scrollRef,
  svgRef,
  cellSize,
  scale,
  drag,
  trails,
  edges,
  ends,
  scoredCells,
}: ChartCanvasProps): ReactElement {
  const frame = measureFrame(cellSize);
  const { cells, ghostOwner, ghosts } = scoredCells;
  return (
    <div className="tr-chart-scroll" ref={scrollRef}>
      <div className="tr-canvas" style={{ width: frame.width * scale, height: frame.height * scale }}>
        <svg
          aria-label="Items by urgency and value"
          className="tr-chart"
          height={frame.height * scale}
          ref={svgRef}
          role="group"
          viewBox={`0 0 ${frame.width} ${frame.height}`}
          width={frame.width * scale}
        >
          <Grid cellSize={cellSize} />
          <g transform={MATRIX_TRANSFORM}>
            <DropTarget cellSize={cellSize} drag={drag} />
            {trails.map((trail) => (
              <Trail cellSize={cellSize} key={trail.id} origin={trail.origin} r={trail.r} x={trail.x} y={trail.y} />
            ))}
            <Edges edges={edges} ends={ends} />
            <ScoredCells {...scoredCells} />
            {ghostOwner === undefined ? ghosts : null}
          </g>
        </svg>
        {/* HTML rather than a foreignObject, which WebKit neither draws nor hit-tests at the SVG's scale. */}
        <div className="tr-gutters" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}>
          {cells.map((cell) =>
            cell.isGutter ? (
              <GutterCell
                blockedKeys={scoredCells.blockedKeys}
                cell={cell}
                cellSize={cellSize}
                dragHandlersFor={scoredCells.dragHandlersFor}
                draggingKey={scoredCells.draggingKey}
                highlightedKey={scoredCells.highlightedKey}
                fadeOf={scoredCells.fadeOf}
                itemsByKey={scoredCells.itemsByKey}
                key={`${cell.u},${cell.v}`}
                labelOf={scoredCells.labelOf}
                onPreview={scoredCells.onPreview}
                onSelect={scoredCells.onSelect}
                origin={MATRIX_ORIGIN}
                scores={scoredCells.scores}
                selectedKey={scoredCells.selectedKey}
                workTypeMapping={scoredCells.workTypeMapping}
              />
            ) : null,
          )}
        </div>
        <svg aria-hidden="true" className="tr-chart-overlay" viewBox={`0 0 ${frame.width} ${frame.height}`}>
          <g transform={MATRIX_TRANSFORM}>
            <DragProxy drag={drag} />
          </g>
        </svg>
      </div>
    </div>
  );
}
