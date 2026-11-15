import { formatIdLabel, formatItemKey, type ItemScores } from '@top-right/model';
import {
  type Dispatch,
  type ReactElement,
  type RefObject,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from 'react';

import type { ItemsResponse } from '#src/shared/items-response.ts';

import { AgentPanel } from './AgentPanel.tsx';
import type { AgentToggle } from './AppHeader.tsx';
import { useAgentRun } from './useAgentRun.ts';

/** The header's toggle and the panel, both absent until the page knows that the host runs an agent. */
export interface AgentPanelBinding {
  toggle: AgentToggle | undefined;
  toggleRef: RefObject<HTMLButtonElement | null>;
  /** The panel while it is open, else null. */
  panel: ReactElement | null;
}

/**
 * Holds whether the agent's panel is open and the conversation in it, and returns the toggle and the panel for the
 * page's `data`, undefined while it loads. The resulting scores of each item that a suggestion or a discard changed
 * merge into `setScores`, and a listed suggestion selects its item through `selectKey`.
 */
export function useAgentPanel(
  data: ItemsResponse | undefined,
  setScores: Dispatch<SetStateAction<Record<string, ItemScores>>>,
  selectKey: (key: string, options: { push: boolean }) => void,
): AgentPanelBinding {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const conversation = useAgentRun(
    useCallback(
      (changed: Readonly<Record<string, ItemScores>>) => setScores((current) => ({ ...current, ...changed })),
      [setScores],
    ),
  );
  if (!data?.agent) return { toggle: undefined, toggleRef, panel: null };

  const { abbreviations, items } = data;
  return {
    toggle: { isOpen, onToggle: () => setIsOpen((current) => !current) },
    toggleRef,
    panel: isOpen ? (
      <AgentPanel
        conversation={conversation}
        describeItem={(itemKey) => {
          const item = items.find((candidate) => formatItemKey(candidate) === itemKey);
          return item && { label: formatIdLabel(item, abbreviations[item.repo] ?? item.repo), title: item.title };
        }}
        onClose={() => setIsOpen(false)}
        onSelectItem={(itemKey) => selectKey(itemKey, { push: true })}
        toggleRef={toggleRef}
      />
    ) : null,
  };
}
