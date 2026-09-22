/* eslint-disable no-unused-vars */
import { createContext, useContext, useState, useRef, useEffect } from "react";
import MyAppraisalForm from "../components/appraisal";
import { api } from "../services/api";
import { Avatar, ScoreCard, ScoreBar, StatusBadge, ReviewMetricsStrip, uploadedDocCount } from "../components/dashboard/dashboardPrimitives";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import { ACR_DETAIL_POINTS, SOCIETY_LABELS, MAX_SCORES, APP_INFO, createAcrRows, fetchSavedAppraisal, loadAppraisalDocuments, loadSavedAppraisal, mergeFacultyInfo, saveAppraisalDraftSection, submitAppraisal, fetchReviewQueueForRole, loadReviewerDraft, saveReviewerDraft, submitWorkflowReview, INNOVATIVE_METHODS, SCORE_LIMITS, averageSectionScore, clampScore, clampReviewScore, courseFileAverageScore, courseFileRowScore, effectiveMaxScore, feedbackAverage, feedbackRowScore, feedbackSectionScore, innovativeSelectionsFromDetails, innovativeTeachingScore, isAllowedAttachmentFile, isValidDDMMYYYY, maskDateDDMMYYYY, normalizeAutoScores, projectGuidanceRowMax, researchGuidanceRowMax, researchGuidanceScore, reviewSectionScore, rowHasReviewableData, isSectionEmpty, scoreRemaining, selfEffectivePartAMax, societyRowLocked, societyRowScore, sumSectionScore, toggleInnovativeMethod, validateCompleteRows, generateStandardReport, standardSubmittedScoreSummary, qualificationRowDescription, AppraisalHeaderImage, SummaryOtherInfoField, summaryOtherInfoValueFrom, RejectionNotice, DocCell, ViewCell, ViewDocsCell, RowButtons as RowBtns, SectionSaveFooter, SectionCard as SC, EmptySectionRow, T, TH, TH_HOD, TH_DIR, TH_DEAN, TD, TDC, TDS, TDS_HOD, TDS_DIR, TDS_DEAN, TDV, MyAppraisalSection, CreativeSchoolAuthorityReviewPanel, normalizeSubmittedCreativeFormForReview, isCreativeSchool, isDesignArtsSchool, isMediaCommSchool } from "../features/faculty-appraisal";
import { getActiveAcademicYear, getSessionItem, normalizeAcademicYearLabel, setActiveAcademicYear } from "../auth/session";
import { PreviousYearReportViewer } from "../features/previousYearReport";
import { isLegacyTwoPartAcademicYear } from "../features/faculty-appraisal/forms/standard/legacyPreviousYearReportUtils";
import { DEAN_TRACKS, getSchoolKey, getSchoolsByDeanTrack } from "../constants/universityHierarchy";
import { canReviewerRejectProfile, rejectedStatusFor, reviewedStatusFor, profileFromsessionStorage, workflowValidationError, roleLabel, isAppraisalFinalisedByVc, isRejectedStatus, isPendingReviewStatusFor, hasActiveRejection, reviewListFrom, getDeanTrack } from "../utils/hierarchy";
import { n, pct, grade, RO, TI } from "../features/faculty-appraisal/shared";
import { FacultyRecordHeader, ScoreTable, VCFinalRemarks, FinalSubmitButton, FACULTY_RECORD_THEME } from "../components/dashboard/FacultyAppraisalRecord";
import { enrichQueueItem } from "../services/reviewWorkflow";
import LazyVisible from "../components/dashboard/LazyVisible";
import { legacyDashboardMetrics } from "../utils/legacyDashboardMetrics";

const NON_ENGINEERING_SCHOOLS = getSchoolsByDeanTrack(DEAN_TRACKS.NON_ENGINEERING);
const NON_ENGINEERING_SCHOOL_VALUES = NON_ENGINEERING_SCHOOLS.flatMap((school) =>[
 school.code,
 school.name,
 school.label,
]);
const NON_ENGINEERING_SCHOOL_CODES = NON_ENGINEERING_SCHOOLS.map((school) =>school.code);
const SCHOOL_VISUALS = {
 SoCM: { icon: "CM", color: "#14b8a6", bg: "#ecfeff" },
 SoMCS: { icon: "MC", color: "#6366f1", bg: "#eef2ff" },
 SoHSS: { icon: "HS", color: "#6366f1", bg: "#eef2ff" },
 SoD: { icon: "DS", color: "#ec4899", bg: "#fdf2f8" },
 CioD: { icon: "DS", color: "#ec4899", bg: "#fdf2f8" },
 SoAA: { icon: "AA", color: "#7c3aed", bg: "#f3e8ff" },
};
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
      <PreviousYearReportViewer showTables visibleLevels={["faculty", "dean"]} formType={previousYearFormTypeFor(item)} form={item} docs={item.docs || {}} response={item.previousYearResponse || item} academicYear={item.academicYear || item.academic_year || item.info?.ay} profile={item} reviews={reviewListFrom(item.reviews || item.previousYearResponse?.reviews || item.previousYearResponse?.payload?.reviews)} />
    </div>
  );
}

// --- Helpers ------------------------------------------------------------------
const reviewerMaxScoresFromSubmitted = (summary) =>({
 partA: n(summary.partAMax),
 partB: n(summary.partBMax),
 partC: n(summary.partCMax),
 partD: n(summary.partDMax) || 50,
 grand: n(summary.partAMax) + n(summary.partBMax) + n(summary.partCMax) + (n(summary.partDMax) || 50),
});
const preserveScrollAfterStateUpdate = (update) =>{
 const x = window.scrollX || 0;
 const y = window.scrollY || 0;
 update();
 requestAnimationFrame(() =>window.scrollTo(x, y));
};

function DeanInput({ val, onChange, max, disabled = false }) {
 return (
<input type="number" min="0" step="0.5" value={val ?? ""}
 max={max}
 disabled={disabled}
 onChange={e =>onChange(e.target.value === "" || max === undefined ? e.target.value : String(clampScore(e.target.value, max)))}
 style={{ width: 58, textAlign: "center", border: "1.5px solid #7c3aed", borderRadius: 5, padding: "3px 5px", fontSize: 11, fontFamily: "inherit", outline: "none", background: disabled ? "#f1f5f9" : "#faf5ff", cursor: disabled ? "not-allowed" : "text" }}
 />
 );
}
function SelfInput({ val, onChange, max }) {
 return (
<input type="number" min="0" step="0.5" value={val ?? ""}
 max={max}
 onChange={e =>onChange(e.target.value === "" || max === undefined ? e.target.value : String(clampScore(e.target.value, max)))}
 style={{ width: 58, textAlign: "center", border: "1.5px solid #10b981", borderRadius: 5, padding: "3px 5px", fontSize: 11, fontFamily: "inherit", outline: "none", background: "#f0fff8" }}
 />
 );
}
function ReviewPanel({ faculty, onBack, onSubmit }) {
 const [hodData, setHodData] = useState({});
 const [remarks, setRemarks] = useState(faculty.hodRemarks || "");
 const [sectionView, setSectionView] = useState("partA");

 // Compute HOD total from hodData
 const calcHodScore = () =>{
 const get = (section, idx, field) =>{
 if (hodData[section]) {
 const s = hodData[section];
 return idx === null ? n(s[field]) : n(s[idx]?.[field]);
 }
 return idx === null ? n(faculty[section]?.[field]) : n(faculty[section]?.[idx]?.[field]);
 };
 const getS = (key) =>n(hodData[key] ?? faculty[key]);

 const lectureReviewRows = (faculty.lectures || []).map((row, i) =>({
 ...row,
 hod: hodData.lectures?.[i]?.hod ?? row.hod ?? "",
 }));
 const courseFileReviewRows = (faculty.courseFile || []).map((row, i) =>({
 ...row,
 hod: hodData.courseFile?.[i]?.hod ?? row.hod ?? "",
 }));
 const lec = reviewSectionScore("lectures", lectureReviewRows, 40, "hod");
 const cf = reviewSectionScore("courseFile", courseFileReviewRows, 20, "hod");
 const innov = getS("innovHod");
 const proj = (faculty.projects || []).reduce((a, _, i) =>a + get("projects", i, "hod"), 0);
 const qual = (faculty.quals || []).reduce((a, _, i) =>a + get("quals", i, "hod"), 0);
 const feedbackReviewRows = (faculty.feedback || []).map((row, i) =>({
 ...row,
 hod: hodData.feedback?.[i]?.hod ?? row.hod ?? "",
 }));
 const fb = reviewSectionScore("feedback", feedbackReviewRows, 10, "hod");
 const partA = lec + cf + innov + proj + qual + fb;

 const jour = (faculty.journals || []).reduce((a, _, i) =>a + get("journals", i, "hod"), 0);
 const bk = (faculty.books || []).reduce((a, _, i) =>a + get("books", i, "hod"), 0);
 const ictT = (faculty.ict || []).reduce((a, _, i) =>a + get("ict", i, "hod"), 0);
 const res = (faculty.research || []).reduce((a, _, i) =>a + get("research", i, "hod"), 0);
 const resProjects = clampScore((faculty.projects2 || []).reduce((a, _, i) =>a + get("projects2", i, "hod"), 0), SCORE_LIMITS.researchInternalProjects);
 const externalResProjects = clampScore((faculty.externalProjects || []).reduce((a, _, i) =>a + get("externalProjects", i, "hod"), 0), SCORE_LIMITS.researchExternalProjects);
 const pat = (faculty.patents || []).reduce((a, _, i) =>a + get("patents", i, "hod"), 0);
 const awd = (faculty.awards || []).reduce((a, _, i) =>a + get("awards", i, "hod"), 0);
 const conf = (faculty.confs || []).reduce((a, _, i) =>a + get("confs", i, "hod"), 0);
 const prop = (faculty.proposals || []).reduce((a, _, i) =>a + get("proposals", i, "hod"), 0);
 const prod = (faculty.products || []).reduce((a, _, i) =>a + get("products", i, "hod"), 0);
 const fdp = clampScore((faculty.fdps || []).reduce((a, _, i) =>a + clampScore(get("fdps", i, "hod"), SCORE_LIMITS.fdpRow), 0), 10);
 const train = clampScore((faculty.training || []).reduce((a, _, i) =>a + clampScore(get("training", i, "hod"), SCORE_LIMITS.fdpRow), 0), 10);
 const b8 = clampScore(fdp + train, 10);
 const partB = jour + bk + ictT + res + resProjects + externalResProjects + pat + awd + conf + prop + prod + b8;
 const dept = (faculty.deptActs || []).reduce((a, _, i) =>a + get("deptActs", i, "hod"), 0);
 const uni = (faculty.uniActs || []).reduce((a, _, i) =>a + get("uniActs", i, "hod"), 0);
 const events = (faculty.eventRows || []).reduce((a, _, i) =>a + get("eventRows", i, "hod"), 0);
 const soc = (faculty.society || []).reduce((a, row, i) =>a + (societyRowLocked(row) ? 0 : get("society", i, "hod")), 0);
 const ind = (faculty.industry || []).reduce((a, _, i) =>a + get("industry", i, "hod"), 0);
 const alumni = (faculty.alumniRows || []).reduce((a, _, i) =>a + get("alumniRows", i, "hod"), 0);
 const placement = (faculty.placementRows || []).reduce((a, _, i) =>a + get("placementRows", i, "hod"), 0);
 const partC = uni + dept + events + soc + ind + alumni + placement;
 const partD = (faculty.acr || []).reduce((a, _, i) =>a + clampScore(get("acr", i, "hod"), SCORE_LIMITS.acrRow), 0);

 return { partA, partB, partC, partD, total: partA + partB + partC + partD };
 };

 const { partA, partB, partC, partD, total } = calcHodScore();
 const g = grade(total, 700);
 const facultySummary = standardSubmittedScoreSummary(faculty, {
 partA: faculty.lectures?.reduce((a, r) =>a + n(r.score), 0) || 0,
 partB: faculty.journals?.reduce((a, r) =>a + n(r.score), 0) || 0,
 });

 return (
<div style={{ display: "flex", flexDirection: "column", gap: 0, minHeight: "100%" }}>
 {/* Header */}
<div style={{ background: "#0f172a", padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, marginBottom: 16, borderRadius: 10 }}>
<button onClick={onBack} style={{ background: "#1e293b", border: "none", color: "#94a3b8", cursor: "pointer", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontFamily: "inherit" }}>Back</button>
<Avatar initials={faculty.avatar} src={faculty.avatarUrl} color={faculty.avatarColor} size={50} />
<div style={{ flex: 1 }}>
<div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{faculty.name}</div>
<div style={{ color: "#64748b", fontSize: 11 }}>{faculty.designation} - {faculty.employeeId}</div>
</div>
<div style={{ display: "flex", gap: 10 }}>
<div style={{ background: "#1e293b", borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
<div style={{ color: "#94a3b8", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6 }}>HOD Part A</div>
<div style={{ color: "#818cf8", fontWeight: 800, fontSize: 16 }}>{partA.toFixed(1)}</div>
</div>
<div style={{ background: "#1e293b", borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
<div style={{ color: "#94a3b8", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6 }}>HOD Part B</div>
<div style={{ color: "#38bdf8", fontWeight: 800, fontSize: 16 }}>{partB.toFixed(1)}</div>
</div>
<div style={{ background: g.bg, border: `2px solid ${g.color}40`, borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
<div style={{ color: g.color, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>HOD Total</div>
<div style={{ color: g.color, fontWeight: 800, fontSize: 16 }}>{total.toFixed(1)}<span style={{ fontSize: 10, color: "#94a3b8" }}>/700</span></div>
</div>
</div>
</div>

 {/* Section switcher */}
<div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
  {[["partA", "Part A"], ["partB", "Part B"], ["partC", "Part C"], ["partD", "Part D"], ["summary", "Summary"]].map(([id, label]) =>(
 <button key={id} onClick={() =>{
  setSectionView(id);
  requestAnimationFrame(() =>{
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
  }}
  style={{ padding: "7px 18px", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: sectionView === id ? "#312e81" : "#e2e8f0", color: sectionView === id ? "#e0e7ff" : "#475569" }}>
  {label}
 </button>
  ))}
 </div>

  {["partA", "partB", "partC", "partD"].includes(sectionView) && (
 <MyAppraisalForm faculty={faculty} hodData={hodData} setHodData={setHodData} sectionView={sectionView} />
  )}

 {sectionView === "summary" && (
<div style={{ background: "#fff", borderRadius: 10, padding: "22px 24px", boxShadow: "0 1px 6px rgba(0,0,0,.06)" }}>
<div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
<ScoreCard
 title="Faculty Score"
 totals={{ partA: facultySummary.partA, partB: facultySummary.partB, total: facultySummary.total }}
 maxScores={{ partA: facultySummary.partAMax, partB: facultySummary.partBMax, grand: facultySummary.grandMax }}
/>
<ScoreCard
 title="HOD Score"
 totals={{ partA, partB, total }}
 maxScores={{ partA: facultySummary.partAMax, partB: facultySummary.partBMax, grand: facultySummary.grandMax }}
 remarksTitle="HOD Remarks"
 isFinal
 remarksContent={(
<textarea value={remarks} onChange={e =>setRemarks(e.target.value)} rows={7}
 placeholder="Enter your remarks here..."
 style={{ width: "100%", height: 235, minHeight: 235, border: "1px solid #e2e8f0", borderRadius: 7, padding: "10px 12px", fontSize: 12, fontFamily: "inherit", resize: "none", boxSizing: "border-box" }} />
 )}
/>
</div>

<div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
<button onClick={onBack} style={{ padding: "9px 22px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit" }}>Cancel</button>
<button onClick={() =>onSubmit(faculty.id, total, remarks)}
 disabled={!remarks.trim()}
 style={{ padding: "10px 28px", background: remarks.trim() ? "#059669" : "#64748b", color: "#fff", border: "none", borderRadius: 7, cursor: remarks.trim() ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
 ? Submit HOD Review
</button>
</div>
</div>
 )}
</div>
 );
}

const DEAN_REVIEW_PART_A_KEYS = ["lectures", "courseFile", "projects", "obeRows", "mentoringRows", "quals", "feedback"];
const DEAN_REVIEW_PART_B_KEYS = ["journals", "books", "ict", "research", "projects2", "externalProjects", "patents", "awards", "confs", "proposals", "products", "fdps", "training"];
const DEAN_REVIEW_PART_C_KEYS = ["uniActs", "deptActs", "eventRows", "society", "industry", "alumniRows", "placementRows"];
const DEAN_REVIEW_PART_D_KEYS = ["acr"];
const DEAN_REVIEW_ARRAY_KEYS = [...DEAN_REVIEW_PART_A_KEYS, ...DEAN_REVIEW_PART_B_KEYS, ...DEAN_REVIEW_PART_C_KEYS, ...DEAN_REVIEW_PART_D_KEYS];
const REVIEW_SCORE_FIELDS = ["hod", "director", "dean", "vc"];
const preserveSavedReviewScores = (form = {}, source = {}) =>{
 const merged = { ...form };
 merged.info = mergeFacultyInfo(form.info, source, form);
 DEAN_REVIEW_ARRAY_KEYS.forEach((key) =>{
 if (!Array.isArray(form[key])) return;
 const sourceRows = Array.isArray(source[key]) ? source[key] : [];
 merged[key] = form[key].map((row, index) =>{
 const sourceRow = sourceRows[index] || {};
 const next = { ...row };
 REVIEW_SCORE_FIELDS.forEach((field) =>{
 if (String(next[field] ?? "").trim() === "" && String(sourceRow[field] ?? "").trim() !== "") next[field] = sourceRow[field];
 });
 return next;
 });
 });
 ["innovHod", "innovDirector", "innovDean", "innovVc"].forEach((field) =>{
 if (String(merged[field] ?? "").trim() === "" && String(source[field] ?? "").trim() !== "") merged[field] = source[field];
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
const DEAN_SECTION_MAX = { lectures: 40, courseFile: 20, projects: 20, obeRows: 20, mentoringRows: 10, quals: 10, feedback: 10, deptActs: 30, uniActs: 50, eventRows: 20, society: 10, industry: 10, alumniRows: 10, placementRows: 20, acr: 50, journals: 120, books: 50, ict: 20, research: 30, projects2: 40, externalProjects: SCORE_LIMITS.researchExternalProjects, patents: 40, awards: 10, confs: 30, proposals: 10, products: 10, fdps: 10, training: 10 };
const DEAN_ROW_MAX = { lectures: () =>10, courseFile: () =>SCORE_LIMITS.courseFileRow, projects: projectGuidanceRowMax, projects2: (row) =>row.max || 40, obeRows: (row) =>row.max || 20, mentoringRows: (row) =>row.max || 10, quals: () =>SCORE_LIMITS.qualificationRow, feedback: () =>10, uniActs: () =>50, deptActs: () =>30, eventRows: () =>20, society: (row) =>row.max || 10, industry: () =>10, alumniRows: () =>10, placementRows: () =>20, acr: () =>SCORE_LIMITS.acrRow, research: researchGuidanceRowMax, fdps: () =>SCORE_LIMITS.fdpRow, training: () =>SCORE_LIMITS.fdpRow };

const getSectionMaxForApproval = (key, approval) => {
  const baseMax = DEAN_SECTION_MAX[key] || 0;
  if (key === "proposals" || key === "awards" || key === "products") {
    const school = approval?.info?.school || approval?.school || "";
    const schoolKey = getSchoolKey(school);
    const isApplicable = ["SoCSEA", "SoBB", "SoCE", "SoEMR", "SoCM"].includes(schoolKey);
    return isApplicable ? 20 : 10;
  }
  return baseMax;
};

const deanScorePayload = (approval, deanData) =>{
  const payload = {};

  DEAN_REVIEW_ARRAY_KEYS.forEach((key) =>{
  const rows = key === "acr" ? createAcrRows(approval[key]) : (Array.isArray(approval[key]) ? approval[key] : []);
  payload[key] = rows.map((row, index) =>({
  ...row,
  dean: key === "society" && societyRowLocked(row)
  ? "0"
  : isSectionEmpty(key, approval[key], approval.docs)
    ? ""
    : clampReviewScore(key, row, deanData[key]?.[index]?.dean ?? row.dean ?? "", key === "lectures" ? 10 : getSectionMaxForApproval(key, approval)),
  }));
  });

 const innovRows = Array.isArray(approval.innovRows) ? approval.innovRows : [];
 const reviewInnovRows = Array.isArray(deanData.innovRows) ? deanData.innovRows : [];
 const mergedInnovRows = innovRows.map((row, index) =>({
 ...row,
 dean: clampReviewScore("innovRows", row, reviewInnovRows[index]?.dean ?? row.dean ?? "", 10),
 }));
 const innovTotal = reviewSectionScore("innovRows", mergedInnovRows, 20, "dean");
 payload.innovRows = mergedInnovRows;
 payload.innovativeTeaching = {
 dean: innovTotal ? String(innovTotal) : deanData.innovativeTeaching?.dean ?? approval.innovDean ?? "",
 };

 return payload;
};

const sumDeanRows = (payload, keys, approval) =>
  keys.reduce((total, key) =>{
  const sectionMax = getSectionMaxForApproval(key, approval);
  if (key !== "acr" && isSectionEmpty(key, approval[key], approval.docs)) return total;
  if (key === "lectures" || key === "courseFile" || key === "feedback") return total + reviewSectionScore(key, payload[key] || [], sectionMax, "dean");
  return total + clampScore((payload[key] || []).reduce((sum, row) =>{
  if (key === "society" && societyRowLocked(row)) return sum;
  if (!rowHasReviewableData(key, row)) return sum;
  const rowMax = DEAN_ROW_MAX[key]?.(row) || sectionMax;
  return sum + (rowMax ? clampScore(row.dean, rowMax) : n(row.dean));
  }, 0), sectionMax);
  }, 0);

const deanScoreTotals = (payload, approval) =>{
  const innovativeScore = Array.isArray(payload.innovRows) && payload.innovRows.length
  ? reviewSectionScore("innovRows", payload.innovRows, 10, "dean")
  : clampScore(payload.innovativeTeaching?.dean, 10);
  const partA = clampScore(sumDeanRows(payload, DEAN_REVIEW_PART_A_KEYS, approval) + innovativeScore, 150);
  const b8 = clampScore(sumDeanRows(payload, ["fdps"], approval) + sumDeanRows(payload, ["training"], approval), 10);
  const partBWithoutB8 = sumDeanRows(payload, DEAN_REVIEW_PART_B_KEYS.filter(k =>k !== "fdps" && k !== "training"), approval);
  const cappedPartB = clampScore(partBWithoutB8 + b8, 350);
  const partC = clampScore(sumDeanRows(payload, DEAN_REVIEW_PART_C_KEYS, approval), 150);
  const partD = clampScore(sumDeanRows(payload, DEAN_REVIEW_PART_D_KEYS, approval), 50);
  return { partA, partB: cappedPartB, partC, partD, total: clampScore(partA + cappedPartB + partC + partD, 700) };
};

function DeanScoreCell({ sectionKey, index, row, deanData, setDeanData }) {
 const ctx = useContext(DeanReviewTableContext);
 const approval = ctx?.approval || {};
 const value = deanData[sectionKey]?.[index]?.dean ?? row.dean ?? "";
 const sectionMax = getSectionMaxForApproval(sectionKey, approval);
 const maxForRow = DEAN_ROW_MAX[sectionKey]?.(row) || sectionMax;
 const societyLocked = sectionKey === "society" && societyRowLocked(row);
 const locked = sectionKey === "acr" ? false : (societyLocked || !rowHasReviewableData(sectionKey, row) || isSectionEmpty(sectionKey, approval[sectionKey], ctx?.docs));
 const displayValue = societyLocked ? "0" : String(value ?? "").trim() ? clampScore(value, maxForRow) : "";

 const update = (nextValue) =>{
 const clampedValue = clampReviewScore(sectionKey, row, nextValue, sectionKey === "lectures" ? 10 : sectionMax);
 preserveScrollAfterStateUpdate(() =>setDeanData((prev) =>{
 const baseRows = Array.isArray(prev[sectionKey]) ? prev[sectionKey] : [];
 const updatedRows = [...baseRows];
 updatedRows[index] = { ...(updatedRows[index] || row), dean: clampedValue };
 return { ...prev, [sectionKey]: updatedRows };
 }));
 };

 return<DeanInput val={displayValue} max={maxForRow} disabled={locked} onChange={update} />;
}

function DeanInnovativeScoreCell({ row, index, rows, deanData, setDeanData }) {
 const ctx = useContext(DeanReviewTableContext);
 const value = deanData.innovRows?.[index]?.dean ?? row.dean ?? "";
 const locked = !rowHasReviewableData("innovRows", row) || isSectionEmpty("innovRows", rows, ctx?.docs);
 const update = (nextValue) =>{
 const clampedValue = clampReviewScore("innovRows", row, nextValue, 10);
 preserveScrollAfterStateUpdate(() =>setDeanData((prev) =>{
 const baseRows = Array.isArray(prev.innovRows) && prev.innovRows.length ? prev.innovRows : rows;
 const updatedRows = [...baseRows];
 updatedRows[index] = { ...(updatedRows[index] || row), dean: clampedValue };
 const totalRows = updatedRows.map((item, rowIndex) =>({ ...item, ...(rowIndex === index ? row : {}) }));
 const total = reviewSectionScore("innovRows", totalRows, 20, "dean");
 return {
 ...prev,
 innovRows: updatedRows,
 innovativeTeaching: { ...(prev.innovativeTeaching || {}), dean: total ? String(total) : "" },
 };
 }));
 };
 return (
<DeanInput
 val={String(value ?? "").trim() ? clampScore(value, row.max || SCORE_LIMITS.innovativeRow) : ""}
 max={row.max || SCORE_LIMITS.innovativeRow}
 disabled={locked}
 onChange={update}
 />
 );
}

const DeanReviewTableContext = createContext(null);

function ReviewTable({ title, accent = "#4338ca", sectionKey, columns, docPrefix, rows: sectionRows }) {
 const ctx = useContext(DeanReviewTableContext);
 if (!ctx) return null;
 const dataRows = sectionRows || ctx.rows(sectionKey);
 const hasDocs = Boolean(docPrefix);
 const showPreviousScoreColumn = sectionKey !== "acr";
 const colSpan = 1 + columns.length + (hasDocs ? 1 : 0) + (showPreviousScoreColumn ? 1 : 0) + 1;
 const sectionEmpty = isSectionEmpty(sectionKey, dataRows, ctx.docs);
 const previousScoreLabel = sectionKey === "acr" ? "Previous ACR Score" : "Faculty Score";
 const previousScoreFor = (row) => {
 if (sectionKey === "research") return row.degree || row.name || row.thesis || row.score ? researchGuidanceScore(row).toFixed(1) : "";
 if (sectionKey === "society") return String(row.score ?? "").trim() ? clampScore(row.score, DEAN_ROW_MAX[sectionKey]?.(row) || getSectionMaxForApproval(sectionKey, ctx.approval)) : "";
 if (sectionKey === "acr") return row.director ?? row.dir ?? row.director_score ?? row.dir_score ?? "";
 return row.score;
 };

 return (
<SC title={title} accent={accent}>
<div style={{ overflowX: "visible", width: "100%" }}>
<table style={{ ...T, minWidth: 0, maxWidth: "100%" }}>
<thead>
<tr>
<th style={TH}>SN</th>
 {columns.map((column) =><th key={column.label} style={TH}>{column.label}</th>)}
 {hasDocs &&<th style={TH}>View Docs</th>}
 {showPreviousScoreColumn && <th style={TH}>{previousScoreLabel}</th>}
 <th style={TH_DEAN}>Dean Score</th>
</tr>
</thead>
<tbody>
 {sectionEmpty ? (
 <EmptySectionRow colSpan={colSpan} />
 ) : dataRows.map((row, index) =>(
<tr key={`${sectionKey}-${index}`} style={sectionKey === "society" && societyRowLocked(row) ? { background: "#f1f5f9", opacity: 0.65 } : index % 2 ? { background: "#f8fafc" } : {}}>
<td style={TDC}>{index + 1}</td>
 {columns.map((column) =>(
<td key={column.label} style={column.center ? TDC : TD}>
 {ctx.cell(column.render(row), column.center)}
</td>
 ))}
 {hasDocs &&<td style={TDV}><ViewDocsCell docKey={`${docPrefix}-${index}`} docs={ctx.docs} /></td>}
 {showPreviousScoreColumn && <td style={TDS}>{ctx.cell(previousScoreFor(row), true)}</td>}
<td style={TDS_DEAN}><DeanScoreCell sectionKey={sectionKey} index={index} row={row} deanData={ctx.deanData} setDeanData={ctx.setDeanData} /></td>
</tr>
 ))}
</tbody>
</table>
</div>
</SC>
 );
}

function DeanFacultyInfoTable({ approval, info }) {
 const rows = [
 ["Academic Year", approval.academicYear || info.ay],
 ["Name", info.name || approval.name],
 ["Qualification", info.qual || info.qualification || approval.qualification],
 ["Designation", info.desig || info.designation || approval.designation],
 ["School", info.school || approval.school || approval.department],
 ["Experience", info.experience || info.teachingExperience || approval.experience || approval.teachingExperience],
 ];

 return (
<SC title="Faculty Information" accent="#4338ca">
<div style={{ border: "1px solid #dbe3ef", borderRadius: 8, background: "#fff", overflow: "hidden" }}>
<table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 13 }}>
<tbody>
 {rows.map(([label, value]) =>(
<tr key={label}>
<td style={{ width: "32%", border: "1px solid #e5e7eb", background: "#f8fafc", padding: "11px 16px", color: "#334155", fontWeight: 900, textTransform: "uppercase" }}>{label}</td>
<td style={{ border: "1px solid #e5e7eb", padding: "11px 16px", color: "#1e293b", fontWeight: 700, overflowWrap: "anywhere" }}>{value || "-"}</td>
</tr>
 ))}
</tbody>
</table>
</div>
</SC>
 );
}

function DeanReviewScoreForm({ approval, deanData, setDeanData, sectionView = "partA" }) {
 const info = mergeFacultyInfo(approval.info, approval);
 const docs = approval.docs || {};
 const rows = (key) =>Array.isArray(approval[key]) ? approval[key] : [];
 const cell = (value, center = false) =><RO val={value} center={center} />;
 const innovativeRows = Array.isArray(approval.innovRows) && approval.innovRows.length
 ? approval.innovRows
 : [{ method: approval.innovDetails || "Innovative / participatory teaching methods", details: approval.innovDetails || "", score: approval.innovScore || "" }];

 return (
<DeanReviewTableContext.Provider value={{ approval, deanData, docs, rows, setDeanData, cell }}>
<div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
<div style={{ background: "linear-gradient(90deg,#312e81,#4338ca)", color: "#ede9fe", borderRadius: 8, padding: "10px 16px", marginBottom: 14, fontSize: 12 }}>
<strong>Dean Review Mode</strong>- Faculty self-scores are read-only. Only the Dean score column is editable.
</div>

<DeanFacultyInfoTable approval={approval} info={info} />

 {sectionView === "partA" && (<>
<div style={{ fontWeight: 800, fontSize: 13, color: "#1e293b", background: "#dbeafe", padding: "8px 14px", borderRadius: 6, marginBottom: 10, letterSpacing: 0.3 }}>
 Part A - Teaching & Academic Activities
</div>

<ReviewTable
 title="A1. Lectures / Tutorials / Practicals"
 accent="#4338ca"
 sectionKey="lectures"
 docPrefix="lec"
 columns={[
 { label: "Semester", render: (r) =>r.sem },
 { label: "Course Code / Name", render: (r) =>r.code },
 { label: "Classes (as per course structure)", render: (r) =>r.planned, center: true },
 { label: "Classes Actually Conducted", render: (r) =>r.conducted, center: true },
 { label: "% Conducted", render: (r) =>r.pctConducted || (Number(r.planned) > 0 && Number(r.conducted) >= 0 ? `${((Number(r.conducted) / Number(r.planned)) * 100).toFixed(1)}%` : ""), center: true },
 ]}
 />

<ReviewTable
 title="A2. Course File"
 accent="#4338ca"
 sectionKey="courseFile"
 docPrefix="courseFile"
 columns={[
 { label: "Course / Paper", render: (r) =>r.course },
 { label: "Program & Semester", render: (r) =>r.title },
 { label: "IQAC Index Compliance (Yes/No, with proof)", render: (r) =>r.details },
 ]}
 />

<SC title="A3. Innovative Teaching-Learning" accent="#4338ca">
<table style={T}>
<thead>
<tr>
<th style={TH}>SN</th>
<th style={TH}>Method</th>
<th style={TH}>Proof Attached (Yes/No)</th>
<th style={TH}>View Docs</th>
<th style={TH}>Self Score</th>
<th style={TH_DEAN}>Dean</th>
</tr>
</thead>
<tbody>
 {innovativeRows.map((row, index) =>(
<tr key={`innov-${index}`}>
<td style={TDC}>{index + 1}</td>
<td style={TD}><RO val={row.method || approval.innovDetails} /></td>
<td style={TD}><RO val={row.details} /></td>
<td style={TDV}><ViewDocsCell docKey={index === 0 ? ["innov", "innov-0"] : `innov-${index}`} docs={docs} /></td>
<td style={TDS}><RO val={String(row.score ?? "").trim() ? clampScore(row.score, row.max || SCORE_LIMITS.innovativeRow) : ""} center /></td>
<td style={TDS_DEAN}><DeanInnovativeScoreCell row={row} index={index} rows={innovativeRows} deanData={deanData} setDeanData={setDeanData} /></td>
</tr>
 ))}
</tbody>
</table>
</SC>

<ReviewTable
 title="A4. Student Feedback"
 accent="#0ea5e9"
 sectionKey="feedback"
 columns={[
 { label: "Course", render: (r) =>r.code },
 { label: "First Feedback(%)", render: (r) =>r.fb1, center: true },
 { label: "Second Feedback(%)", render: (r) =>r.fb2, center: true },
 { label: "Average", render: (r) =>r.fb1 && r.fb2 ? ((n(r.fb1) + n(r.fb2)) / 2).toFixed(2) : "", center: true },
 ]}
 />

<ReviewTable
 title="A5. Learning Outcomes Attainment & OBE Practice"
 accent="#8b5cf6"
 sectionKey="obeRows"
 docPrefix="obe"
 columns={[
 { label: "Component", render: (r) =>r.component },
 { label: "Evidence", render: (r) =>r.evidence },
 ]}
 />

<ReviewTable
 title="A6. Guided Students Project"
 accent="#8b5cf6"
 sectionKey="projects"
 docPrefix="proj"
 columns={[{ label: "Project Type / Description", render: (r) =>r.label }]}
 />

<ReviewTable
 title="A7. Student Mentoring & Counselling"
 accent="#8b5cf6"
 sectionKey="mentoringRows"
 docPrefix="mentor"
 columns={[
 { label: "Activity", render: (r) =>r.activity },
 { label: "Evidence", render: (r) =>r.evidence },
 ]}
 />

<ReviewTable
 title="A8. Qualification Enhancement"
 accent="#8b5cf6"
 sectionKey="quals"
 docPrefix="qual"
 columns={[{ label: "Description", render: qualificationRowDescription }]}
 />

</>)}
 {sectionView === "partB" && (<>
<div style={{ fontWeight: 800, fontSize: 13, color: "#1e293b", background: "#ede9fe", padding: "8px 14px", borderRadius: 6, marginBottom: 10, letterSpacing: 0.3 }}>
 Part B - Research & Academic Contributions
</div>

<ReviewTable
 title="B1. Journal Publications"
 accent="#7c3aed"
 sectionKey="journals"
 docPrefix="jour"
 columns={[
 { label: "Title", render: (r) =>r.title },
 { label: "Journal", render: (r) =>r.journal },
 { label: "DOI No.", render: (r) =>r.issn, center: true },
 { label: "Impact Factor", render: (r) =>r.impactFactor || r.impact, center: true },
 { label: "Author Position", render: (r) =>r.authorPosition || r.position, center: true },
 ]}
 />

<ReviewTable
 title="B2. Books, Book Chapters & Edited Volumes"
 accent="#7c3aed"
 sectionKey="books"
 docPrefix="book"
 columns={[
 { label: "Title", render: (r) =>r.title },
 { label: "Publisher & ISBN", render: (r) =>r.book || r.publisherIsbn },
 { label: "Type", render: (r) =>r.pub || r.type },
 { label: "Level", render: (r) =>r.level },
 { label: "Co-authors from DYPIU", render: (r) =>r.coauth },
 ]}
 />

<ReviewTable
 title="B3. Patents, Copyrights & IP and Product Development"
 accent="#f97316"
 sectionKey="patents"
 docPrefix="pat"
 columns={[
 { label: "Title", render: (r) =>r.title },
 { label: "National / International", render: (r) =>r.type || r.level, center: true },
 { label: "Status (Published/Granted)", render: (r) =>r.status, center: true },
 { label: "Filing / Grant No. & Date", render: (r) =>r.fileNo || r.date, center: true },
 ]}
 />

<ReviewTable
 title="B4. External Funded Research Projects"
 accent="#059669"
 sectionKey="projects2"
 docPrefix="project2"
 columns={[
 { label: "Title of Project", render: (r) =>r.title },
 { label: "Funding Agency", render: (r) =>r.agency },
 { label: "Sanction Date", render: (r) =>r.date, center: true },
 { label: "Amount (₹)", render: (r) =>r.amount, center: true },
 { label: "PI / Co-PI", render: (r) =>r.role },
 { label: "Status", render: (r) =>r.status },
 ]}
 />

<ReviewTable
 title="B5. Research Guidance"
 accent="#059669"
 sectionKey="research"
 docPrefix="res"
 columns={[
 { label: "Degree (PhD/PG)", render: (r) =>r.degree, center: true },
 { label: "Name of Student / Scholar", render: (r) =>r.name },
 { label: "Status (Ongoing/Awarded)", render: (r) =>r.status || r.thesis },
 { label: "Date", render: (r) =>(r.status || r.thesis) === "Ongoing" ? "NA" : r.date, center: true },
 ]}
 />

<ReviewTable
 title="B6. Consultancy, Testing & Training"
 accent="#0ea5e9"
 sectionKey="proposals"
 docPrefix="prop"
 columns={[
 { label: "Client / Organisation", render: (r) =>r.agency || r.title },
 { label: "Nature of Engagement", render: (r) =>r.duration || r.nature },
 { label: "Revenue Generated (₹)", render: (r) =>r.amount || r.revenue, center: true },
 ]}
 />

<ReviewTable
 title="B7. Conference / FDP / Training / Workshop Contributions as Resource Person"
 accent="#6366f1"
 sectionKey="confs"
 docPrefix="conf"
 columns={[
 { label: "Event / Session Title", render: (r) =>r.title },
 { label: "Role", render: (r) =>r.role || r.type },
 { label: "Date", render: (r) =>r.date, center: true },
 { label: "Level (Intl./National)", render: (r) =>r.level || r.org },
 ]}
 />

<ReviewTable
 title="B8. Conference / FDP / Industry Training - Attended"
 accent="#10b981"
 sectionKey="fdps"
 docPrefix="fdp"
 columns={[
 { label: "Programme / Event", render: (r) =>r.program },
 { label: "From", render: (r) =>r.fromDate, center: true },
 { label: "To", render: (r) =>r.toDate, center: true },
 { label: "Organised By", render: (r) =>r.org },
 ]}
 />

<ReviewTable
 title="B9. Research Awards, Fellowships, Reviewer of Journal & Citations"
 accent="#f97316"
 sectionKey="awards"
 docPrefix="awd"
 columns={[
 { label: "Title of Award / Fellowship / Metric", render: (r) =>r.title },
 { label: "Awarding Agency", render: (r) =>r.agency },
 { label: "Level", render: (r) =>r.level },
 { label: "Date", render: (r) =>r.date, center: true },
 ]}
 />

<ReviewTable
 title="B10. Innovation, Start-ups & Technology Transfer"
 accent="#0ea5e9"
 sectionKey="products"
 docPrefix="prod"
 columns={[
 { label: "Title / Start-up / Product", render: (r) =>r.details || r.title },
 { label: "Role", render: (r) =>r.role || r.usage },
 { label: "Status", render: (r) =>r.status },
 ]}
 />

<ReviewTable
 title="B11. ICT Content, MOOCs & E-Learning"
 accent="#0ea5e9"
 sectionKey="ict"
 docPrefix="ict"
 columns={[
 { label: "Title", render: (r) =>r.title },
 { label: "Platform / Type", render: (r) =>r.type || r.desc },
 { label: "Reach / Views (if available)", render: (r) =>r.quad || r.reach },
 ]}
 />

{getSchoolKey(approval?.school || approval?.schoolName || approval?.info?.school || "") !== "SoCM" && (
<ReviewTable
 title="B12. Exhibitions — Photography, Design & Applied Arts, Documentaries, Films & Audio-Visual Productions"
 accent="#ec4899"
 sectionKey="exhibitions"
 docPrefix="exh"
 columns={[
 { label: "Title of Work / Exhibition", render: (r) =>r.title },
 { label: "Type (Solo/Group/Curated)", render: (r) =>r.type, center: true },
 { label: "Venue & Level (Institutional/National/Intl.)", render: (r) =>r.venueLevel, center: true },
 { label: "Date", render: (r) =>r.date, center: true },
 ]}
 />
)}
</>)}
 {sectionView === "partC" && (<>
<div style={{ fontWeight: 800, fontSize: 13, color: "#1e293b", background: "#dcfce7", padding: "8px 14px", borderRadius: 6, marginBottom: 10, letterSpacing: 0.3 }}>
 Part C - Administrative Role & University Development Contribution
</div>

<ReviewTable
 title="C1. Administration at University Level"
 accent="#0f766e"
 sectionKey="uniActs"
 docPrefix="uni"
 columns={[
 { label: "Activity", render: (r) =>r.activity },
 { label: "Nature", render: (r) =>r.nature },
 { label: "Period", render: (r) =>r.period, center: true },
 ]}
 />

<ReviewTable
 title="C2. Administration at School Level"
 accent="#0f766e"
 sectionKey="deptActs"
 docPrefix="dept"
 columns={[
 { label: "Activity", render: (r) =>r.activity },
 { label: "Nature", render: (r) =>r.nature },
 { label: "Period", render: (r) =>r.period, center: true },
 ]}
 />

<ReviewTable
 title="C3. Event Organisation & Institutional Visibility"
 accent="#0f766e"
 sectionKey="eventRows"
 docPrefix="event"
 columns={[
 { label: "Event / Contribution", render: (r) =>r.event },
 { label: "Role", render: (r) =>r.role },
 { label: "From", render: (r) =>r.fromDate || r.date, center: true },
 { label: "To", render: (r) =>r.toDate || r.date, center: true },
 { label: "Level", render: (r) =>r.level, center: true },
 ]}
 />

<ReviewTable
 title="C4. Outreach, Extension & Social Responsibility"
 accent="#0f766e"
 sectionKey="society"
 docPrefix="soc"
 columns={[
 { label: "Activity", render: (r) =>r.label },
 { label: "Details", render: (r) =>r.details },
 { label: "Date", render: (r) =>r.date, center: true },
 ]}
 />

<ReviewTable
 title="C5. Industry Interaction & Linkages"
 accent="#0f766e"
 sectionKey="industry"
 docPrefix="ind"
 columns={[
 { label: "Activity", render: (r) =>r.activity || r.name },
 { label: "Industry Partner", render: (r) =>r.partner || r.details },
 { label: "Date", render: (r) =>r.date, center: true },
 ]}
 />

<ReviewTable
 title="C6. Alumni Engagement & Networking"
 accent="#0f766e"
 sectionKey="alumniRows"
 docPrefix="alumni"
 columns={[
 { label: "Activity", render: (r) =>r.activity },
 { label: "Details", render: (r) =>r.details },
 { label: "Date", render: (r) =>r.date, center: true },
 ]}
 />

<ReviewTable
 title="C7. Student Placement Mentoring & Career Development"
 accent="#0f766e"
 sectionKey="placementRows"
 docPrefix="placement"
 columns={[
 { label: "Activity Type", render: (r) =>r.activityType },
 { label: "Student / Company Name", render: (r) =>r.name },
 { label: "Date", render: (r) =>r.date, center: true },
 ]}
 />
</>)}
 {sectionView === "partD" && (<>
<div style={{ fontWeight: 800, fontSize: 13, color: "#1e293b", background: "#ffedd5", padding: "8px 14px", borderRadius: 6, marginBottom: 10, letterSpacing: 0.3 }}>
 Part D - Annual Confidential Report
</div>

<ReviewTable
 title="Part D. Annual Confidential Report (ACR)"
 accent="#ef4444"
 sectionKey="acr"
 rows={createAcrRows(approval.acr)}
 columns={[
 { label: "Parameter", render: (r) =>r.label },
 ]}
 />
</>)}
</div>
</DeanReviewTableContext.Provider>
 );
}

function ApprovalReviewPanel({ approval, approvalType, onBack, onSubmit, readOnly = false }) {
  if (isCreativeSchool(approval)) {
    return (
      <CreativeSchoolAuthorityReviewPanel
        person={approval}
        reviewerRole="dean"
        onBack={onBack}
        onSubmit={onSubmit}
        readOnly={readOnly}
        showReport={false}
      />
    );
  }
  return (
    <StandardApprovalReviewPanel
      approval={approval}
      approvalType={approvalType}
      onBack={onBack}
      onSubmit={onSubmit}
      readOnly={readOnly}
    />
  );
}

function StandardApprovalReviewPanel({ approval, approvalType, onBack, onSubmit, readOnly = false }) {
  const [remarks, setRemarks] = useState(approval?.deanRemarks || "");
  const [deanData, setDeanData] = useState({});
  const [sectionView, setSectionView] = useState("partA");
 const [reviewConfirmed, setReviewConfirmed] = useState(false);
 const [draftStatus, setDraftStatus] = useState("");
 const [savingDraft, setSavingDraft] = useState(false);
 const finalisedByVc = isAppraisalFinalisedByVc(approval);
 const pendingThisReviewer = isPendingReviewStatusFor([approval?.status, approval?.workflowStatus, approval?.workflow_status], "dean");
 const reviewLocked = finalisedByVc || readOnly || (!pendingThisReviewer && (approval?.status === "Reviewed" || /Dean\s*(Reviewed|Approved|Rejected)/i.test(approval?.status || "")));
 const canReject = canReviewerRejectProfile("dean", approval);
 const subjectEmail = approval?.email || approval?.faculty_email || approval?.facultyEmail;
 const academicYear = approval?.academicYear || approval?.academic_year || approval?.info?.ay || APP_INFO.DEFAULT_AY || "2026-2027";
 const sectionScores = deanScorePayload(approval, deanData);
 const deanScores = deanScoreTotals(sectionScores, approval);
 const selfSummary = standardSubmittedScoreSummary(approval);
 const reviewerMaxScores = reviewerMaxScoresFromSubmitted(selfSummary);
 const subjectRole = (approval.appraisalRole || approval.appraisal_role || approval.role || "faculty").toLowerCase();
 const isSoemrFaculty = subjectRole === "faculty" && getSchoolKey(approval.school || approval.schoolName || approval.info?.school || "") === "SoEMR";
 const useDirectorDeanSummaryRow = subjectRole === "director";
 const selfScoreTitle = subjectRole === "faculty" ? "Faculty Score" : `${subjectRole === "hod" ? "HOD" : subjectRole === "director" ? "Director" : "Self"} Self Score`;
 const roleTotalsFor = (prefix) =>({
 partA: n(approval[`${prefix}PartA`]),
 partB: n(approval[`${prefix}PartB`]),
 partC: n(approval[`${prefix}PartC`]),
 partD: n(approval[`${prefix}PartD`]),
 total: n(approval[`${prefix}Total`]),
 });
 const deanSummaryCards = [
 ...(["faculty", "hod", "director"].includes(subjectRole) ? [{
 key: "self",
 title: selfScoreTitle,
 subtitle: `Self score for the ${subjectRole === "hod" ? "HOD" : subjectRole === "director" ? "Director" : "non-engineering"} appraisal form.`,
 totals: { partA: selfSummary.partA, partB: selfSummary.partB, partC: selfSummary.partC, partD: selfSummary.partD, total: selfSummary.total },
 maxScores: { partA: selfSummary.partAMax, partB: selfSummary.partBMax, partC: selfSummary.partCMax, partD: selfSummary.partDMax, grand: selfSummary.grandMax },
 accent: "#0ea5e9",
 extraContent: <SummaryOtherInfoField value={summaryOtherInfoValueFrom(approval)} readOnly rows={4} />,
 }] : []),
 ...(isSoemrFaculty ? [{
 key: "hod",
 title: "HOD Score",
 subtitle: "HOD score for the non-engineering appraisal form.",
 totals: roleTotalsFor("hod"),
 maxScores: reviewerMaxScores,
 accent: "#0f766e",
 remarksTitle: "HOD Remarks",
 remarksContent: <div style={{ color: "#334155", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{approval.hodRemarks || "-"}</div>,
 }] : []),
 ...(["faculty", "hod"].includes(subjectRole) ? [{
 key: "director",
 title: "Director Score",
 subtitle: "Director score for the non-engineering appraisal form.",
 totals: roleTotalsFor("director"),
 maxScores: reviewerMaxScores,
 accent: "#0f766e",
 remarksTitle: "Director Remarks",
 remarksContent: <div style={{ color: "#334155", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{approval.directorRemarks || "-"}</div>,
 }] : []),
 ];
 const hasSavedDeanScores = ["deanPartA", "deanPartB", "deanPartC", "deanPartD", "deanTotal"].some((key) =>String(approval?.[key] ?? "").trim() !== "");
 const rawDisplayedDeanScores = reviewLocked && hasSavedDeanScores ? {
 partA: String(approval?.deanPartA ?? "").trim() !== "" ? n(approval?.deanPartA) : deanScores.partA,
 partB: String(approval?.deanPartB ?? "").trim() !== "" ? n(approval?.deanPartB) : deanScores.partB,
 partC: String(approval?.deanPartC ?? "").trim() !== "" ? n(approval?.deanPartC) : deanScores.partC,
 partD: String(approval?.deanPartD ?? "").trim() !== "" ? n(approval?.deanPartD) : deanScores.partD,
 total: String(approval?.deanTotal ?? "").trim() !== "" ? n(approval?.deanTotal) : deanScores.total,
 } : deanScores;
 const displayedDeanPartA = clampScore(rawDisplayedDeanScores.partA, reviewerMaxScores.partA);
 const displayedDeanPartB = clampScore(rawDisplayedDeanScores.partB, reviewerMaxScores.partB);
 const displayedDeanPartC = clampScore(rawDisplayedDeanScores.partC, reviewerMaxScores.partC);
 const displayedDeanPartD = clampScore(rawDisplayedDeanScores.partD, reviewerMaxScores.partD);
 const hasSavedDeanTotal = reviewLocked && String(approval?.deanTotal ?? "").trim() !== "";
 const displayedDeanScores = {
 partA: displayedDeanPartA,
 partB: displayedDeanPartB,
 partC: displayedDeanPartC,
 partD: displayedDeanPartD,
 total: clampScore(hasSavedDeanTotal ? rawDisplayedDeanScores.total : displayedDeanPartA + displayedDeanPartB + displayedDeanPartC + displayedDeanPartD, reviewerMaxScores.grand),
 };
 const titleMap = {
 directorApprovals: "Director's Appraisal Review",
 facultyApprovals: "Faculty's Appraisal Review",
 };
 const recordSchoolTrack = getDeanTrack({ school: approval.school || approval.info?.school, department: approval.department, designation: approval.designation });
 const recordSchoolGroupLabel = { engineering: "Engineering", non_engineering: "Non-Engineering", cisr: "CISR" }[recordSchoolTrack] || approval.school || approval.info?.school || APP_INFO.UNIVERSITY_NAME;
 const recordScoreRows = [
 { key: "self", label: "Self", icon: "user", values: { partA: selfSummary.partA, partB: selfSummary.partB, partC: selfSummary.partC, partD: selfSummary.partD, total: selfSummary.total }, note: summaryOtherInfoValueFrom(approval) },
 { key: "dean", label: "Dean", icon: "briefcase", values: displayedDeanScores, accent: true },
 ];
 const deanRemarksSideContent = (
<div style={{ background: "#eff6ff", border: "2px solid #93c5fd", borderRadius: 10, padding: "14px 15px", display: "flex", flexDirection: "column", minWidth: 0, boxShadow: "0 0 0 4px rgba(147,197,253,0.16), 0 14px 28px rgba(37,99,235,0.08)" }}>
<div style={{ fontSize: 11, fontWeight: 900, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Dean Remarks</div>
<div style={{ color: "#1e40af", fontSize: 11, fontWeight: 700, marginBottom: 10 }}>Please enter remarks before submitting the review.</div>
<textarea value={remarks} onChange={(e) =>setRemarks(e.target.value)} rows={7} readOnly={reviewLocked}
 placeholder="Enter your remarks here..."
 style={{ width: "100%", height: 235, minHeight: 235, border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 11px", fontFamily: "inherit", fontSize: 12, lineHeight: 1.5, color: "#334155", resize: "none", background: "#fff", outline: "none", boxSizing: "border-box" }}
/>
</div>
 );
 const useFacultyDeanSummaryRows = subjectRole === "faculty" && !isSoemrFaculty;
 useEffect(() =>{
 let active = true;
 if (reviewLocked || !subjectEmail) return undefined;
 loadReviewerDraft({ subjectEmail, academicYear, reviewerRole: "dean" })
 .then((draft) =>{
 if (!active || !draft?.payload) return;
 setDeanData(draft.payload.section_scores || {});
 setRemarks(draft.payload.remarks ?? "");
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
 reviewerRole: "dean",
 partAScore: displayedDeanScores.partA,
 partBScore: displayedDeanScores.partB,
 partCScore: displayedDeanScores.partC,
 partDScore: displayedDeanScores.partD,
 totalScore: displayedDeanScores.total,
 remarks,
 sectionScores,
 });
 setDraftStatus(`Draft saved: ${new Date().toLocaleString()}`);
 } catch (err) {
 console.error("Could not save reviewer draft:", err);
 setDraftStatus(err?.message || "Unable to save draft.");
 } finally {
 setSavingDraft(false);
 }
 };

 const NEXT_SECTION_MAP = { partA: "partB", partB: "partC", partC: "partD", partD: "summary" };

 const handleSaveAndNext = async () => {
   await handleSaveDraft();
   const nextSection = NEXT_SECTION_MAP[sectionView];
   if (nextSection) {
     setSectionView(nextSection);
     requestAnimationFrame(() => {
       window.scrollTo({ top: 0, left: 0, behavior: "auto" });
     });
   }
 };

 return (
<div style={{ background: "#fff", borderRadius: 14, padding: "24px", boxShadow: "0 18px 45px rgba(15,23,42,0.18)", minHeight: "100%" }}>
<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
<button onClick={onBack} style={{ border: "none", background: "#e2e8f0", color: "#0f172a", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Back</button>
<div>
<div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{titleMap[approvalType]}</div>
<div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{approval.name} - {approval.designation}</div>
</div>
</div>

<div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
 {[["partA", "Part A"], ["partB", "Part B"], ["partC", "Part C"], ["partD", "Part D"], ["summary", "Summary"]].map(([id, label]) =>(
<button key={id} onClick={() =>{
 setSectionView(id);
 requestAnimationFrame(() =>{
 window.scrollTo({ top: 0, left: 0, behavior: "auto" });
 });
 }}
 style={{ padding: "7px 18px", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: sectionView === id ? "#4c1d95" : "#e2e8f0", color: sectionView === id ? "#ede9fe" : "#475569" }}>
 {label}
</button>
 ))}
</div>

 {["partA", "partB", "partC", "partD"].includes(sectionView) && (
<fieldset disabled={reviewLocked} style={{ border: "none", padding: 0, margin: 0 }}>
<DeanReviewScoreForm approval={approval} deanData={deanData} setDeanData={setDeanData} sectionView={sectionView} />
</fieldset>
 )}
 {["partA", "partB", "partC", "partD"].includes(sectionView) && !reviewLocked && (
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

 {sectionView === "summary" && (
<div className="far-wrap" style={{ width: "100%" }}>
<div className="far-card" style={{ width: "100%", boxSizing: "border-box", background: FACULTY_RECORD_THEME.card, border: `1px solid ${FACULTY_RECORD_THEME.borderStrong}`, borderRadius: 16, padding: "22px 24px", display: "grid", gap: 18, boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
<FacultyRecordHeader
 title="Faculty appraisal record"
 subtitle={`${APP_INFO.UNIVERSITY_NAME} · ${recordSchoolGroupLabel} · AY ${academicYear}`}
 referenceNumber={approval.employeeId}
/>
<ScoreTable
 columns={[
 { key: "partA", label: "Part A", max: MAX_SCORES.PART_A },
 { key: "partB", label: "Part B", max: MAX_SCORES.PART_B },
 { key: "partC", label: "Part C", max: MAX_SCORES.PART_C },
 { key: "partD", label: "Part D", max: MAX_SCORES.PART_D },
 { key: "total", label: "Total", max: MAX_SCORES.GRAND_TOTAL },
 ]}
 rows={recordScoreRows}
/>
<VCFinalRemarks
 title="Dean final remarks"
 icon="briefcase"
 value={remarks}
 onChange={setRemarks}
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
 disabled={!reviewConfirmed || !remarks.trim()}
 onClick={() =>onSubmit(approval.id, displayedDeanScores, remarks, sectionScores, reviewConfirmed)}
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
<button onClick={() =>{ if (window.confirm("Reject this appraisal and send it back to the user for editing?")) { onSubmit(approval.id, displayedDeanScores, remarks, sectionScores, reviewConfirmed, "rejected"); } }}
 disabled={!reviewConfirmed || !remarks.trim()}
 style={{ padding: "8px 14px", background: "transparent", color: (reviewConfirmed && remarks.trim()) ? "#dc2626" : FACULTY_RECORD_THEME.textFaint, border: `1px solid ${(reviewConfirmed && remarks.trim()) ? "#fecaca" : FACULTY_RECORD_THEME.border}`, borderRadius: 8, cursor: (reviewConfirmed && remarks.trim()) ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 11.5, fontFamily: "inherit" }}>
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

// --- Main Dean Dashboard -------------------------------------------------------
export default function NonEngineeringDeanDashboard() {
  const [activeMainTab, setActiveMainTab] = useState("schoolAppraisal");
  const [activeRoleTab, setActiveRoleTab] = useState("facultyApprovals");
  const [hodAppraisalTab, setHodAppraisalTab] = useState("partA");
  const [reviewingApproval, setReviewingApproval] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(null);

  const [facultyList, setFacultyList] = useState([]);
  const [hodList, setHodList] = useState([]);
  const [directorList, setDirectorList] = useState([]);
  const [queueLoadError, setQueueLoadError] = useState("");
  const queueLoadRequestRef = useRef(0);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(() => getActiveAcademicYear());
  const [availableCycles, setAvailableCycles] = useState(() => storedAcademicYearCycles());
  const [loadingYearData, setLoadingYearData] = useState(false);

  const userProfile = profileFromsessionStorage();
  const activeDeanTrack = getDeanTrack(userProfile);
  const activeSchools = getSchoolsByDeanTrack(activeDeanTrack);
  const activeSchoolCodes = activeSchools.map((s) => s.code);
  const activeSchoolCodesKey = activeSchoolCodes.join(",");
  const academicYearOptions = availableCycles.length ? availableCycles : [{ academic_year: selectedAcademicYear || APP_INFO.DEFAULT_AY, is_open: true }];

  const handleReviewAcademicYearChange = (academicYear) => {
    const nextAcademicYear = setActiveAcademicYear(academicYear);
    setSelectedAcademicYear(nextAcademicYear);
    window.dispatchEvent(new CustomEvent("academicYearChanged", { detail: { academicYear: nextAcademicYear } }));
  };

  useEffect(() => {
    const syncAcademicYear = (event) => {
      setSelectedAcademicYear(event?.detail?.academicYear || getActiveAcademicYear());
      setAvailableCycles(storedAcademicYearCycles());
    };
    window.addEventListener("academicYearChanged", syncAcademicYear);
    return () => window.removeEventListener("academicYearChanged", syncAcademicYear);
  }, []);

  useEffect(() => {
    const requestId = ++queueLoadRequestRef.current;
    const isCurrentRequest = () => queueLoadRequestRef.current === requestId;
    const schoolOf = (item) => getSchoolKey(item.school || item.school_name || item.schoolName || "");
    const roleOf = (item) => (item.appraisalRole || item.appraisal_role || "").toLowerCase();
    const loadReviewQueue = async () => {
      const schoolValues = activeSchoolCodesKey.split(",").filter(Boolean);
      const reviewerProfile = profileFromsessionStorage();
      const isInScope = (item) => schoolValues.includes(schoolOf(item)) || schoolValues.includes(item.school);
      setLoadingYearData(true);
      setQueueLoadError("");
      try {
        // lazy: true - the list renders instantly from the lightweight response; each card's
        // doc-count/legacy-score is only fetched once that card actually scrolls into view (see
        // the LazyVisible wrapper around each card below).
        const items = await fetchReviewQueueForRole({
          reviewerRole: "dean",
          reviewerProfile,
          academicYear: selectedAcademicYear,
          schoolValues,
          lazy: true,
        });
        if (!isCurrentRequest()) return;
        const scopedItems = items.filter(isInScope);
        setFacultyList(scopedItems.filter((item) => roleOf(item) === "faculty"));
        setHodList(scopedItems.filter((item) => roleOf(item) === "hod"));
        setDirectorList(scopedItems.filter((item) => roleOf(item) === "director"));
      } catch (err) {
        if (!isCurrentRequest()) return;
        console.error("Could not load Non-Engineering Dean review queue:", err);
        // A failed fetch used to fall back to an empty list, which looked identical to "nothing
        // is pending" - a reviewer had no way to tell a real error apart from a genuinely empty queue.
        setQueueLoadError(err?.message || "Could not load the review queue. Please try again.");
        setFacultyList([]);
        setHodList([]);
        setDirectorList([]);
      } finally {
        if (isCurrentRequest()) setLoadingYearData(false);
      }
    };

    loadReviewQueue();
  }, [activeSchoolCodesKey, selectedAcademicYear]);

  const [filterStatus, setFilterStatus] = useState("All");
  const [selectedSchoolCode, setSelectedSchoolCode] = useState(activeSchools[0]?.code || "SoCM");
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const isDeanPending = (item) => {
    const s = item.status || "";
    if (isPendingReviewStatusFor([s, item.workflowStatus, item.workflow_status], "dean")) return true;
    return s === "pending_dean" ||
      (n(item.deanTotal) <= 0 && !String(item.deanRemarks || "").trim() && s !== "Reviewed" && s !== "pending_vc" && s !== "completed" && !/Dean\s*(Reviewed|Rejected)/i.test(s));
  };
  const isDeanReviewed = (item) => {
    const s = item.status || "";
    if (isPendingReviewStatusFor([s, item.workflowStatus, item.workflow_status], "dean")) return false;
    return n(item.deanTotal) > 0 || String(item.deanRemarks || "").trim() !== "" || s === "Reviewed" || s === "pending_vc" || s === "completed" || /Dean\s*Reviewed/i.test(s);
  };

  const facultyPendingCount = facultyList.filter(isDeanPending).length;
  const hodPendingCount = hodList.filter(isDeanPending).length;
  const directorPendingCount = directorList.filter(isDeanPending).length;
  const totalSchoolPendingCount = facultyPendingCount + hodPendingCount + directorPendingCount;

  const activeApprovalList = activeRoleTab === "hodApprovals"
    ? hodList
    : activeRoleTab === "directorApprovals"
    ? directorList
    : facultyList;

  const activeSchoolApprovalList = (selectedSchoolCode === "all" || selectedSchoolCode === "DEAN-NONENGG" || selectedSchoolCode === "DEAN-ENGG")
    ? activeApprovalList
    : activeApprovalList.filter((item) => getSchoolKey(item.school) === selectedSchoolCode || item.school === selectedSchoolCode);

  const pendingCount = activeSchoolApprovalList.filter(isDeanPending).length;
  const reviewedCount = activeSchoolApprovalList.filter(isDeanReviewed).length;

  const filtered = filterStatus === "All"
    ? activeSchoolApprovalList
    : (filterStatus === "Pending Review"
    ? activeSchoolApprovalList.filter(isDeanPending)
    : activeSchoolApprovalList.filter(isDeanReviewed));

  // Fetches doc-count/legacy-score for one card only once it actually scrolls into view -
  // see the lazy: true note on the queue load above.
  const handleCardVisible = (item) => {
    enrichQueueItem(item).then((enriched) => {
      const role = (enriched.appraisalRole || enriched.appraisal_role || "").toLowerCase();
      const setList = role === "faculty" ? setFacultyList : role === "hod" ? setHodList : role === "director" ? setDirectorList : null;
      setList?.((prev) => prev.map((row) => (row.email === enriched.email && row.academicYear === enriched.academicYear ? enriched : row)));
    }).catch(() => {});
  };

  const schoolCards = activeSchools.map((school) => {
    const visual = SCHOOL_VISUALS[school.code] || {};
    const facPending = facultyList
      .filter((item) => getSchoolKey(item.school) === school.code || item.school === school.code)
      .filter(isDeanPending).length;
    const hodPending = hodList
      .filter((item) => getSchoolKey(item.school) === school.code || item.school === school.code)
      .filter(isDeanPending).length;
    const dirPending = directorList
      .filter((item) => getSchoolKey(item.school) === school.code || item.school === school.code)
      .filter(isDeanPending).length;
    const pendingCount = facPending + hodPending + dirPending;

    return {
      code: school.code,
      icon: visual.icon || school.code.slice(2).toUpperCase(),
      name: school.name,
      shortName: school.shortName || school.name.replace(/^School of\s+/i, ""),
      pendingCount,
    };
  });

  const activeSchoolInfo = schoolCards.find((s) => s.code === selectedSchoolCode) || schoolCards[0];
  const activeSchoolMembersCount = (selectedSchoolCode === "all" || selectedSchoolCode === "DEAN-NONENGG")
    ? activeApprovalList.length
    : activeApprovalList.filter((item) => getSchoolKey(item.school) === selectedSchoolCode || item.school === selectedSchoolCode).length;

  const pendingSchoolCards = schoolCards.filter((school) => school.pendingCount > 0);
  const firstPendingRoleTabForSchool = (schoolCode) => {
    const facPending = facultyList.filter((item) => getSchoolKey(item.school) === schoolCode || item.school === schoolCode).filter(isDeanPending).length;
    if (facPending > 0) return "facultyApprovals";
    const hodPending = hodList.filter((item) => getSchoolKey(item.school) === schoolCode || item.school === schoolCode).filter(isDeanPending).length;
    if (hodPending > 0) return "hodApprovals";
    const dirPending = directorList.filter((item) => getSchoolKey(item.school) === schoolCode || item.school === schoolCode).filter(isDeanPending).length;
    if (dirPending > 0) return "directorApprovals";
    return activeRoleTab;
  };

  const roleTabsForSchool = [
    {
      id: "facultyApprovals",
      label: "Faculty's Appraisal",
      count: facultyList.filter((item) => (selectedSchoolCode === "all" || selectedSchoolCode === "DEAN-NONENGG") ? true : (getSchoolKey(item.school) === selectedSchoolCode || item.school === selectedSchoolCode)).filter(isDeanPending).length,
    },
    {
      id: "hodApprovals",
      label: "HOD's Appraisal",
      count: hodList.filter((item) => (selectedSchoolCode === "all" || selectedSchoolCode === "DEAN-NONENGG") ? true : (getSchoolKey(item.school) === selectedSchoolCode || item.school === selectedSchoolCode)).filter(isDeanPending).length,
    },
    {
      id: "directorApprovals",
      label: "Director's Appraisal",
      count: directorList.filter((item) => (selectedSchoolCode === "all" || selectedSchoolCode === "DEAN-NONENGG") ? true : (getSchoolKey(item.school) === selectedSchoolCode || item.school === selectedSchoolCode)).filter(isDeanPending).length,
    },
  ];

  const navItems = [
    { id: "myAppraisal", icon: "", label: "My Appraisal", sub: "Self-assessment form" },
    { id: "schoolAppraisal", icon: "", label: "School Appraisal", sub: "Review school submissions", badge: totalSchoolPendingCount },
  ];

  const handleSubmitReview = async (id, scores, remarks, sectionScores, reviewConfirmed = false, decision = "approved") => {
    if (!reviewConfirmed) {
      alert("Please verify and confirm the accuracy declaration before submitting the review.");
      return;
    }
    if (!remarks?.trim()) {
      alert("Remarks are mandatory. Please enter your remarks before submitting the review.");
      return;
    }
    const sourceList = activeRoleTab === "facultyApprovals"
      ? facultyList
      : activeRoleTab === "hodApprovals"
      ? hodList
      : directorList;
    const item = sourceList.find((entry) => entry.id === id);
    if (!item) return;

    try {
      await submitWorkflowReview({
        subjectEmail: item.email,
        academicYear: item.academicYear || item.academic_year || item.info?.ay || APP_INFO.DEFAULT_AY || "2026-2027",
        reviewerRole: "dean",
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

      const status = decision === "rejected" ? rejectedStatusFor("dean") : reviewedStatusFor("dean");
      const markReviewed = (entry) => entry.id === id
        ? { ...entry, ...sectionScores, innovDean: sectionScores?.innovativeTeaching?.dean ?? entry.innovDean, status, workflowStatus: status, deanPartA: scores.partA, deanPartB: scores.partB, deanPartC: scores.partC, deanPartD: scores.partD, deanTotal: scores.total, deanRemarks: remarks }
        : entry;

      if (activeRoleTab === "facultyApprovals") {
        setFacultyList((prev) => prev.map(markReviewed));
      }
      if (activeRoleTab === "hodApprovals") {
        setHodList((prev) => prev.map(markReviewed));
      }
      if (activeRoleTab === "directorApprovals") {
        setDirectorList((prev) => prev.map(markReviewed));
      }
      setReviewingApproval(null);
      alert(decision === "rejected" ? "Appraisal rejected and sent back for editing." : "Dean review approved and forwarded to VC.");
    } catch (err) {
      console.error("Could not submit Dean review:", err);
      alert(`Unable to submit Dean review.\n\n${err.message}`);
    }
  };

  const handleMyAppraisalSectionChange = (section) => {
    setHodAppraisalTab(section);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  };

  return (
    <DashboardLayout
      appInfo={APP_INFO}
      showLogoutModal={showLogoutModal}
      onCancelLogout={() => setShowLogoutModal(false)}
      containerStyle={{ display: "flex", minHeight: "100vh", fontFamily: "inherit", background: "#f4f6fa", color: "#1e293b" }}
      mainStyle={{ flex: 1, padding: "24px 30px", display: "flex", flexDirection: "column", gap: 18, overflowX: "hidden" }}
      sidebar={(
        <DashboardSidebar
          appInfo={APP_INFO}
          navItems={navItems}
          activeTab={activeMainTab}
          onTabSelect={(tab) => { setActiveMainTab(tab); setReviewingApproval(null); }}
          showSectionSelector={activeMainTab === "myAppraisal"}
          sectionTab={hodAppraisalTab}
          onSectionChange={handleMyAppraisalSectionChange}
          profileSubtitle={`Dean - ${sessionStorage.getItem("department")?.split(" ")[0] || ""}`}
          onLogout={() => setShowLogoutModal(true)}
          showLogoutSpacer
        />
      )}
    >
      {activeMainTab === "myAppraisal" && (
        <MyAppraisalSection
          sectionTab={hodAppraisalTab}
          onSectionTabChange={handleMyAppraisalSectionChange}
          defaultDesignation={sessionStorage.getItem("role") === "dean" ? "Dean" : ""}
          defaultAcademicYear={sessionStorage.getItem("academicYear") || APP_INFO.DEFAULT_AY}
          titleNameFallback="Dean"
          subtitleSeparator=" - "
        />
      )}

      {(activeMainTab === "schoolAppraisal" || activeMainTab === "hodApprovals" || activeMainTab === "directorApprovals" || activeMainTab === "facultyApprovals") && !reviewingApproval && (
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 18 }}>
          {loadingYearData && (
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
          {/* Horizontal School Selector Bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", background: "#fff", borderRadius: 14, padding: "16px 24px", boxShadow: "0 10px 28px rgba(17,24,39,0.06)", border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
            <AppraisalHeaderImage logo="dypiu" />
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0f172a", lineHeight: 1.15, letterSpacing: -0.5 }}>Non-Engineering School Appraisal Reviews</h1>
              <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#e0e7ff", color: "#3730a3", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{APP_INFO.SHORT_NAME}</span>
                <span>AY</span>
                <select
                  value={selectedAcademicYear}
                  onChange={(event) => handleReviewAcademicYearChange(event.target.value)}
                  style={{ height: 28, border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff", color: "#0f172a", fontSize: 11, fontWeight: 800, padding: "3px 28px 3px 9px", fontFamily: "inherit", outline: "none" }}
                >
                  {academicYearOptions.map((cycle) => (
                    <option key={cycle.academic_year} value={cycle.academic_year}>
                      {cycle.academic_year} {cycle.is_open ? "(Active)" : "(Closed)"}
                    </option>
                  ))}
                </select>
              </p>
            </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "10px 16px", boxShadow: "0 2px 8px rgba(15,23,42,0.08)", minWidth: 250 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: pendingSchoolCards.length ? 8 : 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: totalSchoolPendingCount ? "#f59e0b" : "#10b981", boxShadow: totalSchoolPendingCount ? "0 0 0 4px #fef3c7" : "0 0 0 4px #dcfce7" }} />
                  <span style={{ color: "#334155", fontSize: 12, fontWeight: 800 }}>
                    {totalSchoolPendingCount ? `${totalSchoolPendingCount} pending reviews` : "No pending reviews"}
                  </span>
                </div>
                {pendingSchoolCards.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {pendingSchoolCards.map((school) => {
                      const visual = SCHOOL_VISUALS[school.code] || {};
                      return (
                        <button
                          key={school.code}
                          type="button"
                          onClick={() => {
                            setSelectedSchoolCode(school.code);
                            setActiveRoleTab(firstPendingRoleTabForSchool(school.code));
                            setFilterStatus("Pending Review");
                          }}
                          title={`${school.name}: ${school.pendingCount} pending`}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${(visual.color || "#f59e0b")}40`, background: visual.bg || "#fffbeb", color: visual.color || "#92400e", borderRadius: 999, padding: "4px 9px", fontSize: 10, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          <span>{school.code}</span>
                          <span style={{ background: visual.color || "#f59e0b", color: "#fff", minWidth: 17, height: 17, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px", fontSize: 9 }}>{school.pendingCount}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <AppraisalHeaderImage logo="iqas" />
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden", display: "grid", gridTemplateColumns: `repeat(${schoolCards.length}, 1fr)` }}>
            {schoolCards.map((school) => {
              const active = selectedSchoolCode === school.code;
              return (
                <button
                  key={school.code}
                  onClick={() => setSelectedSchoolCode(school.code)}
                  style={{
                    padding: "16px 12px",
                    border: "none",
                    borderBottom: active ? "3px solid #6366f1" : "3px solid transparent",
                    background: active ? "#f5f3ff" : "#ffffff",
                    cursor: "pointer",
                    textAlign: "center",
                    fontFamily: "inherit",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    position: "relative",
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <span style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: active ? "#6366f1" : "#f1f5f9",
                      color: active ? "#ffffff" : "#475569",
                      fontWeight: 800,
                      fontSize: 13,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: active ? "0 4px 10px rgba(99,102,241,0.25)" : "none",
                    }}>
                      {school.icon}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: active ? "#4338ca" : "#1e293b" }}>
                      {school.code}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: active ? "#6366f1" : "#64748b", fontWeight: 600, lineHeight: 1.25, maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {school.shortName}
                  </span>
                  {school.pendingCount > 0 && (
                    <span style={{ background: "#f59e0b", color: "#ffffff", borderRadius: 10, padding: "2px 8px", fontSize: 9, fontWeight: 900, lineHeight: 1.2, marginTop: 3 }}>
                      {school.pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Role Sub-Tabs & Filter Bar directly below Horizontal School Selector */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff", padding: "10px 16px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {roleTabsForSchool.map((role) => {
                const active = activeRoleTab === role.id;
                return (
                  <button
                    key={role.id}
                    onClick={() => setActiveRoleTab(role.id)}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: active ? "#4338ca" : "transparent",
                      color: active ? "#ffffff" : "#475569",
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontFamily: "inherit",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{role.label}</span>
                    {role.count > 0 && (
                      <span style={{
                        background: active ? "rgba(255,255,255,0.25)" : "#e0e7ff",
                        color: active ? "#ffffff" : "#4338ca",
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 800,
                      }}>
                        {role.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Filter:</span>
              {[
                ["All", "All"],
                ["Pending Review", "Pending Review"],
                ["Reviewed", "Dean Reviewed"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilterStatus(value)}
                  style={{
                    fontSize: 11,
                    padding: "5px 14px",
                    border: filterStatus === value ? "none" : "1px solid #e2e8f0",
                    borderRadius: 20,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 700,
                    background: filterStatus === value ? "#4338ca" : "#ffffff",
                    color: filterStatus === value ? "#ffffff" : "#475569",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {queueLoadError && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, color: "#991b1b", fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
              <span aria-hidden="true">!</span>
              <span>{queueLoadError}</span>
            </div>
          )}

          {/* Submissions Grid or Empty State */}
          {filtered.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
              {filtered.map((faculty) => {
                const facultySummary = standardSubmittedScoreSummary(faculty);
                const facultyAcademicYear = faculty.academic_year || faculty.academicYear || selectedAcademicYear || APP_INFO.DEFAULT_AY;
                const facultyMetrics = legacyDashboardMetrics({
                  academicYear: facultyAcademicYear,
                  partA: facultySummary.partA,
                  partB: facultySummary.partB,
                  total: facultySummary.total,
                }) || [
                  { label: "Part A", val: facultySummary.partA, max: facultySummary.partAMax, color: "#6366f1" },
                  { label: "Part B", val: facultySummary.partB, max: facultySummary.partBMax, color: "#0ea5e9" },
                  { label: "Part C", val: facultySummary.partC, max: facultySummary.partCMax, color: "#10b981" },
                  { label: "Part D", val: facultySummary.partD, max: facultySummary.partDMax, color: "#f59e0b" },
                  { label: "Total", val: facultySummary.total, max: facultySummary.grandMax, color: "#4338ca" },
                ];
                const courseFilePartA = Array.isArray(faculty.courseFile)
                  ? (() => {
                      const filled = faculty.courseFile.filter((row) => String(row?.score ?? "").trim() !== "");
                      return filled.length ? filled.reduce((total, row) => total + courseFileRowScore(row), 0) / filled.length : 0;
                    })()
                  : n(faculty.courseFile?.score);
                const docCount = uploadedDocCount(faculty.docs, faculty);

                return (
                  <LazyVisible key={faculty.id} triggerKey={`${faculty.email}::${faculty.academicYear}`} onVisible={() => handleCardVisible(faculty)}>
                  <div className="vc-review-card fa-fade-up" style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 16px rgba(15,23,42,0.06)", border: "1px solid #eef1f6", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <Avatar initials={faculty.avatar} src={faculty.avatarUrl} color={faculty.avatarColor} size={52} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", letterSpacing: -0.2, marginBottom: 4 }}>{faculty.name}</div>
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 2 }}>{faculty.designation}</div>
                        <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace" }}>{faculty.employeeId}</div>
                      </div>
                      <StatusBadge status={faculty.status} />
                    </div>

                    <ReviewMetricsStrip
                      metrics={facultyMetrics}
                      docs={faculty.docs}
                    />

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                      <div style={{ fontSize: 9.5, color: "#94a3b8", fontWeight: 600 }}>Submitted: {faculty.submittedOn}</div>
                      <button
                        className="vc-action-button"
                        disabled={reviewLoading === faculty.id}
                        onClick={async () => {
                          setReviewLoading(faculty.id);
                          try {
                            const academicYear = faculty.academic_year || faculty.academicYear || selectedAcademicYear || APP_INFO.DEFAULT_AY || "2026-2027";
                            const data = await fetchSavedAppraisal({
                              facultyEmail: faculty.email,
                              academicYear,
                              reviewerRole: "dean",
                            });
                            const form = data?.payload?.form || data?.form || {};
                            const docs = data?.payload?.docs || data?.docs || {};
                            const mergedForm = normalizeSubmittedCreativeFormForReview(form, faculty);
                            const declaration = data?.declaration || faculty.declaration || null;
                            setReviewingApproval({ ...faculty, ...mergedForm, docs, declaration, academicYear, academic_year: academicYear, previousYearResponse: data, previousYearResultOnly: isLegacyTwoPartAcademicYear(academicYear), status: declaration?.status || data?.status || faculty.status, workflowStatus: declaration?.status || data?.workflowStatus || faculty.workflowStatus });
                          } catch (err) {
                            alert(`Unable to open submitted form.\n\n${err.message}`);
                          } finally {
                            setReviewLoading(null);
                          }
                        }}
                        style={{ fontSize: 11.5, padding: "8px 18px", background: reviewLoading === faculty.id ? "#94a3b8" : isDeanReviewed(faculty) ? "#ecfdf5" : "#0f172a", color: reviewLoading === faculty.id ? "#fff" : isDeanReviewed(faculty) ? "#047857" : "#fff", border: reviewLoading !== faculty.id && isDeanReviewed(faculty) ? "1px solid #a7f3d0" : "none", borderRadius: 9, cursor: reviewLoading === faculty.id ? "wait" : "pointer", fontWeight: 800, fontFamily: "inherit", letterSpacing: 0.2, boxShadow: reviewLoading === faculty.id ? "none" : isDeanReviewed(faculty) ? "0 2px 8px rgba(5,150,105,0.12)" : "0 6px 14px rgba(15,23,42,0.22)" }}
                      >
                        {reviewLoading === faculty.id ? "Loading..." : isDeanReviewed(faculty) ? "View Review" : "Review Form"}
                      </button>
                    </div>
                  </div>
                  </LazyVisible>
                );
              })}
            </div>
          ) : !queueLoadError ? (
            <div style={{ background: "#ffffff", borderRadius: 14, padding: "64px 24px", border: "1.5px dashed #cbd5e1", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#f5f3ff", border: "1.5px dashed #c7d2fe", color: "#6366f1", padding: "8px 20px", borderRadius: 12, fontWeight: 800, fontSize: 15, marginBottom: 16, display: "inline-block" }}>
                {activeSchoolInfo.code}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", marginBottom: 6 }}>
                No submissions yet
              </div>
              <div style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                New appraisal forms will appear here automatically.
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* REVIEW PANEL */}
      {(activeMainTab === "schoolAppraisal" || activeMainTab === "hodApprovals" || activeMainTab === "directorApprovals" || activeMainTab === "facultyApprovals") && reviewingApproval && (
        reviewingApproval.previousYearResultOnly ? (
        <PreviousYearAuthorityResult item={reviewingApproval} onBack={() => setReviewingApproval(null)} />
        ) : (
        <ApprovalReviewPanel
          approval={reviewingApproval}
          approvalType={activeRoleTab}
          onBack={() => setReviewingApproval(null)}
          onSubmit={handleSubmitReview}
          readOnly={isDeanReviewed(reviewingApproval)}
        />
        )
      )}
    </DashboardLayout>
  );
}







