import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { reportTextValue } from '../src/features/faculty-appraisal/shared/dashboardHelpers.js';

// Render the actual Standard report fragments, not a duplicate report implementation.
const source = readFileSync(new URL('../src/features/faculty-appraisal/forms/standard/StandardMyAppraisal.jsx', import.meta.url), 'utf8');
const cases = [
  ['A1.', 'lectures', 'sem code planned conducted pctConducted score', 'totalLecScore'],
  ['A3.', 'innovRows', 'method details score', 'innovTotal'],
  ['A6.', 'projects', 'label studentsCount industryCollab awardReceived studentPub score', 'projectTotal'],
  ['A8.', 'quals', 'label awardingBody date score', 'qualTotal'],
  ['B1.', 'journals', 'title journal issn impactFactor authorPosition score', 'journalScore'],
  ['B2.', 'books', 'title book pub level coauth score', 'bookScore'],
  ['B3.', 'patents', 'title type status fileNo score', 'patentScore'],
  ['B6.', 'proposals', 'agency duration amount score', 'proposalScore'],
  ['B7.', 'confs', 'title role date level score', 'confScore'],
  ['B10.', 'products', 'details role status score', 'productScore'],
  ['B11.', 'ict', 'title type quad score', 'ictScore'],
];

for (const [section, arrayKey, fieldList, totalKey] of cases) {
  const start = source.indexOf(`<h3>${section}`);
  assert.ok(start >= 0, `${section} exists`);
  const fragment = source.slice(start, source.indexOf('</table>', start) + 8);
  const keys = fieldList.split(' ');
  const rows = [
    Object.fromEntries(keys.map(key => [key, key === 'score' ? 7 : `${key} <&> value`])),
    Object.fromEntries(keys.map(key => [key, 0])),
    Object.fromEntries(keys.map(key => [key, key === 'score' ? 0 : false])),
  ];
  if (arrayKey === 'innovRows') {
    rows[0].method = 'Other';
    rows[0].methodOther = '<Custom method & details>';
  }
  const before = structuredClone(rows);
  const html = runInNewContext('`' + fragment + '`', {
    [arrayKey]: rows, [totalKey]: 7, reportTextValue,
    OTHER_INNOVATIVE_METHOD: 'Other', A8_QUALIFICATION_MAX: 10,
    clampScore: value => value, projectGuidanceRowMax: () => 20,
  });
  for (const row of rows) {
    for (const value of Object.values(row)) assert.ok(html.includes(reportTextValue(value)), `${section}: missing ${value}`);
  }
  assert.deepEqual(rows, before, `${section}: report must not mutate answers`);
  const headerCount = [...html.matchAll(/<th>/g)].length;
  assert.equal(headerCount, keys.length + 1, `${section}: header count`);
  for (const match of html.matchAll(/<tr><td class="c">\d+<\/td>(.*?)<\/tr>/gs)) {
    assert.equal([...match[0].matchAll(/<td\b/g)].length, headerCount, `${section}: aligned data cells`);
  }
  assert.equal(Number(html.match(/colspan="(\d+)"/)[1]) + 1, headerCount, `${section}: aligned total`);
  assert.ok(!html.includes('<Custom method'), 'User content must be escaped');
}
console.log(`PASS: ${cases.length} Standard report sections: current fields, zero/false, escaping, column alignment, and immutable answers.`);
