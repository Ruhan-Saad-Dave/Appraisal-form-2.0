import assert from 'node:assert/strict';
import { requiresPageReload } from '../src/utils/runtimeRecovery.js';
import config from '../vite.config.js';

for (const message of [
  "Cannot read properties of null (reading 'useContext')",
  "Cannot read properties of null (reading 'useState')",
  'Failed to fetch dynamically imported module: /assets/dashboard.js',
  'error loading dynamically imported module',
  'Importing a module script failed.',
  'Loading chunk 123 failed.',
  'Outdated Optimize Dep',
]) assert.equal(requiresPageReload(new Error(message)), true, message);

for (const error of [null, new Error('Network Error'), new Error('Permission denied'),
  new Error("Cannot read properties of null (reading 'name')"),
  new Error('Review feedback requires ReviewFeedbackProvider.'),
]) assert.equal(requiresPageReload(error), false, String(error));

assert.deepEqual(config.resolve.dedupe, ['react', 'react-dom']);
for (const dependency of ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react', 'react-router-dom']) {
  assert.ok(config.optimizeDeps.include.includes(dependency), dependency);
}
assert.equal(config.optimizeDeps.holdUntilCrawlEnd, true);
console.log('Runtime recovery and dependency configuration checks passed.');
