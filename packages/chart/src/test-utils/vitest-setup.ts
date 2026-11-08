import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import '@testing-library/jest-dom/vitest';

// Vitest runs without globals, so Testing Library cannot register its own cleanup.
afterEach(cleanup);

// jsdom does not implement scrolling; a test that observes it spies on this no-op.
Element.prototype.scrollIntoView = () => {};
