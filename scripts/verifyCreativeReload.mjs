import assert from 'node:assert/strict';
import { creativeReloadData } from '../src/features/faculty-appraisal/forms/CreativeSchool/creativeReloadData.js';

const raw = {
  lectures: [{ semester: 'II', course_code: 'ART101', planned_classes: 20, conducted_classes: 20, score: 10 }],
  summaryOtherInfo: 'Saved summary', declarationConfirmed: true, info: { name: 'Faculty' },
};
const normalized = {
  lectures: [{ sem: 'II', code: 'ART101', planned: 20, conducted: 20, score: 10 }],
  feedback: [{ fb1: 0, fb2: 4 }], info: { name: 'Faculty', school: 'Creative', ay: '2026-2027' },
};
const before = JSON.stringify({ raw, normalized });
const result = creativeReloadData(raw, normalized, ['lectures', 'feedback']);
assert.deepEqual(result.lectures, normalized.lectures);
assert.equal(result.lectures[0].sem, 'II');
assert.equal(result.lectures[0].planned, 20);
assert.equal(result.feedback[0].fb1, 0);
assert.equal(result.summaryOtherInfo, 'Saved summary');
assert.equal(result.declarationConfirmed, true);
assert.equal(result.info.school, 'Creative');
assert.equal(JSON.stringify({ raw, normalized }), before);
assert.deepEqual(creativeReloadData(raw, { lectures: [], info: {} }, ['lectures']).lectures, []);
assert.deepEqual(creativeReloadData(raw, {}, ['lectures']).lectures, raw.lectures);
console.log('Creative reload regression checks passed.');
