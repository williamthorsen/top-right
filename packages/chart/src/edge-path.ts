/** A circle's centre and radius in matrix units. */
export interface EdgeEnd {
  x: number;
  y: number;
  r: number;
}

/** How far an edge stops short of a circle's border. */
const END_GAP = 3;
/** How far an edge stops short of the border at an arrowhead end, which leaves room for the arrowhead. */
const ARROW_GAP = 7;
/** The bow's share of the distance between the centres, and its ceiling. */
const BOW_SHARE = 0.18;
const BOW_LIMIT = 60;
const STEPS = 100;

/**
 * Returns the SVG path of an edge from `from` to `to`: a quadratic curve that bows to the right of travel, trimmed so
 * that it starts and ends outside both circles. Returns undefined when the circles are too close to leave a curve.
 */
export function buildEdgePath(from: EdgeEnd, to: EdgeEnd, hasArrow: boolean): string | undefined {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance === 0) return undefined;
  const normal = { x: -(to.y - from.y) / distance, y: (to.x - from.x) / distance };
  const bow = Math.min(BOW_SHARE * distance, BOW_LIMIT);
  const control = { x: (from.x + to.x) / 2 + normal.x * bow, y: (from.y + to.y) / 2 + normal.y * bow };

  const start = findTrim(from, control, to, from, from.r + END_GAP, 1);
  const end = findTrim(from, control, to, to, to.r + (hasArrow ? ARROW_GAP : END_GAP), -1);
  if (start === undefined || end === undefined || end <= start) return undefined;

  const a = pointAt(from, control, to, start);
  const b = pointAt(from, control, to, end);
  const middle = pointAt(from, control, to, (start + end) / 2);
  // The control point of the sub-curve from `start` to `end` passes through the original curve's midpoint there.
  const c = { x: 2 * middle.x - (a.x + b.x) / 2, y: 2 * middle.y - (a.y + b.y) / 2 };
  return `M${format(a.x)} ${format(a.y)} Q${format(c.x)} ${format(c.y)} ${format(b.x)} ${format(b.y)}`;
}

// region | Helpers
/** Returns the first curve parameter, stepping from one end, at which the curve lies `clearance` or more from `end`. */
function findTrim(
  p0: Point,
  p1: Point,
  p2: Point,
  end: Point,
  clearance: number,
  direction: 1 | -1,
): number | undefined {
  for (let step = 0; step <= STEPS; step++) {
    const t = direction === 1 ? step / STEPS : 1 - step / STEPS;
    const point = pointAt(p0, p1, p2, t);
    if (Math.hypot(point.x - end.x, point.y - end.y) >= clearance) return t;
  }
  return undefined;
}

function format(value: number): string {
  return value.toFixed(1);
}

interface Point {
  x: number;
  y: number;
}

function pointAt(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
}
// endregion | Helpers
