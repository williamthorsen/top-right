// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AGENT_STARTERS } from '../agent-starters.ts';
import { AgentPanel } from '../AgentPanel.tsx';
import { setUpAppEnvironment } from '../test-utils/app-environment.ts';
import type { AgentConversation, AgentRun } from '../useAgentRun.ts';

setUpAppEnvironment();

const ITEM_KEY = 'w/top-right#12';

describe(AgentPanel, () => {
  it('shows one line while the conversation is empty, and starts a run from a starter', async () => {
    const user = userEvent.setup();
    const { conversation } = renderPanel([]);

    expect(screen.getByText('Ask about the backlog, or start from a suggestion above.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Suggest urgency changes' }));

    expect(conversation.start).toHaveBeenCalledWith(AGENT_STARTERS[0]?.prompt);
  });

  it('sends the instruction on Enter, starts a new line on Shift+Enter, and offers Send only with text', async () => {
    const user = userEvent.setup();
    const { conversation } = renderPanel([]);
    const field = screen.getByRole('textbox', { name: 'Instruction' });

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await user.type(field, 'Score the bugs{Shift>}{Enter}{/Shift}first{Enter}');

    expect(conversation.start).toHaveBeenCalledWith('Score the bugs\nfirst');
    expect(field).toHaveValue('');
  });

  it('shows a run in progress with its activity and Cancel, and disables the starters', async () => {
    const user = userEvent.setup();
    const { conversation } = renderPanel([buildRun({ activity: 'Reading items' })], { isRunning: true });

    expect(screen.getByRole('status')).toHaveTextContent(/^Reading items$/);
    expect(screen.getByText(/^\d+ s$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suggest urgency changes' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(conversation.cancel).toHaveBeenCalled();
  });

  it.each([
    { outcome: 'empty', text: 'The agent finished without a result.' },
    { outcome: 'cancelled', text: 'Cancelled.' },
    { outcome: 'failed', text: 'Failed: The harness is not signed in' },
  ] as const)('reports a run that ended as $outcome', ({ outcome, text }) => {
    renderPanel([buildRun({ outcome, failure: outcome === 'failed' ? 'The harness is not signed in' : undefined })]);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('shows the agent’s answer', () => {
    renderPanel([buildRun({ outcome: 'answered', message: 'Two items look urgent.' })]);

    expect(screen.getByText('Two items look urgent.')).toBeInTheDocument();
  });

  it('lists each suggestion with its change and reason, selects its item, and discards the run', async () => {
    const user = userEvent.setup();
    const suggestion = {
      itemKey: ITEM_KEY,
      field: 'urgency' as const,
      from: 'medium',
      to: 'high',
      reason: 'Blocks it',
    };
    const { conversation, onSelectItem } = renderPanel([buildRun({ outcome: 'suggested', suggestions: [suggestion] })]);

    const row = screen.getByRole('button', { name: /T12 Score items/ });
    expect(row).toHaveTextContent('Medium → High urgency');
    expect(row).toHaveTextContent('Blocks it');
    await user.click(row);
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    expect(onSelectItem).toHaveBeenCalledWith(ITEM_KEY);
    expect(conversation.discard).toHaveBeenCalledWith(1);
  });

  it('marks a discarded run instead of offering Discard', () => {
    const suggestion = { itemKey: ITEM_KEY, field: 'value' as const, to: 'must-have', reason: 'Core' };
    renderPanel([buildRun({ outcome: 'suggested', suggestions: [suggestion], isDiscarded: true })]);

    expect(screen.getByText('Discarded')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument();
  });

  it('returns focus to the toggle on Escape', async () => {
    const user = userEvent.setup();
    renderPanel([]);
    await user.click(screen.getByRole('textbox', { name: 'Instruction' }));

    await user.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Agent' })).toHaveFocus();
  });
});

// region | Helpers
/** Returns a run of a prompt with `overrides` applied. */
function buildRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: 1,
    prompt: 'Score the backlog',
    at: '2026-11-08T09:00:00.000Z',
    startedAt: Date.now(),
    activity: undefined,
    message: '',
    suggestions: [],
    outcome: undefined,
    failure: undefined,
    isDiscarded: false,
    ...overrides,
  };
}

/** Renders the panel over `runs`, beside a stand-in for the header's toggle. */
function renderPanel(runs: AgentRun[], { isRunning = false } = {}) {
  const conversation: AgentConversation = {
    runs,
    isRunning,
    start: vi.fn<AgentConversation['start']>(),
    cancel: vi.fn<AgentConversation['cancel']>(),
    discard: vi.fn<AgentConversation['discard']>(),
  };
  const onSelectItem = vi.fn<(itemKey: string) => void>();
  const toggleRef = createRef<HTMLButtonElement>();
  render(
    <>
      <button ref={toggleRef} type="button">
        Agent
      </button>
      <AgentPanel
        conversation={conversation}
        describeItem={(itemKey) => (itemKey === ITEM_KEY ? { label: 'T12', title: 'Score items' } : undefined)}
        onClose={() => {}}
        onSelectItem={onSelectItem}
        toggleRef={toggleRef}
      />
    </>,
  );
  return { conversation, onSelectItem };
}
// endregion | Helpers
