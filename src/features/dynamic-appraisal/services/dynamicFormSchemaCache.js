// ETag/304-coordinated cache for GET /appraisal/form-schema, scoped entirely to
// the dynamic-appraisal module (the faculty-side custom-schema form and its
// review panel). Standard and Creative School forms fetch schema through their
// own separate code paths and are completely untouched by this file.
//
// Mirrors the caching contract from the backend team's "Form Schema Hashing &
// Caching" guide: an in-memory Map for the current session/tab, backed by
// localStorage across reloads, coordinated with the backend's ETag + HTTP 304
// Not Modified support. Deliberately returns the RAW records array exactly as
// the backend sends it — with NO field/section normalization — because
// src/utils/schemaPreview.js's buildSchemaPreview() already does its own strict
// normalization of these same raw records; pre-normalizing here would conflict
// with that rather than complement it.
//
// Degrades safely if the backend doesn't (yet) send an ETag: no cached etag
// means no If-None-Match header is sent, so every request just gets a normal
// 200 response — identical to today's uncached behavior, never broken.
import { apiClient } from '../../../services/api';

const SCHEMA_CACHE = new Map();

const readStorage = (key) => {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota exceeded / private-mode storage disabled — the in-memory Map still
    // caches for the rest of this session, so this is a soft degrade only.
  }
};

export function clearDynamicFormSchemaCache() {
  SCHEMA_CACHE.clear();
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('dynamic_appraisal_schema_') || key.startsWith('dynamic_appraisal_etag_')) localStorage.removeItem(key);
    });
  } catch {
    // ignore
  }
}

/**
 * @param {object} options
 * @param {string} [options.formFamily] - Pass explicitly whenever the caller is
 *   NOT resolving the family from their own session school (e.g. a reviewer
 *   looking up a subject's schema) — see the note in DynamicAuthorityReviewPanel.jsx
 *   about why relying on the backend's caller-side default resolution is wrong
 *   for that case. Omit it when fetching the current session's own assigned form.
 * @param {string} options.academicYear
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Array>} the raw schema records array, unnormalized.
 */
const readSessionIdentity = () => {
  try {
    return sessionStorage.getItem('school') || sessionStorage.getItem('username') || sessionStorage.getItem('email') || '';
  } catch {
    return '';
  }
};

export async function fetchDynamicFormSchema({ formFamily, academicYear, signal } = {}) {
  // When formFamily isn't given explicitly, the backend resolves it server-side
  // from the CALLER's own session school — so the cache key must fold in that
  // same session identity here too. Without this, localStorage's schema/ETag
  // cache would be shared across different users on the same browser (a shared
  // machine, or logging out and back in as someone else without a full page
  // reload) and could serve one user's school's schema to another's.
  const cacheKey = `${formFamily || `auto-${readSessionIdentity() || 'anon'}`}__${academicYear || 'current'}`;
  const storageKey = `dynamic_appraisal_schema_${cacheKey}`;
  const etagKey = `dynamic_appraisal_etag_${cacheKey}`;

  if (SCHEMA_CACHE.has(cacheKey)) return SCHEMA_CACHE.get(cacheKey);

  let cachedRecords = null;
  let cachedEtag = null;
  try {
    const cachedStr = readStorage(storageKey);
    cachedEtag = readStorage(etagKey);
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      if (Array.isArray(parsed)) cachedRecords = parsed;
    }
  } catch {
    // malformed cache entry — treat as a miss
  }

  try {
    const params = { academic_year: academicYear };
    if (formFamily) params.form_family = formFamily;
    const headers = {};
    if (cachedEtag && cachedRecords) headers['If-None-Match'] = cachedEtag;

    const response = await apiClient.get('/appraisal/form-schema', {
      params,
      headers,
      signal,
      validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
    });

    if (response.status === 304 && cachedRecords) {
      SCHEMA_CACHE.set(cacheKey, cachedRecords);
      return cachedRecords;
    }

    if (response.status === 200 && Array.isArray(response.data)) {
      const records = response.data;
      const newEtag = response.headers?.etag || response.headers?.ETag;
      SCHEMA_CACHE.set(cacheKey, records);
      writeStorage(storageKey, JSON.stringify(records));
      if (newEtag) writeStorage(etagKey, newEtag);
      return records;
    }
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') throw err;
    if (cachedRecords) {
      SCHEMA_CACHE.set(cacheKey, cachedRecords);
      return cachedRecords;
    }
    throw err;
  }

  if (cachedRecords) {
    SCHEMA_CACHE.set(cacheKey, cachedRecords);
    return cachedRecords;
  }
  throw new Error('Unsupported schema response.');
}
