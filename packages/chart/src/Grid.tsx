import { URGENCY_LEVELS, VALUE_LEVELS } from '@top-right/model';
import type { ReactElement } from 'react';

import { GRID_SIZE } from './layout.ts';
import { LEVEL_NAMES } from './level-names.ts';

// -- Frame around the matrix, in chart units --
export const MARGIN_LEFT = 44;
export const MARGIN_TOP = 14;
export const MARGIN_RIGHT = 14;
export const AXIS_HEIGHT = 40;
/** The gridline index, counted from the gutter side, that separates the gutter from the scores. */
const GUTTER_LINE = 1;
/** The gridline index that separates the low and high halves of each axis. */
const QUADRANT_LINE = 3;

/** The matrix's gridlines, axis labels, and axis titles, for cells of `cellSize` chart units. */
export function Grid({ cellSize }: { cellSize: number }): ReactElement {
  const matrixSize = cellSize * GRID_SIZE;
  const lines = Array.from({ length: GRID_SIZE + 1 }, (_, index) => index);
  const urgencyTicks = ['Unscored', ...URGENCY_LEVELS.map((level) => LEVEL_NAMES[level])];
  const valueTicks = ['Unscored', ...VALUE_LEVELS.map((level) => LEVEL_NAMES[level])];
  const left = MARGIN_LEFT;
  const top = MARGIN_TOP;
  const bottom = MARGIN_TOP + matrixSize;

  return (
    <g aria-hidden="true">
      {lines.map((index) => (
        <line
          className={lineClass(index)}
          key={`v${index}`}
          x1={left + index * cellSize}
          x2={left + index * cellSize}
          y1={top}
          y2={bottom}
        />
      ))}
      {lines.map((index) => (
        <line
          className={lineClass(GRID_SIZE - index)}
          key={`h${index}`}
          x1={left}
          x2={left + matrixSize}
          y1={top + index * cellSize}
          y2={top + index * cellSize}
        />
      ))}
      {urgencyTicks.map((tick, index) => (
        <text
          className="tr-axis-label"
          key={`u${index}`}
          textAnchor="middle"
          x={left + (index + 0.5) * cellSize}
          y={bottom + 16}
        >
          {tick}
        </text>
      ))}
      {valueTicks.map((tick, index) => (
        <text
          className="tr-axis-label"
          key={`v${index}`}
          textAnchor="middle"
          transform={`translate(${left - 10} ${bottom - (index + 0.5) * cellSize}) rotate(-90)`}
          x={0}
          y={0}
        >
          {tick}
        </text>
      ))}
      <text className="tr-axis-title" textAnchor="end" x={left + matrixSize} y={bottom + 34}>
        Urgency →
      </text>
      <text className="tr-axis-title" transform={`translate(12 ${top}) rotate(-90)`} textAnchor="end" x={0} y={0}>
        Value →
      </text>
    </g>
  );
}

/** Returns the chart's size in chart units, the matrix of `cellSize` cells with its axis margins. */
export function measureFrame(cellSize: number): { width: number; height: number } {
  const matrixSize = cellSize * GRID_SIZE;
  return { width: MARGIN_LEFT + matrixSize + MARGIN_RIGHT, height: MARGIN_TOP + matrixSize + AXIS_HEIGHT };
}

/** Converts a pointer's client position to matrix units, whose origin is the top-left of the must-have row. */
export function toMatrixPoint(
  svg: SVGSVGElement | null,
  clientX: number,
  clientY: number,
  cellSize: number,
): { x: number; y: number } | undefined {
  const rect = svg?.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return undefined;
  const frame = measureFrame(cellSize);
  return {
    x: ((clientX - rect.left) * frame.width) / rect.width - MARGIN_LEFT,
    y: ((clientY - rect.top) * frame.height) / rect.height - MARGIN_TOP,
  };
}

// region | Helpers
/** Returns the class of the gridline at `index` along an axis, counted from the gutter side. */
function lineClass(index: number): string {
  if (index === GUTTER_LINE) return 'tr-gutterline';
  if (index === QUADRANT_LINE) return 'tr-quad';
  return 'tr-gridline';
}
// endregion | Helpers
