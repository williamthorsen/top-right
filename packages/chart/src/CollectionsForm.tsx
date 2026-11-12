import { type Collection, type CollectionSettings, findCollectionProblem } from '@top-right/model';
import { type ReactElement, type SubmitEvent, useId, useState } from 'react';

import { type Outcome, OutcomeMessage, type SaveSettings } from './OutcomeMessage.tsx';
import { sortRepos } from './repo-names.ts';

/**
 * The collections, each with its name, its repositories, and a Delete button, and the default collection, saved
 * together and refused while `findCollectionProblem` reports a problem.
 */
export function CollectionsForm({
  repos,
  saved,
  onSave,
}: {
  repos: readonly string[];
  saved: CollectionSettings;
  onSave: SaveSettings<CollectionSettings>;
}): ReactElement {
  const headingId = useId();
  const defaultHintId = useId();
  const sortedRepos = sortRepos(repos);
  const [drafts, setDrafts] = useState<Collection[]>(() => {
    const configured = new Set(repos);
    return saved.collections.map((collection) => ({
      ...collection,
      repos: collection.repos.filter((repo) => configured.has(repo)),
    }));
  });
  const [defaultId, setDefaultId] = useState(() =>
    saved.collections.some((collection) => collection.id === saved.defaultCollectionId)
      ? (saved.defaultCollectionId ?? '')
      : '',
  );
  const [outcome, setOutcome] = useState<Outcome>();
  const [isSaving, setIsSaving] = useState(false);

  function updateDraft(id: string, update: (collection: Collection) => Collection): void {
    setDrafts((current) => current.map((collection) => (collection.id === id ? update(collection) : collection)));
  }

  function toggleRepo(id: string, repo: string): void {
    updateDraft(id, (collection) => ({
      ...collection,
      repos: collection.repos.includes(repo)
        ? collection.repos.filter((kept) => kept !== repo)
        : [...collection.repos, repo],
    }));
  }

  function deleteDraft(id: string): void {
    setDrafts((current) => current.filter((collection) => collection.id !== id));
    if (defaultId === id) setDefaultId('');
  }

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const settings: CollectionSettings = {
      collections: drafts.map((collection) => ({ ...collection, name: collection.name.trim() })),
      defaultCollectionId: defaultId === '' ? undefined : defaultId,
    };
    const problem = findCollectionProblem(settings, repos);
    if (problem !== undefined) {
      setOutcome({ kind: 'error', message: problem });
      return;
    }
    setIsSaving(true);
    const refusal = await onSave(settings);
    setIsSaving(false);
    if (refusal !== undefined) {
      setOutcome({ kind: 'error', message: refusal });
      return;
    }
    setOutcome({ kind: 'saved' });
    setDrafts([...settings.collections]);
  }

  return (
    <form aria-labelledby={headingId} className="tr-settings-section" onSubmit={(event) => void save(event)}>
      <h2 id={headingId}>Collections</h2>
      {drafts.length === 0 ? <p className="tr-settings-hint">No collections</p> : null}
      {drafts.map((collection) => (
        <fieldset className="tr-settings-group tr-settings-collection" key={collection.id}>
          <legend>{nameDraft(collection)}</legend>
          <label className="tr-settings-field">
            <span>Name</span>
            <input
              className="tr-input"
              onChange={(event) => updateDraft(collection.id, (draft) => ({ ...draft, name: event.target.value }))}
              value={collection.name}
            />
          </label>
          <div className="tr-settings-checks">
            {sortedRepos.map((repo) => (
              <label className="tr-settings-check" key={repo}>
                <input
                  checked={collection.repos.includes(repo)}
                  onChange={() => toggleRepo(collection.id, repo)}
                  type="checkbox"
                />
                {repo}
              </label>
            ))}
          </div>
          <div className="tr-settings-actions">
            <button className="tr-button" onClick={() => deleteDraft(collection.id)} type="button">
              Delete
            </button>
          </div>
        </fieldset>
      ))}
      <div className="tr-settings-actions">
        <button
          className="tr-button"
          onClick={() => setDrafts((current) => [...current, { id: crypto.randomUUID(), name: '', repos: [] }])}
          type="button"
        >
          Add collection
        </button>
      </div>
      <label className="tr-settings-field">
        <span>Default collection</span>
        <select
          aria-describedby={defaultHintId}
          className="tr-select"
          onChange={(event) => setDefaultId(event.target.value)}
          value={defaultId}
        >
          <option value="">None (all repos)</option>
          {drafts.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {nameDraft(collection)}
            </option>
          ))}
        </select>
      </label>
      <p className="tr-settings-hint" id={defaultHintId}>
        The chart opens with this collection after each reload.
      </p>
      <OutcomeMessage outcome={outcome} />
      <div className="tr-settings-actions">
        <button className="tr-button" disabled={isSaving} type="submit">
          Save
        </button>
      </div>
    </form>
  );
}

// region | Helpers
/** Returns the name under which the form shows a collection: its trimmed name, or "New collection" while empty. */
function nameDraft(collection: Collection): string {
  return collection.name.trim() || 'New collection';
}
// endregion | Helpers
