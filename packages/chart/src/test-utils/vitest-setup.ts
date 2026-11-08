import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import '@testing-library/jest-dom/vitest';

// Vitest runs without globals, so Testing Library cannot register its own cleanup.
afterEach(cleanup);
