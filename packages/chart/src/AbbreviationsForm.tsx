import {
  abbreviate,
  describeAbbreviationClash,
  describeInvalidAbbreviation,
  findAbbreviationClashes,
  isValidAbbreviation,
  resolveAbbreviations,
} from '@top-right/model';
import { type ReactElement, type SubmitEvent, useId, useState } from 'react';

import { type Outcome, OutcomeMessage, type SaveSettings } from './OutcomeMessage.tsx';

/** The repository abbreviations, refused while invalid or shared by two repositories. */
export function AbbreviationsForm({
  repos,
  abbreviations,
  onSave,
}: {
  repos: readonly string[];
  abbreviations: Readonly<Record<string, string>>;
  onSave: SaveSettings<Record<string, string>>;
}): ReactElement {
  const headingId = useId();
  const [values, setValues] = useState(() =>
    Object.fromEntries(repos.map((repo) => [repo, abbreviations[repo] ?? ''])),
  );
  const [outcome, setOutcome] = useState<Outcome>(() => {
    const [clash] = findAbbreviationClashes(resolveAbbreviations(repos, abbreviations));
    return clash ? { kind: 'error', message: describeAbbreviationClash(clash) } : undefined;
  });
  const [isSaving, setIsSaving] = useState(false);

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const trimmed = Object.fromEntries(repos.map((repo) => [repo, (values[repo] ?? '').trim()]));
    const invalid = repos.find((repo) => trimmed[repo] !== '' && !isValidAbbreviation(trimmed[repo] ?? ''));
    if (invalid !== undefined) {
      setOutcome({ kind: 'error', message: describeInvalidAbbreviation(invalid, trimmed[invalid] ?? '') });
      return;
    }
    const stored = Object.fromEntries(Object.entries(trimmed).filter(([, value]) => value !== ''));
    const [clash] = findAbbreviationClashes(resolveAbbreviations(repos, stored));
    if (clash) {
      setOutcome({ kind: 'error', message: describeAbbreviationClash(clash) });
      return;
    }
    setIsSaving(true);
    const refusal = await onSave(trimmed);
    setIsSaving(false);
    if (refusal !== undefined) {
      setOutcome({ kind: 'error', message: refusal });
      return;
    }
    setOutcome({ kind: 'saved' });
    setValues(trimmed);
  }

  return (
    <form aria-labelledby={headingId} className="tr-settings-section" onSubmit={(event) => void save(event)}>
      <h2 id={headingId}>Repo abbreviations</h2>
      {repos.map((repo) => (
        <label className="tr-settings-field" key={repo}>
          <span>{repo}</span>
          <input
            className="tr-input"
            onChange={(event) => setValues((current) => ({ ...current, [repo]: event.target.value }))}
            placeholder={abbreviate(repo)}
            value={values[repo] ?? ''}
          />
        </label>
      ))}
      <OutcomeMessage outcome={outcome} />
      <div className="tr-settings-actions">
        <button className="tr-button" disabled={isSaving} type="submit">
          Save
        </button>
      </div>
    </form>
  );
}
