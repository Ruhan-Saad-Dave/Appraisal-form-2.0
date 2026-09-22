import assert from 'node:assert/strict';
import { scopedAppraisalSetters } from '../src/utils/scopedAppraisalSetters.js';

const state = { partA: 0, partB: 0, partC: 0, docs: {} };
const setters = Object.fromEntries(Object.keys(state).map((key) => [key, (value) => {
  state[key] = typeof value === 'function' ? value(state[key]) : value;
}]));
let request = 1;
const previous = scopedAppraisalSetters(setters, () => request === 1);
previous.partB(320);
previous.partC(85);
request = 2;
const current = scopedAppraisalSetters(setters, () => request === 2);
current.partA(9);
current.partB(0);
current.partC(0);
assert.equal(state.partA + state.partB + state.partC, 9, 'All sections must hydrate without opening their tabs');

// Simulate the previous-year request finishing after the current-year request.
await Promise.resolve();
previous.partB(320);
previous.partC(85);
previous.docs({ previousYear: ['old.pdf'] });
assert.deepEqual(state, { partA: 9, partB: 0, partC: 0, docs: {} });
current.partA((score) => score + 1);
assert.equal(state.partA, 10, 'Functional setters must be preserved');

request = 3;
current.partA(999);
assert.equal(state.partA, 10, 'Invalidated requests must not write');
console.log('Year-scoped hydration checks passed: all sections, late responses, documents, functional setters, invalidation.');
