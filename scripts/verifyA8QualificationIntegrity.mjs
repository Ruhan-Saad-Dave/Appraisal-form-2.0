import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standardReadRows } from '../src/features/faculty-appraisal/forms/standard/standardReadCompatibility.js';

const distinct = {
  category: 'FDP Advanced Robotics',
  body: 'IEEE Education Board',
  date: '11/11/2026',
};

const [fromCustomFields] = standardReadRows('setQuals', [{
  custom_fields: {
    qualificationTitle: distinct.category,
    body: distinct.body,
    awardDate: distinct.date,
  },
}]);
assert.equal(fromCustomFields.label, distinct.category);
assert.equal(fromCustomFields.awardingBody, distinct.body);
assert.equal(fromCustomFields.date, distinct.date);

const [fromRowAliases] = standardReadRows('setQuals', [{
  qualification: distinct.category,
  awarding_body: distinct.body,
  completionDate: distinct.date,
}]);
assert.equal(fromRowAliases.label, distinct.category);
assert.equal(fromRowAliases.awardingBody, distinct.body);
assert.equal(fromRowAliases.date, distinct.date);

const [cleared] = standardReadRows('setQuals', [{
  label: '',
  awardingBody: '',
  date: '',
  custom_fields: {
    qualificationTitle: 'stale title',
    body: 'stale body',
    awardDate: '01/01/2000',
  },
}]);
assert.equal(cleared.label, '');
assert.equal(cleared.awardingBody, '');
assert.equal(cleared.date, '');

const creativeSource = readFileSync(new URL('../src/features/faculty-appraisal/forms/CreativeSchool/CreativeSchoolAppraisalForm.jsx', import.meta.url), 'utf8');
assert.ok(creativeSource.includes('{ key: "quals", title: "A8. Qualification Enhancement"'));
assert.ok(creativeSource.includes('["title", "Qualification / Certification Title"]'));
assert.ok(creativeSource.includes('["body", "Awarding Body"]'));
assert.ok(creativeSource.includes('["date", "Date"]'));
assert.ok(creativeSource.includes('title: ["title", "label", "qualification", "qualificationTitle", "certification", "certificationTitle", "name"]'));
assert.ok(creativeSource.includes('body: ["body", "details", "awardingBody", "awarding_body", "agency", "institution", "institute", "university"]'));
assert.ok(creativeSource.includes('date: ["date", "completionDate", "awardDate"]'));

const files = [
  ['Dean', '../src/pages/dashboards/DeanDashboard.jsx'],
  ['NonEngineeringDean', '../src/pages/dashboards/dean/NonEngineeringDeanView.jsx'],
  ['VC', '../src/pages/dashboards/VCDashboard.jsx'],
  ['Director', '../src/pages/dashboards/DirectorDashboard.jsx'],
  ['StandardReport', '../src/features/faculty-appraisal/forms/standard/StandardMyAppraisal.jsx'],
  ['FullFormReport', '../src/utils/fullFormReport.js'],
];

for (const [label, path] of files) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  assert.ok(source.includes('Qualification / Category'), `${label}: category column`);
  assert.ok(source.includes('Awarding Body'), `${label}: awarding body column`);
  assert.ok(source.includes('Date'), `${label}: date column`);
}

for (const [label, path] of files.slice(0, 4)) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  assert.equal(/A8\.[\s\S]{0,260}Description/.test(source), false, `${label}: A8 must not collapse into Description`);
}

console.log('PASS: A8 qualification data stays separated for Standard read, Dean/VC/Director display/report definitions, and Creative title/body/date fields.');
