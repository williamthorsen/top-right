import { defineConfig } from '@williamthorsen/nmr/config';

/** Repo-specific script additions. */
export default defineConfig({
  rootScripts: {
    'drift:sweep': 'node scripts/drift-sweep.ts',
  },
});
