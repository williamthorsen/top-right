import type { WorkType } from '@top-right/model';
import { type ReactElement, useEffect, useEffectEvent, useRef } from 'react';

import { CircleBody, type CircleBodyProps } from './ScoredCircle.tsx';
import { playCirclePulse } from './usePulse.ts';

export interface PulsingCircleProps extends Omit<CircleBodyProps, 'isSelected'> {
  /** The circle's centre, in the matrix's units. */
  x: number;
  y: number;
  workType: WorkType;
  onEnd: () => void;
}

/**
 * A copy of the selected circle and its rings, drawn over its neighbours in the chart's aria-hidden overlay, which
 * grows once and settles back, then calls `onEnd`.
 */
export function PulsingCircle({ x, y, workType, onEnd, ...body }: PulsingCircleProps): ReactElement {
  const ref = useRef<SVGGElement>(null);
  const end = useEffectEvent(onEnd);

  useEffect(() => {
    const animation = ref.current ? playCirclePulse(ref.current) : undefined;
    if (!animation) {
      end();
      return;
    }
    function finish(): void {
      end();
    }
    animation.addEventListener('finish', finish);
    return () => {
      animation.removeEventListener('finish', finish);
      animation.cancel();
    };
  }, []);

  return (
    <g transform={`translate(${x} ${y})`}>
      <g
        className="tr-node tr-pulse"
        data-sized={!body.isUnsized}
        data-status={body.status}
        data-work-type={workType}
        ref={ref}
      >
        <CircleBody {...body} isSelected />
      </g>
    </g>
  );
}
