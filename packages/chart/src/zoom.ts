import { AXIS_HEIGHT, MARGIN_LEFT, MARGIN_RIGHT, MARGIN_TOP } from './Grid.tsx';
import { GRID_SIZE, MIN_CELL_SIZE } from './layout.ts';

export type ZoomDirection = 'in' | 'out';

/** The magnifications that the zoom control offers, where 1 draws a chart unit as one pixel. */
export const ZOOM_STEPS: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
/** The magnification at which the chart's text is at its 12 px floor, which the chart opens at and `0` returns to. */
export const NATURAL_SCALE = 1;

const MIN_STEP = 0.5;
const MAX_STEP = 4;

/**
 * Returns the largest whole cell size, in chart units, at which the matrix and its axis margins fit an area at
 * `magnification`, and never less than `MIN_CELL_SIZE`.
 */
export function fitCellSize(areaWidth: number, areaHeight: number, magnification: number): number {
  if (areaWidth <= 0 || areaHeight <= 0 || magnification <= 0) return MIN_CELL_SIZE;
  const byWidth = (areaWidth / magnification - MARGIN_LEFT - MARGIN_RIGHT) / GRID_SIZE;
  const byHeight = (areaHeight / magnification - MARGIN_TOP - AXIS_HEIGHT) / GRID_SIZE;
  // The tolerance keeps an area of exactly a whole cell size from rounding down a unit through float error.
  return Math.max(MIN_CELL_SIZE, Math.floor(Math.min(byWidth, byHeight) + 1e-9));
}

/** Formats a scale as the readout shows it, such as `125 %`, with a non-breaking space. */
export function formatScale(scale: number): string {
  return `${Math.round(scale * 100)}\u{A0}%`;
}

/** Returns whether `scale` is at the end of the range in `direction`, where a step would not change it. */
export function isAtEnd(scale: number, direction: ZoomDirection): boolean {
  return direction === 'in' ? scale >= MAX_STEP : scale <= MIN_STEP;
}

/** Returns the nearest step strictly beyond `scale` in `direction`, or `scale` itself at an end of the range. */
export function stepZoom(scale: number, direction: ZoomDirection): number {
  const next =
    direction === 'in' ? ZOOM_STEPS.find((step) => step > scale) : ZOOM_STEPS.findLast((step) => step < scale);
  return next ?? scale;
}
