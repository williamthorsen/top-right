import { LEVEL_NAMES } from '@top-right/chart';
import { type ReactElement, type RefObject, useEffect, useRef, useState } from 'react';

import { AGENT_STARTERS } from './agent-starters.ts';
import type { AgentConversation, AgentRun, SuggestedChange } from './useAgentRun.ts';

/** The id of the panel, which the header's toggle controls. */
export const AGENT_PANEL_ID = 'agent-panel';

/** How the panel names an item: its id label and its title. */
export interface ItemDescription {
  label: string;
  title: string;
}

export interface AgentPanelProps {
  conversation: AgentConversation;
  /** Returns how the panel names an item, or undefined for an item that the page has not loaded. */
  describeItem: (itemKey: string) => ItemDescription | undefined;
  onClose: () => void;
  /** Selects an item on the chart, as a history entry. */
  onSelectItem: (itemKey: string) => void;
  /** The header's toggle, to which Escape returns focus. */
  toggleRef: RefObject<HTMLButtonElement | null>;
}

const LEVEL_NAME_OF = new Map<unknown, string>(Object.entries(LEVEL_NAMES));

/**
 * The panel in which the author instructs the agent: the starters, the conversation with each run's progress and
 * outcome, and the field for a prompt of the author's own.
 */
export function AgentPanel({
  conversation,
  describeItem,
  onClose,
  onSelectItem,
  toggleRef,
}: AgentPanelProps): ReactElement {
  const [draft, setDraft] = useState('');
  const panelRef = useRef<HTMLElement>(null);
  const { isRunning, runs, start } = conversation;
  const canSend = !isRunning && draft.trim() !== '';

  // Escape returns focus to the toggle, rather than reaching the chart, which would clear the selection.
  useEffect(() => {
    const panel = panelRef.current;
    function returnFocus(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      toggleRef.current?.focus();
    }
    panel?.addEventListener('keydown', returnFocus);
    return () => panel?.removeEventListener('keydown', returnFocus);
  }, [toggleRef]);

  function send(): void {
    if (!canSend) return;
    start(draft.trim());
    setDraft('');
  }

  return (
    <aside aria-label="Agent" className="host-agent-panel" id={AGENT_PANEL_ID} ref={panelRef}>
      <div className="host-agent-head">
        <h2 className="host-agent-title">Agent</h2>
        <button className="host-button" onClick={onClose} type="button">
          Close
        </button>
      </div>
      <div className="host-agent-starters">
        {AGENT_STARTERS.map((starter) => (
          <button
            className="host-button"
            disabled={isRunning}
            key={starter.label}
            onClick={() => start(starter.prompt)}
            type="button"
          >
            {starter.label}
          </button>
        ))}
      </div>
      {runs.length === 0 ? (
        <p className="host-agent-empty">Ask about the backlog, or start from a suggestion above.</p>
      ) : (
        <ol aria-label="Conversation" className="host-agent-log">
          {runs.map((run) => (
            <RunEntry
              conversation={conversation}
              describeItem={describeItem}
              key={run.id}
              onSelectItem={onSelectItem}
              run={run}
            />
          ))}
        </ol>
      )}
      <form
        className="host-agent-compose"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          aria-label="Instruction"
          className="host-agent-input"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            send();
          }}
          rows={3}
          value={draft}
        />
        <button className="host-button" disabled={!canSend} type="submit">
          Send
        </button>
      </form>
    </aside>
  );
}

// region | Helpers
/** One run in the conversation: its prompt, then its progress or its outcome. */
function RunEntry({
  conversation,
  describeItem,
  onSelectItem,
  run,
}: {
  conversation: AgentConversation;
  describeItem: AgentPanelProps['describeItem'];
  onSelectItem: AgentPanelProps['onSelectItem'];
  run: AgentRun;
}): ReactElement {
  const itemCount = new Set(run.suggestions.map((change) => change.itemKey)).size;
  return (
    <li className="host-agent-run">
      <p className="host-agent-prompt">{run.prompt}</p>
      {run.outcome === undefined ? (
        <div className="host-agent-progress" role="status">
          <span aria-hidden="true" className="host-agent-spinner" />
          <span>{run.activity ?? 'Starting'}</span>
          <Elapsed startedAt={run.startedAt} />
          <button className="host-button" onClick={conversation.cancel} type="button">
            Cancel
          </button>
        </div>
      ) : null}
      {run.message.trim() === '' ? null : <p className="host-agent-answer">{run.message}</p>}
      {run.suggestions.length > 0 ? (
        <div className="host-agent-suggestions">
          <p className="host-agent-outcome">
            <span className="host-agent-badge">{itemCount}</span>{' '}
            {itemCount === 1 ? 'item suggested' : 'items suggested'}
          </p>
          <ul className="host-agent-rows">
            {run.suggestions.map((change) => (
              <li key={`${change.itemKey} ${change.field}`}>
                <SuggestionRow change={change} describeItem={describeItem} onSelectItem={onSelectItem} />
              </li>
            ))}
          </ul>
          {run.outcome === 'suggested' && !run.isDiscarded ? (
            <button className="host-button" onClick={() => conversation.discard(run.id)} type="button">
              Discard
            </button>
          ) : null}
          {run.isDiscarded ? <p className="host-agent-note">Discarded</p> : null}
        </div>
      ) : null}
      <Outcome run={run} />
    </li>
  );
}

/** The seconds since the run started, updated each second. */
function Elapsed({ startedAt }: { startedAt: number }): ReactElement {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="host-agent-note">{Math.max(0, Math.round((now - startedAt) / 1000))} s</span>;
}

/** Returns the change as the author reads it, such as `High → Critical urgency`. */
function formatChange({ field, from, to }: SuggestedChange): string {
  return `${formatScore(field, from)} → ${formatScore(field, to)} ${field}`;
}

/** Returns a score as the pane names it: a level's name, a progress as a percentage, or an effort's points. */
function formatScore(field: SuggestedChange['field'], value: string | number | undefined): string {
  if (value === undefined) return 'Unscored';
  if (field === 'progress' && typeof value === 'number') return `${Math.round(value * 100)} %`;
  return LEVEL_NAME_OF.get(value) ?? String(value);
}

/** The run's outcome, unless its answer or its suggestions already state it. */
function Outcome({ run }: { run: AgentRun }): ReactElement | null {
  switch (run.outcome) {
    case 'cancelled':
      return <p className="host-agent-note">Cancelled.</p>;
    case 'empty':
      return <p className="host-agent-note">The agent finished without a result.</p>;
    case 'failed':
      return (
        <p className="host-agent-failure" role="alert">
          <svg aria-hidden="true" height="14" viewBox="0 0 16 16" width="14">
            <path d="M8 1 15 14H1Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
            <path d="M8 6v4M8 11.5v1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Failed: {run.failure ?? 'the agent stopped'}
        </p>
      );
    default:
      return run.failure === undefined ? null : (
        <p className="host-agent-failure" role="alert">
          {run.failure}
        </p>
      );
  }
}

/** A suggested change, which selects its item on the chart. */
function SuggestionRow({
  change,
  describeItem,
  onSelectItem,
}: {
  change: SuggestedChange;
  describeItem: AgentPanelProps['describeItem'];
  onSelectItem: AgentPanelProps['onSelectItem'];
}): ReactElement {
  const item = describeItem(change.itemKey);
  return (
    <button className="host-agent-row" onClick={() => onSelectItem(change.itemKey)} type="button">
      <span className="host-agent-row-head">
        <code className="host-agent-id">{item?.label ?? change.itemKey}</code>{' '}
        <span className="host-agent-row-title">{item?.title}</span>
      </span>{' '}
      <span>{formatChange(change)}</span> <span className="host-agent-note">{change.reason}</span>
    </button>
  );
}
// endregion | Helpers
