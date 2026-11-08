import { fileURLToPath } from 'node:url';

import { defineVitestConfig } from '@williamthorsen/nmr/vitest';

export default defineVitestConfig({
  project: {
    environment: 'jsdom',
    setupFiles: [fileURLToPath(new URL('src/test-utils/vitest-setup.ts', import.meta.url))],
  },
});
