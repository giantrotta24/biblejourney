// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', '.jest-cache/*'],
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'jest.setup.js', 'jest.config.js'],
    languageOptions: {
      globals: globals.jest,
    },
  },
]);
