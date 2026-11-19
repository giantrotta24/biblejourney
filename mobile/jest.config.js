/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  cacheDirectory: '<rootDir>/.jest-cache',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.jest-cache/', '<rootDir>/dist/'],
};
