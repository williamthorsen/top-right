import type { ReactElement } from 'react';

import { MenuButton, type MenuButtonItem } from './MenuButton.tsx';
import type { ZoomState } from './useZoom.ts';
import { formatScale, isAtEnd, ZOOM_STEPS } from './zoom.ts';

/**
 * The strip's zoom control, after a document editor's: a zoom-out button, a readout of the magnification that opens the
 * steps, and a zoom-in button.
 */
export function ZoomControl({
  magnification,
  step,
  choose,
}: Pick<ZoomState, 'choose' | 'magnification' | 'step'>): ReactElement {
  const scale = formatScale(magnification);
  const items = ZOOM_STEPS.map((step): MenuButtonItem => ({
    label: formatScale(step),
    role: 'menuitemradio',
    isChecked: magnification === step,
    onChoose: () => choose(step),
  }));

  return (
    <div aria-label="Zoom" className="tr-zoom" role="group">
      <button
        aria-label="Zoom out"
        className="tr-menu-button tr-zoom-step"
        disabled={isAtEnd(magnification, 'out')}
        onClick={() => step('out')}
        type="button"
      >
        −
      </button>
      <MenuButton buttonLabel={`Zoom, ${scale}`} className="tr-zoom-readout" items={items} menuLabel="Zoom">
        {scale}
      </MenuButton>
      <button
        aria-label="Zoom in"
        className="tr-menu-button tr-zoom-step"
        disabled={isAtEnd(magnification, 'in')}
        onClick={() => step('in')}
        type="button"
      >
        +
      </button>
    </div>
  );
}
