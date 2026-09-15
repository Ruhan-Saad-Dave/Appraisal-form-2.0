/* eslint-disable no-unused-vars */
import { DynamicAuthorityReviewPanel } from "../../features/dynamic-appraisal";
import { dynamicReviewForm } from "../../utils/dynamicAppraisalData";
import { useReviewFeedback } from "../../components/reviewFeedbackContext";
import ReviewerReportHeader from "../../components/dashboard/ReviewerReportHeader";
import { useState, useRef, useEffect, useMemo } from "react";
import { DirectorFacultyReviewForm } from "../../components/appraisal";
import { api } from "../../services/api";
import { Avatar, ScoreCard, ScoreBar, StatusBadge, ReviewMetricsStrip, uploadedDocCount } from "../../components/dashboard/dashboardPrimitives";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import { ACR_DETAIL_POINTS, SOCIETY_LABELS, MAX_SCORES, APP_INFO, createAcrRows, fetchSavedAppraisal, loadAppraisalDocuments, loadSavedAppraisal, mergeFacultyInfo, saveAppraisalDraftSection, submitAppraisal, fetchReviewQueueForRole, loadReviewerDraft, saveReviewerDraft, submitWorkflowReview, INNOVATIVE_METHODS, SCORE_LIMITS, averageSectionScore, clampScore, clampReviewScore, courseFileAverageScore, courseFileRowScore, effectiveMaxScore, feedbackAverage, feedbackRowScore, feedbackSectionScore, innovativeSelectionsFromDetails, innovativeTeachingScore, isAllowedAttachmentFile, isValidDDMMYYYY, maskDateDDMMYYYY, normalizeAutoScores, projectGuidanceRowMax, researchGuidanceRowMax, researchGuidanceScore, reviewSectionScore, rowHasReviewableData, isSectionEmpty, scoreRemaining, selfEffectivePartAMax, societyRowLocked, societyRowScore, sumSectionScore, toggleInnovativeMethod, validateCompleteRows, buildReviewRemarks, standardSubmittedScoreSummary, AppraisalHeaderImage, SummaryOtherInfoField, summaryOtherInfoValueFrom, RejectionNotice, DocCell, ViewCell, ViewDocsCell, RowButtons as RowBtns, SectionSaveFooter, SectionCard as SC, T, TH, TH_HOD, TH_DIR, TD, TDC, TDS, TDS_HOD, TDS_DIR, TDV, MyAppraisalSection, CreativeSchoolAuthorityReviewPanel, isCreativeSchool, isDesignArtsSchool, isMediaCommSchool } from "../../features/faculty-appraisal";
import { getActiveAcademicYear, getSessionItem, normalizeAcademicYearLabel, setActiveAcademicYear, storeUserSession } from "../../auth/session";
import { PreviousYearReportViewer } from "../../features/previousYearReport";
import { isLegacyTwoPartAcademicYear } from "../../features/faculty-appraisal/forms/standard/legacyPreviousYearReportUtils";
import { legacyDashboardMetrics } from "../../utils/legacyDashboardMetrics";
import { canReviewerRejectProfile, getDeanTrack, getReviewChain, rejectedStatusFor, reviewedStatusFor, profileFromsessionStorage, workflowValidationError, roleLabel, isAppraisalFinalisedByVc, isRejectedStatus, isPendingReviewStatusFor, hasActiveRejection, reviewListFrom } from "../../utils/hierarchy";
import { n, pct, grade, RO, TI } from "../../features/faculty-appraisal/shared";
import { FacultyRecordHeader, ScoreTable, VCFinalRemarks, FinalSubmitButton, FACULTY_RECORD_THEME } from "../../components/dashboard/FacultyAppraisalRecord";
import { fetchImageAsDataUrl } from "../../utils/fullFormReport";
import ManageDepartmentsPanel from "../../components/dashboard/ManageDepartmentsPanel";
import { listSchoolDepartments } from "../../services/departmentsService";
import { enrichQueueItem } from "../../services/reviewWorkflow";
import { refreshSchoolsOnce, useSchools } from "../../services/schoolsService";
import { useAssignedFormAssignment } from "../../features/faculty-appraisal/hooks/useAssignedFormAssignment";
import { useCustomFormParts } from "../../features/faculty-appraisal/hooks/useCustomFormParts";
import LazyVisible from "../../components/dashboard/LazyVisible";
import { getSchoolByValue, schoolUnitLabel } from "../../constants/universityHierarchy";

// - Helpers - (n, pct, grade, RO, TI → imported from shared)
const docsCount = (docs = {}, item = {}) => uploadedDocCount(docs, item);
const scoreText = (value) =>{
 const score = n(value);
 return Number.isFinite(score) ? score.toFixed(1) : "0.0";
};

const REVIEW_ARRAY_KEYS = ["lectures", "courseFile", "obeRows", "projects", "mentoringRows", "quals", "feedback", "deptActs", "uniActs", "eventRows", "society", "industry", "alumniRows", "placementRows", "acr", "journals", "books", "ict", "research", "projects2", "patents", "awards", "confs", "proposals", "products", "fdps"];
const REVIEW_SECTION_MAX = { lectures: 10, courseFile: 20, obeRows: 20, projects: 20, mentoringRows: 10, quals: 10, feedback: 10, deptActs: 30, uniActs: 50, eventRows: 20, society: 10, industry: 10, alumniRows: 10, placementRows: 20, acr: 50, journals: 100, books: 30, ict: 20, research: 20, projects2: 40, patents: 40, awards: 20, confs: 20, proposals: 20, products: 20, fdps: 20 };
const STANDARD_INNOVATIVE_SECTION_MAX = 20;
const STANDARD_INNOVATIVE_ROW_MAX = 4;
const REVIEW_SCORE_FIELDS = ["hod", "director", "dean", "vc"];
const storedAcademicYearCycles = () => {
 try {
 if (getSessionItem("availableCyclesSource") !== "backend") return [];
 return JSON.parse(getSessionItem("availableCycles") || "[]")
 .map((cycle) => {
 const academicYear = normalizeAcademicYearLabel(cycle?.academic_year || cycle?.academicYear || cycle?.year || cycle?.year_label || cycle);
 return academicYear ? { academic_year: academicYear, is_open: cycle?.is_open ?? cycle?.isOpen ?? cycle?.active ?? cycle?.open ?? academicYear === APP_INFO.DEFAULT_AY } : null;
 })
 .filter(Boolean);
 } catch {
 return [];
 }
};
const previousYearFormTypeFor = (profile = {}) => {
 if (isMediaCommSchool(profile, profile.info?.school, profile.school)) return "mediaCommunication";
 if (isDesignArtsSchool(profile, profile.info?.school, profile.school)) return "designArts";
 return "engineering";
};
function PreviousYearAuthorityResult({ item, onBack }) {
 return (
 <div style={{ display: "grid", gap: 12 }}>
 <button type="button" onClick={onBack} style={{ justifySelf: "start", border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 8, padding: "8px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Back</button>
 <PreviousYearReportViewer showTables visibleLevels={["faculty", "director"]} formType={previousYearFormTypeFor(item)} form={item} docs={item.docs || {}} response={item.previousYearResponse || item} academicYear={item.academicYear || item.academic_year || item.info?.ay} profile={item} reviews={reviewListFrom(item.reviews || item.previousYearResponse?.reviews || item.previousYearResponse?.payload?.reviews)} />
 </div>
 );
}
const clampDirectorReviewScore = (section, row, value, maxScore) =>{
 if (String(value ?? "").trim() === "") return "";
 if (section !== "acr" && clampReviewScore(section, row, value, maxScore) === "") return "";
 return String(clampScore(value, maxScore));
};
const preserveSavedReviewScores = (form = {}, source = {}) =>{
 const merged = { ...form };
 merged.info = mergeFacultyInfo(form.info, source, form);
 REVIEW_ARRAY_KEYS.forEach((key) =>{
 if (!Array.isArray(form[key])) return;
 const sourceRows = Array.isArray(source[key]) ? source[key] : [];
 merged[key] = form[key].map((row, index) =>{
 const sourceRow = sourceRows[index] || {};
 const next = { ...row };
 REVIEW_SCORE_FIELDS.forEach((field) =>{
 if (String(next[field] ?? "").trim() === "" && String(sourceRow[field] ?? "").trim() !== "") {
 next[field] = sourceRow[field];
 }
 });
 return next;
 });
 });
 ["innovHod", "innovDirector", "innovDean", "innovVc"].forEach((field) =>{
 if (String(merged[field] ?? "").trim() === "" && String(source[field] ?? "").trim() !== "") {
 merged[field] = source[field];
 }
 });
 if (Array.isArray(form.innovRows)) {
 const sourceRows = Array.isArray(source.innovRows) ? source.innovRows : [];
 merged.innovRows = form.innovRows.map((row, index) =>{
 const sourceRow = sourceRows[index] || {};
 const next = { ...row };
 REVIEW_SCORE_FIELDS.forEach((field) =>{
 if (String(next[field] ?? "").trim() === "" && String(sourceRow[field] ?? "").trim() !== "") next[field] = sourceRow[field];
 });
 return next;
 });
 }
 return merged;
};
const buildDirectorSectionScores = (faculty, dirData) =>{
 const payload = {};
 REVIEW_ARRAY_KEYS.forEach((key) =>{
 const rows = key === "acr" ? createAcrRows(faculty.acr) : (Array.isArray(faculty[key]) ? faculty[key] : []);
 payload[key] = rows.map((row, index) =>{
 const reviewRow = dirData[key]?.[index] || {};
 const score = key === "society" && societyRowLocked(row)
 ? "0"
 : clampDirectorReviewScore(key, row, reviewRow.director ?? reviewRow.director_score ?? reviewRow.directorScore ?? reviewRow.dir ?? row.director ?? row.director_score ?? row.directorScore ?? row.dir ?? "", REVIEW_SECTION_MAX[key] || 0);
 return {
 ...row,
 dir: score,
 director: score,
 director_score: score,
 };
 });
 });
 const innovRows = Array.isArray(faculty.innovRows) ? faculty.innovRows : [];
 const reviewInnovRows = Array.isArray(dirData.innovRows) ? dirData.innovRows : [];
 const mergedInnovRows = innovRows.map((row, index) =>{
 const score = isSectionEmpty("innovRows", faculty.innovRows, faculty.docs)
   ? ""
   : clampDirectorReviewScore("innovRows", { ...row, max: row.max || STANDARD_INNOVATIVE_ROW_MAX }, reviewInnovRows[index]?.director ?? reviewInnovRows[index]?.director_score ?? reviewInnovRows[index]?.directorScore ?? reviewInnovRows[index]?.dir ?? row.director ?? row.director_score ?? row.directorScore ?? row.dir ?? "", STANDARD_INNOVATIVE_SECTION_MAX);
 return {
 ...row,
 max: row.max || STANDARD_INNOVATIVE_ROW_MAX,
 sectionMax: row.sectionMax || STANDARD_INNOVATIVE_SECTION_MAX,
 dir: score,
 director: score,
 director_score: score,
 };
 });
 const innovTotal = reviewSectionScore("innovRows", mergedInnovRows, STANDARD_INNOVATIVE_SECTION_MAX, "director");
 payload.innovRows = mergedInnovRows;
 payload.innovativeTeaching = {
 director: innovTotal ? String(innovTotal) : dirData.innovDir ?? faculty.innovDirector ?? "",
 };
 return payload;
};
const normalizeDirectorDraftData = (sectionScores = {}) =>{
 const next = { ...(sectionScores || {}) };
 REVIEW_ARRAY_KEYS.forEach((key) =>{
 if (!Array.isArray(next[key])) return;
 next[key] = next[key].map((row = {}) =>{
 const score = row.director ?? row.director_score ?? row.directorScore ?? row.dir ?? "";
 return {
 ...row,
 dir: score,
 director: score,
 director_score: score,
 };
 });
 });
 if (Array.isArray(next.innovRows)) {
 next.innovRows = next.innovRows.map((row = {}) =>{
 const score = row.director ?? row.director_score ?? row.directorScore ?? row.dir ?? "";
 return {
 ...row,
 dir: score,
 director: score,
 director_score: score,
 };
 });
 }
 if (next.innovativeTeaching?.director && !next.innovDir) {
 next.innovDir = next.innovativeTeaching.director;
 }
 return next;
};

const STANDARD_ARRAY_SECTIONS = [
 "lectures", "courseFile", "projects", "quals", "feedback", "deptActs", "uniActs",
 "society", "industry", "acr", "journals", "books", "ict", "research", "projects2",
 "externalProjects", "patents", "awards", "confs", "proposals", "products", "fdps", "training",
];
const STANDARD_REPORT_PART_A_SECTIONS = [
 { key: "lectures", title: "A1. Lectures / Tutorials / Practicals", max: 40, doc: "lec", fields: [["sem", "Semester"], ["code", "Course Code / Name"], ["planned", "Classes (as per course structure)"], ["conducted", "Classes Actually Conducted"], ["pctConducted", "% Conducted"]] },
 { key: "courseFile", title: "A2. Course File", max: 20, doc: "courseFile", fields: [["course", "Course / Paper"], ["title", "Program & Semester"], ["details", "IQAC Index Compliance (Yes/No, with proof)"]] },
 { key: "innovRows", title: "A3. Innovative Teaching-Learning Methods", max: 10, doc: "innov", fields: [["method", "Methods Used"], ["details", "Details"]] },
 { key: "feedback", title: "A4. Student Feedback", max: 10, doc: "fb", fields: [["code", "Course Code / Name"], ["fb1", "First Feedback(%)"], ["fb2", "Second Feedback(%)"]] },
 { key: "obeRows", title: "A5. Learning Outcomes Attainment & OBE Practice", max: 20, doc: "obe", fields: [["component", "Component"], ["evidence", "Evidence"]] },
 { key: "projects", title: "A6. Guided Students Project", max: 20, doc: "proj", fields: [["label", "Project Category"]] },
 { key: "mentoringRows", title: "A7. Student Mentoring & Counselling", max: 10, doc: "mentor", fields: [["activity", "Activity"], ["evidence", "Evidence"]] },
 { key: "quals", title: "A8. Professional Development & Qualification Enhancement", max: 10, doc: "qual", fields: [["label", "Qualification / Category"], ["awardingBody", "Awarding Body"], ["date", "Date"]] },
];
const STANDARD_REPORT_PART_B_SECTIONS = [
 { key: "journals", title: "B1. Journal Publications", max: 100, doc: "jour", fields: [["title", "Title"], ["journal", "Journal"], ["issn", "DOI No."], ["impactFactor", "Impact Factor"], ["authorPosition", "Author Position"]] },
 { key: "books", title: "B2. Books, Book Chapters & Edited Volumes", max: 30, doc: "book", fields: [["title", "Title"], ["book", "Publisher & ISBN"], ["pub", "Type"], ["level", "Level"], ["coauth", "Co-authors from DYPIU"]] },
 { key: "patents", title: "B3. Patents, Copyrights & IP and Product Development", max: 40, doc: "pat", fields: [["title", "Title"], ["type", "National / International"], ["status", "Status"], ["fileNo", "Filing / Grant No. & Date"]] },
 { key: "projects2", title: "B4. External Funded Research Projects", max: 40, doc: "project2", fields: [["title", "Title of Project"], ["agency", "Funding Agency"], ["date", "Sanction Date"], ["amount", "Amount"], ["role", "PI / Co-PI"], ["status", "Status"]] },
 { key: "research", title: "B5. Research Guidance", max: 20, doc: "res", fields: [["degree", "Degree"], ["name", "Name of Student / Scholar"], ["status", "Status"], ["date", "Date"]] },
 { key: "proposals", title: "B6. Consultancy, Testing & Training", max: 20, doc: "prop", fields: [["agency", "Client / Organisation"], ["duration", "Nature of Engagement"], ["amount", "Revenue Generated"]] },
 { key: "confs", title: "B7. Conference / FDP / Training / Workshop Contributions as Resource Person", max: 20, doc: "conf", fields: [["title", "Event / Session Title"], ["role", "Role"], ["date", "Date"], ["level", "Level"]] },
 { key: "fdps", title: "B8. Conference / FDP / Industry Training - Attended", max: 20, doc: "fdp", fields: [["program", "Programme / Event"], ["fromDate", "From"], ["toDate", "To"], ["org", "Organised By"]] },
 { key: "awards", title: "B9. Research Awards, Fellowships, Reviewer of Journal & Citations", max: 20, doc: "awd", fields: [["title", "Title of Award / Fellowship / Metric"], ["agency", "Awarding Agency"], ["level", "Level"], ["date", "Date"]] },
 { key: "products", title: "B10. Innovation, Start-ups & Technology Transfer", max: 20, doc: "prod", fields: [["details", "Title / Start-up / Product"], ["role", "Role"], ["status", "Status"]] },
 { key: "ict", title: "B11. ICT Content, MOOCs & E-Learning", max: 20, doc: "ict", fields: [["title", "Title"], ["type", "Platform / Type"], ["quad", "Reach / Views"]] },
];
const STANDARD_REPORT_PART_C_SECTIONS = [
 { key: "uniActs", title: "C1. Administration at University Level", max: 50, doc: "uni", fields: [["activity", "Activity"], ["nature", "Nature"], ["period", "Period"]] },
 { key: "deptActs", title: "C2. Administration at School Level", max: 30, doc: "dept", fields: [["activity", "Activity"], ["nature", "Nature"], ["period", "Period"]] },
 { key: "eventRows", title: "C3. Event Organisation & Institutional Visibility", max: 20, doc: "event", fields: [["event", "Event / Contribution"], ["role", "Role"], ["fromDate", "From"], ["toDate", "To"], ["level", "Level"]] },
 { key: "society", title: "C4. Outreach, Extension & Social Responsibility", max: 20, doc: "soc", fields: [["label", "Activity"], ["details", "Details"], ["date", "Date"]] },
 { key: "industry", title: "C5. Industry Interaction & Linkages", max: 10, doc: "ind", fields: [["activity", "Activity"], ["partner", "Industry Partner"], ["date", "Date"]] },
 { key: "alumniRows", title: "C6. Alumni Engagement & Networking", max: 10, doc: "alumni", fields: [["activity", "Activity"], ["details", "Details"], ["date", "Date"]] },
 { key: "placementRows", title: "C7. Student Placement Mentoring & Career Development", max: 20, doc: "placement", fields: [["activityType", "Activity Type"], ["name", "Student / Company Name"], ["date", "Date"]] },
];
const STANDARD_REPORT_PART_D_SECTIONS = [
 { key: "acr", title: "D1. Annual Confidential Report (ACR)", max: 50, doc: "acr", showDocuments: false, fields: [["label", "Attribute"]] },
];
const escapeReportHtml = (value) =>String(value ?? "")
 .replace(/&/g, "&amp;")
 .replace(/</g, "&lt;")
 .replace(/>/g, "&gt;")
 .replace(/"/g, "&quot;")
 .replace(/'/g, "&#39;");
const reportValue = (value) =>{
 const text = String(value ?? "").trim();
 return text ? escapeReportHtml(text) : "&nbsp;";
};
const directorReportScore = (section, row = {}, role, sectionMax) =>{
 if (role === "score") return String(row.score ?? "").trim() ? clampScore(row.score, sectionMax).toFixed(1) : "";
 const raw = role === "hod"
 ? row.hod
 : row.director ?? row.dir;
 if (!String(raw ?? "").trim()) return "";
 const rowMax = section.key === "acr"
 ? SCORE_LIMITS.acrRow
 : section.key === "quals"
 ? SCORE_LIMITS.qualificationRow
 : section.key === "feedback"
 ? 10
 : section.key === "projects"
 ? projectGuidanceRowMax(row)
 : section.key === "research"
 ? researchGuidanceRowMax(row)
 : section.key === "courseFile"
 ? SCORE_LIMITS.courseFileRow
 : section.key === "fdps" || section.key === "training"
 ? SCORE_LIMITS.fdpRow
 : row.max || sectionMax;
 return clampScore(raw, rowMax).toFixed(1);
};
const directorReportSectionTotal = (section, rows, role) =>{
 if (!rows.length) return "";
 if (role === "score") {
 const total = sumSectionScore(rows, section.max, "score", (row) =>
 section.key === "quals" ? SCORE_LIMITS.qualificationRow : row.max || section.max,
 );
 return total ? total.toFixed(1) : "";
 }
 const key = role === "hod" ? "hod" : "director";
 const total = reviewSectionScore(section.key, rows, section.max, key);
 return total ? total.toFixed(1) : "";
};
const directorReportRowsFor = (form, section) =>{
 if (section.key === "acr") return createAcrRows(form.acr);
 if (section.key === "innovRows") {
 return Array.isArray(form.innovRows) && form.innovRows.length
 ? form.innovRows
 : [{ method: form.innovDetails || "", details: form.innovDetails || "", score: form.innovScore || "", director: form.innovDirector || "" }];
 }
 return Array.isArray(form[section.key]) ? form[section.key] : [];
};
const directorReportTable = ({ form, docs, section, scoreRoles, roleLabel }) =>{
 const rows = directorReportRowsFor(form, section);
 const showDocs = Boolean(section.doc) && section.showDocuments !== false && section.key !== "acr";
 const totalColSpan = section.fields.length + 1 + (showDocs ? 1 : 0);
 return `
  <h3>${escapeReportHtml(section.title)} <span>(Max ${escapeReportHtml(section.max)})</span></h3>
  <table>
    <thead><tr>
      <th>SN</th>
      ${section.fields.map(([, label]) =>`<th>${escapeReportHtml(label)}</th>`).join("")}
      ${showDocs ? "<th>Documents</th>" : ""}
      ${scoreRoles.map((role) =>`<th>${escapeReportHtml(roleLabel(role))}</th>`).join("")}
    </tr></thead>
    <tbody>
      ${(rows.length ? rows : [{}]).map((row, index) =>`
        <tr>
          <td class="c">${index + 1}</td>
          ${section.fields.map(([key]) =>`<td>${reportValue(
 key === "pctConducted"
 ? (row.pctConducted || (Number(row.planned) > 0 && Number(row.conducted) >= 0 ? `${((Number(row.conducted) / Number(row.planned)) * 100).toFixed(1)}%` : ""))
 : key === "label" && section.key === "quals"
 ? (row.label || row.title || row.qualificationTitle || row.qualification || row.name)
 : section.key === "research" && key === "date" && (row.status || row.thesis) === "Ongoing"
 ? "NA"
 : section.key === "eventRows" && (key === "fromDate" || key === "toDate")
 ? (row[key] || row.date)
 : row[key]
 )}</td>`).join("")}
          ${showDocs ? `<td>${reportValue((docs?.[`${section.doc}-${index}`] || []).map((file) =>file.name || file.url || "Document").join(", "))}</td>` : ""}
          ${scoreRoles.map((role) =>`<td class="c">${reportValue(directorReportScore(section, row, role, section.max))}</td>`).join("")}
        </tr>
      `).join("")}
      <tr class="tr">
        <td colspan="${totalColSpan}" class="c b">Total Score (Max ${escapeReportHtml(section.max)})</td>
        ${scoreRoles.map((role) =>`<td class="c b">${reportValue(directorReportSectionTotal(section, rows, role))}</td>`).join("")}
      </tr>
    </tbody>
  </table>`;
};
const directorReportPart = ({ title, sections, form, docs, scoreRoles, roleLabel }) =>`
  <div class="page-break"></div>
  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">${escapeReportHtml(title)}</h3>
  ${sections.map((section) =>directorReportTable({ form, docs, section, scoreRoles, roleLabel })).join("")}
`;
const directorSummaryRows = ({ totals, maxScores }) =>[
 ["Part A", totals.partA, maxScores.partA],
 ["Part B", totals.partB, maxScores.partB],
 ["Part C", totals.partC, maxScores.partC],
 ["Part E", totals.partD, maxScores.partD],
];

const asRows = (value) =>{
 if (Array.isArray(value)) return value;
 if (value && typeof value === "object") return [value];
 return [];
};

const normalizeStandardReviewSubject = (subject = {}) =>{
 const normalized = { ...subject };
 STANDARD_ARRAY_SECTIONS.forEach((key) =>{
 normalized[key] = asRows(normalized[key]);
 });
 normalized.docs = normalized.docs && typeof normalized.docs === "object" ? normalized.docs : {};
 normalized.info = mergeFacultyInfo(normalized.info, normalized);
 normalized.innovRows = Array.isArray(normalized.innovRows) && normalized.innovRows.length
 ? normalized.innovRows
 : [{ method: normalized.innovDetails || "", details: normalized.innovDetails || "", score: normalized.innovScore || "" }];
 return normalized;
};

// - Full Review Panel (opened when HOD clicks Review) -
function ReviewPanel({ faculty, onBack, onSubmit, readOnly = false }) {
  if (dynamicReviewForm(faculty)) return <DynamicAuthorityReviewPanel subject={faculty} reviewerRole="director" reviewerLabel="Director" onBack={onBack} onSubmit={onSubmit} readOnly={readOnly} />;
  if (isCreativeSchool(faculty)) {
    return (
      <CreativeSchoolAuthorityReviewPanel
        person={faculty}
        reviewerRole="director"
        onBack={onBack}
        onSubmit={(id, scores, remarks, sectionScores, reviewConfirmed, decision) => onSubmit(id, scores, remarks, sectionScores, reviewConfirmed, decision)}
        readOnly={readOnly}
        showReport={false}
      />
    );
  }
  return <StandardReviewPanel faculty={faculty} onBack={onBack} onSubmit={onSubmit} readOnly={readOnly} />;
}

function StandardReviewPanel({ faculty, onBack, onSubmit, readOnly = false }) {
  const confirmRejection = useReviewFeedback();
 const [hodData, setHodData] = useState({});
 const [dirData, setDirData] = useState({});
 const [hodRemarks] = useState(faculty.hodRemarks || "");
 const [dirRemarks, setDirRemarks] = useState(faculty.directorRemarks || "");
 const [sectionView, setSectionView] = useState("partA");
 const [reviewConfirmed, setReviewConfirmed] = useState(false);
 const [draftStatus, setDraftStatus] = useState("");
 const [savingDraft, setSavingDraft] = useState(false);
 const finalisedByVc = isAppraisalFinalisedByVc(faculty);
 const pendingThisReviewer = isPendingReviewStatusFor([faculty.status, faculty.workflowStatus, faculty.workflow_status], "director");
 const reviewLocked = finalisedByVc || readOnly || (!pendingThisReviewer && (faculty.status === "Reviewed" || /Director\s*(Reviewed|Rejected)/i.test(faculty.status || "")));
 const canReject = canReviewerRejectProfile("director", faculty);
 const subjectEmail = faculty.email || faculty.faculty_email || faculty.facultyEmail;
 const academicYear = faculty.academicYear || faculty.academic_year || faculty.info?.ay || APP_INFO.DEFAULT_AY || "2026-2027";
 const reviewerMaxScores = {
 partA: effectiveMaxScore(150),
 partB: effectiveMaxScore(350),
 partC: 150,
 partD: 50,
 grand: 0,
 };
 reviewerMaxScores.grand = reviewerMaxScores.partA + reviewerMaxScores.partB + reviewerMaxScores.partC + reviewerMaxScores.partD;

 // Compute HOD total from hodData
 const calcHodScore = () =>{
 const get = (section, idx, field) =>{
 if (hodData[section]) {
 const s = hodData[section];
 return idx === null ? n(Array.isArray(s) ? s[0]?.[field] : s[field]) : n(s[idx]?.[field]);
 }
 const source = faculty[section];
 return idx === null ? n(Array.isArray(source) ? source[0]?.[field] : source?.[field]) : n(source?.[idx]?.[field]);
 };
 const getS = (key) =>n(hodData[key] ?? faculty[key]);
 const sumReviewRows = (section, field, max, rowMax) =>clampScore(
 (faculty[section] || []).reduce((total, row, index) =>{
 if (section === "society" && societyRowLocked(row)) return total;
 if (!rowHasReviewableData(section, row)) return total;
 const limit = typeof rowMax === "function" ? rowMax(row) : rowMax;
 return total + (limit ? clampScore(get(section, index, field), limit) : get(section, index, field));
 }, 0),
 max,
 );
 const lec = reviewSectionScore("lectures", faculty.lectures || [], 40, "hod");
 const cf = reviewSectionScore("courseFile", faculty.courseFile || [], 20, "hod");
 const innov = clampScore(getS("innovHod"), 20);
 const obe = sumReviewRows("obeRows", "hod", 20, (row) =>row.max || 20);
 const proj = sumReviewRows("projects", "hod", 20, projectGuidanceRowMax);
 const mentoring = sumReviewRows("mentoringRows", "hod", 10, (row) =>row.max || 10);
 const qual = sumReviewRows("quals", "hod", 10, SCORE_LIMITS.qualificationRow);
 const fb = reviewSectionScore("feedback", faculty.feedback || [], 10, "hod");
 const partA = clampScore(lec + cf + innov + fb + obe + proj + mentoring + qual, reviewerMaxScores.partA);

 const jour = sumReviewRows("journals", "hod", 100);
 const bk = sumReviewRows("books", "hod", 30);
 const ictT = sumReviewRows("ict", "hod", 20);
 const res = sumReviewRows("research", "hod", 20, researchGuidanceRowMax);
 const resProjects = sumReviewRows("projects2", "hod", 40);
 const pat = sumReviewRows("patents", "hod", 40);
 const awd = sumReviewRows("awards", "hod", 20);
 const conf = sumReviewRows("confs", "hod", 20);
 const prop = sumReviewRows("proposals", "hod", 20);
 const prod = sumReviewRows("products", "hod", 20);
 const b8 = sumReviewRows("fdps", "hod", 20, SCORE_LIMITS.fdpRow);
 const partB = clampScore(jour + bk + pat + resProjects + res + prop + conf + b8 + awd + prod + ictT, reviewerMaxScores.partB);

 const uni = sumReviewRows("uniActs", "hod", 50);
 const dept = sumReviewRows("deptActs", "hod", 30);
 const events = sumReviewRows("eventRows", "hod", 20);
 const soc = sumReviewRows("society", "hod", 20, (row) =>row.max || 20);
 const ind = sumReviewRows("industry", "hod", 10);
 const alumni = sumReviewRows("alumniRows", "hod", 10);
 const placement = sumReviewRows("placementRows", "hod", 20);
 const partC = clampScore(uni + dept + events + soc + ind + alumni + placement, reviewerMaxScores.partC);
 const partD = sumReviewRows("acr", "hod", reviewerMaxScores.partD, SCORE_LIMITS.acrRow);

 return { partA, partB, partC, partD, total: clampScore(partA + partB + partC + partD, reviewerMaxScores.grand) };
 };

 // Compute Director total from dirData
 const calcDirScore = () =>{
 const getD = (section, idx, field) => n(getDRaw(section, idx, field));
 const getDRaw = (section, idx, field) =>{
 let value;
 if (dirData[section]) {
 const s = dirData[section];
 value = idx === null ? (Array.isArray(s) ? s[0]?.[field] : s[field]) : s[idx]?.[field];
 } else {
 const source = faculty[section];
 if (section === "acr" && !reviewLocked) return "";
 value = idx === null ? (Array.isArray(source) ? source[0]?.director : source?.director) : source?.[idx]?.director;
 }
 return value;
 };
 const getDirS = (key) =>n(dirData[key] ?? faculty.innovDirector ?? faculty.innovDir);
 const sumReviewRows = (section, field, max, rowMax) =>clampScore(
 (section === "acr" ? createAcrRows(faculty.acr) : (faculty[section] || [])).reduce((total, row, index) =>{
 if (section === "society" && societyRowLocked(row)) return total;
 if (!rowHasReviewableData(section, row) && String(getDRaw(section, index, field) ?? "").trim() === "") return total;
 const limit = typeof rowMax === "function" ? rowMax(row) : rowMax;
 return total + (limit ? clampScore(getD(section, index, field), limit) : getD(section, index, field));
 }, 0),
 max,
 );
 const lectureReviewRows = (faculty.lectures || []).map((row, index) =>({
 ...row,
 dir: dirData.lectures?.[index]?.dir ?? dirData.lectures?.[index]?.director ?? row.dir ?? row.director ?? "",
 }));
 const courseFileReviewRows = (faculty.courseFile || []).map((row, index) =>({
 ...row,
 dir: dirData.courseFile?.[index]?.dir ?? dirData.courseFile?.[index]?.director ?? row.dir ?? row.director ?? "",
 }));
 const lec = reviewSectionScore("lectures", lectureReviewRows, 40, "dir");
 const cf = reviewSectionScore("courseFile", courseFileReviewRows, 20, "dir");
 const innovReviewRows = (faculty.innovRows || []).map((row, index) =>({
 ...row,
 director: dirData.innovRows?.[index]?.director ?? dirData.innovRows?.[index]?.dir ?? row.director ?? "",
 }));
 const feedbackReviewRows = (faculty.feedback || []).map((row, index) =>({
 ...row,
 dir: dirData.feedback?.[index]?.dir ?? dirData.feedback?.[index]?.director ?? row.dir ?? row.director ?? "",
 }));
 const innov = innovReviewRows.length ? reviewSectionScore("innovRows", innovReviewRows, STANDARD_INNOVATIVE_SECTION_MAX, "director") : clampScore(getDirS("innovDir"), STANDARD_INNOVATIVE_SECTION_MAX);
 const obe = sumReviewRows("obeRows", "dir", 20, (row) =>row.max || 20);
 const proj = sumReviewRows("projects", "dir", 20, projectGuidanceRowMax);
 const mentoring = sumReviewRows("mentoringRows", "dir", 10, (row) =>row.max || 10);
 const qual = sumReviewRows("quals", "dir", 10, SCORE_LIMITS.qualificationRow);
 const fb = reviewSectionScore("feedback", feedbackReviewRows, 10, "dir");
 const partA = clampScore(lec + cf + innov + fb + obe + proj + mentoring + qual, reviewerMaxScores.partA);

 const jour = sumReviewRows("journals", "dir", 100);
 const bk = sumReviewRows("books", "dir", 30);
 const ictT = sumReviewRows("ict", "dir", 20);
 const res = sumReviewRows("research", "dir", 20, researchGuidanceRowMax);
 const resProjects = sumReviewRows("projects2", "dir", 40);
 const pat = sumReviewRows("patents", "dir", 40);
 const awd = sumReviewRows("awards", "dir", 20);
 const conf = sumReviewRows("confs", "dir", 20);
 const prop = sumReviewRows("proposals", "dir", 20);
 const prod = sumReviewRows("products", "dir", 20);
 const b8 = sumReviewRows("fdps", "dir", 20, SCORE_LIMITS.fdpRow);
 const partB = clampScore(jour + bk + pat + resProjects + res + prop + conf + b8 + awd + prod + ictT, reviewerMaxScores.partB);

 const uni = sumReviewRows("uniActs", "dir", 50);
 const dept = sumReviewRows("deptActs", "dir", 30);
 const events = sumReviewRows("eventRows", "dir", 20);
 const soc = sumReviewRows("society", "dir", 20, SCORE_LIMITS.societyRow);
 const ind = sumReviewRows("industry", "dir", 10);
 const alumni = sumReviewRows("alumniRows", "dir", 10);
 const placement = sumReviewRows("placementRows", "dir", 20);
 const partC = clampScore(uni + dept + events + soc + ind + alumni + placement, reviewerMaxScores.partC);
 const partD = sumReviewRows("acr", "dir", reviewerMaxScores.partD, SCORE_LIMITS.acrRow);

 return { partA, partB, partC, partD, total: clampScore(partA + partB + partC + partD, reviewerMaxScores.grand) };
 };

 const { partA, partB, partC, partD, total } = calcHodScore();
 const calculatedDirScores = calcDirScore();
 const hasSavedDirectorScores = ["directorPartA", "directorPartB", "directorPartC", "directorPartD", "directorTotal"].some((key) =>String(faculty?.[key] ?? "").trim() !== "");
 const rawDisplayedDirScores = reviewLocked && hasSavedDirectorScores ? {
 partA: String(faculty?.directorPartA ?? "").trim() !== "" ? n(faculty.directorPartA) : calculatedDirScores.partA,
 partB: String(faculty?.directorPartB ?? "").trim() !== "" ? n(faculty.directorPartB) : calculatedDirScores.partB,
 partC: String(faculty?.directorPartC ?? "").trim() !== "" ? n(faculty.directorPartC) : calculatedDirScores.partC,
 partD: String(faculty?.directorPartD ?? "").trim() !== "" ? n(faculty.directorPartD) : calculatedDirScores.partD,
 total: String(faculty?.directorTotal ?? "").trim() !== "" ? n(faculty.directorTotal) : calculatedDirScores.total,
 } : calculatedDirScores;
 const displayedDirScores = {
 partA: clampScore(rawDisplayedDirScores.partA, reviewerMaxScores.partA),
 partB: clampScore(rawDisplayedDirScores.partB, reviewerMaxScores.partB),
 partC: clampScore(rawDisplayedDirScores.partC, reviewerMaxScores.partC),
 partD: clampScore(rawDisplayedDirScores.partD, reviewerMaxScores.partD),
 total: clampScore(rawDisplayedDirScores.total || rawDisplayedDirScores.partA + rawDisplayedDirScores.partB + rawDisplayedDirScores.partC + rawDisplayedDirScores.partD, reviewerMaxScores.grand),
 };
 const { partA: dirPartA, partB: dirPartB, partC: dirPartC, partD: dirPartD, total: dirTotal } = displayedDirScores;
 const g = grade(dirTotal, reviewerMaxScores.grand);
 const directorSectionScores = buildDirectorSectionScores(faculty, dirData);
 const directorReviewForm = {
 ...faculty,
 ...directorSectionScores,
 innovDirector: directorSectionScores?.innovativeTeaching?.director ?? faculty.innovDirector ?? "",
 };
 useEffect(() =>{
 let active = true;
 if (reviewLocked || !subjectEmail) return undefined;
 loadReviewerDraft({ subjectEmail, academicYear, reviewerRole: "director" })
 .then((draft) =>{
 if (!active || !draft?.payload) return;
 setDirData(normalizeDirectorDraftData(draft.payload.section_scores || {}));
 setDirRemarks(draft.payload.remarks ?? "");
 setDraftStatus(draft.updated_at ? `Last saved: ${new Date(draft.updated_at).toLocaleString()}` : "Draft loaded");
 })
 .catch((err) =>{
 if (!active) return;
 console.error("Could not load reviewer draft:", err);
 setDraftStatus(err?.message || "Could not load draft.");
 });
 return () =>{ active = false; };
 }, [academicYear, reviewLocked, subjectEmail]);

 const handleSaveDraft = async () =>{
 try {
 setSavingDraft(true);
 await saveReviewerDraft({
 subjectEmail,
 academicYear,
 reviewerRole: "director",
 partAScore: dirPartA,
 partBScore: dirPartB,
 partCScore: dirPartC,
 partDScore: dirPartD,
 totalScore: dirTotal,
 remarks: dirRemarks,
 sectionScores: directorSectionScores,
 });
 setDraftStatus(`Draft saved: ${new Date().toLocaleString()}`);
 } catch (err) {
 console.error("Could not save reviewer draft:", err);
 setDraftStatus(err?.message || "Unable to save draft.");
 } finally {
 setSavingDraft(false);
 }
 };

 const NEXT_SECTION_MAP = { partA: "partB", partB: "partC", partC: "partD", partD: "partE", partE: "summary" };

 const handleNextSection = () => {
    const nextSection = NEXT_SECTION_MAP[sectionView];
    if (nextSection) {
      setSectionView(nextSection);
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    }
  };

 const handleSaveAndNext = async () => {
    await handleSaveDraft();
    handleNextSection();
  };

 const generateDirectorReport = async () =>{
 const reportForm = {
 ...faculty,
 ...directorSectionScores,
 info: {
 ...(faculty.info || {}),
 name: faculty.info?.name || faculty.name,
 ay: faculty.info?.ay || faculty.academicYear || faculty.academic_year || APP_INFO.DEFAULT_AY,
 desig: faculty.info?.desig || faculty.designation || directorSubjectRole,
 school: faculty.info?.school || faculty.schoolName || faculty.school,
 },
 docs: faculty.docs || {},
 innovDirector: directorSectionScores?.innovativeTeaching?.director ?? faculty.innovDirector ?? "",
 };
 const totals = { partA: dirPartA, partB: dirPartB, partC: dirPartC, partD: dirPartD, total: dirTotal };
 const scoreRoles = showHodSummaryCard ? ["score", "hod", "director"] : ["score", "director"];
 const roleLabel = (value) =>value === "hod" ? "HOD Score" : value === "director" ? "Director Score" : "Faculty Score";
 const summaryRows = directorSummaryRows({ totals, maxScores: reviewerMaxScores });
 const percent = (score, max) =>max >0 ? ((n(score) / n(max)) * 100).toFixed(2) : "0.00";
 const remarksSections = buildReviewRemarks({
 source: faculty,
 currentRole: "director",
 currentRemarks: dirRemarks,
 roleLabels: { hod: "HOD" },
 });
 const win = window.open("", "_blank", "width=1000,height=800");
 if (!win) {
 alert("Please allow popups to generate the report.");
 return;
 }
 const logoSrc = await fetchImageAsDataUrl("/image.png");
 const iqacLogoSrc = await fetchImageAsDataUrl("/IQAS.png");
 const html = `<!doctype html>
<html>
<head>
  <title>Director Appraisal Report</title>
  <style>
    @page{size:A4;margin:12mm}
    *{box-sizing:border-box}
    body{font-family:"Times New Roman",Times,serif;font-size:10.8px;line-height:1.34;color:#111;background:#fff;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    h1{text-align:center;font-size:14px;line-height:1.18;letter-spacing:.45px;margin:0 0 4px;text-transform:uppercase;color:#111;font-weight:700}
    h2{text-align:center;font-size:11px;line-height:1.25;margin:2px 0;color:#111;font-weight:700}
    h3{font-size:11px;line-height:1.25;margin:10px 0 5px;color:#111;break-after:avoid;font-weight:700}
    h3 span{color:#444;font-size:10px;font-weight:400}
    h3[style*="background"]{background:#f1f3f5!important;border:none!important;border-top:1.6px solid #111!important;border-bottom:1.2px solid #111!important;border-radius:0!important;padding:6px 0!important;margin:14px 0 8px!important;color:#111!important;text-align:center!important;text-transform:uppercase;letter-spacing:.25px}
    table{width:100%;border-collapse:collapse!important;margin-bottom:10px;table-layout:fixed;border:1.15px solid #6b7280!important;background:#fff;page-break-inside:auto}
    thead{display:table-header-group}
    tr{page-break-inside:avoid;page-break-after:auto}
    th,td{border:1px solid #aeb6c2!important;padding:4.8px 6px;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere}
    th{background:#eef0f3!important;text-align:center;font-weight:700;color:#111}
    .c{text-align:center}.b{font-weight:bold}.page-break{page-break-before:always}.page-break:first-of-type{page-break-before:auto}.tr{background:#f6f7f9!important;font-weight:bold}
    .ht{width:100%;border:none!important;border-bottom:2px solid #111!important;margin-bottom:9px;padding-bottom:5px;background:transparent}.ht td{border:none!important;padding:0 4px;vertical-align:middle}
    .logo{width:17mm;max-height:22mm;object-fit:contain;height:auto}.st{border:1.35px solid #4b5563!important}.st th{background:#dfe3e8!important}.remarks{white-space:pre-wrap;border:1px solid #6b7280!important;padding:8px;min-height:34px;background:#fff}
  </style>
</head>
<body>
  <table class="ht"><tr>
    <td style="width:20%;text-align:left"><img class="logo" src="${logoSrc}" alt="DYPIU"/></td>
    <td style="text-align:center">
      <h1>D Y PATIL INTERNATIONAL UNIVERSITY, AKURDI, PUNE</h1>
      <h2>Director Appraisal Report</h2>
      <h2>${escapeReportHtml(APP_INFO.UNIVERSITY_NAME)} | Academic Year ${reportValue(reportForm.info.ay)}</h2>
    </td>
    <td style="width:20%"></td>
  </tr></table>
  <table>
    <tr><td class="b" style="width:35%">Name of Faculty</td><td>${reportValue(reportForm.info.name || reportForm.name)}</td></tr>
    <tr><td class="b">Present Designation</td><td>${reportValue(reportForm.info.desig || reportForm.designation)}</td></tr>
    <tr><td class="b">School / Department</td><td>${reportValue(reportForm.info.school || reportForm.schoolName || reportForm.school)}</td></tr>
    <tr><td class="b">Academic Year</td><td>${reportValue(reportForm.info.ay)}</td></tr>
    <tr><td class="b">Generated On</td><td>${escapeReportHtml(new Date().toLocaleString())}</td></tr>
    <tr><td class="b">Generated By</td><td>${reportValue(sessionStorage.getItem("name") || "Director")}</td></tr>
  </table>
  ${directorReportPart({ title: "PART A - Teaching Process & Academic Activities", sections: STANDARD_REPORT_PART_A_SECTIONS, form: reportForm, docs: reportForm.docs, scoreRoles, roleLabel })}
  ${directorReportPart({ title: "PART B - Research & Academic Contributions", sections: STANDARD_REPORT_PART_B_SECTIONS, form: reportForm, docs: reportForm.docs, scoreRoles, roleLabel })}
  ${directorReportPart({ title: "PART C - Administrative Role & University Development Contribution", sections: STANDARD_REPORT_PART_C_SECTIONS, form: reportForm, docs: reportForm.docs, scoreRoles, roleLabel })}
  ${directorReportPart({ title: "PART D - Annual Confidential Report (ACR)", sections: STANDARD_REPORT_PART_D_SECTIONS, form: reportForm, docs: reportForm.docs, scoreRoles: scoreRoles.filter((role) => role !== "score"), roleLabel })}
  <div class="page-break"></div>
  <h3 style="text-align:center;font-size:13px">SUMMARY</h3>
  <table class="st">
    <thead><tr><th>Section</th><th>Score</th><th>Maximum</th><th>Marks Obtained (%)</th></tr></thead>
    <tbody>
      ${summaryRows.map(([label, score, max]) =>`<tr><td>${escapeReportHtml(label)}</td><td class="c">${n(score).toFixed(1)}</td><td class="c">${escapeReportHtml(max)}</td><td class="c">${percent(score, max)}%</td></tr>`).join("")}
      <tr class="tr"><td>Grand Total</td><td class="c">${n(totals.total).toFixed(1)}</td><td class="c">${escapeReportHtml(reviewerMaxScores.grand)}</td><td class="c">${percent(totals.total, reviewerMaxScores.grand)}%</td></tr>
      ${faculty.status ? `<tr><td>Status</td><td colspan="3">${reportValue(faculty.status)}</td></tr>` : ""}
    </tbody>
  </table>
  ${remarksSections.length ? `<h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">REVIEW REMARKS</h3>${remarksSections.map((section) =>`<h3>${escapeReportHtml(section.label)}</h3><div class="remarks">${escapeReportHtml(section.remarks || "")}</div>`).join("")}` : ""}
  <script>
    window.addEventListener('load', function(){
      setTimeout(function(){ window.focus(); window.print(); }, 120);
    });
  </script>
</body>
</html>`;
 win.document.write(html);
 win.document.close();
 };

 const facultySummary = standardSubmittedScoreSummary(faculty, {
 partA: faculty.lectures?.reduce((a, r) =>a + n(r.score), 0) || 0,
 partB: faculty.journals?.reduce((a, r) =>a + n(r.score), 0) || 0,
 });
 const directorSubjectRole = (faculty.appraisalRole || faculty.appraisal_role || faculty.role || "faculty").toLowerCase();
 const showHodSummaryCard = directorSubjectRole === "faculty" && getReviewChain(faculty).includes("hod");
 const directorRecordSchoolTrack = getDeanTrack({ school: faculty.school || faculty.info?.school, department: faculty.department, designation: faculty.designation });
 const directorRecordSchoolGroupLabel = { engineering: "Engineering", non_engineering: "Non-Engineering", cisr: "CISR" }[directorRecordSchoolTrack] || faculty.school || faculty.info?.school || APP_INFO.UNIVERSITY_NAME;
 const directorRecordScoreRows = [
 { key: "self", label: "Self", icon: "user", values: { partA: facultySummary.partA, partB: facultySummary.partB, partC: facultySummary.partC, partD: facultySummary.partD, partE: 0, total: facultySummary.total }, note: summaryOtherInfoValueFrom(faculty) },
 { key: "director", label: "Director", icon: "briefcase", values: { partA: dirPartA, partB: dirPartB, partC: dirPartC, partD: facultySummary.partD, partE: dirPartD, total: dirTotal }, accent: true },
 ];

 return (
<div style={{ display: "flex", flexDirection: "column", gap: 0, minHeight: "100%" }}>
 {/* Header */}
<ReviewerReportHeader reviewerLabel="Director" readOnly={reviewLocked} onBack={onBack}>
<div className="reviewer-report-header__legacy-metrics">
<div style={{ background: "rgba(5,46,22,0.92)", border: "1px solid rgba(134,239,172,0.18)", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 92 }}>
<div style={{ color: "#86efac", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6 }}>Dir Part A</div>
<div style={{ color: "#4ade80", fontWeight: 800, fontSize: 16 }}>{dirPartA.toFixed(1)}</div>
</div>
<div style={{ background: "rgba(5,46,22,0.92)", border: "1px solid rgba(134,239,172,0.18)", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 92 }}>
<div style={{ color: "#86efac", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6 }}>Dir Part B</div>
<div style={{ color: "#4ade80", fontWeight: 800, fontSize: 16 }}>{dirPartB.toFixed(1)}</div>
</div>
<div style={{ background: "rgba(5,46,22,0.92)", border: "1px solid rgba(134,239,172,0.18)", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 92 }}>
<div style={{ color: "#86efac", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6 }}>Dir Part C</div>
<div style={{ color: "#2dd4bf", fontWeight: 800, fontSize: 16 }}>{dirPartC.toFixed(1)}</div>
</div>
<div style={{ background: "rgba(5,46,22,0.92)", border: "1px solid rgba(134,239,172,0.18)", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 92 }}>
<div style={{ color: "#86efac", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6 }}>Dir Part E</div>
<div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 16 }}>{dirPartD.toFixed(1)}</div>
</div>
<div style={{ background: g.bg, border: `2px solid ${g.color}40`, borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
<div style={{ color: g.color, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>Dir Total</div>
<div style={{ color: g.color, fontWeight: 800, fontSize: 16 }}>{dirTotal.toFixed(1)}<span style={{ fontSize: 10, color: "#94a3b8" }}>/{reviewerMaxScores.grand}</span></div>
</div>
</div>
</ReviewerReportHeader>
{/* Section switcher */}
<div className="reviewer-report-tabs" style={{ display: "inline-flex", gap: 6, marginBottom: 16, padding: 4, background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 12, width: "fit-content", flexWrap: "wrap" }}>
 {[["partA", "Part A"], ["partB", "Part B"], ["partC", "Part C"], ["partD", "Part D"], ["partE", "Part E"], ["summary", "Summary"]].map(([id, label]) =>(
<button aria-current={sectionView === id ? "page" : undefined} key={id} onClick={() =>{
 setSectionView(id);
 requestAnimationFrame(() =>{
 window.scrollTo({ top: 0, left: 0, behavior: "auto" });
 });
 }}
 style={{ padding: "8px 18px", border: "none", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 800, background: sectionView === id ? "#047857" : "transparent", color: sectionView === id ? "#ecfdf5" : "#475569", boxShadow: sectionView === id ? "0 8px 18px rgba(4,120,87,0.20)" : "none" }}>
 {label}
</button>
 ))}
</div>

 {["partA", "partB", "partC", "partD", "partE"].includes(sectionView) && (
<fieldset disabled={reviewLocked || sectionView === "partD"} style={{ border: "none", padding: 0, margin: 0 }}>
<DirectorFacultyReviewForm faculty={directorReviewForm} hodData={hodData} setHodData={setHodData} dirData={dirData} setDirData={setDirData} sectionView={sectionView} reviewLocked={reviewLocked} />
</fieldset>
 )}

 {["partA", "partB", "partC", "partE"].includes(sectionView) && !reviewLocked && (
<div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, margin: "12px 0 14px", flexWrap: "wrap" }}>
<span style={{ color: "#64748b", fontSize: 11, fontWeight: 700 }}>{draftStatus}</span>
<button
 type="button"
 onClick={handleSaveDraft}
 disabled={savingDraft}
 style={{ padding: "10px 22px", background: "#fff", color: savingDraft ? "#94a3b8" : "#2563eb", border: "1.5px solid #2563eb", borderRadius: 7, cursor: savingDraft ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}
>
 {savingDraft ? "Saving..." : "Save as Draft"}
</button>
<button
 type="button"
 onClick={handleSaveAndNext}
 disabled={savingDraft}
 style={{ padding: "10px 22px", background: savingDraft ? "#94a3b8" : "#2563eb", color: "#fff", border: "none", borderRadius: 7, cursor: savingDraft ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}
>
 {savingDraft ? "Saving..." : "Save & Next"}
</button>
</div>
 )}

 {sectionView === "partD" && (
<div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, margin: "12px 0 14px", flexWrap: "wrap" }}>
<button
 type="button"
 onClick={handleNextSection}
 style={{ padding: "10px 22px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}
>
 Next
</button>
</div>
 )}

 {sectionView === "summary" && (
<div className="far-wrap" style={{ width: "100%" }}>
<div className="far-card" style={{ width: "100%", boxSizing: "border-box", background: FACULTY_RECORD_THEME.card, border: `1px solid ${FACULTY_RECORD_THEME.borderStrong}`, borderRadius: 16, padding: "22px 24px", display: "grid", gap: 18, boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
<FacultyRecordHeader
 title="Faculty appraisal record"
 subtitle={`${APP_INFO.UNIVERSITY_NAME} · ${directorRecordSchoolGroupLabel} · AY ${academicYear}`}
 referenceNumber={faculty.employeeId}
/>
<ScoreTable
 columns={[
 { key: "partA", label: "Part A", max: MAX_SCORES.PART_A },
 { key: "partB", label: "Part B", max: MAX_SCORES.PART_B },
 { key: "partC", label: "Part C", max: MAX_SCORES.PART_C },
 { key: "partD", label: "Part D", max: MAX_SCORES.PART_D },
 { key: "partE", label: "Part E", max: MAX_SCORES.PART_E },
 { key: "total", label: "Total", max: MAX_SCORES.GRAND_TOTAL },
 ]}
 rows={directorRecordScoreRows}
/>
<VCFinalRemarks
 title="Director final remarks"
 icon="briefcase"
 value={dirRemarks}
 onChange={setDirRemarks}
 readOnly={reviewLocked}
 description="This statement is entered against the official appraisal record before final submission."
/>
{!reviewLocked && (
<label style={{ display: "flex", alignItems: "flex-start", gap: 9, color: FACULTY_RECORD_THEME.textMuted, fontSize: 11, lineHeight: 1.5, cursor: "pointer" }}>
<input type="checkbox" checked={reviewConfirmed} onChange={(e) =>setReviewConfirmed(e.target.checked)} style={{ marginTop: 2, accentColor: FACULTY_RECORD_THEME.accent, flexShrink: 0 }} />
<span>I have verified all the details and confirm that the information provided is correct. I am responsible for the accuracy of this data.</span>
</label>
)}
{!reviewLocked && (
<FinalSubmitButton
 disabled={!reviewConfirmed || !dirRemarks.trim()}
 onClick={() =>onSubmit(faculty.id, { partA: dirPartA, partB: dirPartB, partC: dirPartC, partD: dirPartD, total: dirTotal }, dirRemarks, directorSectionScores, reviewConfirmed)}
>
 Confirm and submit final score
</FinalSubmitButton>
)}
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: `1px solid ${FACULTY_RECORD_THEME.border}`, paddingTop: 14 }}>
<span style={{ color: FACULTY_RECORD_THEME.textFaint, fontSize: 10.5, fontStyle: "italic" }}>{draftStatus}</span>
<div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginLeft: "auto" }}>
<button onClick={onBack} style={{ padding: "8px 14px", background: "transparent", color: FACULTY_RECORD_THEME.textMuted, border: `1px solid ${FACULTY_RECORD_THEME.border}`, borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 11.5, fontFamily: "inherit" }}>{reviewLocked ? "Close" : "Cancel"}</button>
{!reviewLocked && (
<>
<button onClick={handleSaveDraft} disabled={savingDraft} style={{ padding: "8px 14px", background: "transparent", color: savingDraft ? FACULTY_RECORD_THEME.textFaint : "#2563eb", border: `1px solid ${savingDraft ? FACULTY_RECORD_THEME.border : "#bfdbfe"}`, borderRadius: 8, cursor: savingDraft ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 11.5, fontFamily: "inherit" }}>
 {savingDraft ? "Saving..." : "Save Draft"}
</button>
{canReject && (
<button onClick={async () =>{ if (await confirmRejection("Reject this appraisal and send it back to the user for editing?", "reject")) { onSubmit(faculty.id, { partA: dirPartA, partB: dirPartB, partC: dirPartC, partD: dirPartD, total: dirTotal }, dirRemarks, directorSectionScores, reviewConfirmed, "rejected"); } }}
 disabled={!reviewConfirmed || !dirRemarks.trim()}
 style={{ padding: "8px 14px", background: "transparent", color: (reviewConfirmed && dirRemarks.trim()) ? "#dc2626" : FACULTY_RECORD_THEME.textFaint, border: `1px solid ${(reviewConfirmed && dirRemarks.trim()) ? "#fecaca" : FACULTY_RECORD_THEME.border}`, borderRadius: 8, cursor: (reviewConfirmed && dirRemarks.trim()) ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 11.5, fontFamily: "inherit" }}>
 Reject Form
</button>
)}
</>
)}
</div>
</div>
</div>
</div>
 )}
</div>
 );
}

// - Main Director Dashboard -
export default function DirectorDashboard() {
  const showReviewFeedback = useReviewFeedback();
 const [activeMainTab, setActiveMainTab] = useState("myAppraisal");
 const [hodAppraisalTab, setHodAppraisalTab] = useState("partA");
 const [reviewingFaculty, setReviewingFaculty] = useState(null);
 const [reviewingHod, setReviewingHod] = useState(null);
 const [reviewLoading, setReviewLoading] = useState(null);

 // Live schools data must be loaded for getSchoolKey(...) to resolve an admin-created ("dynamic")
 // school, otherwise the queue's client-side school match drops every item for such a school.
 const { schools: liveSchools } = useSchools();
 const schoolsSignature = liveSchools.map((s) => s.code).join(",");
 const [directorProfile, setDirectorProfile] = useState(() =>profileFromsessionStorage());
 const primaryDirectorSchool = sessionStorage.getItem("school");
 const assignedDirectorSchools = useMemo(() =>(Array.isArray(directorProfile.schools) && directorProfile.schools.length
  ? directorProfile.schools
  : [primaryDirectorSchool]
 ).filter(Boolean), [directorProfile.schools, primaryDirectorSchool]);
 const uniqueDirectorSchools = useMemo(() =>[...new Set(assignedDirectorSchools)], [assignedDirectorSchools]);
 const directorSchoolsKey = uniqueDirectorSchools.join("|");
 const [selectedDirectorSchool, setSelectedDirectorSchool] = useState(() =>uniqueDirectorSchools.length > 1 ? "__all__" : uniqueDirectorSchools[0] || primaryDirectorSchool || "");
 const dirSchool = selectedDirectorSchool || uniqueDirectorSchools[0] || primaryDirectorSchool || "";
 const selectedSchoolValues = useMemo(() =>selectedDirectorSchool === "__all__" ? uniqueDirectorSchools : [dirSchool].filter(Boolean), [selectedDirectorSchool, uniqueDirectorSchools, dirSchool]);
 const directorSchoolConfig = selectedDirectorSchool !== "__all__" ? getSchoolByValue(dirSchool) : null;
 const directorSchoolHasHod = Boolean(directorSchoolConfig?.hasHod || directorSchoolConfig?.approvalChain?.includes("hod"));
 const manageProgramSchools = uniqueDirectorSchools.filter((schoolCode) =>{
 const config = getSchoolByValue(schoolCode);
 return Boolean(config?.hasHod || config?.approvalChain?.includes("hod"));
 });
 const canManagePrograms = manageProgramSchools.length > 0;
 const [manageProgramSchool, setManageProgramSchool] = useState(() =>manageProgramSchools[0] || "");
 const activeManageProgramSchool = manageProgramSchools.includes(manageProgramSchool) ? manageProgramSchool : manageProgramSchools[0] || "";
 const [schoolDepartments, setSchoolDepartments] = useState([]);
 const refreshSchoolDepartments = async () =>{
 if (!activeManageProgramSchool || !canManagePrograms) {
 setSchoolDepartments([]);
 return;
 }
  try {
 setSchoolDepartments(await listSchoolDepartments(activeManageProgramSchool));
 } catch (err) {
 console.error("Could not load school departments:", err);
 }
 };

 const [facultyList, setFacultyList] = useState([]);
 const [hodList, setHodList] = useState([]);
 const [queueLoadError, setQueueLoadError] = useState("");
 const queueLoadRequestRef = useRef(0);
 const [selectedAcademicYear, setSelectedAcademicYear] = useState(() => getActiveAcademicYear());
 const [availableCycles, setAvailableCycles] = useState(() => storedAcademicYearCycles());
 const [loadingYearData, setLoadingYearData] = useState(false);
 const academicYearOptions = availableCycles.length ? availableCycles : [{ academic_year: selectedAcademicYear || APP_INFO.DEFAULT_AY, is_open: true }];

 useEffect(() =>{
 let cancelled = false;
 const refreshDirectorSession = async () =>{
 try {
 await refreshSchoolsOnce().catch(() =>{});
 const profile = await api.get("/auth/me");
 if (cancelled) return;
 storeUserSession({ token: getSessionItem("accessToken") || getSessionItem("token"), profile });
 const refreshedProfile = profileFromsessionStorage();
 setDirectorProfile(refreshedProfile);
 const refreshedSchools = Array.isArray(refreshedProfile.schools) && refreshedProfile.schools.length
 ? refreshedProfile.schools
 : [refreshedProfile.school].filter(Boolean);
 if (refreshedSchools.length > 1) {
 setSelectedDirectorSchool("__all__");
 }
 } catch (err) {
 if (!cancelled) console.warn("Could not refresh Director profile:", err);
 }
 };
 refreshDirectorSession();
 return () =>{ cancelled = true; };
 }, []);

 useEffect(() =>{
 if (!uniqueDirectorSchools.length) return;
 const timer = setTimeout(() =>setSelectedDirectorSchool((current) =>{
 if (current === "__all__") return current;
 if (uniqueDirectorSchools.length > 1 && !current) return "__all__";
 if (current && uniqueDirectorSchools.includes(current)) return current;
 return uniqueDirectorSchools.length > 1 ? "__all__" : uniqueDirectorSchools[0];
 }), 0);
 return () =>clearTimeout(timer);
 }, [directorSchoolsKey, uniqueDirectorSchools]);

 const handleReviewAcademicYearChange = (academicYear) =>{
 const nextAcademicYear = setActiveAcademicYear(academicYear);
 setSelectedAcademicYear(nextAcademicYear);
 window.dispatchEvent(new CustomEvent("academicYearChanged", { detail: { academicYear: nextAcademicYear } }));
 };

 useEffect(() =>{
 const syncAcademicYear = (event) =>{
 setSelectedAcademicYear(event?.detail?.academicYear || getActiveAcademicYear());
 setAvailableCycles(storedAcademicYearCycles());
 };
 window.addEventListener("academicYearChanged", syncAcademicYear);
 return () =>window.removeEventListener("academicYearChanged", syncAcademicYear);
 }, []);

 useEffect(() =>{
 const requestId = ++queueLoadRequestRef.current;
 const isCurrentRequest = () =>queueLoadRequestRef.current === requestId;
 const loadReviewQueue = async () =>{
 setLoadingYearData(true);
 setQueueLoadError("");
 try {
 // lazy: true - the list renders instantly from the lightweight response; each card's
 // doc-count/legacy-score is only fetched once that card actually scrolls into view (see
 // the LazyVisible wrapper around each card below), instead of enriching the whole queue
 // up front. See fetchReviewQueueForRole's comment for why that eager pass was slow.
  const items = await fetchReviewQueueForRole({
  reviewerRole: "director",
  reviewerProfile: { ...directorProfile, school: selectedDirectorSchool === "__all__" ? primaryDirectorSchool : dirSchool, schools: uniqueDirectorSchools, assignedSchools: uniqueDirectorSchools },
  academicYear: selectedAcademicYear,
  schoolValues: selectedSchoolValues,
  lazy: true,
  });
 if (!isCurrentRequest()) return;
 setFacultyList(items.filter((item) =>item.appraisalRole === "faculty"));
 setHodList(items.filter((item) =>item.appraisalRole === "hod"));
 } catch (err) {
 if (!isCurrentRequest()) return;
 console.error("Could not load Director review queue:", err);
 // A failed fetch used to fall back to an empty list, which looked identical to "nothing is
 // pending" - a reviewer had no way to tell a real error apart from a genuinely empty queue.
 setQueueLoadError(err?.message || "Could not load the review queue. Please try again.");
 setFacultyList([]);
 setHodList([]);
 } finally {
 if (isCurrentRequest()) setLoadingYearData(false);
 }
 };

 loadReviewQueue();
 }, [dirSchool, selectedAcademicYear, schoolsSignature, selectedDirectorSchool, directorSchoolsKey, directorProfile, primaryDirectorSchool, selectedSchoolValues, uniqueDirectorSchools]);

 useEffect(() =>{
 const timer = setTimeout(refreshSchoolDepartments, 0);
 return () =>clearTimeout(timer);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [activeManageProgramSchool, canManagePrograms]);

 const [filterStatus, setFilterStatus] = useState("All");
 const [reviewerTypeFilter, setReviewerTypeFilter] = useState("faculty");
 const [showLogoutModal, setShowLogoutModal] = useState(false);


 const isDirectorPending = (item) =>{
 const s = item.status || "";
 if (isPendingReviewStatusFor([s, item.workflowStatus, item.workflow_status], "director")) return true;
 return s === "pending_director" || s === "Pending Review" || s === "pending_hod" ||
 (n(item.directorTotal)<= 0 && !String(item.directorRemarks || "").trim() && s !== "Reviewed" && s !== "pending_dean" && s !== "director_reviewed" && !/Director\s*(Reviewed|Rejected)/i.test(s) && s !== "completed");
 };
 const isDirectorReviewed = (item) =>{
 const s = item.status || "";
 if (isPendingReviewStatusFor([s, item.workflowStatus, item.workflow_status], "director")) return false;
 return s === "Reviewed" || s === "pending_dean" || s === "director_reviewed" || /Director\s*Reviewed/i.test(s);
 };

 const facultyPendingCount = facultyList.filter(isDirectorPending).length;
 const facultyReviewedCount = facultyList.filter(isDirectorReviewed).length;
 const hodPendingCount = hodList.filter(isDirectorPending).length;
 const hodReviewedCount = hodList.filter(isDirectorReviewed).length;

 const navItems = [
 { id: "myAppraisal", icon: "", label: "My Appraisal", sub: "View your self-appraisal form" },
 // Faculty's Appraisal and HOD's Appraisal are merged into one screen, switched via a
 // Faculty/HOD dropdown on the page itself - applies to both Engineering and
 // Non-Engineering school Directors alike, same as the two used to be always shown.
 { id: "appraisalReviewer", icon: "", label: "Appraisal Reviewer", sub: `${facultyPendingCount + hodPendingCount} awaiting review`, badge: facultyPendingCount + hodPendingCount },
  ...(canManagePrograms ? [{ id: "departments", icon: "", label: `Manage ${schoolUnitLabel(activeManageProgramSchool)}s`, sub: `${schoolDepartments.length} ${schoolUnitLabel(activeManageProgramSchool).toLowerCase()}${schoolDepartments.length === 1 ? "" : "s"}` }] : []),
 ];

 const visibleMainTab = activeMainTab === "departments" && !canManagePrograms ? "myAppraisal" : activeMainTab;
const handleSubmitReview = async (type, id, scores, remarks, sectionScores, reviewConfirmed = false, decision = "approved") =>{
 if (!reviewConfirmed) {
 void showReviewFeedback("Please verify and confirm the accuracy declaration before submitting the review.");
 return;
 }
 if (!remarks?.trim()) {
 void showReviewFeedback("Remarks are mandatory. Please enter your remarks before submitting the review.");
 return;
 }
 const sourceList = type === "hod" ? hodList : facultyList;
 const item = sourceList.find((entry) =>entry.id === id);
 if (!item) return;

 try {
 await submitWorkflowReview({
 subjectEmail: item.email,
 academicYear: item.academicYear || item.academic_year || item.info?.ay || APP_INFO.DEFAULT_AY || "2026-2027",
 reviewerRole: "director",
 partAScore: scores.partA,
 partBScore: scores.partB,
 partCScore: scores.partC,
 partDScore: scores.partD,
 totalScore: scores.total,
 remarks,
 sectionScores,
 subjectProfile: item,
 decision,
 });

 const status = decision === "rejected" ? rejectedStatusFor("director") : reviewedStatusFor("director");
 const updateDirectorReviewState = (entry) => {
 if (entry.id !== id) return entry;
 const rejectionUpdate = { status, workflowStatus: status, directorRemarks: remarks };
 const approvalUpdate = { ...sectionScores, innovDirector: sectionScores?.innovativeTeaching?.director ?? entry.innovDirector, status, workflowStatus: status, directorPartA: scores.partA, directorPartB: scores.partB, directorPartC: scores.partC, directorPartD: scores.partD, directorTotal: scores.total, directorRemarks: remarks };
 return { ...entry, ...(decision === "rejected" ? rejectionUpdate : approvalUpdate) };
 };
 if (type === "hod") {
 setHodList(prev =>prev.map(updateDirectorReviewState));
 setReviewingHod(null);
 } else {
 setFacultyList(prev =>prev.map(updateDirectorReviewState));
 setReviewingFaculty(null);
 }

 void showReviewFeedback(decision === "rejected" ? "Appraisal rejected and sent back for editing." : "Director review approved and forwarded to Dean.", "success");
 } catch (err) {
 console.error("Could not submit Director review:", err);
 void showReviewFeedback(`Unable to submit Director review.\n\n${err.message}`);
 }
 };

 const filtered = reviewerTypeFilter === "hod"
 ? (filterStatus === "All" ? hodList : (filterStatus === "Pending Review" ? hodList.filter(isDirectorPending) : hodList.filter(isDirectorReviewed)))
 : (filterStatus === "All" ? facultyList : (filterStatus === "Pending Review" ? facultyList.filter(isDirectorPending) : facultyList.filter(isDirectorReviewed)));

 // Fetches doc-count/legacy-score for one card only once it actually scrolls into view -
 // see the lazy: true note on the queue load above.
 const handleCardVisible = (item) =>{
 enrichQueueItem(item).then((enriched) =>{
 const setList = enriched.appraisalRole === "hod" ? setHodList : enriched.appraisalRole === "faculty" ? setFacultyList : null;
 setList?.((prev) =>prev.map((row) =>(row.email === enriched.email && row.academicYear === enriched.academicYear ? enriched : row)));
 }).catch(() =>{});
 };


 const handleMyAppraisalSectionChange = (section) =>{
 setHodAppraisalTab(section);
 requestAnimationFrame(() =>{
 window.scrollTo({ top: 0, left: 0, behavior: "auto" });
 });
 };

 // If the Director's own school is assigned a dynamic (admin-built custom
 // schema) form, its Parts have arbitrary admin-defined labels, not the
 // hardcoded Standard-form "Part A/B/C/D/E" — without this, the sidebar's
 // section selector never matches any of the dynamic form's real part labels,
 // so AssignedSchemaPreview falls back to rendering every part on one long
 // page instead of dividing the appraisal Part-wise. Mirrors the same pattern
 // already used for the plain faculty dashboard (src/pages/dashboards/Dashboard.jsx).
 const { assignment: myFormAssignment, isCustomForm: myFormIsCustom } = useAssignedFormAssignment();
 const myCustomParts = useCustomFormParts(myFormIsCustom ? myFormAssignment : null, selectedAcademicYear);
 const myCustomSectionOptions = myFormIsCustom && myCustomParts
 ? [...myCustomParts.map((label) => [label, label]), ["Summary", "Summary"]]
 : null;
 const myEffectiveSection = myCustomSectionOptions?.length && !myCustomSectionOptions.some(([value]) => value === hodAppraisalTab)
 ? myCustomSectionOptions[0][0]
 : hodAppraisalTab;
 return (
<DashboardLayout
 appInfo={APP_INFO}
 showLogoutModal={showLogoutModal}
 onCancelLogout={() =>setShowLogoutModal(false)}
 containerStyle={{ display: "flex", minHeight: "100vh", fontFamily: "inherit", background: "#f8fafc", color: "#1e293b" }}
 mainStyle={{ flex: 1, padding: "24px 30px", display: "flex", flexDirection: "column", gap: 18, overflowX: "auto", position: "relative" }}
 sidebar={(
<DashboardSidebar
 appInfo={APP_INFO}
navItems={navItems}
activeTab={visibleMainTab}
onTabSelect={(tab) =>{ setActiveMainTab(tab); setReviewingFaculty(null); setReviewingHod(null); }}
showSectionSelector={visibleMainTab === "myAppraisal"}
 sectionTab={myEffectiveSection}
 onSectionChange={handleMyAppraisalSectionChange}
 customSectionOptions={myCustomSectionOptions}
 profileSubtitle={`Director - ${sessionStorage.getItem("department")?.split(" ")[0] || ""}`}
 onLogout={() =>setShowLogoutModal(true)}
 showLogoutSpacer
/>
 )}
>

{loadingYearData && visibleMainTab !== "myAppraisal" && (
 <div className="appraisal-year-loading-overlay" role="status" aria-live="polite">
 <div className="appraisal-year-loading-card">
 <div className="appraisal-year-loading-spinner" />
 <div className="appraisal-year-loading-textwrap">
 <div className="appraisal-year-loading-text">Loading {selectedAcademicYear || "academic year"} data…</div>
 <div className="appraisal-year-loading-subtext">Fetching review queue records</div>
 <div className="appraisal-year-loading-dots"><span /><span /><span /></div>
 </div>
 </div>
 </div>
)}

{visibleMainTab === "myAppraisal" && <MyAppraisalSection sectionTab={myEffectiveSection} onSectionTabChange={handleMyAppraisalSectionChange} defaultDesignation={sessionStorage.getItem("role") === "director" ? "Director" : ""} defaultAcademicYear={sessionStorage.getItem("academicYear") || APP_INFO.DEFAULT_AY} titleNameFallback="Director" subtitleSeparator=" - " />}

{visibleMainTab === "departments" && canManagePrograms && (
<ManageDepartmentsPanel
 school={activeManageProgramSchool}
 headerControls={manageProgramSchools.length > 1 ? (
 <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 10, flexWrap: "wrap", marginTop: -4, padding: "0 2px 2px" }}>
 <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>Manage school</span>
 <select
 value={activeManageProgramSchool}
 onChange={(event) =>setManageProgramSchool(event.target.value)}
 style={{ height: 34, border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#0f172a", fontSize: 12, fontWeight: 800, padding: "4px 32px 4px 11px", fontFamily: "inherit", outline: "none", cursor: "pointer", minWidth: 260, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
 >
 {manageProgramSchools.map((schoolCode) =>{
 const school = getSchoolByValue(schoolCode);
 return <option key={schoolCode} value={schoolCode}>{school?.label || schoolCode}</option>;
 })}
 </select>
 <span style={{ fontSize: 11.5, fontWeight: 700, color: "#94a3b8" }}>
 {manageProgramSchools.length} school{manageProgramSchools.length === 1 ? "" : "s"} with HOD support
 </span>
 </div>
 ) : null}
/>
)}

 {visibleMainTab === "appraisalReviewer" && !reviewingFaculty && !reviewingHod && (
<>
<div className="reviewer-window__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 18, background: "#fff", borderRadius: 14, padding: "16px 24px", boxShadow: "0 10px 28px rgba(17,24,39,0.06)", border: "1px solid #e5e7eb" }}>
<div style={{ display: "flex", alignItems: "center", gap: 14 }}>
<AppraisalHeaderImage logo="dypiu" />
<div>
<h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: -0.5 }}>
 Appraisal Reviewer
</h1>
<div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", color: "#64748b", fontSize: 11 }}>
<span>{sessionStorage.getItem("department") || ""}</span>
<span>AY</span>
<select
 value={selectedAcademicYear}
 onChange={(event) =>handleReviewAcademicYearChange(event.target.value)}
 style={{ height: 28, border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff", color: "#0f172a", fontSize: 11, fontWeight: 800, padding: "3px 28px 3px 9px", fontFamily: "inherit", outline: "none" }}
>
 {academicYearOptions.map((cycle) =>(
 <option key={cycle.academic_year} value={cycle.academic_year}>
 {cycle.academic_year} {cycle.is_open ? "(Active)" : "(Closed)"}
 </option>
 ))}
</select>
</div>
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
<div style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 20, background: "#fef3c7", color: "#92400e" }}>
 {reviewerTypeFilter === "hod" ? hodPendingCount : facultyPendingCount} Pending
</div>
<div style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 20, background: "#d1fae5", color: "#065f46" }}>
 {reviewerTypeFilter === "hod" ? hodReviewedCount : facultyReviewedCount} Reviewed
</div>
<AppraisalHeaderImage logo="iqas" />
</div>
</div>

 {/* Filter */}
<div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "10px 16px", background: "#fff", borderRadius: 9, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
<span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>School:</span>
<select
 value={selectedDirectorSchool || dirSchool}
 onChange={(event) =>{ setSelectedDirectorSchool(event.target.value); setFilterStatus("All"); setReviewingFaculty(null); setReviewingHod(null); }}
 style={{ height: 30, border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#0f172a", fontSize: 11.5, fontWeight: 800, padding: "3px 10px", fontFamily: "inherit", outline: "none", cursor: "pointer" }}
>
 {uniqueDirectorSchools.length > 1 && <option value="__all__">All assigned schools</option>}
 {uniqueDirectorSchools.map((schoolCode) =>{
 const school = getSchoolByValue(schoolCode);
 return <option key={schoolCode} value={schoolCode}>{school?.label || schoolCode}</option>;
 })}
</select>
</div>
<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
<span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Reviewing:</span>
<select
 value={reviewerTypeFilter}
 onChange={(event) =>{ setReviewerTypeFilter(event.target.value); setFilterStatus("All"); }}
 style={{ height: 30, border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#0f172a", fontSize: 11.5, fontWeight: 800, padding: "3px 10px", fontFamily: "inherit", outline: "none", cursor: "pointer" }}
>
 <option value="faculty">Faculty's Appraisal ({facultyPendingCount} pending)</option>
 <option value="hod">HOD's Appraisal ({hodPendingCount} pending)</option>
</select>
</div>
<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
<span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Filter:</span>
 {["All", "Pending Review", "Reviewed"].map(f =>(
<button key={f} onClick={() =>setFilterStatus(f)}
 style={{ fontSize: 11, padding: "4px 12px", border: "1px solid #e2e8f0", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", background: filterStatus === f ? "#0f172a" : "none", color: filterStatus === f ? "#f1f5f9" : "#475569" }}>
 {f}
</button>
 ))}
</div>
</div>

 {queueLoadError && (
<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, color: "#991b1b", fontSize: 13, fontWeight: 700 }}>
 <span aria-hidden="true">!</span>
 <span>{queueLoadError}</span>
</div>
 )}

<div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
 {filtered.map(item =>{
 const itemSummary = standardSubmittedScoreSummary(item);
 const itemAcademicYear = item.academic_year || item.academicYear || selectedAcademicYear || APP_INFO.DEFAULT_AY;
 const courseFilePartA = Array.isArray(item.courseFile)
 ? (() =>{
 const filled = item.courseFile.filter(row =>String(row?.score ?? "").trim() !== "");
 return filled.length ? filled.reduce((total, row) =>total + courseFileRowScore(row), 0) / filled.length : 0;
 })()
 : n(item.courseFile?.score);
 const partA = [
 ...(item.lectures || []).map(r =>n(r.score)),
 courseFilePartA, n(item.innovScore),
 ...(item.projects || []).map(r =>n(r.score)),
 ...(item.quals || []).map(r =>n(r.score)),
 ...(item.feedback || []).map(r =>n(r.score)),
 ...(item.deptActs || []).map(r =>n(r.score)),
 ...(item.uniActs || []).map(r =>n(r.score)),
 ...(item.society || []).map(r =>societyRowScore(r)),
 ...(item.industry || []).map(r =>n(r.score)),
 ].reduce((a, b) =>a + b, 0);

 const partB = [
 ...(item.journals || []).map(r =>n(r.score)),
 ...(item.books || []).map(r =>n(r.score)),
 ...(item.confs || []).map(r =>n(r.score)),
 ...(item.patents || []).map(r =>n(r.score)),
 ].reduce((a, b) =>a + b, 0);

 const docCount = docsCount(item.docs, item);

 return (
<LazyVisible key={item.id} triggerKey={`${item.email}::${item.academicYear}`} onVisible={() =>handleCardVisible(item)}>
<div className="vc-review-card fa-fade-up" style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 16px rgba(15,23,42,0.06)", border: "1px solid #eef1f6", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
<Avatar initials={item.avatar} src={item.avatarUrl} color={item.avatarColor} size={52} />
<div style={{ flex: 1, minWidth: 0 }}>
<div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", letterSpacing: -0.2, marginBottom: 4 }}>{item.name}</div>
<div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 2 }}>{item.designation}</div>
<div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace" }}>{item.employeeId}</div>
</div>
<StatusBadge status={item.status} />
</div>

 {(() =>{
 const reviewed = isDirectorReviewed(item);
 const dirA = n(item.directorPartA);
 const dirB = n(item.directorPartB);
 const dirC = n(item.directorPartC);
 const dirD = n(item.directorPartD);
 const dirTotal = n(item.directorTotal);
 const selfA = itemSummary.partA;
 const selfB = itemSummary.partB;
 const selfC = itemSummary.partC;
 const selfD = itemSummary.partD;
 const selfTotal = itemSummary.total;
 const showDirScores = reviewed && (dirA >0 || dirB >0 || dirC >0 || dirD >0 || dirTotal >0);
 const reviewPartAMax = itemSummary.partAMax;
 const directorMetrics = legacyDashboardMetrics({
 academicYear: itemAcademicYear,
 labelPrefix: showDirScores ? "Dir" : "",
 partA: showDirScores ? dirA : selfA,
 partB: showDirScores ? dirB : selfB,
 total: showDirScores ? dirTotal : selfTotal,
 }) || [
 { label: showDirScores ? "Dir Part A" : "Part A", val: showDirScores ? dirA : selfA, max: showDirScores ? reviewPartAMax : itemSummary.partAMax, color: "#6366f1" },
 { label: showDirScores ? "Dir Part B" : "Part B", val: showDirScores ? dirB : selfB, max: itemSummary.partBMax, color: "#0ea5e9" },
 { label: showDirScores ? "Dir Part C" : "Part C", val: showDirScores ? dirC : selfC, max: itemSummary.partCMax, color: "#10b981" },
 { label: showDirScores ? "Dir Part E" : "Part D", val: showDirScores ? dirD : selfD, max: showDirScores ? 50 : itemSummary.partDMax, color: "#f59e0b" },
 { label: showDirScores ? "Dir Total" : "Total", val: showDirScores ? dirTotal : selfTotal, max: itemSummary.grandMax, color: "#4338ca" },
 ];
 const noScoresAvailable = reviewed && dirA === 0 && dirB === 0 && dirC === 0 && dirD === 0 && dirTotal === 0 && selfA === 0 && selfB === 0 && selfC === 0 && selfD === 0 && selfTotal === 0;
 if (noScoresAvailable) {
 return (
<div style={{ background: "#f0fdf4", borderRadius: 8, padding: "14px", textAlign: "center" }}>
<div style={{ fontSize: 18, color: "#10b981" }}>Done</div>
<div style={{ fontSize: 11, fontWeight: 700, color: "#059669", marginTop: 2 }}>Director Reviewed</div>
<div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Click "View Review" to see scores</div>
</div>
 );
 }
 
return (
<ReviewMetricsStrip
 metrics={directorMetrics}
docs={item.docs}
item={item}
/>
);
 })()}

<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
<div style={{ fontSize: 9.5, color: "#94a3b8", fontWeight: 600 }}>Submitted: {item.submittedOn}</div>
<button
 className="vc-action-button"
 disabled={reviewLoading === item.id}
 onClick={async () =>{
 setReviewLoading(item.id);
 try {
 const academicYear = item.academic_year || item.academicYear || selectedAcademicYear || APP_INFO.DEFAULT_AY || "2026-2027";
 const data = await fetchSavedAppraisal({
 facultyEmail: item.email,
 academicYear,
 reviewerRole: "director",
 });
 const form = data?.payload?.form || data?.form || {};
 const docs = data?.payload?.docs || data?.docs || {};
 const mergedForm = preserveSavedReviewScores(form, item);
 const declaration = data?.declaration || item.declaration || null;
 const merged = normalizeStandardReviewSubject({ ...item, ...mergedForm, docs, declaration, academicYear, academic_year: academicYear, previousYearResponse: data, previousYearResultOnly: isLegacyTwoPartAcademicYear(academicYear), status: declaration?.status || data?.status || item.status, workflowStatus: declaration?.status || data?.workflowStatus || item.workflowStatus });
 reviewerTypeFilter === "hod" ? setReviewingHod(merged) : setReviewingFaculty(merged);
 } catch (err) {
 alert(`Unable to open submitted form.\n\n${err.message}`);
 } finally {
 setReviewLoading(null);
 }
 }}
 style={{ fontSize: 11.5, padding: "8px 18px", background: reviewLoading === item.id ? "#94a3b8" : isDirectorReviewed(item) ? "#ecfdf5" : "#0f172a", color: reviewLoading === item.id ? "#fff" : isDirectorReviewed(item) ? "#047857" : "#fff", border: reviewLoading !== item.id && isDirectorReviewed(item) ? "1px solid #a7f3d0" : "none", borderRadius: 9, cursor: reviewLoading === item.id ? "wait" : "pointer", fontWeight: 800, fontFamily: "inherit", letterSpacing: 0.2, boxShadow: reviewLoading === item.id ? "none" : isDirectorReviewed(item) ? "0 2px 8px rgba(5,150,105,0.12)" : "0 6px 14px rgba(15,23,42,0.22)" }}>
 {reviewLoading === item.id ? "Loading..." : isDirectorReviewed(item) ? "View Review" : "Review Form"}
</button>
</div>
</div>
</LazyVisible>
 );
 })}
</div>

 {filtered.length === 0 && !queueLoadError && (
<div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
<div style={{ fontSize: 32, marginBottom: 8 }}>Done</div>
<div style={{ fontWeight: 700, color: "#0f172a" }}>All caught up!</div>
<div style={{ color: "#64748b", fontSize: 12 }}>No forms match the selected filter.</div>
</div>
 )}
</>
 )}

 {/* REVIEW PANEL */}
 {visibleMainTab === "appraisalReviewer" && reviewingFaculty && (
reviewingFaculty.previousYearResultOnly ? (
<PreviousYearAuthorityResult item={reviewingFaculty} onBack={() =>setReviewingFaculty(null)} />
) : (
<ReviewPanel
faculty={reviewingFaculty}
 onBack={() =>setReviewingFaculty(null)}
 onSubmit={(id, total, remarks, sectionScores, reviewConfirmed, decision) =>handleSubmitReview("faculty", id, total, remarks, sectionScores, reviewConfirmed, decision)}
readOnly={isDirectorReviewed(reviewingFaculty)}
/>
)
 )}
 {visibleMainTab === "appraisalReviewer" && reviewingHod && (
reviewingHod.previousYearResultOnly ? (
<PreviousYearAuthorityResult item={reviewingHod} onBack={() =>setReviewingHod(null)} />
) : (
<ReviewPanel
faculty={reviewingHod}
 onBack={() =>setReviewingHod(null)}
 onSubmit={(id, total, remarks, sectionScores, reviewConfirmed, decision) =>handleSubmitReview("hod", id, total, remarks, sectionScores, reviewConfirmed, decision)}
readOnly={isDirectorReviewed(reviewingHod)}
/>
)
 )}
</DashboardLayout>
 );
}









