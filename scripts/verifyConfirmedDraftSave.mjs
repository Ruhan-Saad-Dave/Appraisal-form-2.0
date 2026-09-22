import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { confirmedDraftSave, draftSaveErrorMessage, DRAFT_CONNECTION_ERROR } from '../src/utils/confirmedDraftSave.js';
const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
try {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  let called = false;
  await assert.rejects(confirmedDraftSave(() => { called = true; }), { code: 'DRAFT_OFFLINE' });
  assert.equal(called, false);
  globalThis.navigator.onLine = true;
  for (const message of ['Saved', 'Draft saved']) {
    assert.deepEqual(await confirmedDraftSave(async () => ({ message })), { message });
  }
  for (const response of [undefined, {}, { message: 'failed' }, { success: false, message: 'Saved' }]) {
    await assert.rejects(confirmedDraftSave(async () => response), { code: 'DRAFT_UNCONFIRMED' });
  }
  const networkError = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
  await assert.rejects(confirmedDraftSave(async () => { throw networkError; }), networkError);
  assert.equal(draftSaveErrorMessage(networkError), DRAFT_CONNECTION_ERROR);
  assert.equal(draftSaveErrorMessage({ code: 'ECONNABORTED' }), DRAFT_CONNECTION_ERROR);
  assert.match(draftSaveErrorMessage({ response: { status: 403 }, message: 'Review locked' }), /Review locked/);
  let resolve;
  let complete = false;
  const pending = confirmedDraftSave(() => new Promise(done => { resolve = done; })).then(() => { complete = true; });
  await Promise.resolve();
  assert.equal(complete, false);
  resolve({ message: 'Saved' });
  await pending;
  assert.equal(complete, true);
  const reviewer = readFileSync(new URL('../src/features/faculty-appraisal/forms/CreativeSchool/CreativeSchoolAppraisalForm.jsx', import.meta.url), 'utf8');
  assert.ok(reviewer.includes('if (!await handleSaveDraft()) return;'));
  const faculty = readFileSync(new URL('../src/features/faculty-appraisal/forms/CreativeSchool/CreativeMyAppraisalSection.jsx', import.meta.url), 'utf8');
  assert.ok(faculty.includes('if (navigateNext && nextSection)'));
  console.log('PASS: offline, network/timeout errors, failed/malformed acknowledgements, confirmed saves, pending saves and navigation guards.');
} finally {
  if (original) Object.defineProperty(globalThis, 'navigator', original);
  else delete globalThis.navigator;
}
