import { HEIGHT, WIDTH } from './Grid.tsx';

/** The matrix's scale and how it was chosen: a step, or Fit, which scales to the chart area. */
export type Zoom = { kind: 'step'; scale: number } | { kind: 'fit'; scale: number };

export type ZoomDirection = 'in' | 'out';

/** The scales that the zoom control offers, where 1 is the matrix's natural size. */
export const ZOOM_STEPS: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
export const DEFAULT_ZOOM: Zoom = { kind: 'step', scale: 1 };

const MIN_STEP = 0.5;
const MAX_STEP = 4;
/** Fit never scales below the natural size, so that the chart's text keeps its floor. */
const MIN_FIT = 1;

/** Returns the scale that fits the matrix to an area, rounded down to a whole percent and clamped to 100–400 %. */
export function fitScale(areaWidth: number, areaHeight: number): number {
  if (areaWidth <= 0 || areaHeight <= 0) return MIN_FIT;
  const percent = Math.floor(Math.min(areaWidth / WIDTH, areaHeight / HEIGHT) * 100);
  return Math.min(MAX_STEP, Math.max(MIN_FIT, percent / 100));
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
