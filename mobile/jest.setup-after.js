const { beforeEach } = require('@jest/globals');

beforeEach(() => {
  const { resetSettingsForTests } = require('./src/settings/client');
  resetSettingsForTests();
});
