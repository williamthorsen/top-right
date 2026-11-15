import { describe, expect, it } from 'vitest';

import { renderChangesText } from '../write-scores.ts';

describe(renderChangesText, () => {
  const changes = [{ itemKey: 'o/r#1', field: 'urgency' as const, from: 'medium' as const, to: 'high' as const }];

  it('reports a dry run as what would change and how to write it', () => {
    expect(renderChangesText(changes, true)).toBe(
      'o/r#1 urgency medium → high\ntop-right: 1 score on 1 item would change; run without --dry-run to write them\n',
    );
  });

  it('reports a write as what it wrote', () => {
    expect(renderChangesText(changes, false)).toBe('o/r#1 urgency medium → high\ntop-right: wrote 1 score on 1 item\n');
  });

  it('says so when nothing changes', () => {
    expect(renderChangesText([], false)).toBe('top-right: no score changed\n');
  });
});
