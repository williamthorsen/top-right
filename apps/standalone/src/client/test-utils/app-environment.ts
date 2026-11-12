import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import '@testing-library/jest-dom/vitest';

/**
 * Registers the hooks that every App test file needs under jsdom: the browser APIs that jsdom lacks, and the cleanup of
 * the DOM, the stubbed globals, storage, and the URL after each test.
 */
export function setUpAppEnvironment(): void {
  // jsdom does not implement scrolling, which the chart's table calls on each selection.
  Element.prototype.scrollIntoView = () => {};

  // jsdom does not implement `ResizeObserver`, to which the chart's zoom subscribes; these tests do not resize the chart.
  // The stub is installed per test because `afterEach` unstubs every global.
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
    globalThis.history.replaceState(null, '', '/');
  });
}
