// cPanel Passenger loader runs as CommonJS; expose the app root and load dist.
process.env.APP_ROOT = process.env.APP_ROOT || __dirname;

import('./dist/index.js').catch((err) => {
  console.error(err);
  process.exit(1);
});
