import baseConfig, { commonIgnores, createConfig, toolIgnores } from '@williamthorsen/eslint-config-typescript';
import { defineConfig, globalIgnores } from 'eslint/config';

const config = defineConfig(
  ...baseConfig,
  globalIgnores([...commonIgnores, ...toolIgnores]),
  {
    files: ['**/*.ts', '**/*.mts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        // Anchor the project service (enabled by the base config) at the repo root.
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-confusing-void-expression': [
        'warn',
        {
          ignoreArrowShorthand: true,
          ignoreVoidOperator: true,
          ignoreVoidReturningFunctions: true,
        },
      ],
    },
  },
  {
    files: ['**/*.tsx'],
    extends: [await createConfig.react(), await createConfig.jsxA11y()],
    settings: { react: { version: '19.3' } },
  },
  {
    files: ['**/__tests__/**/*.test.tsx'],
    extends: [await createConfig.reactTestingLibrary()],
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['**/scripts/**/*'],
    rules: {
      'no-console': 'off',
    },
  },
);

export default config;
