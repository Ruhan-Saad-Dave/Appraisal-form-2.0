import { api } from "./api";
import { storeUserSession } from "../auth/session";
import { getDeanTrack, getReviewChain, normalizeRoleForWorkflow, pendingStatusFor } from "../utils/hierarchy";
import { DEAN_TRACKS } from "../constants/universityHierarchy";
import { attachSubmittedScoreSummary } from "../utils/reviewSummaryTotals";
import { filesForDocValue } from "../utils/appraisalFormUtils";

const SNAPSHOT_SETTERS = {
 info: "setInfo",
 lectures: "setLectures",
 courseFile: "setCourseFile",
 innovRows: "setInnovRows",
 innovDetails: "setInnovDetails",
 innovScore: "setInnovScore",
 innovHod: "setInnovHod",
 innovDirector: "setInnovDirector",
 innovDean: "setInnovDean",
 innovVc: "setInnovVc",
 projects: "setProjects",
 obeRows: "setObeRows",
 mentoringRows: "setMentoringRows",
 quals: "setQuals",
 feedback: "setFeedback",
deptActs: "setDeptActs",
uniActs: "setUniActs",
events: "setEvents",
eventRows: "setEventRows",
society: "setSociety",
industry: "setIndustry",
alumni: "setAlumni",
alumniRows: "setAlumniRows",
placements: "setPlacements",
placementRows: "setPlacementRows",
acr: "setAcr",
 journals: "setJournals",
 popularWritings: "setPopularWritings",
 books: "setBooks",
 ict: "setIct",
 research: "setResearch",
 projects2: "setProjects2",
 internalProjects: "setInternalProjects",
 externalProjects: "setExternalProjects",
 ipr: "setIpr",
 patents: "setPatents",
 awards: "setAwards",
 confs: "setConfs",
 consultancyRows: "setConsultancyRows",
 startupRows: "setStartupRows",
 proposals: "setProposals",
 products: "setProducts",
 fdps: "setFdps",
 training: "setTraining",
 exhibitions: "setExhibitions",
 summaryOtherInfo: "setSummaryOtherInfo",
 sectionSaveStatus: "setSectionSaveStatus",
};

const snapshotFormFromPayload = (payload) =>{
 if (!payload) return null;
 if (payload.form && typeof payload.form === "object") return payload.form;
 if (payload.data && typeof payload.data === "object") return payload.data;
 return null;
};

// Resolve a form field's React setter name. SNAPSHOT_SETTERS is consulted first so any
// deliberate override keeps working unchanged; otherwise the setter name is derived from
// the field name itself (set + Capitalized-first-letter), the same convention every form
// engine already uses for its own state. This means a section whose field name isn't in
// SNAPSHOT_SETTERS (e.g. an engine that names it differently than the table's original
// author expected) still resolves correctly instead of being silently skipped, and any
// future section works without needing a new table entry.
const resolveSnapshotSetterKey = (formKey) =>
 SNAPSHOT_SETTERS[formKey] || `set${formKey.charAt(0).toUpperCase()}${formKey.slice(1)}`;

const applySnapshotToSetters = (snapshotPayload, setters) =>{
 const snapshotForm = normalizeFetchedForm(snapshotFormFromPayload(snapshotPayload));
 if (!snapshotForm || !setters) return;

 Object.keys(snapshotForm).forEach((formKey) =>{
 const setterKey = resolveSnapshotSetterKey(formKey);
 if (formKey === "info") {
 setters[setterKey]?.((current = {}) =>normalizeInfo(snapshotForm[formKey], current, snapshotForm, snapshotPayload));
 } else {
 setters[setterKey]?.(snapshotForm[formKey]);
 }
 });

 if (snapshotPayload?.docs) {
 setters.setDocs?.(normalizeDocsMap(snapshotPayload.docs));
 }
};

const submittedFormFromResponse = (response) =>
 response?.payload?.form || response?.form || null;

const normalizeDocFile = (file) =>{
 if (!file) return null;
 if (typeof file === "string") return { url: file, name: file.split("/").pop() || "Document" };
 const url = file.url || file.file_url || file.fileUrl || file.path || file.location || file.document_url || file.documentUrl;
 if (!url) return null;
 return {
 ...file,
 url,
 name: file.name || file.file_name || file.fileName || file.original_name || file.originalName || url.split("/").pop() || "Document",
 type: file.type || file.file_type || file.fileType || file.mime_type || file.mimeType || "",
 publicId: file.publicId || file.public_id || file.storage_path || file.storagePath || file.path || null,
 };
};

const normalizeDocsMap = (docs = {}) =>{
 if (!docs || typeof docs !== "object" || Array.isArray(docs)) return {};
 return Object.fromEntries(
 Object.entries(docs || {})
 .map(([key, files]) =>[
 key,
 filesForDocValue(files).map(normalizeDocFile).filter(Boolean),
 ])
 .filter(([, files]) =>files.length >0),
 );
};

const normalizeDocFilterValue = (value) =>String(value ?? "").trim().toLowerCase();

const rowMatchesDocumentScope = (row = {}, { facultyEmail = "", academicYear = "" } = {}) =>{
 const targetEmail = normalizeDocFilterValue(facultyEmail);
 const targetYear = normalizeDocFilterValue(academicYear);
 const rowEmail = normalizeDocFilterValue(
 row.faculty_email ?? row.facultyEmail ?? row.email ?? row.user_email ?? row.userEmail ?? row.submitter_email ?? row.submitterEmail
 );
 const rowYear = normalizeDocFilterValue(row.academic_year ?? row.academicYear ?? row.year);

 if (targetEmail && rowEmail && rowEmail !== targetEmail) return false;
 if (targetYear && rowYear && rowYear !== targetYear) return false;
 return true;
};

const docsRowsToMap = (rows = [], scope = {}) =>{
 const groupedDocs = {};
 (rows || []).forEach((row) =>{
 if (!rowMatchesDocumentScope(row, scope)) return;
 const section = row.section || row.doc_section || row.docSection || "";
 const rowNo = row.row_no ?? row.rowNo ?? row.row_number ?? row.rowNumber;
 const key = row.doc_key || row.docKey || row.document_key || row.documentKey || (section ? `${section}-${Math.max((Number(rowNo) || 1) - 1, 0)}` : "");
 const file = normalizeDocFile(row);
 if (!key || !file) return;
 if (!groupedDocs[key]) groupedDocs[key] = [];
 groupedDocs[key].push(file);
 });
 return groupedDocs;
};

const mergeDocsMaps = (...sources) =>{
 const merged = {};
 sources.forEach((source) =>{
 Object.entries(normalizeDocsMap(source)).forEach(([key, files]) =>{
 merged[key] = [...(merged[key] || []), ...files];
 });
 });
 return merged;
};

const submittedDocsFromResponse = (response, scope = {}) =>
 mergeDocsMaps(
 response?.payload?.docs,
 response?.docs,
 response?.payload?.form?.docs,
 response?.form?.docs,
 docsRowsToMap(response?.documents || response?.appraisal_documents || response?.appraisalDocuments || response?.payload?.documents || response?.payload?.appraisal_documents || response?.payload?.appraisalDocuments || [], scope),
 );

const applySubmittedAppraisalToSetters = (submittedAppraisal, setters, scope = {}) =>{
 if (!submittedAppraisal || !setters) return false;
 const submittedForm = normalizeFetchedForm(submittedFormFromResponse(submittedAppraisal));
 if (!submittedForm) return false;

 Object.keys(submittedForm).forEach((formKey) =>{
 const setterKey = resolveSnapshotSetterKey(formKey);
 if (formKey === "info") {
 setters[setterKey]?.((current = {}) =>normalizeInfo(submittedForm[formKey], current, submittedForm, submittedAppraisal));
 } else {
 setters[setterKey]?.(submittedForm[formKey]);
 }
 });

 const submittedDocs = submittedDocsFromResponse(submittedAppraisal, scope);
 if (submittedDocs) {
 setters.setDocs?.(normalizeDocsMap(submittedDocs));
 } else {
 setters.setDocs?.({});
 }

 return true;
};

const docsHaveFiles = (docs = {}) =>
 Object.values(docs || {}).some((files) =>filesForDocValue(files).length >0);

const hasRows = (value) =>Array.isArray(value) && value.length >0;

const rowHasMeaningfulApplicantData = (row = {}) =>
 Object.entries(row || {}).some(([key, value]) =>
 ![
 "_id",
 "id",
 "max",
 "sectionMax",
 "section_max",
 "hod",
 "director",
 "dean",
 "vc",
 "hod_score",
 "director_score",
 "dean_score",
 "vc_score",
 ].includes(key) &&
 String(value ?? "").trim() !== ""
 );

const hasMeaningfulRows = (rows) =>
 Array.isArray(rows) && rows.some(rowHasMeaningfulApplicantData);

const B6_B10_SECTION_KEYS = [
 "consultancy",
 "consultancyRows",
 "creativeCommissions",
 "proposals",
 "training",
 "innovation",
 "startupRows",
 "products",
];

const mergeMissingSubmittedFormData = (submittedForm = {}, snapshotPayload = null) =>{
 const snapshotForm = normalizeFetchedForm(snapshotFormFromPayload(snapshotPayload));
 if (!snapshotForm || typeof snapshotForm !== "object") return submittedForm;

 const merged = { ...snapshotForm, ...submittedForm };
 merged.info = {
 ...(snapshotForm.info || {}),
 ...(submittedForm.info || {}),
 };

 FORM_SECTION_KEYS.forEach((key) =>{
 if (!hasRows(submittedForm[key]) && hasRows(snapshotForm[key])) {
 merged[key] = snapshotForm[key];
 }
 });

 B6_B10_SECTION_KEYS.forEach((key) =>{
 if (!hasMeaningfulRows(submittedForm[key]) && hasMeaningfulRows(snapshotForm[key])) {
 merged[key] = snapshotForm[key];
 }
 });

 ["innovDetails", "innovScore", "innovHod", "innovDirector", "innovDean", "innovVc", "summaryOtherInfo", "sectionSaveStatus"].forEach((key) =>{
 if ((submittedForm[key] === undefined || submittedForm[key] === null || submittedForm[key] === "") && snapshotForm[key] !== undefined) {
 merged[key] = snapshotForm[key];
 }
 });

 if (submittedForm.innovativeTeaching && snapshotForm.innovativeTeaching) {
 merged.innovativeTeaching = {
 ...snapshotForm.innovativeTeaching,
 ...submittedForm.innovativeTeaching,
 };
 }

 return merged;
};

const normalizeTotalsForSubmit = (totals = {}) =>({
 ...totals,
 part_a_total: totals.part_a_total ?? totals.partATotal,
 part_b_total: totals.part_b_total ?? totals.partBTotal,
 part_c_total: totals.part_c_total ?? totals.partCTotal,
 part_d_total: totals.part_d_total ?? totals.partDTotal,
 grand_total: totals.grand_total ?? totals.grandTotal,
 effective_part_a_max: totals.effective_part_a_max ?? totals.effectivePartAMax,
 effective_part_b_max: totals.effective_part_b_max ?? totals.effectivePartBMax,
 effective_part_c_max: totals.effective_part_c_max ?? totals.effectivePartCTotal,
 effective_part_d_max: totals.effective_part_d_max ?? totals.effectivePartDMax,
 effective_grand_max: totals.effective_grand_max ?? totals.effectiveGrandMax,
});

const legacyTotalsForSubmit = (totals = {}) => {
 const partATotal = totals.partATotal ?? totals.part_a_total ?? 0;
 const partBTotal = totals.partBTotal ?? totals.part_b_total ?? 0;
 const grandTotal = totals.grandTotal ?? totals.grand_total ?? (partATotal + partBTotal);
 return {
 partATotal,
 partBTotal,
 grandTotal,
 part_a_total: partATotal,
 part_b_total: partBTotal,
 grand_total: grandTotal,
 };
};

const legacyFormForSubmit = (form = {}) => {
 const legacyForm = { ...form };
[
 "acr",
 "exhibitions",
 "popularWritings",
 ].forEach((key) => {
 delete legacyForm[key];
 });
 return legacyForm;
};

const defaultAcrRows = () =>[
 { label: "Self-motivation & Proactiveness" },
 { label: "Punctuality" },
 { label: "Target-based Work" },
 { label: "Effectiveness" },
 { label: "Obedience" },
];

const resetSnapshotSetters = (academicYear, setters) =>{
 setters.setInfo?.({
  name: sessionStorage.getItem("name") || "",
  qual: sessionStorage.getItem("qualification") || "",
  desig: sessionStorage.getItem("designation") || "",
  school: sessionStorage.getItem("school") || sessionStorage.getItem("department") || "",
  experience: sessionStorage.getItem("experience") || "",
  expDyp: "",
  expPrev: "",
  expTotal: "",
  ay: academicYear,
 });
 setters.setLectures?.([{ sem: "", code: "", planned: "", conducted: "", score: "", hod: "", director: "" }]);
 setters.setCourseFile?.([{ course: "", title: "", details: "", score: "", hod: "", director: "" }]);
 setters.setInnovRows?.([{ method: "", details: "", score: "", max: 4, sectionMax: 10 }]);
 setters.setInnovDetails?.("");
 setters.setInnovScore?.("");
 setters.setInnovHod?.("");
 setters.setInnovDirector?.("");
 setters.setInnovDean?.("");
 setters.setInnovVc?.("");
 setters.setProjects?.([{ label: "", score: "", hod: "", director: "" }]);
 setters.setObeRows?.([
  { component: "CO-PO mapping sheet", evidence: "", score: "", max: 5 },
  { component: "Attainment calculation", evidence: "", score: "", max: 10 },
  { component: "Corrective action plan", evidence: "", score: "", max: 5 },
 ]);
 setters.setMentoringRows?.([
  { activity: "Mentoring meetings conducted (min. 2/semester)", evidence: "", score: "", max: 4 },
  { activity: "Mentoring register maintained", evidence: "", score: "", max: 3 },
  { activity: "Documented academic/career counselling outcomes", evidence: "", score: "", max: 3 },
 ]);
 setters.setQuals?.([{ label: "", score: "", hod: "", director: "" }]);
 setters.setFeedback?.([{ code: "", fb1: "", fb2: "", score: "", hod: "", director: "" }]);
 setters.setDeptActs?.([{ activity: "", nature: "", period: "", score: "", hod: "", director: "" }]);
 setters.setUniActs?.([{ activity: "", nature: "", period: "", score: "", hod: "", director: "" }]);
 setters.setEvents?.([{ event: "", role: "", fromDate: "", toDate: "", level: "", score: "" }]);
 setters.setEventRows?.([{ event: "", role: "", fromDate: "", toDate: "", level: "", score: "" }]);
 setters.setSociety?.([{ label: "", details: "", date: "", score: "", hod: "", director: "", max: 10 }]);
 setters.setIndustry?.([{ activity: "", partner: "", date: "", name: "", details: "", score: "", hod: "", director: "" }]);
 setters.setAlumni?.([{ activity: "", details: "", date: "", score: "" }]);
 setters.setAlumniRows?.([{ activity: "", details: "", date: "", score: "" }]);
 setters.setPlacements?.([{ activityType: "", name: "", date: "", score: "" }]);
 setters.setPlacementRows?.([{ activityType: "", name: "", date: "", score: "" }]);
 setters.setAcr?.(defaultAcrRows());
 setters.setJournals?.([{ title: "", journal: "", issn: "", index: "", score: "", hod: "", director: "" }]);
 setters.setPopularWritings?.([{ title: "", media: "", date: "", url: "", score: "", hod: "", director: "" }]);
 setters.setBooks?.([{ title: "", book: "", issn: "", pub: "", coauth: "", first: "", score: "", hod: "", director: "" }]);
 setters.setIct?.([{ title: "", desc: "", type: "", quad: "", score: "", hod: "", director: "" }]);
 setters.setResearch?.([{ degree: "", name: "", thesis: "", score: "", hod: "", director: "" }]);
 setters.setProjects2?.([{ title: "", agency: "", date: "", amount: "", role: "", status: "", score: "", hod: "" }]);
 setters.setInternalProjects?.([{ title: "", agency: "", date: "", amount: "", role: "", status: "", score: "", hod: "" }]);
 setters.setExternalProjects?.([{ title: "", agency: "", date: "", amount: "", role: "", status: "", score: "", hod: "", max: 20 }]);
 setters.setIpr?.([{ title: "", type: "", date: "", status: "", fileNo: "", score: "", hod: "", director: "" }]);
 setters.setPatents?.([{ title: "", type: "", date: "", status: "", fileNo: "", score: "", hod: "", director: "" }]);
 setters.setAwards?.([{ title: "", date: "", agency: "", level: "", score: "", hod: "", director: "" }]);
 setters.setConfs?.([{ title: "", type: "", org: "", level: "", score: "", hod: "", director: "" }]);
 setters.setConsultancyRows?.([{ title: "", agency: "", date: "", amount: "", role: "", status: "", score: "", hod: "" }]);
 setters.setStartupRows?.([{ title: "", status: "", details: "", score: "", hod: "", director: "" }]);
 setters.setProposals?.([{ title: "", duration: "", agency: "", amount: "", score: "", hod: "", director: "" }]);
 setters.setProducts?.([{ details: "", usage: "", score: "", hod: "", director: "" }]);
 setters.setFdps?.([{ program: "", duration: "", org: "", score: "", hod: "", director: "" }]);
 setters.setTraining?.([{ company: "", duration: "", nature: "", score: "", hod: "", director: "" }]);
 setters.setExhibitions?.([{ title: "", type: "", venueLevel: "", date: "", score: "", hod: "", director: "" }]);
 setters.setDocs?.({});
 setters.setSummaryOtherInfo?.("");
 setters.setSectionSaveStatus?.({ partA: false, partB: false, partC: false, partD: false });
};

export const loadAppraisalSnapshot = async ({ facultyEmail, academicYear }) =>{
 if (!facultyEmail || !academicYear) return null;
 try {
 const data = await api.get("/appraisal/snapshot", {
 params: { academic_year: academicYear },
 });
 return data?.payload ?? data ?? null;
 } catch {
 return null;
 }
};

export const saveAppraisalDraftSection = async ({
 facultyEmail,
 academicYear,
 form,
 docs = {},
 totals = {},
 submitterProfile,
 sectionSaveStatus = {},
}) =>{
  const email = facultyEmail || (typeof window !== "undefined" ? sessionStorage.getItem("username") || sessionStorage.getItem("email") || localStorage.getItem("username") || localStorage.getItem("email") : "");
  if (!email) throw new Error("Please login again before saving. Your email was not found in this session.");
  if (!academicYear) throw new Error("Academic year is required before saving.");

 return api.put("/appraisal/snapshot", {
 academic_year: academicYear,
 payload: {
 form: { ...form, sectionSaveStatus },
 totals,
 submitterProfile,
 savedAt: new Date().toISOString(),
 },
 docs: normalizeDocsMap(docs),
 });
};

export const docsToRows = (docs, facultyEmail, academicYear) =>{
 const docSectionFromKey = (docKey) =>docKey.replace(/-\d+$/, "").replace(/\d+$/, "");
 const docRowFromKey = (docKey) =>{
 const match = docKey.match(/(\d+)$/);
 return match ? Number(match[1]) + 1 : null;
 };

 return Object.entries(docs || {}).flatMap(([docKey, files]) =>
 filesForDocValue(files)
 .filter((file) =>file?.url && !String(file.url).startsWith("blob:"))
 .map((file) =>({
 faculty_email: facultyEmail,
 academic_year: academicYear,
 section: docSectionFromKey(docKey),
 row_no: docRowFromKey(docKey),
 doc_key: docKey,
 file_name: file.name,
 file_type: file.type,
 file_url: file.url,
 storage_path: file.publicId || null,
 }))
 );
};

export const loadAppraisalDocuments = async ({ facultyEmail, academicYear, setDocs }) =>{
 if (!facultyEmail || !academicYear || !setDocs) return;

 try {
 const data = await api.get("/appraisal-documents", {
 params: { academic_year: academicYear, faculty_email: facultyEmail },
 });

 const fetchedDocs = docsRowsToMap(data, { facultyEmail, academicYear });
 if (docsHaveFiles(fetchedDocs)) {
 setDocs((currentDocs = {}) =>mergeDocsMaps(currentDocs, fetchedDocs));
 }
 } catch {
 // non-fatal
 }
};

const fetchSubmittedDocsMap = async ({ facultyEmail, academicYear }) =>{
 if (!facultyEmail || !academicYear) return {};
 try {
 const rows = await api.get("/appraisal-documents", {
 params: { academic_year: academicYear, faculty_email: facultyEmail },
 });
 return docsRowsToMap(rows, { facultyEmail, academicYear });
 } catch {
 return {};
 }
};

const isCurrentSessionUser = (email) =>{
 const target = String(email || "").trim().toLowerCase();
 if (!target || typeof window === "undefined") return false;
 return [
 sessionStorage.getItem("username"),
 sessionStorage.getItem("email"),
 localStorage.getItem("username"),
 localStorage.getItem("email"),
 ].some((value) =>String(value || "").trim().toLowerCase() === target);
};

export const loadSavedAppraisal = async ({ facultyEmail, academicYear, setters, preferSubmitted = false }) =>{
 if (!facultyEmail || !academicYear || !setters) return;

 if (preferSubmitted) {
 try {
 const submittedAppraisal = await fetchSavedAppraisal({ facultyEmail, academicYear });
 if (applySubmittedAppraisalToSetters(submittedAppraisal, setters, { facultyEmail, academicYear })) {
 return submittedAppraisal;
 }
 } catch (err) {
 console.warn("Could not load submitted rejected appraisal; falling back to snapshot:", err);
 }
 }

 const snapshotPayload = isCurrentSessionUser(facultyEmail)
 ? await loadAppraisalSnapshot({ facultyEmail, academicYear })
 : null;
 if (snapshotPayload) {
 applySnapshotToSetters(snapshotPayload, setters);
 return snapshotPayload;
 } else {
 resetSnapshotSetters(academicYear, setters);
 }
};

export const loadClosedAppraisal = async ({ facultyEmail, academicYear, setters }) => {
  if (!facultyEmail || !academicYear || !setters) return null;

  try {
    // A closed year - legacy two-part or a future closed 5-part year alike - has no in-progress
    // workflow left to protect visibility for, so this reads from the dedicated history endpoint
    // (no Part D release-gate) instead of the live endpoint used for the active cycle.
    const submittedAppraisal = await fetchSavedAppraisal({ facultyEmail, academicYear, useHistoryEndpoint: true });
    if (applySubmittedAppraisalToSetters(submittedAppraisal, setters, { facultyEmail, academicYear })) {
      return submittedAppraisal;
    }
  } catch (err) {
    console.warn("Could not load submitted appraisal for closed year; falling back to snapshot:", err);
  }

  const snapshotPayload = await loadAppraisalSnapshot({ facultyEmail, academicYear });
  if (snapshotPayload) {
    applySnapshotToSetters(snapshotPayload, setters);
    return snapshotPayload;
  }

  resetSnapshotSetters(academicYear, setters);
  return null;
};

// Used by reviewWorkflow to load any faculty's appraisal for authority review. Pass
// useHistoryEndpoint: true only for a confirmed-closed academic year (see loadClosedAppraisal) -
// every other caller (current/active-cycle lookups) must keep the default false, since the
// history endpoint rejects requests for a year that's still open.
export const fetchSavedAppraisal = async ({ facultyEmail, academicYear, useHistoryEndpoint = false }) => {
  if (!facultyEmail) throw new Error("Faculty email is required to open the submitted form.");
  if (!academicYear) throw new Error("Academic year is required to open the submitted form.");
  const path = `/dashboard/faculty/${encodeURIComponent(facultyEmail)}${useHistoryEndpoint ? "/history" : ""}`;
  try {
    const data = await api.get(path, { params: { academic_year: academicYear } });
    return await readSubmittedAppraisalResponse(data, facultyEmail, academicYear);
  } catch (err) {
    if (err?.statusCode === 403) {
      const repaired = await repairDeanDivisionProfile();
      if (repaired) {
        try {
          const data = await api.get(path, { params: { academic_year: academicYear } });
          return await readSubmittedAppraisalResponse(data, facultyEmail, academicYear);
        } catch {
          // Fall through to the explicit authority message below.
        }
      }
      throw new Error("Access denied while opening this submitted form. I tried the Dean division-profile repair, but the backend still rejected the request. Please log out and log in again so the refreshed profile/token is used. If it still fails, the backend faculty_profiles.school for this Dean must be updated to 'engineering' or 'non_engineering'.", { cause: err });
    }
    throw err;
  }
};

const readSubmittedAppraisalResponse = async (data, facultyEmail, academicYear) =>{
 if (!data) {
 throw new Error(`No saved appraisal snapshot was found for ${facultyEmail} in academic year ${academicYear}. Check that the academic year matches the submitted record.`);
 }
 const snapshotPayload = isCurrentSessionUser(facultyEmail)
 ? await loadAppraisalSnapshot({ facultyEmail, academicYear })
 : null;
 const normalized = normalizeFetchedAppraisal(data, { facultyEmail, academicYear, snapshotPayload });
 const form = normalized.payload?.form || normalized.form;
 if (!hasSubmittedFormData(form)) {
 throw new Error(`The saved appraisal snapshot for ${facultyEmail} does not contain submitted form section data. The user may need to resubmit the appraisal for academic year ${academicYear}.`);
 }
 const currentDocs = submittedDocsFromResponse(normalized, { facultyEmail, academicYear }) || {};
 if (docsHaveFiles(currentDocs)) return normalized;

 const fallbackDocs = await fetchSubmittedDocsMap({ facultyEmail, academicYear });
 if (!docsHaveFiles(fallbackDocs)) return normalized;

 return {
 ...normalized,
 docs: fallbackDocs,
 ...(normalized.payload ? { payload: { ...normalized.payload, docs: fallbackDocs } } : {}),
 ...(normalized.form ? { form: { ...normalized.form, docs: fallbackDocs } } : {}),
 };
};

const repairDeanDivisionProfile = async () =>{
 const role = normalizeRoleForWorkflow(sessionStorage.getItem("role"));
 if (role !== "dean") return false;

 const profile = {
 school: sessionStorage.getItem("school") || "",
 department: sessionStorage.getItem("department") || "",
 designation: sessionStorage.getItem("designation") || "",
 };
 if (!profile.school) return false;
 const deanTrack = getDeanTrack(profile);
 if (![DEAN_TRACKS.ENGINEERING, DEAN_TRACKS.NON_ENGINEERING].includes(deanTrack)) return false;

 try {
 await api.put("/auth/me", { school: deanTrack });
 const refreshedProfile = await api.get("/auth/me").catch(() =>null);
 if (refreshedProfile) {
 storeUserSession({ profile: refreshedProfile });
 }
 sessionStorage.setItem("school", deanTrack);
 sessionStorage.setItem("hasHod", "false");
 sessionStorage.setItem("hasHOD", "false");
 return true;
 } catch {
 return false;
 }
};

const FORM_SECTION_KEYS = [
 "lectures", "courseFile", "obeRows", "projects", "mentoringRows", "quals", "feedback", "deptActs", "uniActs",
 "eventRows", "events", "society", "industry", "alumniRows", "alumni", "placementRows", "placements", "acr", "leaveManagement", "journals", "books", "ict", "research", "projects2",
 "internalProjects", "externalProjects", "ipr", "patents", "awards", "confs",
 "proposals", "products", "innovation", "consultancy", "fdps", "training", "popularWritings", "exhibitions",
];

const REVIEW_FIELD_BY_ROLE = {
 hod: "hod",
 center_head: "hod",
 director: "director",
 dean: "dean",
 vc: "vc",
};

const REVIEW_INNOV_FIELD_BY_ROLE = {
 hod: "innovHod",
 center_head: "innovHod",
 director: "innovDirector",
 dean: "innovDean",
 vc: "innovVc",
};

const hasSubmittedFormData = (form = {}) =>
 Boolean(form && FORM_SECTION_KEYS.some((key) =>Array.isArray(form[key]) && form[key].length >0));

const firstPresent = (...values) =>
 values.find((value) =>value !== undefined && value !== null && String(value).trim() !== "");

const infoFromProfileSources = (...sources) =>{
 const profileSources = sources.flatMap((source) =>[
 source,
 source?.info,
 source?.profile,
 source?.faculty,
 source?.facultyProfile,
 source?.faculty_profile,
 source?.submitterProfile,
 source?.submitter_profile,
 source?.payload?.submitterProfile,
 source?.payload?.submitter_profile,
 ]).filter(Boolean);

 const pick = (...keys) =>firstPresent(
 ...profileSources.flatMap((source) =>keys.map((key) =>source?.[key])),
 );

 return {
 name: pick("name", "full_name", "fullName", "faculty_name", "facultyName"),
 qual: pick("qual", "qualification", "educational_qualifications", "educationalQualifications"),
 desig: pick("desig", "designation", "present_designation", "presentDesignation"),
 school: pick("school", "schoolName", "department", "departmentName"),
 experience: pick("experience", "teaching_experience", "teachingExperience"),
 ay: pick("ay", "academic_year", "academicYear"),
 };
};

const normalizeInfo = (info = {}, ...fallbackSources) =>{
 const fallback = infoFromProfileSources(...fallbackSources);
 return {
 ...info,
 name: firstPresent(info.name, info.full_name, info.fullName, fallback.name) || "",
 qual: firstPresent(info.qual, info.qualification, info.educational_qualifications, info.educationalQualifications, fallback.qual) || "",
 desig: firstPresent(info.desig, info.designation, info.present_designation, info.presentDesignation, fallback.desig) || "",
 school: firstPresent(info.school, info.schoolName, info.department, info.departmentName, fallback.school) || "",
 experience: firstPresent(info.experience, info.teaching_experience, info.teachingExperience, fallback.experience, info.expTotal) || "",
 ay: firstPresent(info.ay, info.academic_year, info.academicYear, fallback.ay) || "",
 };
};

export const mergeFacultyInfo = (info = {}, ...fallbackSources) =>
 normalizeInfo(info || {}, ...fallbackSources);

const parseMaybeJson = (value) =>{
 if (typeof value !== "string") return value;
 const trimmed = value.trim();
 if (!trimmed || !["{", "["].includes(trimmed[0])) return value;
 try {
 return JSON.parse(trimmed);
 } catch {
 return value;
 }
};

const reviewArrayFrom = (value) =>{
 const parsed = parseMaybeJson(value);
 if (!parsed) return [];
 if (Array.isArray(parsed)) return parsed.map(parseMaybeJson);
 if (typeof parsed !== "object") return [];

 return Object.entries(parsed).map(([role, review]) =>{
 const parsedReview = parseMaybeJson(review);
 if (parsedReview && typeof parsedReview === "object" && !Array.isArray(parsedReview)) {
 return { reviewer_role: parsedReview.reviewer_role || parsedReview.reviewerRole || role, ...parsedReview };
 }
 return { reviewer_role: role, section_scores: parsedReview };
 });
};

const syntheticReviewFromRoleFields = (source = {}) =>
 ["hod", "center_head", "director", "dean", "vc"].flatMap((role) =>{
 const camel = role.replace(/_([a-z])/g, (_, letter) =>letter.toUpperCase());
 const sectionScores = parseMaybeJson(
 source[`${role}_section_scores`] ||
 source[`${role}_sectionScores`] ||
 source[`${role}_scores`] ||
 source[`${role}_review_scores`] ||
 source[`${camel}SectionScores`] ||
 source[`${camel}Scores`] ||
 source[`${camel}ReviewScores`],
 );
 if (!sectionScores) return [];
 return [{
 reviewer_role: role,
 section_scores: sectionScores,
 part_a_score: source[`${role}_part_a`] || source[`${camel}PartA`],
 part_b_score: source[`${role}_part_b`] || source[`${camel}PartB`],
 part_c_score: source[`${role}_part_c`] || source[`${camel}PartC`],
 part_d_score: source[`${role}_part_d`] || source[`${camel}PartD`],
 total_score: source[`${role}_total`] || source[`${camel}Total`],
 remarks: source[`${role}_remarks`] || source[`${camel}Remarks`],
 }];
 });

const reviewsFromRoleScoreMap = (source = {}) =>{
 const explicitMap = parseMaybeJson(
 source.section_scores_by_role ||
 source.sectionScoresByRole ||
 source.review_scores_by_role ||
 source.reviewScoresByRole ||
 source.reviewer_scores ||
 source.reviewerScores ||
 source.role_scores ||
 source.roleScores,
 );
 const directSectionScores = parseMaybeJson(source.section_scores || source.sectionScores);
 const roleWrappedSectionScores =
 directSectionScores &&
 typeof directSectionScores === "object" &&
 !Array.isArray(directSectionScores) &&
 ["hod", "center_head", "director", "dean", "vc"].some((role) =>directSectionScores[role])
 ? directSectionScores
 : null;
 const scoreMap = explicitMap || roleWrappedSectionScores;

 if (!scoreMap || typeof scoreMap !== "object" || Array.isArray(scoreMap)) return [];

 return Object.entries(scoreMap).map(([role, sectionScores]) =>({
 reviewer_role: role,
 section_scores: sectionScores,
 }));
};

const reviewsFromAppraisalResponse = (data = {}) =>[
 ...reviewArrayFrom(data.reviews),
 ...reviewArrayFrom(data.review_history),
 ...reviewArrayFrom(data.reviewHistory),
 ...reviewArrayFrom(data.appraisal_reviews),
 ...reviewArrayFrom(data.appraisalReviews),
 ...reviewArrayFrom(data.payload?.reviews),
 ...reviewArrayFrom(data.payload?.review_history),
 ...reviewArrayFrom(data.payload?.reviewHistory),
 ...reviewArrayFrom(data.payload?.appraisal_reviews),
 ...reviewArrayFrom(data.payload?.appraisalReviews),
 ...reviewsFromRoleScoreMap(data),
 ...reviewsFromRoleScoreMap(data.payload || {}),
 ...syntheticReviewFromRoleFields(data),
 ...syntheticReviewFromRoleFields(data.payload || {}),
];

const reviewRowScore = (row, roleField, role) =>{
 const parsedRow = parseMaybeJson(row);
 if (parsedRow === undefined || parsedRow === null) return undefined;
 if (typeof parsedRow !== "object" || Array.isArray(parsedRow)) return parsedRow;
 const directorAlias = roleField === "director" || role === "director"
 ? firstPresent(parsedRow.dir, parsedRow.dir_score, parsedRow.dirScore, parsedRow.dir_marks, parsedRow.dirMarks)
 : undefined;
 return firstPresent(
  parsedRow[roleField],
  parsedRow[role],
  directorAlias,
  parsedRow[`${roleField}_score`],
  parsedRow[`${role}_score`],
  parsedRow[`${roleField}_marks`],
 parsedRow[`${role}_marks`],
 parsedRow.reviewScore,
 parsedRow.review_score,
 parsedRow.reviewerScore,
 parsedRow.reviewer_score,
 parsedRow.value,
 parsedRow.total,
 );
};

const mergeSectionReviewScore = (rows, sectionScore, roleField, role) =>{
 const baseRows = Array.isArray(rows) ? rows : [];

 const parsedSectionScore = parseMaybeJson(sectionScore);

 if (Array.isArray(parsedSectionScore)) {
 const length = Math.max(baseRows.length, parsedSectionScore.length);
 return Array.from({ length }, (_, index) =>{
 const existing = baseRows[index] || {};
 const reviewValue = reviewRowScore(parsedSectionScore[index], roleField, role);
 return reviewValue === undefined ? existing : { ...existing, [roleField]: reviewValue };
 });
 }

 if (parsedSectionScore && typeof parsedSectionScore === "object") {
 const numericEntries = Object.entries(parsedSectionScore)
 .filter(([key]) =>/^\d+$/.test(key))
 .sort(([a], [b]) =>Number(a) - Number(b));
 if (numericEntries.length) {
 return mergeSectionReviewScore(baseRows, numericEntries.map(([, value]) =>value), roleField, role);
 }
 }

 const reviewValue = reviewRowScore(parsedSectionScore, roleField, role);
 if (reviewValue === undefined) return rows;
 if (!baseRows.length) return [{ [roleField]: reviewValue }];
 return baseRows.map((row, index) =>index === 0 ? { ...row, [roleField]: reviewValue } : row);
};

const REVIEW_SECTION_KEY_ALIASES = {
 teaching_process: "lectures",
 teachingProcess: "lectures",
 lectures_tutorials_practicals: "lectures",
 lecturesTutorialsPracticals: "lectures",
 innovativeTeachingRows: "innovRows",
 innovative_teaching_rows: "innovRows",
 course_file: "courseFile",
 courseFiles: "courseFile",
 course_files: "courseFile",
 projects_guided: "projects",
 projectsGuided: "projects",
 qualification_enhancement: "quals",
 qualificationEnhancement: "quals",
 qualifications: "quals",
 student_feedback: "feedback",
 studentFeedback: "feedback",
 departmental_activities: "deptActs",
 departmentalActivities: "deptActs",
 department_activities: "deptActs",
 departmentActivities: "deptActs",
 dept_acts: "deptActs",
 university_activities: "uniActs",
 universityActivities: "uniActs",
 uni_acts: "uniActs",
 social_contributions: "society",
 socialContributions: "society",
 contribution_to_society: "society",
 contributionToSociety: "society",
 industry_connect: "industry",
 industryConnect: "industry",
 acr_scores: "acr",
 acrScores: "acr",
 annual_confidential_report: "acr",
 annualConfidentialReport: "acr",
 journal_publication: "journals",
 journalPublication: "journals",
 journal_publications: "journals",
 journalPublications: "journals",
 research_papers: "journals",
 researchPapers: "journals",
 research_papers_journal_publications: "journals",
 researchPapersJournalPublications: "journals",
 popular_writings: "popularWritings",
 popularWritings: "popularWritings",
 book_publications: "books",
 bookPublications: "books",
 book_chapters: "books",
 bookChapters: "books",
 books_book_chapters: "books",
 booksBookChapters: "books",
 ict_pedagogy: "ict",
 ictPedagogy: "ict",
 e_content: "ict",
 eContent: "ict",
 ict_e_content: "ict",
 ictEContent: "ict",
 research_guidance: "research",
 researchGuidance: "research",
 research_projects: "projects2",
 researchProjects: "projects2",
 internal_projects: "projects2",
 internalProjects: "projects2",
 consultancy_internal_projects: "projects2",
 consultancyInternalProjects: "projects2",
 external_research_projects: "externalProjects",
 externalResearchProjects: "externalProjects",
 external_projects: "externalProjects",
 external_projects_consultancy: "externalProjects",
 externalProjectsConsultancy: "externalProjects",
 ipr_records: "ipr",
 iprRecords: "ipr",
 awards: "awards",
 conferences: "confs",
 invited_lectures: "confs",
 invitedLectures: "confs",
 research_proposals: "proposals",
 researchProposals: "proposals",
 submitted_research_proposals: "proposals",
 submittedResearchProposals: "proposals",
 products_developed: "products",
 productsDeveloped: "products",
 fdp_workshops: "fdps",
 fdpWorkshops: "fdps",
 self_development: "fdps",
 selfDevelopment: "fdps",
 industrial_training: "training",
 industrialTraining: "training",
 exhibitions: "exhibitions",
 exhibition_records: "exhibitions",
 exhibitionRecords: "exhibitions",
};

const normalizeReviewSectionScores = (scores = {}) =>{
 const parsedScores = parseMaybeJson(scores);
 if (!parsedScores || typeof parsedScores !== "object" || Array.isArray(parsedScores)) return parsedScores;
 const normalized = { ...parsedScores };
 Object.entries(parsedScores).forEach(([key, value]) =>{
 const target = REVIEW_SECTION_KEY_ALIASES[key];
 if (target && normalized[target] === undefined) normalized[target] = value;
 });
 return normalized;
};

const applyReviewToForm = (form = {}, review = {}) =>{
  const role = normalizeRoleForWorkflow(review.reviewer_role || review.reviewerRole || review.role);
  if (role === "registrar") {
    const rawScores = parseMaybeJson(
      review.section_scores ||
      review.sectionScores ||
      review.review_scores ||
      review.reviewScores ||
      review.scores ||
      review,
    );
    if (rawScores && typeof rawScores === "object") {
      const regLeave = rawScores.registrar_part_d_leave_management || rawScores.leave_management || rawScores.leaveManagement;
      if (Array.isArray(regLeave) && regLeave.length > 0) {
        return {
          ...form,
          leaveManagement: regLeave,
          leave_management: regLeave,
          registrar_part_d_leave_management: regLeave,
        };
      }
    }
    return form;
  }
  const roleField = REVIEW_FIELD_BY_ROLE[role];
  if (!roleField) return form;

 const rawScores = parseMaybeJson(
 review.section_scores ||
 review.sectionScores ||
 review.review_scores ||
 review.reviewScores ||
 review.scores ||
 review,
 );
 const scores = normalizeReviewSectionScores(
 rawScores?.form ||
 rawScores?.payload?.form ||
 rawScores?.section_scores ||
 rawScores?.sectionScores ||
 rawScores,
 );
 if (!scores || typeof scores !== "object") return form;

 const next = { ...form };
 FORM_SECTION_KEYS.forEach((key) =>{
 if (!Object.prototype.hasOwnProperty.call(scores, key)) return;
 next[key] = mergeSectionReviewScore(next[key], scores[key], roleField, role);
 });

 if (Object.prototype.hasOwnProperty.call(scores, "innovRows")) {
 next.innovRows = mergeSectionReviewScore(next.innovRows, scores.innovRows, roleField, role);
 }

 const innovField = REVIEW_INNOV_FIELD_BY_ROLE[role];
 const innovScore = firstPresent(
 reviewRowScore(scores.innovativeTeaching, roleField, role),
 scores[innovField],
 scores.innovative_teaching,
 scores.innovativeTeachingScore,
 );
 if (innovField && innovScore !== undefined) next[innovField] = innovScore;

 return next;
};

const mergeReviewScoresIntoForm = (form = {}, reviews = []) =>
 (reviews || []).reduce((current, review) =>applyReviewToForm(current, review), form);

// Each mapping entry declares two (or more) field names that hold the same logical value
// across form engines (e.g. Standard's row.label vs Creative School's row.activity). Sync
// is bidirectional: whichever of "from"/"targets" already has the row's real data backfills
// every other empty name in the group, so the value shows up regardless of which field name
// it happened to be stored/returned under. Purely additive versus a one-way copy - never
// overwrites a field that already has data.
const aliasKeys = (rows, mapping) =>
 (rows || []).map((row) =>{
 const out = { ...row };
 Object.entries(mapping).forEach(([from, to]) =>{
 const group = [from, ...(Array.isArray(to) ? to : [to])];
 const sourceKey = group.find((key) =>out[key] != null);
 if (sourceKey === undefined) return;
 group.forEach((key) =>{
 if (out[key] == null) out[key] = out[sourceKey];
 });
 });
 return out;
 });

const ROW_SOURCE_IGNORE_KEYS = new Set([
 "id", "_id", "faculty_email", "academic_year", "form_family", "section_title", "max_marks",
 "row_no", "created_at", "updated_at", "score", "hod", "director", "dean", "vc",
 "hod_score", "director_score", "dean_score", "vc_score",
]);

const rowHasDisplayData = (row = {}) =>
 Object.entries(row || {}).some(([key, value]) =>
 !ROW_SOURCE_IGNORE_KEYS.has(key) &&
 value !== undefined &&
 value !== null &&
 String(value).trim() !== ""
 );

const firstArraySource = (source = {}, keys = []) =>{
 const arrays = keys.map((key) =>source?.[key]).filter(Array.isArray);
 return arrays.find((rows) =>rows.some(rowHasDisplayData)) || arrays[0] || null;
};

const normalizeSectionRows = (normalized, targetKey, sourceKeys = [], mapping = {}) =>{
 const rows = firstArraySource(normalized, [targetKey, ...sourceKeys]);
 if (rows) normalized[targetKey] = aliasKeys(rows, mapping);
 return normalized[targetKey];
};

const REVIEW_SCORE_ALIASES = {
 hod_score: "hod",
 hodScore: "hod",
 hod_marks: "hod",
 hodMarks: "hod",
 center_head_score: "hod",
 centerHeadScore: "hod",
 center_head_marks: "hod",
 centerHeadMarks: "hod",
 director_score: "director",
 directorScore: "director",
 director_marks: "director",
 directorMarks: "director",
 dir: "director",
 dir_score: "director",
 dirScore: "director",
 dir_marks: "director",
 dirMarks: "director",
 dean_score: "dean",
 deanScore: "dean",
 dean_marks: "dean",
 deanMarks: "dean",
 vc_score: "vc",
 vcScore: "vc",
 vc_marks: "vc",
 vcMarks: "vc",
};

const LECTURE_ROW_ALIASES = {
 sem: "sem",
 semester: "sem",
 semester_name: "sem",
 semesterName: "sem",
 course_code: "code",
 courseCode: "code",
 course_name: "code",
 courseName: "code",
 course_title: "code",
 courseTitle: "code",
 planned_classes: "planned",
 plannedClasses: "planned",
 classes_as_per_course_structure: "planned",
 classesAsPerCourseStructure: "planned",
 class_planned: "planned",
 classPlanned: "planned",
 total_classes: "planned",
 totalClasses: "planned",
 conducted_classes: "conducted",
 conductedClasses: "conducted",
 classes_actually_conducted: "conducted",
 classesActuallyConducted: "conducted",
 actual_classes: "conducted",
 actualClasses: "conducted",
 class_conducted: "conducted",
 classConducted: "conducted",
};

const COURSE_FILE_ROW_ALIASES = {
 course_name: "course",
 courseName: "course",
 course_paper: "course",
 coursePaper: "course",
 paper: "course",
 year: "title",
 program_semester: "title",
 programSemester: "title",
 program_and_semester: "title",
 programAndSemester: "title",
 "program_&_semester": "title",
 "program & semester": "title",
 Program_Semester: "title",
 ProgramAndSemester: "title",
 "Program & Semester": "title",
 "Program and Semester": "title",
 availability: "details",
 iqac_format: "details",
 iqacFormat: "details",
 availability_iqac: "details",
 availabilityIqac: "details",
 availability_as_per_iqac_format: "details",
 availabilityAsPerIqacFormat: "details",
};

const LABEL_ROW_ALIASES = {
 category: "label",
 project_category: "label",
 projectCategory: "label",
 qualification: "label",
 qualification_category: "label",
 qualificationCategory: "label",
 attribute: "label",
};

const FEEDBACK_ROW_ALIASES = {
 course_code: "code",
 courseCode: "code",
 course_name: "code",
 courseName: "code",
 feedback_1: "fb1",
 feedback1: "fb1",
 first_feedback: "fb1",
 firstFeedback: "fb1",
 feedback_2: "fb2",
 feedback2: "fb2",
 second_feedback: "fb2",
 secondFeedback: "fb2",
};

const SOCIETY_ROW_ALIASES = {
 activity: "label",
 society_activity: "label",
 societyActivity: "label",
 status: "participated",
 participation: "participated",
 yes_no: "participated",
 yesNo: "participated",
};

const OBE_ROW_ALIASES = {
 component_name: "component",
 componentName: "component",
 outcome_component: "component",
 outcomeComponent: "component",
 proof: "evidence",
 evidence_attached: "evidence",
 evidenceAttached: "evidence",
};

const MENTORING_ROW_ALIASES = {
 mentoring_activity: "activity",
 mentoringActivity: "activity",
 component: "activity",
 proof: "evidence",
 evidence_attached: "evidence",
 evidenceAttached: "evidence",
};

const EVENT_ROW_ALIASES = {
 activity: "event",
 title: "event",
 event_name: "event",
 eventName: "event",
 responsibility: "role",
 from_date: "fromDate",
 from: "fromDate",
 start_date: "fromDate",
 startDate: "fromDate",
 to_date: "toDate",
 to: "toDate",
 end_date: "toDate",
 endDate: "toDate",
 scope: "level",
};

const ALUMNI_ROW_ALIASES = {
 event: "activity",
 title: "activity",
 description: "details",
 name: "details",
 period: "date",
};

const PLACEMENT_ROW_ALIASES = {
 type: ["activityType", "type"],
 activity: ["activityType", "type"],
 activity_type: "activityType",
 activityType: "activityType",
 student: "name",
 company: "name",
 organization: "name",
 organisation: "name",
 details: "name",
 period: "date",
};

const JOURNAL_ROW_ALIASES = {
 indexing: "index",
 index_name: "index",
 indexName: "index",
 journal_name: "journal",
 journalName: "journal",
 paper_title: "title",
 paperTitle: "title",
 issn_no: "issn",
 issnNo: "issn",
 ...REVIEW_SCORE_ALIASES,
};

const BOOK_ROW_ALIASES = {
 publisher: ["pub", "publisher"],
 pub: ["pub", "publisher"],
 coauthor: ["coauth", "coAuthors"],
 co_author: ["coauth", "coAuthors"],
 coAuthor: ["coauth", "coAuthors"],
 coauth: ["coauth", "coAuthors"],
 coAuthors: ["coauth", "coAuthors"],
 first_author: "first",
 firstAuthor: "first",
};

const ICT_ROW_ALIASES = {
 description: ["desc", "platform"],
 short_description: ["desc", "platform"],
 shortDescription: ["desc", "platform"],
 type: "platform",
 quadrant: ["quad", "reach"],
 quadrants: ["quad", "reach"],
 views: "reach",
};

const RESEARCH_ROW_ALIASES = {
 student_name: "name",
 studentName: "name",
 thesis: "status",
 stage: "status",
 award_date: "date",
 awardDate: "date",
 registration_date: "date",
 registrationDate: "date",
};

const RESEARCH_PROJECT_ROW_ALIASES = {
 sanction_date: "date",
 sanctionDate: "date",
 project_date: "date",
 projectDate: "date",
 project_status: "status",
 projectStatus: "status",
};

const IPR_ROW_ALIASES = {
 ipr_date: "date",
 iprDate: "date",
 ipr_status: "status",
 iprStatus: "status",
 file_no: "fileNo",
 fileNo: "fileNo",
};

const PATENT_ROW_ALIASES = {
 patent_date: "date",
 patentDate: "date",
 patent_status: "status",
 patentStatus: "status",
 file_no: "fileNo",
 fileNo: "fileNo",
};

const AWARD_ROW_ALIASES = {
 award_date: "date",
 awardDate: "date",
};

const CONF_ROW_ALIASES = {
 organization: "org",
 organisation: "org",
 organizer: "org",
 organiser: "org",
};

const CONSULTANCY_ROW_ALIASES = {
 organisation: "client",
 organization: "client",
 agency: "client",
 company: "client",
 title: "client",
 type: "nature",
 role: "nature",
 status: "nature",
 details: "nature",
};

const PRODUCT_ROW_ALIASES = {
 usage: ["usage", "used"],
 used: ["usage", "used"],
 product_details: "details",
 productDetails: "details",
 impact: "status",
 nature: "role",
};

const FDP_ROW_ALIASES = {
 organization: "org",
 organisation: "org",
 organizer: "org",
 organiser: "org",
};

const POPULAR_WRITING_ROW_ALIASES = {
 newspaper_magazine_website: "media",
 newspaperMagazineWebsite: "media",
 media_name: "media",
 mediaName: "media",
 film_documentary: "film",
 filmDocumentary: "film",
};

const INDUSTRY_ROW_ALIASES = {
 industry_name: "name",
 industryName: "name",
 company: "name",
 organization: "name",
};

const INNOVATIVE_ROW_ALIASES = {
 methods_used: "method",
 methodsUsed: "method",
 method_used: "method",
 methodUsed: "method",
 description: "details",
 proof: "details",
 evidence: "details",
};

const normalizeReviewScoreAliasesOnRows = (normalized) =>{
 FORM_SECTION_KEYS.forEach((key) =>{
 if (Array.isArray(normalized[key])) {
 normalized[key] = aliasKeys(normalized[key], REVIEW_SCORE_ALIASES);
 }
 });
 if (Array.isArray(normalized.innovRows)) {
 normalized.innovRows = aliasKeys(normalized.innovRows, REVIEW_SCORE_ALIASES);
 }
 return normalized;
};

const normalizeInnovativeReviewScoreAliases = (normalized) =>{
 const mapping = {
 innov_hod: "innovHod",
 innov_hod_score: "innovHod",
 innovHodScore: "innovHod",
 innov_center_head: "innovHod",
 innov_center_head_score: "innovHod",
 innovCenterHead: "innovHod",
 innovCenterHeadScore: "innovHod",
 innov_director: "innovDirector",
 innov_director_score: "innovDirector",
 innovDirectorScore: "innovDirector",
 innov_dean: "innovDean",
 innov_dean_score: "innovDean",
 innovDeanScore: "innovDean",
 innov_vc: "innovVc",
 innov_vc_score: "innovVc",
 innovVC: "innovVc",
 innovVcScore: "innovVc",
 };
 Object.entries(mapping).forEach(([from, to]) =>{
 if (normalized[to] == null && normalized[from] != null) normalized[to] = normalized[from];
 });
 return normalized;
};

const normalizeFetchedForm = (form = {}) =>{
 if (!form || typeof form !== "object") return form;
 const normalized = { ...form };
 normalized.info = normalizeInfo(normalized.info || {}, normalized);
 const mediaOrDesign = isMediaOrDesignForm(normalized);

 normalizeSectionRows(normalized, "lectures", [
 "teaching_process",
 "teachingProcess",
 "lectures_tutorials_practicals",
 "lecturesTutorialsPracticals",
 ], LECTURE_ROW_ALIASES);

 normalizeSectionRows(normalized, "courseFile", [
 "course_file",
 "courseFiles",
 "course_files",
 ], COURSE_FILE_ROW_ALIASES);

 normalizeSectionRows(normalized, "projects", [
 "projects_guided",
 "projectsGuided",
 ], LABEL_ROW_ALIASES);

 normalizeSectionRows(normalized, "quals", [
 "qualification_enhancement",
 "qualificationEnhancement",
 "qualifications",
 ], LABEL_ROW_ALIASES);

 normalizeSectionRows(normalized, "feedback", [
 "student_feedback",
 "studentFeedback",
 ], FEEDBACK_ROW_ALIASES);

 normalizeSectionRows(normalized, "obeRows", [
 "obe_rows",
 "obeRows",
 "learning_outcomes",
 "learningOutcomes",
 "obe_practice",
 "obePractice",
 ], OBE_ROW_ALIASES);

 normalizeSectionRows(normalized, "mentoringRows", [
 "mentoring_rows",
 "mentoringRows",
 "student_mentoring",
 "studentMentoring",
 ], MENTORING_ROW_ALIASES);

 normalizeSectionRows(normalized, "deptActs", [
 "department_activities",
 "departmentActivities",
 "departmental_activities",
 "departmentalActivities",
 "dept_acts",
 ]);

 normalizeSectionRows(normalized, "uniActs", [
 "university_activities",
 "universityActivities",
 "uni_acts",
 ]);

 const eventRows = normalizeSectionRows(normalized, "eventRows", [
 "event_rows",
 "eventRows",
 "events",
 "event_organisation",
 "eventOrganisation",
 ], EVENT_ROW_ALIASES);
 normalizeSectionRows(normalized, "events", [
 "events",
 "eventRows",
 "event_rows",
 "event_organisation",
 "eventOrganisation",
 ], EVENT_ROW_ALIASES);
 if (!Array.isArray(normalized.events) && eventRows) {
 normalized.events = aliasKeys(eventRows, EVENT_ROW_ALIASES);
 }

 normalizeSectionRows(normalized, "society", [
 "social_contributions",
 "socialContributions",
 "contribution_to_society",
 "contributionToSociety",
 ], SOCIETY_ROW_ALIASES);

 normalizeSectionRows(normalized, "industry", [
 "industry_connect",
 "industryConnect",
 ], INDUSTRY_ROW_ALIASES);

 const alumniRows = normalizeSectionRows(normalized, "alumniRows", [
 "alumni_rows",
 "alumniRows",
 "alumni",
 "alumni_engagement",
 "alumniEngagement",
 ], ALUMNI_ROW_ALIASES);
 normalizeSectionRows(normalized, "alumni", [
 "alumni",
 "alumniRows",
 "alumni_rows",
 "alumni_engagement",
 "alumniEngagement",
 ], ALUMNI_ROW_ALIASES);
 if (!Array.isArray(normalized.alumni) && alumniRows) {
 normalized.alumni = aliasKeys(alumniRows, ALUMNI_ROW_ALIASES);
 }

 const placementRows = normalizeSectionRows(normalized, "placementRows", [
 "placement_rows",
 "placementRows",
 "placements",
 "student_placements",
 "studentPlacements",
 ], PLACEMENT_ROW_ALIASES);
 normalizeSectionRows(normalized, "placements", [
 "placements",
 "placementRows",
 "placement_rows",
 "student_placements",
 "studentPlacements",
 ], PLACEMENT_ROW_ALIASES);
 if (!Array.isArray(normalized.placements) && placementRows) {
 normalized.placements = aliasKeys(placementRows, PLACEMENT_ROW_ALIASES);
 }

 normalizeSectionRows(normalized, "acr", [
 "acr_scores",
 "acrScores",
 "annual_confidential_report",
 "annualConfidentialReport",
 ], LABEL_ROW_ALIASES);

 normalizeSectionRows(normalized, "journals", [
 "journal_publications",
 "journalPublications",
 "research_papers",
 "researchPapers",
 "research_papers_journal_publications",
 "researchPapersJournalPublications",
 "journal_publication",
 "journalPublication",
 ], JOURNAL_ROW_ALIASES);

 normalizeSectionRows(normalized, "popularWritings", [
 "popular_writings",
 "popularWritings",
 ], POPULAR_WRITING_ROW_ALIASES);

 normalizeSectionRows(normalized, "books", [
 "book_publications",
 "bookPublications",
 "book_chapters",
 "bookChapters",
 "books_book_chapters",
 "booksBookChapters",
 ], BOOK_ROW_ALIASES);

 normalizeSectionRows(normalized, "ict", [
 "ict_pedagogy",
 "ictPedagogy",
 "e_content",
 "eContent",
 "ict_e_content",
 "ictEContent",
 ], ICT_ROW_ALIASES);

 normalizeSectionRows(normalized, "research", [
 "research_guidance",
 "researchGuidance",
 ], RESEARCH_ROW_ALIASES);

 const standardProjectRows = normalizeSectionRows(normalized, "projects2", [
 "research_projects",
 "researchProjects",
 "internal_projects",
 "internalProjects",
 "consultancy_internal_projects",
 "consultancyInternalProjects",
 ], RESEARCH_PROJECT_ROW_ALIASES);
 const internalProjectRows = normalizeSectionRows(normalized, "internalProjects", [
 "research_projects",
 "researchProjects",
 "projects2",
 "internal_projects",
 "consultancy_internal_projects",
 "consultancyInternalProjects",
 ], RESEARCH_PROJECT_ROW_ALIASES);
 if (!Array.isArray(normalized.projects2) && internalProjectRows) {
 normalized.projects2 = aliasKeys(internalProjectRows, RESEARCH_PROJECT_ROW_ALIASES);
 }
 if (!Array.isArray(normalized.internalProjects) && standardProjectRows) {
 normalized.internalProjects = aliasKeys(standardProjectRows, RESEARCH_PROJECT_ROW_ALIASES);
 }

 normalizeSectionRows(normalized, "externalProjects", [
 "external_research_projects",
 "externalResearchProjects",
 "external_projects",
 "external_projects_consultancy",
 "externalProjectsConsultancy",
 ], RESEARCH_PROJECT_ROW_ALIASES);

 normalizeSectionRows(normalized, "ipr", [
 "ipr_records",
 "iprRecords",
 ], IPR_ROW_ALIASES);

 normalizeSectionRows(normalized, "patents", [
 "patent_records",
 "patentRecords",
 ], PATENT_ROW_ALIASES);

 normalizeSectionRows(normalized, "awards", [
 "research_awards",
 "researchAwards",
 ], AWARD_ROW_ALIASES);

 normalizeSectionRows(normalized, "confs", [
 "conferences",
 "invited_lectures",
 "invitedLectures",
 ], CONF_ROW_ALIASES);

 normalizeSectionRows(normalized, "consultancy", [
 "consultancy",
 "consultancy_rows",
 "consultancyRows",
 "creative_commissions",
 "creativeCommissions",
 ], CONSULTANCY_ROW_ALIASES);

 normalizeSectionRows(normalized, "proposals", [
 "research_proposals",
 "researchProposals",
 "submitted_research_proposals",
 "submittedResearchProposals",
 ]);

 normalizeSectionRows(normalized, "products", [
 "products_developed",
 "productsDeveloped",
 ], PRODUCT_ROW_ALIASES);

 normalizeSectionRows(normalized, "innovation", [
 "innovation",
 "innovation_rows",
 "innovationRows",
 "products",
 "products_developed",
 "productsDeveloped",
 "startupRows",
 "startups",
 ], PRODUCT_ROW_ALIASES);

 normalizeSectionRows(normalized, "fdps", [
 "self_development",
 "selfDevelopment",
 "fdp_workshops",
 "fdpWorkshops",
 ], FDP_ROW_ALIASES);

 normalizeSectionRows(normalized, "training", [
 "industrial_training",
 "industrialTraining",
 ]);

 const innovRows = normalizeSectionRows(normalized, "innovRows", [
 "innovativeTeachingRows",
 "innovative_teaching_rows",
 ], INNOVATIVE_ROW_ALIASES);
 const innovativeTeaching = normalized.innovativeTeaching || normalized.innovative_teaching;
 if (innovativeTeaching && typeof innovativeTeaching === "object" && !Array.isArray(innovativeTeaching)) {
 if (normalized.innovDetails == null && innovativeTeaching.details != null) {
 normalized.innovDetails = innovativeTeaching.details;
 }
 if (normalized.innovScore == null && innovativeTeaching.score != null) {
 normalized.innovScore = innovativeTeaching.score;
 }
 if (!innovRows) {
 normalized.innovRows = [{
 method: innovativeTeaching.method || innovativeTeaching.methods_used || innovativeTeaching.details || "",
 details: innovativeTeaching.details || "",
 score: innovativeTeaching.score ?? "",
 hod: innovativeTeaching.hod ?? innovativeTeaching.hod_score,
 director: innovativeTeaching.director ?? innovativeTeaching.director_score,
 dean: innovativeTeaching.dean ?? innovativeTeaching.dean_score,
 vc: innovativeTeaching.vc ?? innovativeTeaching.vc_score,
 }];
 }
 }

 if (mediaOrDesign) {
 if (Array.isArray(normalized.innovRows)) normalized.innovRows = normalized.innovRows.map((row) =>({ ...row, max: row.max || 4, sectionMax: row.sectionMax || row.section_max || 10 }));
 if (Array.isArray(normalized.society)) normalized.society = normalized.society.map((row) =>({ ...row, max: row.max || 10 }));
 if (Array.isArray(normalized.externalProjects)) normalized.externalProjects = normalized.externalProjects.map((row) =>({ ...row, max: row.max || 20 }));
 } else {
 if (Array.isArray(normalized.innovRows)) normalized.innovRows = normalized.innovRows.map((row) =>({ ...row, max: row.max || 4 }));
 if (Array.isArray(normalized.projects2)) normalized.projects2 = normalized.projects2.map((row) =>({ ...row, max: row.max || 40 }));
 if (Array.isArray(normalized.society)) normalized.society = normalized.society.map((row) =>({ ...row, max: row.max || 20 }));
 }

 return normalizeInnovativeReviewScoreAliases(normalizeReviewScoreAliasesOnRows(normalized));
};

const normalizeFetchedAppraisal = (data = {}, scope = {}) =>{
 const reviews = reviewsFromAppraisalResponse(data);
 const payload = data.payload ? { ...data.payload } : null;
 const declaration = data.declaration || payload?.declaration || null;
 const snapshotPayload = scope?.snapshotPayload || null;
 const docs = mergeDocsMaps(snapshotPayload?.docs, snapshotPayload?.form?.docs, submittedDocsFromResponse(data, scope) || {});
 const withResponseInfo = (form = {}, ...sources) =>({
 ...form,
 info: normalizeInfo(form.info || {}, form, ...sources),
 });
 const payloadForm = payload?.form ? attachSubmittedScoreSummary(
 mergeReviewScoresIntoForm(withResponseInfo(mergeMissingSubmittedFormData(normalizeFetchedForm(payload.form), snapshotPayload), payload, data), reviews),
 data,
 payload,
 payload.totals,
 ) : null;
 const directForm = data.form ? attachSubmittedScoreSummary(
 mergeReviewScoresIntoForm(withResponseInfo(mergeMissingSubmittedFormData(normalizeFetchedForm(data.form), snapshotPayload), data, payload), reviews),
 data,
 data.totals,
 ) : null;
 const directData = attachSubmittedScoreSummary(
 mergeReviewScoresIntoForm(withResponseInfo(mergeMissingSubmittedFormData(normalizeFetchedForm(data), snapshotPayload), data, payload), reviews),
 data,
 data.totals,
 payload,
 payload?.totals,
 );

 const regRev = reviews.find(r => normalizeRoleForWorkflow(r.reviewer_role || r.reviewerRole || r.role) === "registrar");
 const regScore = firstPresent(data.registrar_part_d_score, data.registrarPartDScore, regRev?.registrar_part_d_score, regRev?.registrarPartDScore, regRev?.part_d_score, regRev?.partDScore);
 const regRemarks = firstPresent(data.registrar_part_d_remarks, data.registrarPartDRemarks, regRev?.remarks, regRev?.review_remarks);
 const regReviewedAt = firstPresent(data.registrar_part_d_reviewed_at, data.registrarPartDReviewedAt, regRev?.reviewed_at);
 const regSectionScores = parseMaybeJson(regRev?.section_scores) || parseMaybeJson(regRev?.sectionScores);
 const regLeave = regSectionScores?.registrar_part_d_leave_management || data.registrar_part_d_leave_management || data.registrarPartDLeaveManagement;

 return {
   ...directData,
   docs,
   declaration,
   status: declaration?.status || data.status || directData.status,
   workflowStatus: declaration?.status || data.workflowStatus || data.workflow_status || directData.workflowStatus,
   partDStatus: data.part_d_status || data.partDStatus || declaration?.part_d_status || directData.partDStatus,
   registrarPartDScore: regScore !== undefined && regScore !== null && regScore !== "" ? Number(regScore) : directData.registrarPartDScore,
   registrarPartDRemarks: regRemarks || directData.registrarPartDRemarks,
   registrarPartDReviewedAt: regReviewedAt || directData.registrarPartDReviewedAt,
   registrarPartDLeaveManagement: regLeave || directData.registrarPartDLeaveManagement,
   ...(regLeave && Array.isArray(regLeave) ? { leaveManagement: regLeave, leave_management: regLeave } : {}),
   ...(directForm ? { form: { ...directForm, docs, ...(regLeave && Array.isArray(regLeave) ? { leaveManagement: regLeave, leave_management: regLeave } : {}) } } : {}),
   ...(payload ? { payload: { ...payload, docs, ...(payloadForm ? { form: { ...payloadForm, docs, ...(regLeave && Array.isArray(regLeave) ? { leaveManagement: regLeave, leave_management: regLeave } : {}) } } : {}) } } : {}),
 };
};

const renameKeys = (rows, mapping) =>
 (rows || []).map((row) =>{
 const out = { ...row };
 Object.entries(mapping).forEach(([from, to]) =>{
 if (from in out) { out[to] = out[from]; delete out[from]; }
 });
 return out;
 });

// Like renameKeys, but never lets an empty source clobber a target that already has data.
// For the Standard engine, where `label` is the row's real field and `activity` is only the
// wire key: `label` wins whenever it has a value (that's the edit the user just made), and an
// empty `label` can't wipe a populated `activity`.
const coalesceKeys = (rows, mapping) =>
 (rows || []).map((row) =>{
 const out = { ...row };
 Object.entries(mapping).forEach(([from, to]) =>{
 if (!(from in out)) return;
 const fromValue = out[from];
 const hasFrom = String(fromValue ?? "").trim() !== "";
 const hasTo = String(out[to] ?? "").trim() !== "";
 if (hasFrom || !hasTo) out[to] = fromValue;
 delete out[from];
 });
 return out;
 });

// The mirror of coalesceKeys for the Creative/Media/Design engine, where `activity` is the
// row's real field and `label` is only ever a stale ghost that normalizeFetchedForm backfills
// on every round-trip. `label` may fill an *empty* `activity` but must never replace one the
// user has edited - otherwise resubmitting after a rejection reverts the C4 text to its old
// value (the ghost `label` still holds the pre-edit string).
const fillEmptyKeys = (rows, mapping) =>
 (rows || []).map((row) =>{
 const out = { ...row };
 Object.entries(mapping).forEach(([from, to]) =>{
 if (!(from in out)) return;
 if (String(out[to] ?? "").trim() === "" && String(out[from] ?? "").trim() !== "") {
 out[to] = out[from];
 }
 delete out[from];
 });
 return out;
 });

const dropKeys = (rows, keys = []) =>
 (rows || []).map((row) =>{
 const out = { ...row };
 keys.forEach((key) =>{ delete out[key]; });
 return out;
 });

const isMediaOrDesignForm = (form = {}) =>
 Array.isArray(form.popularWritings) || Array.isArray(form.ipr);

const mapFormForSubmit = (form = {}) =>{
 const mediaOrDesign = isMediaOrDesignForm(form);
 const books = mediaOrDesign
 ? dropKeys(renameKeys(form.books, { coAuthors: "coauthor", first: "first_author" }), ["pub", "coauth"])
 : dropKeys(renameKeys(form.books, { pub: "publisher", coauth: "coauthor", first: "first_author" }), ["coAuthors"]);

 return {
 ...form,
 lectures: renameKeys(form.lectures, {
 sem: "semester", code: "course_code",
 planned: "planned_classes", conducted: "conducted_classes",
 }),
 feedback: renameKeys(form.feedback, {
 code: "course_code", fb1: "feedback_1", fb2: "feedback_2",
 }),
 society: mediaOrDesign
 ? fillEmptyKeys(form.society, { label: "activity", participated: "status" })
 : coalesceKeys(form.society, { label: "activity", participated: "status" }),
 journals: renameKeys(form.journals, { index: "indexing" }),
 books,
 ict: renameKeys(form.ict, { desc: "description", quad: "quadrant" }),
 research: renameKeys(form.research, { name: "student_name" }),
 projects2: renameKeys(form.projects2, {
 date: "sanction_date", status: "project_status",
 }),
 internalProjects: renameKeys(form.internalProjects, {
 date: "sanction_date", status: "project_status",
 }),
 externalProjects: renameKeys(form.externalProjects, {
 date: "sanction_date", status: "project_status",
 }),
 ipr: renameKeys(form.ipr, {
 date: "ipr_date", status: "ipr_status", fileNo: "file_no",
 }),
 patents: renameKeys(form.patents, {
 date: "patent_date", status: "patent_status", fileNo: "file_no",
 }),
 awards: renameKeys(form.awards, { date: "award_date" }),
 confs: renameKeys(form.confs, { org: "organization" }),
 products: mediaOrDesign ? renameKeys(form.products, { used: "usage" }) : dropKeys(form.products, ["used"]),
 fdps: renameKeys(form.fdps, { org: "organization" }),
 };
};

export const submitAppraisal = async ({
 facultyEmail,
 academicYear,
 form,
 totals,
 docs,
 submitterProfile,
 activeProfile,
}) =>{
 if (!facultyEmail) throw new Error("Please login again. Your email was not found in this session.");
 if (!academicYear) throw new Error("Academic year is required before submitting.");

 const workflowProfile = submitterProfile || activeProfile || {};
 const reviewChain = getReviewChain(workflowProfile);
 const nextReviewer = reviewChain[0] || "";
 const workflowStatus = nextReviewer ? pendingStatusFor(nextReviewer) : "Submitted";
 const basePayload = {
 academic_year: academicYear,
 form: mapFormForSubmit(form),
 totals: normalizeTotalsForSubmit(totals),
 docs: normalizeDocsMap(docs),
 submitter_profile: submitterProfile || activeProfile,
 };

 await api.put("/appraisal/snapshot", {
 academic_year: academicYear,
 payload: {
 form,
 totals,
 submitterProfile: submitterProfile || activeProfile,
 submittedAt: new Date().toISOString(),
 submitted: true,
 },
 docs: normalizeDocsMap(docs),
 });

 const submitWithWorkflow = {
  ...basePayload,
  totals: legacyTotalsForSubmit(totals),
  status: workflowStatus,
  workflow_status: workflowStatus,
  next_reviewer: nextReviewer,
 next_reviewer_role: nextReviewer,
 review_chain: reviewChain,
 };

 try {
 await api.post("/appraisal/submit", submitWithWorkflow);
 } catch (err) {
 const canRetry = [400, 422, 500].includes(err?.response?.status || err?.statusCode);
 if (!canRetry) throw err;

 const legacyPayload = {
 ...basePayload,
 form: legacyFormForSubmit(basePayload.form),
 totals: legacyTotalsForSubmit(totals),
 };

 try {
 await api.post("/appraisal/submit", legacyPayload);
 } catch (fallbackErr) {
 throw fallbackErr?.message ? fallbackErr : err;
 }
 }
};

// Section rows to used by the review workflow to get section data from snapshot rows.
export const sectionRowsFromSnapshot = (snapshotPayload) =>{
 const form = snapshotFormFromPayload(snapshotPayload);
 if (!form) return {};
 return normalizeFetchedForm(form);
};

export const saveAppraisal = saveAppraisalDraftSection;
