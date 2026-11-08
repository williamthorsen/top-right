import {
  classifyWorkType,
  formatItemKey,
  type ItemScores,
  type Relation,
  type RelationKind,
  type Scores,
  type StatusOverride,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';
import type { ReactElement } from 'react';

import { type Abbreviations, labelItem } from './item-label.ts';
import { WORK_TYPE_NAMES } from './Legend.tsx';
import { PaneScores, type SettableStatus } from './PaneScores.tsx';

export type PaneMode = 'preview' | 'selected';

export interface DetailPaneProps {
  item: WorkItem | undefined;
  mode: PaneMode;
  abbreviations: Abbreviations;
  workTypeMapping: WorkTypeMapping;
  /** The keys of the open items that an open item blocks, for tagging relation rows. */
  blockedKeys: ReadonlySet<string>;
  scores: ItemScores | undefined;
  override: StatusOverride | undefined;
  onClose: () => void;
  onScoresChange: (itemKey: string, scores: Scores) => void;
  onStatusChange: (itemKey: string, status: SettableStatus) => void;
}

const RELATION_HEADINGS: ReadonlyArray<[RelationKind, string]> = [
  ['blocked-by', 'Blocked by'],
  ['blocking', 'Blocking'],
  ['parent', 'Parent'],
  ['sub-issue', 'Sub-issues'],
];

/** The side pane (a bottom sheet at phone width) that shows the previewed or selected item. */
export function DetailPane({
  item,
  mode,
  abbreviations,
  workTypeMapping,
  blockedKeys,
  scores,
  override,
  onClose,
  onScoresChange,
  onStatusChange,
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
        <p className="tr-pane-mode">{mode === 'preview' ? 'Preview' : 'Selected'}</p>
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
      <RelationLists abbreviations={abbreviations} blockedKeys={blockedKeys} relations={item.relations} />
    </aside>
  );
}

// region | Helpers
function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="12"
      stroke="currentColor"
      strokeWidth="1.6"
      viewBox="0 0 12 12"
      width="12"
    >
      <path d="M5 2H2v8h8V7M7 1h4v4M11 1 5.5 6.5" />
    </svg>
  );
}

function RelationLists({
  relations,
  abbreviations,
  blockedKeys,
}: {
  relations: readonly Relation[];
  abbreviations: Abbreviations;
  blockedKeys: ReadonlySet<string>;
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
                    <a className="tr-relation" href={ref.url} rel="noreferrer" target="_blank">
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
