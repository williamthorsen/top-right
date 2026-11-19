import { describe, expect, it } from 'vitest';

import { measureRings } from '../ScoredCircle.tsx';

const BORDER = 1.5;
const SELECTION = 2;
const FOCUS = 3;

describe(measureRings, () => {
  for (const isBlocked of [false, true]) {
    describe(isBlocked ? 'on a blocked circle' : 'on an unblocked circle', () => {
      it('places the hover ring outside the border and the blocked ring, and the focus ring outside it', () => {
        const rings = measureRings(10, isBlocked, false);

        const edge = isBlocked ? rings.blocked + BORDER / 2 : 10 + BORDER / 2;
        expect(rings.hover - BORDER / 2).toBeCloseTo(edge);
        expect(rings.focus - FOCUS / 2).toBeCloseTo(rings.hover + BORDER / 2);
      });

      it('places the gap, then the ink ring, then the focus ring, each against the one inside it', () => {
        const rings = measureRings(10, isBlocked, true);

        const edge = isBlocked ? rings.blocked + BORDER / 2 : 10 + BORDER / 2;
        expect(rings.gap - SELECTION / 2).toBeCloseTo(edge);
        expect(rings.selected - SELECTION / 2).toBeCloseTo(rings.gap + SELECTION / 2);
        expect(rings.focus - FOCUS / 2).toBeCloseTo(rings.selected + SELECTION / 2);
      });
    });
  }
});
