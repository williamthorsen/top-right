/** Schema migrations, applied in order; migration `n` brings `PRAGMA user_version` to `n + 1`. */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE scores (
    user_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    field TEXT NOT NULL,
    value REAL NOT NULL,
    scored_by TEXT NOT NULL,
    scored_at TEXT NOT NULL,
    PRIMARY KEY (user_id, item_key, field)
  ) STRICT;
  CREATE TABLE status_overrides (
    user_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    status TEXT NOT NULL,
    source_state TEXT NOT NULL,
    set_at TEXT NOT NULL,
    PRIMARY KEY (user_id, item_key)
  ) STRICT;
  CREATE TABLE visits (
    user_id TEXT PRIMARY KEY,
    last_visit_at TEXT NOT NULL
  ) STRICT;
  `,
  'ALTER TABLE scores ADD COLUMN previous_value REAL;',
  `
  CREATE TABLE settings (
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, name)
  ) STRICT;
  `,
  `
  DROP TABLE scores;
  CREATE TABLE scores (
    user_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    field TEXT NOT NULL CHECK (field IN ('effort', 'progress', 'urgency', 'value')),
    score ANY NOT NULL,
    scored_by TEXT NOT NULL,
    scored_at TEXT NOT NULL,
    previous_score ANY,
    PRIMARY KEY (user_id, item_key, field),
    CHECK (
      CASE field
        WHEN 'urgency' THEN score IN ('low', 'medium', 'high', 'critical')
        WHEN 'value' THEN score IN ('questionable', 'nice-to-have', 'should-have', 'must-have')
        ELSE typeof(score) IN ('integer', 'real')
      END
    ),
    CHECK (
      previous_score IS NULL OR CASE field
        WHEN 'urgency' THEN previous_score IN ('low', 'medium', 'high', 'critical')
        WHEN 'value' THEN previous_score IN ('questionable', 'nice-to-have', 'should-have', 'must-have')
        ELSE typeof(previous_score) IN ('integer', 'real')
      END
    )
  ) STRICT;
  `,
];
