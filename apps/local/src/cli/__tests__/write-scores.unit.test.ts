import type { ItemScores } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { createMemoryStore } from '#src/test-utils/memory-store.ts';

import { parseScoreBatch, planScoreChanges, renderChangesText, writeScoreBatch } from '../write-scores.ts';

const OPEN = new Set(['o/r#1', 'o/r#2']);
const AT = '2026-11-08T09:00:00.000Z';

describe(parseScoreBatch, () => {
  it('returns the entries of a valid batch without the fields that it omits', () => {
    expect(parseScoreBatch([{ itemKey: 'o/r#1', scores: { urgency: 4, impact: 2 } }], OPEN)).toStrictEqual({
      kind: 'valid',
      entries: [{ itemKey: 'o/r#1', scores: { urgency: 4, impact: 2 } }],
    });
  });

  it('refuses the whole batch, naming each offending entry', () => {
    const batch = [
      { itemKey: 'o/r#1', scores: { urgency: 4 } },
      { itemKey: 'o/r#9', scores: { urgency: 4 } },
      { itemKey: 'o/r#2', scores: { effort: 4 } },
      { itemKey: 'o/r#2', scores: {} },
      { itemKey: 'o/r#1', scores: { impact: 1 } },
    ];

    const parsed = parseScoreBatch(batch, OPEN);

    expect(parsed).toStrictEqual({
      kind: 'invalid',
      problems: [
        'entry 2: o/r#9 is not an open issue of a configured repository',
        expect.stringMatching(/^entry 3: scores\.effort: /),
        expect.stringMatching(/^entry 4: scores: /),
        'entry 5: o/r#1 appears more than once',
      ],
    });
  });

  it('refuses input that is not an array', () => {
    expect(parseScoreBatch({ itemKey: 'o/r#1' }, OPEN)).toMatchObject({ kind: 'invalid' });
  });
});

describe(planScoreChanges, () => {
  it('reports each field whose value the write changes, and none that it leaves alone', () => {
    const scores: Record<string, ItemScores> = { 'o/r#1': { urgency: { value: 2, by: 'author', at: AT } } };

    const changes = planScoreChanges(
      [
        { itemKey: 'o/r#1', scores: { urgency: 2, impact: 5 } },
        { itemKey: 'o/r#2', scores: { effort: 3 } },
      ],
      scores,
      AT,
    );

    expect(changes).toStrictEqual([
      { itemKey: 'o/r#1', field: 'impact', from: undefined, to: 5 },
      { itemKey: 'o/r#2', field: 'effort', from: undefined, to: 3 },
    ]);
  });
});

describe(renderChangesText, () => {
  const changes = [{ itemKey: 'o/r#1', field: 'urgency' as const, from: 2, to: 4 }];

  it('reports a dry run as what would change and how to write it', () => {
    expect(renderChangesText(changes, true)).toBe(
      'o/r#1 urgency 2 → 4\ntop-right: 1 score on 1 item would change; run without --dry-run to write them\n',
    );
  });

  it('reports a write as what it wrote', () => {
    expect(renderChangesText(changes, false)).toBe('o/r#1 urgency 2 → 4\ntop-right: wrote 1 score on 1 item\n');
  });

  it('says so when nothing changes', () => {
    expect(renderChangesText([], false)).toBe('top-right: no score changed\n');
  });
});

describe(writeScoreBatch, () => {
  it('writes each entry as the agent’s at one time', async () => {
    const store = createMemoryStore();

    await writeScoreBatch(store, 'github:author', [{ itemKey: 'o/r#1', scores: { urgency: 4 } }], AT);

    expect(store.state.scores).toStrictEqual({ 'o/r#1': { urgency: { value: 4, by: 'agent', at: AT } } });
  });
});
