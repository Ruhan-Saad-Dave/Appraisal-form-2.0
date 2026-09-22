import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COURSE_FILE_DETAIL_OPTIONS,
  normalizeCourseFileDetails,
} from '../src/utils/appraisalFormUtils.js';
import { standardReadRows } from '../src/features/faculty-appraisal/forms/standard/standardReadCompatibility.js';

const cases = [
  ['Yes', '1.Available'],
  ['Available', '1.Available'],
  ['1.Available', '1.Available'],
  ['No', '3.Not Available'],
  ['Not Available', '3.Not Available'],
  ['3.Not Available', '3.Not Available'],
  ['Partial', '2.Partially Available'],
  ['Partially Available', '2.Partially Available'],
  ['2.Partially Available', '2.Partially Available'],
];

for (const [input, expected] of cases) {
  assert.equal(normalizeCourseFileDetails(input), expected, input);
  assert.ok(COURSE_FILE_DETAIL_OPTIONS.includes(expected), `${expected} is selectable`);
  assert.equal(standardReadRows('setCourseFile', [{ details: input }])[0].details, expected);
  assert.equal(standardReadRows('setCourseFile', [{ custom_fields: { details: input } }])[0].details, expected);
}

const [cleared] = standardReadRows('setCourseFile', [{ details: '', custom_fields: { details: '1.Available' } }]);
assert.equal(cleared.details, '', 'explicitly cleared dropdown must stay blank');

for (const file of [
  '../src/features/faculty-appraisal/forms/standard/StandardMyAppraisal.jsx',
  '../src/features/faculty-appraisal/forms/CreativeSchool/CreativeSchoolAppraisalForm.jsx',
]) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  assert.ok(source.includes('COURSE_FILE_DETAIL_OPTIONS.map'), `${file} renders shared dropdown options`);
  assert.ok(source.includes('normalizeCourseFileDetails'), `${file} normalizes select value`);
}

console.log('PASS: A2 course-file dropdown survives refresh for backend normalized values and old Yes/No values.');
