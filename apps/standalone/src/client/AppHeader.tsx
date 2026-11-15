import type { ReactElement, RefObject } from 'react';

import { AGENT_PANEL_ID } from './AgentPanel.tsx';

export interface AppHeaderProps {
  /** The page that is shown. */
  current: 'chart' | 'settings';
  chartHref: string;
  settingsHref: string;
  /** The toggle of the agent's panel; without it, the header offers none. */
  agentToggle?: AgentToggle | undefined;
  /** The agent's toggle, which the panel focuses on Escape. */
  agentToggleRef?: RefObject<HTMLButtonElement | null> | undefined;
}

/** Whether the agent's panel is open, and the action that opens or closes it. */
export interface AgentToggle {
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * The host's header on every page: the product's name, which links to the chart, the links between the pages, and, at
 * its right end beside the panel that it opens, the agent's toggle.
 */
export function AppHeader({
  agentToggle,
  agentToggleRef,
  current,
  chartHref,
  settingsHref,
}: AppHeaderProps): ReactElement {
  return (
    <header className="host-header">
      <a className="host-header-name" href={chartHref}>
        Top Right
      </a>
      <nav aria-label="Pages" className="host-header-nav">
        <a aria-current={current === 'chart' ? 'page' : undefined} className="host-header-link" href={chartHref}>
          Chart
        </a>
        <a aria-current={current === 'settings' ? 'page' : undefined} className="host-header-link" href={settingsHref}>
          Settings
        </a>
      </nav>
      {agentToggle ? (
        <button
          aria-controls={AGENT_PANEL_ID}
          aria-expanded={agentToggle.isOpen}
          className="host-header-toggle"
          onClick={agentToggle.onToggle}
          ref={agentToggleRef}
          type="button"
        >
          Agent
        </button>
      ) : null}
    </header>
  );
}
