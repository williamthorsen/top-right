/** The path at which the host serves the chart. */
export const CHART_PATH = '/';

/** The path at which the host serves the Settings page. */
export const SETTINGS_PATH = '/settings';

/** The query parameter that holds the selected item's key. */
export const ITEM_PARAMETER = 'item';

/** Returns the chart's URL, carrying the selected item when there is one. */
export function buildChartHref(item: string | undefined): string {
  return buildHref(CHART_PATH, item);
}

/** Returns the Settings page's URL, carrying the selected item so that the way back to the chart restores it. */
export function buildSettingsHref(item: string | undefined): string {
  return buildHref(SETTINGS_PATH, item);
}

/** Returns the key of the item that the current URL names, if it names one. */
export function readUrlItem(): string | undefined {
  return new URLSearchParams(globalThis.location.search).get(ITEM_PARAMETER) ?? undefined;
}

// region | Helpers
function buildHref(path: string, item: string | undefined): string {
  return item === undefined ? path : `${path}?${new URLSearchParams({ [ITEM_PARAMETER]: item })}`;
}
// endregion | Helpers
