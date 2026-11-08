import { describe, expect, it } from 'vitest';

import { buildEdgePath, type EdgeEnd } from '../edge-path.ts';

describe(buildEdgePath, () => {
  const from: EdgeEnd = { x: 0, y: 0, r: 10 };
  const to: EdgeEnd = { x: 200, y: 0, r: 20 };

  it('starts and ends outside both circles', () => {
    const [start, end] = readEnds(buildEdgePath(from, to, false));

    expect(Math.hypot(start.x - from.x, start.y - from.y)).toBeGreaterThanOrEqual(from.r + 3 - 0.1);
    expect(Math.hypot(end.x - to.x, end.y - to.y)).toBeGreaterThanOrEqual(to.r + 3 - 0.1);
  });

  it('stops further short of the circle at an arrowhead end', () => {
    const [, plainEnd] = readEnds(buildEdgePath(from, to, false));
    const [, arrowEnd] = readEnds(buildEdgePath(from, to, true));

    expect(Math.hypot(arrowEnd.x - to.x, arrowEnd.y - to.y)).toBeGreaterThan(
      Math.hypot(plainEnd.x - to.x, plainEnd.y - to.y),
    );
  });

  it('returns undefined for circles too close to leave a curve between them', () => {
    expect(buildEdgePath({ x: 0, y: 0, r: 10 }, { x: 15, y: 0, r: 10 }, true)).toBeUndefined();
    expect(buildEdgePath(from, from, false)).toBeUndefined();
  });
});

// region | Helpers
function readEnds(path: string | undefined): [{ x: number; y: number }, { x: number; y: number }] {
  const match = /^M(\S+) (\S+) Q\S+ \S+ (\S+) (\S+)$/.exec(path ?? '');
  if (!match) throw new Error(`unexpected path: ${path}`);
  const [, x1, y1, x2, y2] = match.map(Number);
  return [
    { x: x1 ?? NaN, y: y1 ?? NaN },
    { x: x2 ?? NaN, y: y2 ?? NaN },
  ];
}
// endregion | Helpers
