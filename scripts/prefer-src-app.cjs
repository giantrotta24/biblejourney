/* eslint-disable @typescript-eslint/no-require-imports */
// Next.js uses ./app and ignores ./src/app when both exist
// (next/dist/lib/find-pages-dir.js). The native app lives in ./app,
// so this tells that lookup the website directory is still ./src/app.
const fs = require('fs');
const path = require('path');

const nativeApp = fs.realpathSync(path.join(__dirname, '..', 'app'));
const existsSync = fs.existsSync;

fs.existsSync = function (target) {
  const asString = String(target);
  if (asString === 'app' || asString.endsWith(`${path.sep}app`)) {
    const stack = new Error().stack ?? '';
    if (stack.includes('find-pages-dir.js')) {
      try {
        if (fs.realpathSync(asString) === nativeApp) return false;
      } catch {
        // The path is missing. Fall through to the real check.
      }
    }
  }
  return existsSync.call(this, target);
};
