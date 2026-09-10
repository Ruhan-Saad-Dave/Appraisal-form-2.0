import { api } from "./api";
import { fetchSavedAppraisal } from "./appraisalPersistence";
import { getActiveAcademicYear } from "../auth/session";
import { APP_INFO } from "../constants/formConfig";
import {
  canAuthorityReviewProfile,
  departmentHasHod,
  getSchoolKey,
  getReviewChain,
  isRejectedStatus,
  PART_D_STATUSES,
  pendingStatusFor,
  rejectedStatusFor,
  profileFromsessionStorage,
  reviewedStatusFor,
  roleLabel,
  normalizeRoleForWorkflow,
} from "../utils/hierarchy";
import { standardReviewSummary, standardSubmittedScoreSummary } from "../utils/reviewSummaryTotals";
import { isLegacyTwoPartAcademicYear, legacySubmittedTotals } from "../features/faculty-appraisal/forms/standard/legacyPreviousYearReportUtils";

// enrichQueueItemDocs fans out up to 2 requests per queue item. For a small department that's
// fine in parallel, but VC's queue spans the whole university (100+ people) - firing all of them
// at once floods the backend and each individual request slows down waiting behind the pile-up.
// Capping concurrency lets requests actually complete at normal speed instead of queueing.
const ENRICHMENT_CONCURRENCY = 6;
const mapWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  const lane = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, lane));
  return results;
};

// Short-lived cache for the two enrichment calls (doc list, full submitted appraisal). VC's
// dashboard polls the same queue every few seconds to stay live - without this, every poll
// re-fetched every person's documents and submission from scratch, even when nothing changed.
const ENRICHMENT_CACHE_TTL_MS = 60000;
const enrichmentCache = new Map();
const withEnrichmentCache = async (kind, email, academicYear, fetcher) => {
  const key = `${kind}::${academicYear}::${email}`;
  const cached = enrichmentCache.get(key);
  if (cached && Date.now() - cached.time < ENRICHMENT_CACHE_TTL_MS) {
    return cached.value;
  }
  const value = await fetcher();
  enrichmentCache.set(key, { value, time: Date.now() });
  return value;
};

const n = (value) => parseFloat(value) || 0;
const clean = (value) => String(value ?? "").trim();
const lower = (value) => clean(value).toLowerCase();
const normalizeStatusText = (value) =>
  lower(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const firstValue = (...values) =>
  values.find((value) => clean(value) !== "") ?? "";

const numberValue = (...values) => n(firstValue(...values));

const docCountFromValue = (value, item = {}) => {
  const countKeys = new Set([
    "doc_count",
    "docCount",
    "docs_count",
    "docsCount",
    "document_count",
    "documentCount",
    "documents_count",
    "documentsCount",
    "uploaded_docs_count",
    "uploadedDocsCount",
    "supporting_documents_count",
    "supportingDocumentsCount",
  ]);
  const fileLocatorKeys = [
    "url",
    "file_url",
    "fileUrl",
    "document_url",
    "documentUrl",
    "path",
    "location",
    "storage_path",
    "storagePath",
    "public_id",
    "publicId",
  ];
  const fileNameKeys = [
    "file_name",
    "fileName",
    "filename",
    "original_name",
    "originalName",
    "name",
  ];
  const isFileReference = (src) => {
    const fileRef = clean(src);
    return /^(https?:|blob:|data:)/i.test(fileRef) || /[\\/]/.test(fileRef) || /\.[a-z0-9]{2,8}($|[?#])/i.test(fileRef);
  };
  const hasFileMimeType = (src) =>
    ["type", "file_type", "fileType", "mime_type", "mimeType"].some((key) =>
      /^(image|application|text|video|audio)\//i.test(clean(src?.[key]))
    );
  const hasFileIdentity = (src) => {
    if (!src || typeof src !== "object") return false;
    const hasLocator = fileLocatorKeys.some((key) => clean(src?.[key]) !== "");
    const hasFileName = fileNameKeys.some((key) => clean(src?.[key]) !== "");
    return hasLocator || fileNameKeys.some((key) => isFileReference(src?.[key])) || (hasFileName && hasFileMimeType(src));
  };
  const ignoredFileMetaKeys = new Set([...fileLocatorKeys, ...fileNameKeys, "type", "file_type", "fileType", "mime_type", "mimeType", "size", "file_size", "fileSize", "lastModified"]);

  const parseNum = (v) => {
    if (v === undefined || v === null || v === "") return 0;
    const parsed = n(v);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const explicit = Math.max(
    parseNum(item?.docCount),
    parseNum(item?.doc_count),
    parseNum(item?.docsCount),
    parseNum(item?.docs_count),
    parseNum(item?.documentCount),
    parseNum(item?.document_count),
    parseNum(item?.documentsCount),
    parseNum(item?.documents_count),
    parseNum(item?.uploadedDocsCount),
    parseNum(item?.uploaded_docs_count),
    parseNum(item?.payload?.docCount),
    parseNum(item?.payload?.doc_count),
    parseNum(typeof value === "object" ? value?.docCount : null),
    parseNum(typeof value === "object" ? value?.doc_count : null),
    parseNum(typeof value === "object" ? value?.docsCount : null),
    parseNum(typeof value === "object" ? value?.docs_count : null)
  );

  if (typeof value === "number") return explicit;
  if (typeof value === "string") return Math.max(isFileReference(value) ? 1 : 0, explicit);
  if (Array.isArray(value)) {
    const actual = value.reduce((total, entry) => total + docCountFromValue(entry), 0);
    return actual > 0 ? actual : explicit;
  }
  if (!value || typeof value !== "object") return explicit;

  const mapCount = Object.entries(value).reduce((total, [key, entry]) => {
    if (countKeys.has(key) || ignoredFileMetaKeys.has(key)) return total;
    return total + docCountFromValue(entry);
  }, 0);

  const actual = Math.max(hasFileIdentity(value) ? 1 : 0, mapCount);
  return actual > 0 ? actual : explicit;
};

const documentSourcesFromItem = (item = {}) => [
    item.docs,
    item.payload?.docs,
    item.payload?.form?.docs,
    item.form?.docs,
    item.documents,
    item.appraisal_documents,
    item.appraisalDocuments,
    item.payload?.documents,
    item.payload?.appraisal_documents,
    item.payload?.appraisalDocuments,
    item.payload?.form?.documents,
    item.payload?.form?.appraisal_documents,
    item.payload?.form?.appraisalDocuments,
    item.form?.documents,
    item.form?.appraisal_documents,
    item.form?.appraisalDocuments,
    item.data?.docs,
    item.data?.documents,
    item.data?.appraisal_documents,
    item.data?.appraisalDocuments,
    item.data?.payload?.docs,
    item.data?.payload?.documents,
    item.data?.payload?.appraisal_documents,
    item.data?.payload?.appraisalDocuments,
  ];

const docsForQueueCard = (item = {}) => {
  const validSources = documentSourcesFromItem(item)
    .filter((source) => docCountFromValue(source) > 0)
    .sort((a, b) => docCountFromValue(b) - docCountFromValue(a));

  if (validSources.length > 0) {
    return validSources[0];
  }

  const explicitCount = firstValue(
    item.doc_count,
    item.docCount,
    item.docs_count,
    item.docsCount,
    item.document_count,
    item.documentCount,
    item.documents_count,
    item.documentsCount,
    item.uploaded_docs_count,
    item.uploadedDocsCount,
    item.supporting_documents_count,
    item.supportingDocumentsCount,
    item.payload?.doc_count,
    item.payload?.docCount,
    item.payload?.documents_count,
    item.payload?.documentsCount,
  );
  if (explicitCount !== "") return n(explicitCount);

  return item.docs || item.payload?.docs || {};
};

const enrichQueueItemDocs = async (item = {}) => {
  if (!item.email || !item.academicYear) return item;

  // normalizeQueueItem() above already derives self/hod/director/dean totals - including via
  // the legacy score_summary reader - from the lightweight /dashboard/subordinates response, and
  // most items already carry an accurate doc count from that same response. Re-fetching this
  // person's full saved appraisal (and their doc list) for *every* item in the queue, every time,
  // was the main reason switching academic year felt slow - it turned one list request into up
  // to 2 extra network round trips per person, even for people who needed neither. Only pay that
  // cost for people who actually need it: nobody reported any documents yet, or (legacy two-part
  // format only) a reviewer score is still missing after the lightweight pass.
  const currentDocCount = docCountFromValue(item.docs, item);
  const isLegacyYear = isLegacyTwoPartAcademicYear(item.academicYear);
  const missingLegacyScore = isLegacyYear && (n(item.grandTotal) === 0 || n(item.hodTotal) === 0);
  // The same "lightweight response lacks this reviewer's total" gap the legacy check above
  // covers also happens on the current form format - normalizeQueueItem's lightweight pass over
  // /dashboard/subordinates sometimes comes back with hodTotal 0 even though hod actually
  // reviewed. A later-chain reviewer (director/dean/vc) already having a positive total proves
  // the hod stage must be complete (the workflow is chain-gated), so that combination means
  // "missing", not "not yet reviewed" - worth the extra round trip below to recover it from the
  // full submitted record, which already has it (see currentReviewSummary further down).
  const hasDownstreamReviewerScore = n(item.directorTotal) > 0 || n(item.deanTotal) > 0 || n(item.vcTotal) > 0;
  const missingCurrentHodScore = !isLegacyYear && n(item.hodTotal) === 0 && hasDownstreamReviewerScore;
  // /dashboard/subordinates' lightweight pass also sometimes omits Part C/D entirely (unlike
  // Part A/B, which it always carries) - a subject with a positive Part A or B total but a
  // literal-zero Part C or D is therefore "missing", not "genuinely scored zero", and needs the
  // same full-record round trip below (standardSubmittedScoreSummary against the fetched
  // `submitted` record, which has the real uniActs/deptActs/leaveManagement rows) to recover it.
  const missingCurrentPartCOrDScore = !isLegacyYear &&
    (n(item.partATotal) > 0 || n(item.partBTotal) > 0) &&
    (n(item.partCTotal) === 0 || n(item.partDTotal) === 0);
  const missingReviewerScore = missingLegacyScore || missingCurrentHodScore || missingCurrentPartCOrDScore;
  if (currentDocCount > 0 && !missingReviewerScore) {
    return item;
  }

  let enrichedItem = item;

  if (currentDocCount === 0) {
    try {
      const rows = await withEnrichmentCache("docs", item.email, item.academicYear, () =>
        api.get("/appraisal-documents", {
          params: {
            academic_year: item.academicYear,
            faculty_email: item.email,
          },
        })
      );
      const fetchedCount = docCountFromValue(rows);
      if (fetchedCount > 0 && fetchedCount !== currentDocCount) {
        enrichedItem = { ...enrichedItem, docs: rows, docCount: fetchedCount };
      }
    } catch {
      // Fall through to the submitted-form endpoint below.
    }
  }

  if (!missingReviewerScore && docCountFromValue(enrichedItem.docs, enrichedItem) > 0) {
    return enrichedItem;
  }

  try {
    const submitted = await withEnrichmentCache("submitted", item.email, item.academicYear, () =>
      fetchSavedAppraisal({
        facultyEmail: item.email,
        academicYear: item.academicYear,
      })
    );
    const bestSubmittedDocs = docsForQueueCard(submitted);
    const submittedCount = docCountFromValue(bestSubmittedDocs, submitted);
    const currentCount = docCountFromValue(enrichedItem.docs, enrichedItem);
    // The 2025-2026 cycle stored scores under score_summary.{role} rather than the standard
    // partA/.../hodTotal fields normalizeQueueItem reads. This pass overwrites the self score
    // with a fresh standardSubmittedScoreSummary() below, which would silently wipe out that
    // earlier legacy-aware self score - and it's also the only place with the *full* fetched
    // submission (fetchSavedAppraisal), which is needed to recover reviewer totals (hod/
    // director/dean/vc) for this legacy format when the lightweight queue-list item lacked them.
    const legacyTotals = isLegacyTwoPartAcademicYear(item.academicYear)
      ? legacySubmittedTotals(submitted, submitted?.declaration, submitted?.totals, submitted?.payload, submitted?.payload?.totals, submitted?.payload?.form, submitted?.form, submitted?.info, submitted?.payload?.declaration)
      : null;
    const submittedSummary = legacyTotals
      ? {
          partA: n(legacyTotals.partA),
          partB: n(legacyTotals.partB),
          partC: 0,
          partD: 0,
          total: n(legacyTotals.grand ?? (n(legacyTotals.partA) + n(legacyTotals.partB))),
          partAMax: n(legacyTotals.partAMax),
          partBMax: n(legacyTotals.partBMax),
          partCMax: 0,
          partDMax: 0,
          grandMax: n(legacyTotals.grandMax) || 575,
        }
      : standardSubmittedScoreSummary(submitted, standardSubmittedScoreSummary(enrichedItem));
    // Current (non-legacy) format: the lightweight /dashboard/subordinates pass already tries
    // standardReviewSummary on the queue item itself (see normalizeQueueItem), but that response
    // sometimes doesn't carry a reviewer's total even though they reviewed (the gap this whole
    // function exists to patch, per missingCurrentHodScore above). Re-running the same summary
    // reader against the full submitted record recovers it the same way legacyTotals does for
    // the old format.
    const currentReviewSummary = legacyTotals ? null : standardReviewSummary(submitted, submitted?.payload, submitted?.form);
    const recoveredReviewerFields = legacyTotals
      ? {
          hodTotal: numberValue(legacyTotals.hodTotal, enrichedItem.hodTotal),
          hodPartA: numberValue(legacyTotals.hodPartA, enrichedItem.hodPartA),
          hodPartB: numberValue(legacyTotals.hodPartB, enrichedItem.hodPartB),
          hodRemarks: firstValue(legacyTotals.hodRemarks, enrichedItem.hodRemarks),
          directorTotal: numberValue(legacyTotals.directorTotal, enrichedItem.directorTotal),
          directorPartA: numberValue(legacyTotals.directorPartA, enrichedItem.directorPartA),
          directorPartB: numberValue(legacyTotals.directorPartB, enrichedItem.directorPartB),
          directorRemarks: firstValue(legacyTotals.directorRemarks, enrichedItem.directorRemarks),
          deanTotal: numberValue(legacyTotals.deanTotal, enrichedItem.deanTotal),
          deanPartA: numberValue(legacyTotals.deanPartA, enrichedItem.deanPartA),
          deanPartB: numberValue(legacyTotals.deanPartB, enrichedItem.deanPartB),
          deanRemarks: firstValue(legacyTotals.deanRemarks, enrichedItem.deanRemarks),
          vcTotal: numberValue(legacyTotals.vcTotal, enrichedItem.vcTotal),
          vcPartA: numberValue(legacyTotals.vcPartA, enrichedItem.vcPartA),
          vcPartB: numberValue(legacyTotals.vcPartB, enrichedItem.vcPartB),
          vcRemarks: firstValue(legacyTotals.vcRemarks, enrichedItem.vcRemarks),
        }
      : currentReviewSummary
      ? {
          hodTotal: numberValue(currentReviewSummary.hodTotal, enrichedItem.hodTotal),
          hodPartA: numberValue(currentReviewSummary.hodPartA, enrichedItem.hodPartA),
          hodPartB: numberValue(currentReviewSummary.hodPartB, enrichedItem.hodPartB),
          hodPartC: numberValue(currentReviewSummary.hodPartC, enrichedItem.hodPartC),
          hodPartD: numberValue(currentReviewSummary.hodPartD, enrichedItem.hodPartD),
          hodRemarks: firstValue(currentReviewSummary.hodRemarks, enrichedItem.hodRemarks),
          directorTotal: numberValue(currentReviewSummary.directorTotal, enrichedItem.directorTotal),
          directorPartA: numberValue(currentReviewSummary.directorPartA, enrichedItem.directorPartA),
          directorPartB: numberValue(currentReviewSummary.directorPartB, enrichedItem.directorPartB),
          directorPartC: numberValue(currentReviewSummary.directorPartC, enrichedItem.directorPartC),
          directorPartD: numberValue(currentReviewSummary.directorPartD, enrichedItem.directorPartD),
          directorRemarks: firstValue(currentReviewSummary.directorRemarks, enrichedItem.directorRemarks),
          deanTotal: numberValue(currentReviewSummary.deanTotal, enrichedItem.deanTotal),
          deanPartA: numberValue(currentReviewSummary.deanPartA, enrichedItem.deanPartA),
          deanPartB: numberValue(currentReviewSummary.deanPartB, enrichedItem.deanPartB),
          deanPartC: numberValue(currentReviewSummary.deanPartC, enrichedItem.deanPartC),
          deanPartD: numberValue(currentReviewSummary.deanPartD, enrichedItem.deanPartD),
          deanRemarks: firstValue(currentReviewSummary.deanRemarks, enrichedItem.deanRemarks),
          vcTotal: numberValue(currentReviewSummary.vcTotal, enrichedItem.vcTotal),
          vcPartA: numberValue(currentReviewSummary.vcPartA, enrichedItem.vcPartA),
          vcPartB: numberValue(currentReviewSummary.vcPartB, enrichedItem.vcPartB),
          vcPartC: numberValue(currentReviewSummary.vcPartC, enrichedItem.vcPartC),
          vcPartD: numberValue(currentReviewSummary.vcPartD, enrichedItem.vcPartD),
          vcRemarks: firstValue(currentReviewSummary.vcRemarks, enrichedItem.vcRemarks),
        }
      : {};
    const nextItem = {
      ...enrichedItem,
      ...recoveredReviewerFields,
      partATotal: submittedSummary.partA,
      partBTotal: submittedSummary.partB,
      partCTotal: submittedSummary.partC,
      partDTotal: submittedSummary.partD,
      grandTotal: submittedSummary.total,
      selfPartA: submittedSummary.partA,
      selfPartB: submittedSummary.partB,
      selfPartC: submittedSummary.partC,
      selfPartD: submittedSummary.partD,
      selfTotal: submittedSummary.total,
      effectivePartAMax: submittedSummary.partAMax,
      effectivePartBMax: submittedSummary.partBMax,
      effectivePartCMax: submittedSummary.partCMax,
      effectivePartDMax: submittedSummary.partDMax,
      effectiveGrandMax: submittedSummary.grandMax,
      facultyPartAMax: submittedSummary.partAMax,
      facultyPartBMax: submittedSummary.partBMax,
      facultyPartCMax: submittedSummary.partCMax,
      facultyPartDMax: submittedSummary.partDMax,
      facultyTotalMax: submittedSummary.grandMax,
    };
    if (submittedCount > 0 && submittedCount !== currentCount) {
      return { ...nextItem, docs: bestSubmittedDocs, docCount: submittedCount };
    }
    return nextItem;
  } catch {
    return enrichedItem;
  }
};

const initialsFor = (name, fallback = "U") =>
  String(name || fallback)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const profileImageFrom = (item = {}) =>
  firstValue(
    item.profile_picture_url,
    item.profilePictureUrl,
    item.avatar_url,
    item.avatarUrl,
    item.photo_url,
    item.photoUrl,
    item.picture_url,
    item.pictureUrl,
    item.profile?.profile_picture_url,
    item.profile?.profilePictureUrl,
    item.profile?.avatar_url,
    item.profile?.avatarUrl,
    item.facultyProfile?.profile_picture_url,
    item.facultyProfile?.profilePictureUrl,
    item.faculty_profile?.profile_picture_url,
    item.faculty_profile?.profilePictureUrl,
    item.submitterProfile?.profile_picture_url,
    item.submitterProfile?.profilePictureUrl,
    item.submitter_profile?.profile_picture_url,
    item.submitter_profile?.profilePictureUrl,
    item.payload?.submitterProfile?.profile_picture_url,
    item.payload?.submitterProfile?.profilePictureUrl,
    item.payload?.submitter_profile?.profile_picture_url,
    item.payload?.submitter_profile?.profilePictureUrl,
    item.payload?.profile_picture_url,
    item.payload?.profilePictureUrl,
    item.form?.profile_picture_url,
    item.form?.profilePictureUrl,
    item.info?.profile_picture_url,
    item.info?.profilePictureUrl,
  );

const roleColor = (role) =>
  role === "hod" || role === "center_head" ? "#f59e0b"
  : role === "director" ? "#3b82f6"
  : role === "dean" ? "#8b5cf6"
  : "#6366f1";

const getNested = (item, key) =>
  firstValue(
    item?.[key],
    item?.profile?.[key],
    item?.payload?.info?.[key],
    item?.form?.info?.[key],
    item?.info?.[key],
  );

const subjectProfileFromItem = (item = {}) => {
  const role = normalizeRoleForWorkflow(firstValue(
    item.appraisalRole,
    item.appraisal_role,
    item.role,
    item.profile?.appraisal_role,
    item.profile?.role,
    item.payload?.submittedByRole,
    item.form?.submittedByRole,
    item.info?.appraisalRole,
    item.info?.appraisal_role,
    item.info?.role,
  ));

  return {
    ...item,
    email: firstValue(item.email, item.faculty_email, item.facultyEmail, item.username),
    full_name: firstValue(item.name, item.full_name, item.fullName, item.profile?.full_name),
    profile_picture_url: profileImageFrom(item),
    profilePictureUrl: profileImageFrom(item),
    appraisal_role: role,
    role,
    school: firstValue(
      item.school,
      item.school_name,
      item.schoolName,
      item.school_code,
      item.schoolCode,
      item.school_id,
      item.schoolId,
      getNested(item, "school"),
    ),
    department: firstValue(
      item.department,
      item.department_name,
      item.departmentName,
      item.department_code,
      item.departmentCode,
      getNested(item, "department"),
    ),
    designation: firstValue(item.designation, getNested(item, "designation")),
    qualification: firstValue(
      item.qualification,
      item.qual,
      item.educational_qualifications,
      item.educationalQualifications,
      item.profile?.qualification,
      item.facultyProfile?.qualification,
      item.faculty_profile?.qualification,
      item.submitterProfile?.qualification,
      item.submitter_profile?.qualification,
      item.payload?.submitterProfile?.qualification,
      item.payload?.submitter_profile?.qualification,
      getNested(item, "qualification"),
      getNested(item, "qual"),
    ),
    teaching_experience: firstValue(
      item.teaching_experience,
      item.teachingExperience,
      item.experience,
      item.profile?.teaching_experience,
      item.profile?.experience,
      item.facultyProfile?.teaching_experience,
      item.facultyProfile?.experience,
      item.faculty_profile?.teaching_experience,
      item.faculty_profile?.experience,
      item.submitterProfile?.teaching_experience,
      item.submitterProfile?.experience,
      item.submitter_profile?.teaching_experience,
      item.submitter_profile?.experience,
      item.payload?.submitterProfile?.teaching_experience,
      item.payload?.submitterProfile?.experience,
      item.payload?.submitter_profile?.teaching_experience,
      item.payload?.submitter_profile?.experience,
      getNested(item, "teaching_experience"),
      getNested(item, "teachingExperience"),
      getNested(item, "experience"),
    ),
  };
};

const getWorkflowStatus = (item = {}) =>
  firstValue(
    item.status,
    item.workflowStatus,
    item.workflow_status,
    item.declarationStatus,
    item.declaration_status,
    item.declaration?.status,
    item.payload?.status,
    item.form?.status,
  );

const hasSubmittedAppraisal = (item = {}) => {
  if (item.hasSubmittedAppraisal === true) return true;
  if (item.hasSubmittedAppraisal === false) return false;

  const status = normalizeStatusText(getWorkflowStatus(item));
  const chain = getReviewChain(subjectProfileFromItem(item));
  const workflowStatuses = new Set([
    "submitted",
    "pending review",
    "reviewed",
    "completed",
    ...chain.flatMap((role) => [
      normalizeStatusText(pendingStatusFor(role)),
      normalizeStatusText(reviewedStatusFor(role)),
    ]),
  ]);

  const hasWorkflowStatus =
    workflowStatuses.has(status) ||
    status.startsWith("pending ") ||
    status.includes(" reviewed") ||
    status.includes(" approved") ||
    status.includes(" rejected");

  const hasDeclaration = Boolean(clean(firstValue(
    item.declaration_id,
    item.declarationId,
    item.declaration?.id,
    item.declaration?.submitted_at,
    item.submitted_at,
    item.submittedAt,
    item.submittedOn,
    item.payload?.submitted_at,
    item.form?.submitted_at,
  )));

  const hasWorkflowPointers = Boolean(clean(firstValue(
    item.next_reviewer,
    item.nextReviewer,
    item.next_reviewer_role,
    item.nextReviewerRole,
  )));

  const hasPriorReview = ["hod", "center_head", "director", "dean", "vc"].some((role) => hasReviewScore(item, role));

  return hasWorkflowStatus || hasDeclaration || hasWorkflowPointers || hasPriorReview;
};

const hasReviewScore = (item = {}, role) => {
  const reviewSummary = standardReviewSummary(item, item.payload, item.form);
  if (role === "hod" || role === "center_head") {
    return n(reviewSummary.hodTotal) > 0 || Boolean(clean(reviewSummary.hodRemarks));
  }

  if (role === "director") {
    return n(reviewSummary.directorTotal) > 0 || Boolean(clean(reviewSummary.directorRemarks));
  }

  if (role === "dean") {
    return n(reviewSummary.deanTotal) > 0 || Boolean(clean(reviewSummary.deanRemarks));
  }

  if (role === "vc") {
    return n(reviewSummary.vcTotal) > 0 || Boolean(clean(reviewSummary.vcRemarks));
  }

  return false;
};

const rejectedRoleFromStatus = (status, chain = []) => {
  const normalizedStatus = normalizeStatusText(status);
  if (!isRejectedStatus(normalizedStatus)) return "";

  return chain.find((role) => {
    const label = normalizeStatusText(roleLabel(role));
    const key = normalizeStatusText(role);
    return normalizedStatus === normalizeStatusText(rejectedStatusFor(role)) ||
      normalizedStatus.includes(`${label} rejected`) ||
      normalizedStatus.includes(`${key} rejected`);
  }) || "";
};

const activeRejectedRoleFor = (item = {}, chain = []) => {
  const hintedRole = normalizeRoleForWorkflow(firstValue(
    item.reviewer_role,
    item.reviewerRole,
    item.current_reviewer,
    item.current_reviewer_role,
    item.currentReviewerRole,
    item.authority_role,
  ));
  const rejectedDecision = [
    item.decision,
    item.review_decision,
    item.reviewDecision,
    item.review_status,
    item.reviewStatus,
  ].some(isRejectedStatus) || item.rejected === true || item.is_rejected === true;

  if (rejectedDecision && chain.includes(hintedRole)) return hintedRole;

  const statusCandidates = [
    getWorkflowStatus(item),
    item.declarationStatus,
    item.declaration_status,
    item.declaration?.status,
    item.review_status,
    item.reviewStatus,
    item.workflowStatus,
    item.workflow_status,
  ];
  const rejectedRole = statusCandidates
    .map((status) => rejectedRoleFromStatus(status, chain))
    .find(Boolean);

  if (rejectedRole) return rejectedRole;
  return statusCandidates.some(isRejectedStatus) || rejectedDecision ? "unknown" : "";
};

const statusStageIndex = (item = {}, chain = []) => {
  const status = normalizeStatusText(getWorkflowStatus(item));
  if (!status) return null;
  const rejectedRole = activeRejectedRoleFor(item, chain);
  if (rejectedRole) {
    const rejectedIndex = chain.indexOf(rejectedRole);
    return rejectedIndex >= 0 ? rejectedIndex : -1;
  }
  if (status === "submitted" || status === "pending review") return 0;
  if (status === "reviewed" || status === "completed") {
    const scoreStages = chain
      .map((role, index) => hasReviewScore(item, role) ? index + 1 : -1)
      .filter((index) => index >= 0);
    return scoreStages.length ? Math.max(...scoreStages) : chain.length;
  }

  for (let index = 0; index < chain.length; index += 1) {
    const role = chain[index];
    const label = normalizeStatusText(roleLabel(role));
    if (status === normalizeStatusText(pendingStatusFor(role)) || status.includes(`pending ${label}`)) {
      return index;
    }
    if (
      status === normalizeStatusText(reviewedStatusFor(role)) ||
      status.includes(`${label} reviewed`) ||
      status.includes(`${label} approved`)
    ) {
      return index + 1;
    }
  }

  return status.includes("approved") ? chain.length : null;
};

const hasReachedReviewer = (item = {}, reviewerRole) => {
  const role = normalizeRoleForWorkflow(reviewerRole);
  const subjectProfile = subjectProfileFromItem(item);
  const chain = getReviewChain(subjectProfile);
  const reviewerIndex = chain.indexOf(role);

  if (reviewerIndex < 0) return false;

  const stageIndex = statusStageIndex(item, chain);
  const reachedStage = stageIndex !== null
    ? stageIndex >= reviewerIndex
    : (reviewerIndex === 0 || chain.slice(0, reviewerIndex).every((previousRole) => hasReviewScore(item, previousRole)));

  if (!reachedStage) return false;

  // The VC never receives a form - not even to preview - until the Registrar has released
  // Part D (see PART_D_STATUSES/partDReleaseGateApplies in utils/hierarchy.js). Part D is
  // scored by the Registrar independently of the A/B/C/E chain above, so reaching "Pending VC
  // Review" on that chain is not by itself enough - requires backend_changes_requied.md's
  // /dashboard/subordinates part_d_status fix to actually populate item.partDStatus.
  // Legacy two-part years (Part A + B only, no Part D at all) never get a Registrar release -
  // gating those on partDStatus would hide every legacy-year appraisal from the VC forever.
  if (role === "vc" && !isLegacyTwoPartAcademicYear(item.academicYear) && item.partDStatus !== "released") {
    return false;
  }

  return true;
};

const isReviewableForRole = (item = {}, reviewerRole, reviewerProfile = {}) => {
  const role = normalizeRoleForWorkflow(reviewerRole);
  const reviewer = { ...reviewerProfile, appraisal_role: role };
  const subjectProfile = subjectProfileFromItem(item);
  const rejectionRole = activeRejectedRoleFor(item, getReviewChain(subjectProfile));

  if (rejectionRole && rejectionRole !== role) return false;
  if (rejectionRole === "unknown") return false;

  return hasSubmittedAppraisal(item) &&
    canAuthorityReviewProfile(reviewer, subjectProfile) &&
    hasReachedReviewer(item, role);
};

const normalizeQueueItem = (item = {}) => {
  const subjectProfile = subjectProfileFromItem(item);
  const appraisalRole = subjectProfile.appraisal_role;
  const submitted = hasSubmittedAppraisal(item);
  const status = getWorkflowStatus(item) || (submitted ? pendingStatusFor(getReviewChain(subjectProfile)[0]) : "");
  const email = subjectProfile.email;
  const academicYear = firstValue(item.academicYear, item.academic_year, item.info?.ay, getActiveAcademicYear(), APP_INFO.DEFAULT_AY, "2026-2027");
  const school = subjectProfile.school;
  // The 2025-2026 cycle used a legacy two-part form (Part A + Part B only) whose scores are
  // stored under score_summary.{role} rather than the standard partA/partB/partC/partD +
  // hodTotal/directorTotal/... fields read above - without this, review-queue cards for that
  // year (e.g. VC/Director/Dean/HOD dashboards) show a wrong/zeroed self score and blank
  // reviewer scores even though the same data renders correctly on the faculty's own
  // "Previous Year Report" view, which already reads score_summary via legacySubmittedTotals.
  const legacyTotals = isLegacyTwoPartAcademicYear(academicYear)
    ? legacySubmittedTotals(item, item.declaration, item.totals, item.payload, item.payload?.totals, item.payload?.form, item.form, item.info)
    : null;
  const selfSummary = legacyTotals
    ? {
        partA: n(legacyTotals.partA),
        partB: n(legacyTotals.partB),
        partC: 0,
        partD: 0,
        total: n(legacyTotals.grand ?? (n(legacyTotals.partA) + n(legacyTotals.partB))),
        partAMax: n(legacyTotals.partAMax),
        partBMax: n(legacyTotals.partBMax),
        partCMax: 0,
        partDMax: 0,
        grandMax: n(legacyTotals.grandMax) || 575,
      }
    : standardSubmittedScoreSummary(item);
  const reviewSummary = legacyTotals || standardReviewSummary(item, item.payload, item.form);

  return {
    ...item,
    id: firstValue(item.id, item.declaration_id, item.declarationId, `${email}:${academicYear}`),
    email,
    academicYear,
    academic_year: academicYear,
    name: firstValue(item.name, item.full_name, item.fullName, subjectProfile.full_name, email),
    appraisalRole,
    appraisal_role: appraisalRole,
    school,
    schoolCode: getSchoolKey(school),
    department: subjectProfile.department,
    designation: subjectProfile.designation,
    qualification: subjectProfile.qualification,
    qual: subjectProfile.qualification,
    teaching_experience: subjectProfile.teaching_experience,
    experience: subjectProfile.teaching_experience,
    info: {
      ...(item.info || {}),
      name: firstValue(item.info?.name, item.name, item.full_name, item.fullName, subjectProfile.full_name, email),
      qual: firstValue(item.info?.qual, item.info?.qualification, subjectProfile.qualification),
      desig: firstValue(item.info?.desig, item.info?.designation, subjectProfile.designation),
      school: firstValue(item.info?.school, school),
      experience: firstValue(item.info?.experience, item.info?.teaching_experience, subjectProfile.teaching_experience),
      ay: firstValue(item.info?.ay, academicYear),
    },
    status,
    workflowStatus: status,
    docs: docsForQueueCard(item),
    docCount: docCountFromValue(docsForQueueCard(item)),
    hasSubmittedAppraisal: submitted,
    partATotal: selfSummary.partA,
    partBTotal: selfSummary.partB,
    partCTotal: selfSummary.partC,
    partDTotal: selfSummary.partD,
    grandTotal: selfSummary.total,
    selfPartA: selfSummary.partA,
    selfPartB: selfSummary.partB,
    selfPartC: selfSummary.partC,
    selfPartD: selfSummary.partD,
    selfTotal: selfSummary.total,
    effectivePartAMax: selfSummary.partAMax,
    effectivePartBMax: selfSummary.partBMax,
    effectivePartCMax: selfSummary.partCMax,
    effectivePartDMax: selfSummary.partDMax,
    effectiveGrandMax: selfSummary.grandMax,
    facultyPartAMax: numberValue(firstValue(item.faculty_part_a_max, item.facultyPartAMax, selfSummary.partAMax)),
    facultyPartBMax: numberValue(firstValue(item.faculty_part_b_max, item.facultyPartBMax, selfSummary.partBMax)),
    facultyPartCMax: numberValue(firstValue(item.faculty_part_c_max, item.facultyPartCMax, selfSummary.partCMax)),
    facultyPartDMax: numberValue(firstValue(item.faculty_part_d_max, item.facultyPartDMax, selfSummary.partDMax)),
    facultyTotalMax: numberValue(firstValue(item.faculty_total_max, item.facultyTotalMax, selfSummary.grandMax)),
    hodPartAMax: numberValue(firstValue(item.hod_part_a_max, item.center_head_part_a_max, item.hodPartAMax, item.centerHeadPartAMax)),
    hodPartBMax: numberValue(firstValue(item.hod_part_b_max, item.center_head_part_b_max, item.hodPartBMax, item.centerHeadPartBMax)),
    hodPartCMax: numberValue(firstValue(item.hod_part_c_max, item.center_head_part_c_max, item.hodPartCMax, item.centerHeadPartCMax)),
    hodPartDMax: numberValue(firstValue(item.hod_part_d_max, item.center_head_part_d_max, item.hodPartDMax, item.centerHeadPartDMax)),
    hodTotalMax: numberValue(firstValue(item.hod_total_max, item.center_head_total_max, item.hodTotalMax, item.centerHeadTotalMax)),
    directorPartAMax: numberValue(firstValue(item.director_part_a_max, item.directorPartAMax)),
    directorPartBMax: numberValue(firstValue(item.director_part_b_max, item.directorPartBMax)),
    directorPartCMax: numberValue(firstValue(item.director_part_c_max, item.directorPartCMax)),
    directorPartDMax: numberValue(firstValue(item.director_part_d_max, item.directorPartDMax)),
    directorTotalMax: numberValue(firstValue(item.director_total_max, item.directorTotalMax)),
    deanPartAMax: numberValue(firstValue(item.dean_part_a_max, item.deanPartAMax)),
    deanPartBMax: numberValue(firstValue(item.dean_part_b_max, item.deanPartBMax)),
    deanPartCMax: numberValue(firstValue(item.dean_part_c_max, item.deanPartCMax)),
    deanPartDMax: numberValue(firstValue(item.dean_part_d_max, item.deanPartDMax)),
    deanTotalMax: numberValue(firstValue(item.dean_total_max, item.deanTotalMax)),
    vcPartAMax: numberValue(firstValue(item.vc_part_a_max, item.vcPartAMax)),
    vcPartBMax: numberValue(firstValue(item.vc_part_b_max, item.vcPartBMax)),
    vcPartCMax: numberValue(firstValue(item.vc_part_c_max, item.vcPartCMax)),
    vcPartDMax: numberValue(firstValue(item.vc_part_d_max, item.vcPartDMax)),
    vcTotalMax: numberValue(firstValue(item.vc_total_max, item.vcTotalMax)),
    avatar: initialsFor(firstValue(item.name, item.full_name, email), email),
    avatarUrl: profileImageFrom(item),
    profile_picture_url: profileImageFrom(item),
    profilePictureUrl: profileImageFrom(item),
    avatarColor: roleColor(appraisalRole),
    hodTotal: numberValue(reviewSummary.hodTotal),
    hodPartA: numberValue(reviewSummary.hodPartA),
    hodPartB: numberValue(reviewSummary.hodPartB),
    hodPartC: numberValue(reviewSummary.hodPartC),
    hodPartD: numberValue(reviewSummary.hodPartD),
    hodRemarks: firstValue(reviewSummary.hodRemarks),
    directorTotal: numberValue(reviewSummary.directorTotal),
    directorPartA: numberValue(reviewSummary.directorPartA),
    directorPartB: numberValue(reviewSummary.directorPartB),
    directorPartC: numberValue(reviewSummary.directorPartC),
    directorPartD: numberValue(reviewSummary.directorPartD),
    directorRemarks: firstValue(reviewSummary.directorRemarks),
    deanTotal: numberValue(reviewSummary.deanTotal),
    deanPartA: numberValue(reviewSummary.deanPartA),
    deanPartB: numberValue(reviewSummary.deanPartB),
    deanPartC: numberValue(reviewSummary.deanPartC),
    deanPartD: numberValue(reviewSummary.deanPartD),
    deanRemarks: firstValue(reviewSummary.deanRemarks),
    vcTotal: numberValue(reviewSummary.vcTotal),
    vcPartA: numberValue(reviewSummary.vcPartA),
    vcPartB: numberValue(reviewSummary.vcPartB),
    vcPartC: numberValue(reviewSummary.vcPartC),
    vcPartD: numberValue(reviewSummary.vcPartD),
    vcRemarks: firstValue(reviewSummary.vcRemarks),
    // Part D routes to the Registrar independently of the A/B/C/E chain above - see
    // partDReleaseGateApplies in utils/hierarchy.js and backend_changes_requied.md.
    partDStatus: firstValue(item.part_d_status, item.partDStatus),
    registrarPartDScore: numberValue(firstValue(item.registrar_part_d_score, item.registrarPartDScore, item.registrar_part_d, item.registrarPartD, reviewSummary.registrarPartDScore, reviewSummary.registrarPartD)),
    registrarPartDRemarks: firstValue(item.registrar_part_d_remarks, item.registrarPartDRemarks, item.registrar_remarks, item.registrarRemarks, reviewSummary.registrarPartDRemarks, reviewSummary.registrarRemarks),
    registrarPartDReviewedAt: firstValue(item.registrar_part_d_reviewed_at, item.registrarPartDReviewedAt),
    hasRegistrarPartDScore: Boolean(
      item.has_registrar_part_d_score ||
      item.hasRegistrarPartDScore ||
      item.registrar_part_d_reviewed_at ||
      item.registrarPartDReviewedAt ||
      firstValue(item.registrar_part_d_score, item.registrarPartDScore, item.registrar_part_d, item.registrarPartD, reviewSummary.registrarPartDScore, reviewSummary.registrarPartD) !== ""
    ),
    registrarPartDLeaveManagement: item.registrar_part_d_leave_management || item.registrarPartDLeaveManagement || reviewSummary.registrarPartDLeaveManagement,
    leaveManagement: item.registrar_part_d_leave_management || item.registrarPartDLeaveManagement || reviewSummary.registrarPartDLeaveManagement || item.leaveManagement || item.leave_management || (item.payload?.form?.leaveManagement) || [],
  };
};

// enrichQueueItemDocs does up to 2 extra network round trips per person (see its own comment).
// Blocking the whole queue on Promise.all-ing that for every item is fine for a department-sized
// list, but for a role like VC whose queue spans the entire university (100+ people, worst on a
// legacy year where most items still need the fallback), it turns "load the queue" into hundreds
// of requests racing each other before a single row can render - which is what actually made
// switching to the 2025-2026 academic year feel stuck. When callers pass onItemReady, this returns
// the lightweight (fast) list immediately and enriches each item in the background, calling
// onItemReady as each one resolves so the caller can patch just that row in place. Callers that
// don't pass onItemReady keep the original blocking behavior unchanged.
export const fetchReviewQueueForRole = async ({
  reviewerRole,
  reviewerProfile = profileFromsessionStorage(),
  academicYear,
  schoolValues = [],
  onItemReady,
  isStale,
  lazy = false,
} = {}) => {
  const role = normalizeRoleForWorkflow(reviewerRole || reviewerProfile.appraisal_role || reviewerProfile.role);
  if (!role || role === "faculty") return [];

  try {
    const params = {
      academic_year: academicYear || getActiveAcademicYear() || APP_INFO.DEFAULT_AY || "2026-2027",
      reviewer_role: role,
      pending_status: pendingStatusFor(role),
    };
    if (schoolValues?.length) params.schools = schoolValues.join(",");
    if (reviewerProfile?.school) params.reviewer_school = reviewerProfile.school;
    // HOD can be assigned multiple departments/programs at once (see New_backend.md), so a single
    // reviewer_department would wrongly narrow the server-side query to just their first one -
    // fetch school-wide instead and let isReviewableForRole's array-aware check (below) filter.
    if (role !== "hod" && reviewerProfile?.department) params.reviewer_department = reviewerProfile.department;

    const items = await api.get("/dashboard/subordinates", { params });
    const normalizedItems = (items || [])
      .map(normalizeQueueItem)
      .filter((item) => isReviewableForRole(item, role, reviewerProfile));

    // lazy: don't enrich anything up front - the caller enriches one card at a time via
    // enrichQueueItem, triggered as each card actually scrolls into view (see LazyVisible).
    // For a queue spanning the whole university, this is the only way to avoid paying the
    // enrichment cost for people the reviewer never scrolls down to.
    if (lazy) return normalizedItems;

    if (onItemReady) {
      mapWithConcurrency(normalizedItems, ENRICHMENT_CONCURRENCY, async (item) => {
        try {
          const enriched = await enrichQueueItemDocs(item);
          if (!isStale?.()) onItemReady(enriched);
        } catch {
          // enrichQueueItemDocs already falls back internally on its own errors.
        }
      });
      return normalizedItems;
    }

    return await mapWithConcurrency(normalizedItems, ENRICHMENT_CONCURRENCY, enrichQueueItemDocs);
  } catch (err) {
    throw new Error(err?.message || "Could not load review queue.", { cause: err });
  }
};

// Enriches a single queue item on demand (doc count, and for legacy years, reviewer totals).
// Used by dashboards for viewport-triggered (lazy) enrichment - see LazyVisible.
export const enrichQueueItem = (item) => enrichQueueItemDocs(item);

// Part D (Leave & Attendance) is scored only by the Registrar, for every teaching-staff
// originator (Faculty/HOD/Director/Dean/Center Head, any school) - independent of the
// A/B/C/E chain, which never routes Part D to HOD/Director/Dean. See
// partDReleaseGateApplies / PART_D_STATUSES in utils/hierarchy.js and backend_changes_requied.md.
export const fetchPartDRegistrarQueue = async ({ academicYear } = {}) => {
  try {
    const params = {
      academic_year: academicYear || getActiveAcademicYear() || APP_INFO.DEFAULT_AY || "2026-2027",
      part_d_status: PART_D_STATUSES.PENDING_REGISTRAR,
    };
    const items = await api.get("/dashboard/part-d-queue", { params });
    const normalizedItems = (items || []).map(normalizeQueueItem);
    return await Promise.all(normalizedItems.map(enrichQueueItemDocs));
  } catch (err) {
    throw new Error(err?.message || "Could not load Part D review queue.", { cause: err });
  }
};

export const submitPartDRegistrarReview = async ({
  subjectEmail,
  academicYear,
  score = 0,
  remarks = "",
  leaveManagement,
  leave_management,
}) => {
  if (!subjectEmail) {
    throw new Error("Missing subject email for Part D review.");
  }

  const payload = {
    registrar_part_d_score: n(score),
    remarks: remarks || "",
    academic_year: academicYear || getActiveAcademicYear() || APP_INFO.DEFAULT_AY || "2026-2027",
  };
  const leaveRows = leaveManagement || leave_management;
  if (Array.isArray(leaveRows)) {
    payload.leave_management = leaveRows;
  }

  return await api.post(`/dashboard/part-d-release/${encodeURIComponent(subjectEmail)}`, payload);
};

const workflowForwardingFor = (role, subjectProfile = {}) => {
  const chain = getReviewChain(subjectProfile);
  const reviewerIndex = chain.indexOf(role);
  const fallbackNextReviewer = {
    hod: "director",
    center_head: "vc",
    director: "dean",
    dean: "vc",
  }[role] || "";
  const nextReviewer = reviewerIndex >= 0 ? chain[reviewerIndex + 1] : fallbackNextReviewer;
  const status = nextReviewer ? pendingStatusFor(nextReviewer) : reviewedStatusFor(role);
  // Dean/Center Head is always the last stage before VC when present (see getReviewChain) -
  // their approval is what the Part D release gate waits on (see PART_D_STATUSES).
  const isFinalPreVcStage = (role === "dean" || role === "center_head") && nextReviewer === "vc";

  return {
    status,
    workflow_status: status,
    review_status: reviewedStatusFor(role),
    next_reviewer: nextReviewer,
    next_reviewer_role: nextReviewer,
    ...(isFinalPreVcStage ? { release_part_d_if_pending: true } : {}),
  };
};

const workflowRejectionFor = (role) => {
  const status = rejectedStatusFor(role);
  return {
    status,
    declaration_status: status,
    workflow_status: status,
    review_status: status,
    next_reviewer: null,
    next_reviewer_role: null,
    nextReviewer: null,
    nextReviewerRole: null,
    next_reviewer_email: null,
    nextReviewerEmail: null,
    decision: "rejected",
    action: "reject",
    review_decision: "rejected",
    is_rejected: true,
    rejected: true,
    should_forward: false,
    forward: false,
    forwarded: false,
    advance_workflow: false,
    advanceWorkflow: false,
    stop_workflow: true,
    stopWorkflow: true,
  };
};

const rejectionRoleHintsFor = (role) => ({
  reviewer_role: role,
  reviewerRole: role,
  current_reviewer: role,
  current_reviewer_role: role,
  currentReviewerRole: role,
  authority_role: role,
  role,
});

const draftRoleFor = (reviewerRole) => {
  const rawRole = lower(reviewerRole).replace(/[\s-]+/g, "_");
  if (rawRole === "section_head") return "section_head";
  return normalizeRoleForWorkflow(rawRole);
};

const backendErrorDetails = (err) => ({
  status: err?.statusCode || err?.response?.status || null,
  message: err?.message || "",
  detail: err?.response?.data?.detail || err?.response?.data?.error || err?.response?.data?.message || "",
  data: err?.response?.data || null,
});

const removeLegacyLocalReviewerDrafts = () => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("facultyAppraisal:reviewerDraft:"))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore storage access failures; server-side draft saving remains authoritative.
  }
};

export const loadReviewerDraft = async ({
  subjectEmail,
  academicYear,
  reviewerRole,
} = {}) => {
  removeLegacyLocalReviewerDrafts();
  const role = draftRoleFor(reviewerRole);
  if (!subjectEmail || !academicYear || !role || role === "faculty") {
    return { payload: null, updated_at: null };
  }

  return await api.get(`/appraisal-remarks/draft/${encodeURIComponent(subjectEmail)}`, {
    params: {
      academic_year: academicYear,
      reviewer_role: role,
    },
  }) || { payload: null, updated_at: null };
};

export const saveReviewerDraft = async ({
  subjectEmail,
  academicYear,
  reviewerRole,
  partAScore = 0,
  partBScore = 0,
  partCScore = 0,
  partDScore = 0,
  totalScore = 0,
  remarks = "",
  sectionScores,
  payload,
} = {}) => {
  const role = draftRoleFor(reviewerRole);
  if (!subjectEmail || !academicYear || !role || role === "faculty") {
    throw new Error("Missing reviewer draft details.");
  }

  const draftPayload = payload || {
    part_a_score: n(partAScore),
    part_b_score: n(partBScore),
    part_c_score: n(partCScore),
    part_d_score: n(partDScore),
    total_score: n(totalScore),
    remarks,
    section_scores: sectionScores || {},
  };
  const draftBody = {
    academic_year: academicYear,
    reviewer_role: role,
    payload: draftPayload,
  };
  const draftUrl = `/appraisal-remarks/draft/${encodeURIComponent(subjectEmail)}`;

  try {
    return await api.put(draftUrl, draftBody) || {};
  } catch (err) {
    console.error("Reviewer draft backend save failed.", backendErrorDetails(err));
    throw err;
  }
};

const workflowHierarchyHintsFor = (role, subjectProfile = {}) => {
  const chain = getReviewChain(subjectProfile);
  const reviewerIndex = chain.indexOf(role);
  const previousReviewer = reviewerIndex > 0 ? chain[reviewerIndex - 1] : "";
  const firstReviewer = chain[0] || "";
  const schoolKey = getSchoolKey(subjectProfile.school);
  const hasHod = departmentHasHod(subjectProfile.school, subjectProfile.department);

  return {
    review_chain: chain,
    workflow_chain: chain,
    reviewChain: chain,
    workflowChain: chain,
    current_reviewer: role,
    current_reviewer_role: role,
    currentReviewer: role,
    currentReviewerRole: role,
    first_reviewer: firstReviewer,
    first_reviewer_role: firstReviewer,
    firstReviewer,
    firstReviewerRole: firstReviewer,
    is_first_reviewer: !previousReviewer,
    isFirstReviewer: !previousReviewer,
    previous_reviewer: previousReviewer || null,
    previous_reviewer_role: previousReviewer || null,
    previousReviewer: previousReviewer || null,
    previousReviewerRole: previousReviewer || null,
    previous_review_required: Boolean(previousReviewer),
    previousReviewRequired: Boolean(previousReviewer),
    skip_previous_review: !previousReviewer,
    skipPreviousReview: !previousReviewer,
    bypass_previous_review: !previousReviewer,
    bypassPreviousReview: !previousReviewer,
    allow_missing_previous_review: !previousReviewer,
    allowMissingPreviousReview: !previousReviewer,
    school_code: schoolKey,
    subject_school_code: schoolKey,
    subjectSchoolCode: schoolKey,
    has_hod: hasHod,
    hasHod,
    hod_required: hasHod,
    hodRequired: hasHod,
    requires_hod: hasHod,
    requiresHod: hasHod,
    skip_hod: !hasHod,
    skipHod: !hasHod,
    skip_hod_review: !hasHod,
    skipHodReview: !hasHod,
    no_hod: !hasHod,
    noHod: !hasHod,
    direct_to_director: !hasHod && role === "director",
    directToDirector: !hasHod && role === "director",
    allow_missing_hod_review: !hasHod && role === "director",
    allowMissingHodReview: !hasHod && role === "director",
    subject_profile: {
      email: firstValue(subjectProfile.email, subjectProfile.faculty_email, subjectProfile.facultyEmail),
      appraisal_role: normalizeRoleForWorkflow(subjectProfile.appraisal_role || subjectProfile.appraisalRole || subjectProfile.role),
      school: subjectProfile.school,
      school_code: schoolKey,
      schoolCode: schoolKey,
      department: subjectProfile.department,
      has_hod: hasHod,
      hasHod,
      hod_required: hasHod,
      hodRequired: hasHod,
      skip_hod: !hasHod,
      skipHod: !hasHod,
      no_hod: !hasHod,
      noHod: !hasHod,
      review_chain: chain,
      reviewChain: chain,
    },
  };
};

export const submitWorkflowReview = async ({
  subjectEmail,
  academicYear,
  reviewerRole,
  partAScore = 0,
  partBScore = 0,
  partCScore = 0,
  partDScore = 0,
  totalScore = 0,
  remarks = "",
  sectionScores,
  subjectProfile,
  decision = "approved",
}) => {
  const role = normalizeRoleForWorkflow(reviewerRole);

  const endpointMap = {
    hod: "hod",
    center_head: "center-head",
    director: "director",
    dean: "dean",
    vc: "final",
  };

  const endpoint = endpointMap[role];
  if (!endpoint) {
    throw new Error(`Unknown reviewer role: ${role}`);
  }

  const basePayload = {
    academic_year: academicYear,
    remarks,
    part_a_score: n(partAScore),
    part_b_score: n(partBScore),
    part_c_score: n(partCScore),
    part_d_score: n(partDScore),
    total_score: n(totalScore),
    section_scores: sectionScores || {},
  };
  const endpointUrl = `/appraisal-remarks/${endpoint}/${encodeURIComponent(subjectEmail)}`;
  const rejected = decision === "rejected";
  const forwarding = rejected ? workflowRejectionFor(role) : workflowForwardingFor(role, subjectProfile || {});
  const hierarchyHints = workflowHierarchyHintsFor(role, subjectProfile || {});

  if (rejected) {
    const roleHints = rejectionRoleHintsFor(role);
    return await api.put(endpointUrl, {
      ...basePayload,
      ...roleHints,
      ...forwarding,
      ...hierarchyHints,
      rejected_by: role,
      rejectedBy: role,
      rejection_reason: remarks,
      rejectionReason: remarks,
    }) || {};
  }

  if (role === "vc") {
    return await api.put(endpointUrl, basePayload) || {};
  }

  let result;
  try {
    result = await api.put(endpointUrl, { ...basePayload, ...forwarding, ...hierarchyHints });
  } catch (err) {
    if (rejected) throw err;
    if (![400, 422].includes(err?.response?.status)) throw err;
    result = await api.put(endpointUrl, { ...basePayload, ...hierarchyHints });
  }

  return result || {};
};
