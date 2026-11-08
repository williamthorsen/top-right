import type { ReactElement } from 'react';

import { CELL_SIZE, GRID_SIZE } from './layout.ts';

// -- Frame around the matrix, in chart units --
export const MARGIN_LEFT = 44;
export const MARGIN_TOP = 14;
const MARGIN_RIGHT = 14;
const AXIS_HEIGHT = 40;
const MATRIX_SIZE = CELL_SIZE * GRID_SIZE;
export const WIDTH = MARGIN_LEFT + MATRIX_SIZE + MARGIN_RIGHT;
export const HEIGHT = MARGIN_TOP + MATRIX_SIZE + AXIS_HEIGHT;
/** The gridline index, counted from the gutter side, that separates the gutter from the scores. */
const GUTTER_LINE = 1;
/** The gridline index that separates the low and high halves of each axis. */
const QUADRANT_LINE = 4;

/** The matrix's gridlines, axis labels, and axis titles, which never change. */
export function Grid(): ReactElement {
  const lines = Array.from({ length: GRID_SIZE + 1 }, (_, index) => index);
  const scores = Array.from({ length: GRID_SIZE }, (_, index) => index);
  const left = MARGIN_LEFT;
  const top = MARGIN_TOP;
  const bottom = MARGIN_TOP + MATRIX_SIZE;

  return (
    <g aria-hidden="true">
      {lines.map((index) => (
        <line
          className={lineClass(index)}
          key={`v${index}`}
          x1={left + index * CELL_SIZE}
          x2={left + index * CELL_SIZE}
          y1={top}
          y2={bottom}
        />
      ))}
      {lines.map((index) => (
        <line
          className={lineClass(GRID_SIZE - index)}
          key={`h${index}`}
          x1={left}
          x2={left + MATRIX_SIZE}
          y1={top + index * CELL_SIZE}
          y2={top + index * CELL_SIZE}
        />
      ))}
      {scores.map((score) => (
        <text
          className="tr-axis-label"
          key={`u${score}`}
          textAnchor="middle"
          x={left + (score + 0.5) * CELL_SIZE}
          y={bottom + 16}
        >
          {score === 0 ? 'unscored' : score}
        </text>
      ))}
      {scores.map((score) => (
        <text
          className="tr-axis-label"
          key={`i${score}`}
          textAnchor="middle"
          transform={score === 0 ? `translate(${left - 10} ${bottom - CELL_SIZE / 2}) rotate(-90)` : undefined}
          x={score === 0 ? 0 : left - 14}
          y={score === 0 ? 0 : bottom - (score + 0.5) * CELL_SIZE + 4}
        >
          {score === 0 ? 'unscored' : score}
        </text>
      ))}
      <text className="tr-axis-title" textAnchor="end" x={left + MATRIX_SIZE} y={bottom + 34}>
        Urgency →
      </text>
      <text className="tr-axis-title" transform={`translate(12 ${top}) rotate(-90)`} textAnchor="end" x={0} y={0}>
        Impact →
      </text>
    </g>
  );
}

// region | Helpers
/** Returns the class of the gridline at `index` along an axis, counted from the gutter side. */
function lineClass(index: number): string {
  if (index === GUTTER_LINE) return 'tr-gutterline';
  if (index === QUADRANT_LINE) return 'tr-quad';
  return 'tr-gridline';
}
// endregion | Helpers
