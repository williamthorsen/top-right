/** A named prompt that starts a run when the author activates it. */
export interface AgentStarter {
  label: string;
  prompt: string;
}

/** The starters that the panel offers; each prompt names the outcome that it expects. */
export const AGENT_STARTERS: readonly AgentStarter[] = [
  {
    label: 'Suggest urgency changes',
    prompt: 'Find open items whose urgency looks wrong and record each change with suggest_scores, with a reason.',
  },
  {
    label: 'Score the unscored items',
    prompt:
      'Suggest urgency and value for the open items that lack them, recording each with suggest_scores, with a reason.',
  },
];
