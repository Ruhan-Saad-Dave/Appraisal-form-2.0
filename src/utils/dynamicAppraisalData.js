// Detect saved custom sections, not the school's mutable current assignment.
// This key format is present in the supplied submitted-appraisal response.
export const isDynamicAppraisalForm = (form) => Boolean(form && typeof form === 'object'
  && Object.entries(form).some(([key, value]) => /^custom_.+_s_.+/.test(key)
    && value !== null && typeof value === 'object'));

export const submittedDynamicForm = (response) => response?.payload?.form || response?.form;

export function dynamicReviewForm(subject) {
  const sources = [subject?.previousYearResponse?.payload?.form, subject?.previousYearResponse?.form,
    subject?.payload?.form, subject?.form, subject];
  return sources.find(isDynamicAppraisalForm) || null;
}

export function readDynamicAppraisalResponse(response) {
  const form = submittedDynamicForm(response);
  if (!isDynamicAppraisalForm(form)) throw new Error('The response does not contain a dynamic appraisal.');
  // Preserve all keys, empty tables, answers, schema metadata (when supplied),
  // and score summaries verbatim. Never apply built-in aliases or scoring.
  return response;
}
