import type { ReactElement } from 'react';

import { MenuButton } from './MenuButton.tsx';

export interface MoreMenuProps {
  isChainShown: boolean;
  /** Whether the shown items contain a blocker chain; without one, the chain item is disabled. */
  hasChain: boolean;
  onChainShownChange: (isChainShown: boolean) => void;
}

/** The strip's More menu, which holds the chart's advanced views. */
export function MoreMenu({ isChainShown, hasChain, onChainShownChange }: MoreMenuProps): ReactElement {
  return (
    <MenuButton
      items={[
        {
          label: 'Longest blocker chain',
          role: 'menuitemcheckbox',
          isChecked: isChainShown,
          isDisabled: !hasChain,
          onChoose: () => onChainShownChange(!isChainShown),
        },
      ]}
      menuLabel="More"
    >
      More
    </MenuButton>
  );
}
