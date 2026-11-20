import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { FakeResizeObserver } from './resize-observer.ts';

import '@testing-library/jest-dom/vitest';

// Vitest runs without globals, so Testing Library cannot register its own cleanup.
afterEach(cleanup);

// jsdom does not implement `ResizeObserver`, which the chart's zoom subscribes to on mount.
vi.stubGlobal('ResizeObserver', FakeResizeObserver);
