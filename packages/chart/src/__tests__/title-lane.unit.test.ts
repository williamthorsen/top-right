import { describe, expect, it } from 'vitest';

import { CALLOUT_GAP, CALLOUT_PITCH } from '../callout-layout.ts';
import { MARGIN_RIGHT } from '../Grid.tsx';
import { GRID_SIZE, layoutCells, MIN_CELL_SIZE, type Placement } from '../layout.ts';
import { layoutTitleLane, MIN_TITLE_LANE_WIDTH, type TitleRow } from '../title-lane.ts';

const MATRIX_SIZE = MIN_CELL_SIZE * GRID_SIZE;
const ROOM = 300;

describe(layoutTitleLane, () => {
  it('returns undefined when the room leaves the lane narrower than its minimum', () => {
    const cells = layoutCells(buildPlacements(4, 4, 1), MIN_CELL_SIZE);
    const roomWidth = MIN_TITLE_LANE_WIDTH + CALLOUT_GAP;

    expect(layoutTitleLane({ cells, cellSize: MIN_CELL_SIZE, roomWidth: roomWidth - 1 })).toBeUndefined();
    expect(layoutTitleLane({ cells, cellSize: MIN_CELL_SIZE, roomWidth })?.width).toBe(MIN_TITLE_LANE_WIDTH);
  });

  it('places the lane past the frame edge, clear of every circle', () => {
    const cells = layoutCells(buildPlacements(4, 4, 3), MIN_CELL_SIZE);
    const lane = layoutTitleLane({ cells, cellSize: MIN_CELL_SIZE, roomWidth: ROOM });

    expect(lane?.x).toBe(MATRIX_SIZE + MARGIN_RIGHT + CALLOUT_GAP);
    expect(lane?.width).toBe(ROOM - CALLOUT_GAP);
  });

  it('groups the rows by urgency, most urgent first, ordering each section from top to bottom', () => {
    const cells = layoutCells(
      [...buildPlacements(2, 1, 1, 'low'), ...buildPlacements(4, 1, 1, 'crit-bottom'), ...buildPlacements(4, 4, 1)],
      MIN_CELL_SIZE,
    );
    const rows = layoutTitleLane({ cells, cellSize: MIN_CELL_SIZE, roomWidth: ROOM })?.rows ?? [];

    expect(rows.map(describeRow)).toStrictEqual([
      'heading:Critical urgency',
      'item:4-4-0',
      'item:crit-bottom-0',
      'heading:Medium urgency',
      'item:low-0',
    ]);
  });

  it('spaces the rows at the callout pitch, with a gap before each later section', () => {
    const cells = layoutCells([...buildPlacements(4, 4, 1), ...buildPlacements(3, 4, 1)], MIN_CELL_SIZE);
    const rows = layoutTitleLane({ cells, cellSize: MIN_CELL_SIZE, roomWidth: ROOM })?.rows ?? [];
    const secondHeading = rows[2];

    expect(rows.map((row) => row.y)).toStrictEqual([
      CALLOUT_PITCH / 2,
      CALLOUT_PITCH * 1.5,
      CALLOUT_PITCH * 2.5 + 8,
      CALLOUT_PITCH * 3.5 + 8,
    ]);
    expect(secondHeading).toMatchObject({ kind: 'heading', hasGap: true });
  });

  it('joins each row to the right edge of its circle', () => {
    const cells = layoutCells(buildPlacements(2, 3, 1), MIN_CELL_SIZE);
    const [cell] = cells;
    const circle = cell?.circles[0];
    const row = layoutTitleLane({ cells, cellSize: MIN_CELL_SIZE, roomWidth: ROOM })?.rows.find(isItem);

    expect(row?.from).toStrictEqual({
      x: (cell?.x ?? 0) + (circle?.cx ?? 0) + (circle?.r ?? 0),
      y: (cell?.y ?? 0) + (circle?.cy ?? 0),
    });
  });

  it('keeps every row within the matrix height and counts what each section withholds', () => {
    const cells = layoutCells(
      [...buildPlacements(4, 4, 40, 'crit'), ...buildPlacements(1, 1, 10, 'low')],
      MIN_CELL_SIZE,
    );
    const rows = layoutTitleLane({ cells, cellSize: MIN_CELL_SIZE, roomWidth: ROOM })?.rows ?? [];
    const items = rows.filter(isItem);
    const counts = rows.filter((row) => row.kind === 'more').map((row) => row.count);

    expect(Math.max(...rows.map((row) => row.y)) + CALLOUT_PITCH / 2).toBeLessThanOrEqual(MATRIX_SIZE);
    expect(items.every((row) => row.id.startsWith('crit'))).toBe(true);
    expect(rows.map(describeRow)).toContain('heading:Low urgency');
    expect(counts.reduce((sum, count) => sum + count, 0) + items.length).toBe(50);
    expect(counts.at(-1)).toBe(10);
  });

  it('keeps the selected item and its related items ahead of nearer items when the rows overflow', () => {
    const cells = layoutCells(
      [...buildPlacements(4, 4, 40, 'crit'), ...buildPlacements(1, 1, 4, 'low')],
      MIN_CELL_SIZE,
    );
    const rows =
      layoutTitleLane({
        cells,
        cellSize: MIN_CELL_SIZE,
        roomWidth: ROOM,
        selectedKey: 'low-0',
        relatedKeys: new Set(['low-1']),
      })?.rows ?? [];
    const ids = rows.filter(isItem).map((row) => row.id);

    expect(ids).toContain('low-0');
    expect(ids).toContain('low-1');
    expect(ids).not.toContain('low-2');
  });

  it('prefers larger circles among items equally near the corner', () => {
    const placements: Placement[] = [
      ...buildPlacements(4, 4, 34, 'small'),
      { id: 'large', u: 4, v: 4, r: 20, isUnsized: false },
    ];
    const cells = layoutCells(placements, MIN_CELL_SIZE);
    const ids = layoutTitleLane({ cells, cellSize: MIN_CELL_SIZE, roomWidth: ROOM })
      ?.rows.filter(isItem)
      .map((row) => row.id);

    expect(ids).toContain('large');
  });

  it('narrows to one cell under a heading that names its urgency and value', () => {
    const cells = layoutCells([...buildPlacements(4, 4, 2), ...buildPlacements(3, 2, 2)], MIN_CELL_SIZE);
    const rows =
      layoutTitleLane({ cells, cellSize: MIN_CELL_SIZE, roomWidth: ROOM, narrowedCell: { u: 3, v: 2 } })?.rows ?? [];

    expect(rows.map(describeRow)).toStrictEqual(['heading:High urgency · Nice to have', 'item:3-2-0', 'item:3-2-1']);
  });

  it('pins the selected item above a narrowed cell that does not hold it', () => {
    const cells = layoutCells([...buildPlacements(4, 4, 2), ...buildPlacements(3, 2, 1)], MIN_CELL_SIZE);
    const rows =
      layoutTitleLane({
        cells,
        cellSize: MIN_CELL_SIZE,
        roomWidth: ROOM,
        selectedKey: '4-4-1',
        narrowedCell: { u: 3, v: 2 },
      })?.rows ?? [];

    expect(rows.map(describeRow)).toStrictEqual([
      'heading:Selected',
      'item:4-4-1',
      'heading:High urgency · Nice to have',
      'item:3-2-0',
    ]);
  });

  it('does not pin the selected item when the narrowed cell holds it', () => {
    const cells = layoutCells(buildPlacements(3, 2, 2), MIN_CELL_SIZE);
    const rows =
      layoutTitleLane({
        cells,
        cellSize: MIN_CELL_SIZE,
        roomWidth: ROOM,
        selectedKey: '3-2-1',
        narrowedCell: { u: 3, v: 2 },
      })?.rows ?? [];

    expect(rows.map(describeRow)).not.toContain('heading:Selected');
  });

  it('leaves gutter items out of the lane', () => {
    const cells = layoutCells([...buildPlacements(0, 3, 2, 'gutter'), ...buildPlacements(2, 2, 1)], MIN_CELL_SIZE);
    const ids = layoutTitleLane({ cells, cellSize: MIN_CELL_SIZE, roomWidth: ROOM })
      ?.rows.filter(isItem)
      .map((row) => row.id);

    expect(ids).toStrictEqual(['2-2-0']);
  });
});

// region | Helpers
/** Returns `count` unsized placements in the cell at column `u` and row `v`, with ids `{prefix}-{index}`. */
function buildPlacements(u: number, v: number, count: number, prefix = `${u}-${v}`): Placement[] {
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, u, v }));
}

/** Returns a row's kind with its label, id, or count. */
function describeRow(row: TitleRow): string {
  if (row.kind === 'heading') return `heading:${row.label}`;
  if (row.kind === 'item') return `item:${row.id}`;
  return `more:${row.count}`;
}

/** Narrows a row to an item row. */
function isItem(row: TitleRow): row is Extract<TitleRow, { kind: 'item' }> {
  return row.kind === 'item';
}
// endregion | Helpers
