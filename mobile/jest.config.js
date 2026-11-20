/** @type {import('jest').Config} */
const { resolveBabelOptions } = require('jest-expo/src/resolveBabelOptions');

// Metro turns the compiler on from app.json. Jest's preset does not, so a
// memoized callback can hide a stale row that only shows up on device.
const babelOptions = resolveBabelOptions(__dirname);
babelOptions.caller = { ...babelOptions.caller, supportsReactCompiler: true };

module.exports = {
  preset: 'jest-expo',
  cacheDirectory: '<rootDir>/.jest-cache',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.jest-cache/', '<rootDir>/dist/'],
  transform: {
    '\\.[jt]sx?$': [require.resolve('babel-jest'), babelOptions],
  },
};
