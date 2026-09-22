import assert from 'node:assert/strict';
import { isDynamicAppraisalForm, submittedDynamicForm, readDynamicAppraisalResponse } from '../src/utils/dynamicAppraisalData.js';

const standard = { lectures: [{ semester: 'II', self: 10 }], journals: [] };
const creative = { products: [{ title: 'Design', score: 4 }], exhibitions: [] };
for (const form of [standard, creative, {}, null]) assert.equal(isDynamicAppraisalForm(form), false);
const key = 'custom_525834cf46a548bc81347043135f4b20_s_mtyb6a7c_rbo4b';
const form = { lectures: [], [key]: [{ 'Column 1S': 'Answer', 'Self Score': '10' }] };
const response = { payload: { form, docs: {}, review_chain: ['director', 'dean', 'vc'] }, reviews: [] };
const before = JSON.stringify(response);
assert.equal(isDynamicAppraisalForm(form), true);
assert.equal(isDynamicAppraisalForm({ [key]: [] }), true);
assert.equal(isDynamicAppraisalForm({ [key]: 'invalid table' }), false);
assert.equal(submittedDynamicForm(response), form);
assert.equal(readDynamicAppraisalResponse(response), response);
assert.equal(JSON.stringify(response), before);
assert.throws(() => readDynamicAppraisalResponse({ form: standard }), /does not contain/);
assert.equal(readDynamicAppraisalResponse({ form }).form, form);
console.log('Dynamic detection and lossless response checks passed; Standard/Creative excluded.');
