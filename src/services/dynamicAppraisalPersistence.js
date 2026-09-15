import { api } from './api';
import { getReviewChain, pendingStatusFor } from '../utils/hierarchy';
import { filesForDocValue } from '../utils/appraisalFormUtils';

const documents = (docs = {}) => {
  if (!docs || typeof docs !== 'object' || Array.isArray(docs)) return {};
  return Object.fromEntries(Object.entries(docs).map(([key, value]) => [key, filesForDocValue(value).map((file) => {
    if (!file) return null;
    if (typeof file === 'string') return { url: file, name: file.split('/').pop() || 'Document' };
    const url = file.url || file.file_url || file.fileUrl || file.path || file.location || file.document_url || file.documentUrl;
    if (!url) return null;
    return { ...file, url,
      name: file.name || file.file_name || file.fileName || file.original_name || file.originalName || url.split('/').pop() || 'Document',
      type: file.type || file.file_type || file.fileType || file.mime_type || file.mimeType || '',
      publicId: file.publicId || file.public_id || file.storage_path || file.storagePath || file.path || null,
    };
  }).filter(Boolean)]).filter(([, files]) => files.length > 0));
};
const validateScope = ({ facultyEmail, academicYear }) => {
  if (!facultyEmail) throw new Error('Please login again. Your email was not found in this session.');
  if (!academicYear) throw new Error('Academic year is required.');
};

export async function loadDynamicAppraisalSnapshot({ facultyEmail, academicYear }) {
  validateScope({ facultyEmail, academicYear });
  try {
    const data = await api.get('/appraisal/snapshot', { params: { academic_year: academicYear } });
    return data?.payload ?? data ?? null;
  } catch (error) {
    if ((error?.statusCode || error?.response?.status || error?.status) === 404) return null;
    throw error;
  }
}

export async function saveDynamicAppraisalDraft({ facultyEmail, academicYear, form, docs = {}, totals = {}, submitterProfile, sectionSaveStatus = {} }) {
  validateScope({ facultyEmail, academicYear });
  return api.put('/appraisal/snapshot', {
    academic_year: academicYear,
    payload: { form: { ...form, sectionSaveStatus }, totals, submitterProfile, savedAt: new Date().toISOString() },
    docs: documents(docs),
  });
}

export async function submitDynamicAppraisal({ facultyEmail, academicYear, form, totals = {}, docs = {}, submitterProfile, activeProfile }) {
  validateScope({ facultyEmail, academicYear });
  const profile = submitterProfile || activeProfile || {};
  const chain = getReviewChain(profile);
  const nextReviewer = chain[0] || '';
  const status = nextReviewer ? pendingStatusFor(nextReviewer) : 'Submitted';
  const normalizedDocs = documents(docs);
  await api.put('/appraisal/snapshot', {
    academic_year: academicYear,
    payload: { form, totals, submitterProfile: profile, submittedAt: new Date().toISOString(), submitted: true },
    docs: normalizedDocs,
  });
  // Send custom keys exactly as stored. Never retry using Standard/Creative
  // field mappings, legacy totals, or a payload without the approval chain.
  return api.post('/appraisal/submit', {
    academic_year: academicYear, form, totals, docs: normalizedDocs,
    submitter_profile: profile, status, workflow_status: status,
    next_reviewer: nextReviewer, next_reviewer_role: nextReviewer, review_chain: chain,
  });
}
