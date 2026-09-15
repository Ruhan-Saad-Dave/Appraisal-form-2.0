import assert from 'node:assert/strict';
import { standardReadRows, standardReadSetters } from '../src/features/faculty-appraisal/forms/standard/standardReadCompatibility.js';
const row = { title: 'Saved', impactFactor: null, custom_fields: { impactFactor: 0, authorPosition: 'Corresponding', score: 99, faculty_email: 'forged', unknown: 'keep' } };
const before = structuredClone(row);
const [loaded] = standardReadRows('setJournals', [row]);
assert.equal(loaded.impactFactor, 0);
assert.equal(loaded.authorPosition, 'Corresponding');
assert.equal(loaded.score, undefined);
assert.equal(loaded.faculty_email, undefined);
assert.deepEqual(loaded.custom_fields, row.custom_fields);
assert.deepEqual(row, before);
for (const value of ['', 0, false, 'current']) {
  assert.equal(standardReadRows('setJournals', [{ impactFactor: value, custom_fields: { impactFactor: 'stale' } }])[0].impactFactor, value);
}
assert.equal(standardReadRows('setBooks', [{ custom_fields: { level: 'International', publisher: 'Book' } }])[0].pub, 'Book');
assert.equal(standardReadRows('setProjects', [{ custom_fields: { industryCollab: false } }])[0].industryCollab, false);
assert.equal(standardReadRows('setConfs', [{ custom_fields: { date: '01/09/2026', role: 'Speaker' } }])[0].role, 'Speaker');
assert.deepEqual(standardReadRows('setJournals', standardReadRows('setJournals', [row])), [loaded]);
const untouched = [row];
assert.equal(standardReadRows('setDocs', untouched), untouched);
let state;
const wrapped = standardReadSetters({ setJournals: value => { state = typeof value === 'function' ? value(state) : value; } });
wrapped.setJournals([row]);
assert.deepEqual(state, [loaded]);
wrapped.setJournals(() => [row]);
assert.deepEqual(state, [loaded]);
console.log('PASS: Standard read compatibility, precedence, zero/false/blank, nested fields, immutable data, idempotence and setter integration.');
