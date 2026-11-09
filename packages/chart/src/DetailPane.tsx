import {
  classifyWorkType,
  findTrailOrigin,
  formatItemKey,
  isAgentScored,
  type ItemScores,
  type Relation,
  type RelationKind,
  type Scores,
  type StatusOverride,
  WORK_TYPE_NAMES,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';
import type { ReactElement } from 'react';

import { ExternalLinkIcon } from './ExternalLinkIcon.tsx';
import { type Abbreviations, labelItem } from './item-label.ts';
import { PaneScores, type SettableStatus } from './PaneScores.tsx';

/** Why the pane shows its item: a hover or focus, a selection, or the next pick while nothing is selected. */
export type PaneMode = 'pick' | 'preview' | 'selected';

export interface DetailPaneProps {
  item: WorkItem | undefined;
  mode: PaneMode;
  abbreviations: Abbreviations;
  workTypeMapping: WorkTypeMapping;
  /** The keys of the open items that an open item blocks, for tagging relation rows. */
  blockedKeys: ReadonlySet<string>;
  scores: ItemScores | undefined;
  override: StatusOverride | undefined;
  /** Whether a review queue is running, in which Enter keeps the selected item. */
  isReviewing: boolean;
  onClose: () => void;
  /** Keeps the item's agent scores as the author's; Keep is shown only when the host passes it. */
  onKeep: ((itemKey: string) => void) | undefined;
  onScoresChange: (itemKey: string, scores: Scores) => void;
  onStatusChange: (itemKey: string, status: SettableStatus) => void;
  /** Reports the relation row under the pointer or focus, by item key, so that the chart can ring its circle. */
  onRelationHighlight?: (itemKey: string | undefined) => void;
}

const MODE_HEADINGS: Readonly<Record<PaneMode, string>> = {
  pick: 'Next pick',
  preview: 'Preview',
  selected: 'Selected',
};

const RELATION_HEADINGS: ReadonlyArray<[RelationKind, string]> = [
  ['blocked-by', 'Blocked by'],
  ['blocking', 'Blocking'],
  ['parent', 'Parent'],
  ['sub-issue', 'Sub-issues'],
];

/** Returns the pane's mode: a preview of another item than the selection, the selection, or else the next pick. */
export function choosePaneMode(previewKey: string | undefined, selectedKey: string | undefined): PaneMode {
  if (previewKey !== undefined && previewKey !== selectedKey) return 'preview';
  return selectedKey === undefined ? 'pick' : 'selected';
}

/** The side pane (a bottom sheet at phone width) that shows the previewed or selected item. */
export function DetailPane({
  item,
  mode,
  abbreviations,
  workTypeMapping,
  blockedKeys,
  scores,
  override,
  isReviewing,
  onClose,
  onKeep,
  onScoresChange,
  onStatusChange,
  onRelationHighlight,
}: DetailPaneProps): ReactElement {
  if (!item) {
    return (
      <aside aria-label="Item detail" className="tr-pane" data-empty="true">
        <p className="tr-pane-empty">No item selected</p>
      </aside>
    );
  }

  return (
    <aside aria-label="Item detail" className="tr-pane" data-empty="false">
      <div className="tr-pane-head">
        <p className="tr-pane-mode">{MODE_HEADINGS[mode]}</p>
        {mode === 'selected' ? (
          <button className="tr-pane-close" onClick={onClose} type="button">
            Close
          </button>
        ) : null}
      </div>
      <a className="tr-pane-id" href={item.url} rel="noreferrer" target="_blank">
        {labelItem(item, abbreviations)}
        <ExternalLinkIcon />
        <span className="tr-visually-hidden">(opens in a new tab)</span>
      </a>
      <h2 className="tr-pane-title">{item.title}</h2>
      {onKeep && isAgentScored(scores) ? (
        <AgentReview isReviewing={isReviewing} onKeep={() => onKeep(formatItemKey(item))} scores={scores} />
      ) : null}
      <PaneScores
        item={item}
        onScoresChange={(changed) => onScoresChange(formatItemKey(item), changed)}
        onStatusChange={(status) => onStatusChange(formatItemKey(item), status)}
        override={override}
        scores={scores}
      />
      <dl className="tr-pane-facts">
        <dt>Type</dt>
        <dd>{WORK_TYPE_NAMES[classifyWorkType(item.labels, workTypeMapping)]}</dd>
        <dt>Labels</dt>
        <dd>
          {item.labels.length > 0 ? (
            <ul className="tr-chips">
              {item.labels.map((label) => (
                <li className="tr-chip" key={label}>
                  {label}
                </li>
              ))}
            </ul>
          ) : (
            'None'
          )}
        </dd>
      </dl>
      <RelationLists
        abbreviations={abbreviations}
        blockedKeys={blockedKeys}
        onHighlight={onRelationHighlight}
        relations={item.relations}
      />
    </aside>
  );
}

// region | Helpers
/** The agent's mark on the item: the cell that the agent moved it from, and the Keep button. */
function AgentReview({
  scores,
  isReviewing,
  onKeep,
}: {
  scores: ItemScores | undefined;
  isReviewing: boolean;
  onKeep: () => void;
}) {
  const origin = findTrailOrigin(scores);
  return (
    <div className="tr-agent-review">
      <button className="tr-button" onClick={onKeep} type="button">
        Keep
        {isReviewing ? (
          <kbd aria-hidden="true" className="tr-kbd">
            Enter
          </kbd>
        ) : null}
      </button>
      {origin ? (
        <p className="tr-pane-note">
          Moved by the agent from urgency {origin.urgency}, impact {origin.impact}
        </p>
      ) : null}
    </div>
  );
}

function RelationLists({
  relations,
  abbreviations,
  blockedKeys,
  onHighlight,
}: {
  relations: readonly Relation[];
  abbreviations: Abbreviations;
  blockedKeys: ReadonlySet<string>;
  onHighlight: ((itemKey: string | undefined) => void) | undefined;
}) {
  if (relations.length === 0) return <p className="tr-pane-empty">No relations</p>;

  return (
    <div className="tr-relations">
      {RELATION_HEADINGS.map(([kind, heading]) => {
        const refs = relations.filter((relation) => relation.kind === kind).map((relation) => relation.ref);
        if (refs.length === 0) return null;
        return (
          <section aria-label={heading} key={kind}>
            <h3>{heading}</h3>
            <ul>
              {refs.map((ref) => {
                const key = formatItemKey(ref);
                return (
                  <li key={key}>
                    <a
                      className="tr-relation"
                      href={ref.url}
                      onBlur={() => onHighlight?.(undefined)}
                      onFocus={() => onHighlight?.(key)}
                      onPointerEnter={() => onHighlight?.(key)}
                      onPointerLeave={() => onHighlight?.(undefined)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span className="tr-relation-id">{labelItem(ref, abbreviations)}</span>{' '}
                      <span className="tr-relation-title">{ref.title}</span>
                      {ref.state === 'closed' ? (
                        <>
                          {' '}
                          <span className="tr-tag">closed</span>
                        </>
                      ) : null}
                      {blockedKeys.has(key) ? (
                        <>
                          {' '}
                          <span className="tr-tag">blocked</span>
                        </>
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
// endregion | Helpers
