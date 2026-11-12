import type { ReactElement } from 'react';

export interface AppHeaderProps {
  /** The page that is shown. */
  current: 'chart' | 'settings';
  chartHref: string;
  settingsHref: string;
}

/** The host's header on every page: the product's name, which links to the chart, and the links between the pages. */
export function AppHeader({ current, chartHref, settingsHref }: AppHeaderProps): ReactElement {
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
    </header>
  );
}
