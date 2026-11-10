import type { ReactElement } from 'react';

import { MenuButton, type MenuButtonItem } from './MenuButton.tsx';
import type { ZoomState } from './useZoom.ts';
import { formatScale, isAtEnd, ZOOM_STEPS } from './zoom.ts';

/**
 * The strip's zoom control, after a document editor's: a zoom-out button, a readout that opens the steps and Fit, and a
 * zoom-in button. The readout shows Fit while Fit is on, and the scale otherwise.
 */
export function ZoomControl({ zoom, step, choose }: ZoomState): ReactElement {
  const scale = formatScale(zoom.scale);
  const isFit = zoom.kind === 'fit';
  const items: MenuButtonItem[] = [
    { label: 'Fit', role: 'menuitemradio', isChecked: isFit, onChoose: () => choose('fit') },
    ...ZOOM_STEPS.map((scale): MenuButtonItem => ({
      label: formatScale(scale),
      role: 'menuitemradio',
      isChecked: zoom.kind === 'step' && zoom.scale === scale,
      onChoose: () => choose(scale),
    })),
  ];

  return (
    <div aria-label="Zoom" className="tr-zoom" role="group">
      <button
        aria-label="Zoom out"
        className="tr-menu-button tr-zoom-step"
        disabled={isAtEnd(zoom.scale, 'out')}
        onClick={() => step('out')}
        type="button"
      >
        −
      </button>
      <MenuButton
        buttonLabel={isFit ? `Zoom, Fit, ${scale}` : `Zoom, ${scale}`}
        className="tr-zoom-readout"
        items={items}
        menuLabel="Zoom"
      >
        {isFit ? 'Fit' : scale}
      </MenuButton>
      <button
        aria-label="Zoom in"
        className="tr-menu-button tr-zoom-step"
        disabled={isAtEnd(zoom.scale, 'in')}
        onClick={() => step('in')}
        type="button"
      >
        +
      </button>
    </div>
  );
}
