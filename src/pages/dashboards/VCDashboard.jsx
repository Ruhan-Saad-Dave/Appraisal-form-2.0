import ReviewerReportHeader from "../../components/dashboard/ReviewerReportHeader";
import { DynamicAuthorityReviewPanel } from "../../features/dynamic-appraisal";
import { dynamicReviewForm } from "../../utils/dynamicAppraisalData";
/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect */
import { useReviewFeedback } from "../../components/reviewFeedbackContext";
import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import "./vcReviewHeader.css";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import { useNavigate } from "react-router-dom";
import { Avatar, LogoutConfirmModal, ScoreCard, ReviewMetricsStrip } from "../../components/dashboard/dashboardPrimitives";
import { fetchNonTeachingQueueForRole, isNonTeachingReviewComplete, nonTeachingReviewFlow } from "../../services/nonTeachingWorkflow";
import { useSchools } from "../../services/schoolsService";
import { fetchReviewQueueForRole, loadReviewerDraft, saveReviewerDraft, submitWorkflowReview, fetchSavedAppraisal, mergeFacultyInfo, ACR_DETAIL_POINTS, MAX_SCORES, APP_INFO, createAcrRows, buildReviewRemarks, openFullFormReport, renderCombinedPartsSummary, safeHtml, displayValue, SummaryOtherInfoField, summaryOtherInfoValueFrom, SCORE_LIMITS, clampScore, clampReviewScore, effectiveMaxScore, projectGuidanceRowMax, researchGuidanceRowMax, researchGuidanceScore, reviewRowMaxForSection, reviewSectionScore, rowHasReviewableData, isSectionEmpty, selfEffectivePartAMax, societyRowLocked, societyRowScore, standardReviewSummary, standardSubmittedScoreSummary, AppraisalHeaderImage, ViewDocsCell, SectionCard as SC, EmptySectionRow, CreativeSchoolAuthorityReviewPanel, normalizeSubmittedCreativeFormForReview, isCreativeSchool, isDesignArtsSchool, isMediaCommSchool } from "../../features/faculty-appraisal";
import { clearUserSession, getActiveAcademicYear, getSessionItem, normalizeAcademicYearLabel, setActiveAcademicYear } from "../../auth/session";
import { PreviousYearReportViewer } from "../../features/previousYearReport";
import { isLegacyTwoPartAcademicYear } from "../../features/faculty-appraisal/forms/standard/legacyPreviousYearReportUtils";

import { DEAN_TRACKS, UNIVERSITY_SCHOOLS, normalizeHierarchyText, schoolVisualMeta } from "../../constants/universityHierarchy";
import { canReviewerRejectProfile, getDeanTrack, getSchoolKey, profileFromsessionStorage, rejectedStatusFor, visiblePreviousReviewRoles, isAppraisalFinalisedByVc, isPendingReviewStatusFor, reviewListFrom } from "../../utils/hierarchy";
import { NonTeachingAuthorityReviewPanel } from "./nonTeaching/NonTeachingStaffDashboard";
import { n, pct, grade, RO } from "../../features/faculty-appraisal/shared";
import FacultyInfoSection from "../../components/appraisal/common/FacultyInfoSection";
import { FacultyRecordHeader, ScoreTable, VCFinalRemarks, FinalSubmitButton, FACULTY_RECORD_THEME } from "../../components/dashboard/FacultyAppraisalRecord";
import LeaveManagementReadOnly from "../../components/appraisal/PartD/LeaveManagementReadOnly";
import { isStandardAppraisalSchool } from "../../constants/formRouting";
import { ReportBugButton } from "../../components/dashboard/ReportBugModal";
import NoticesBell from "../../components/dashboard/NoticesBell";

// --- Helpers ------------------------------------------------------------------
const oneDecimal = (value) =>(Math.trunc(n(value) * 10) / 10).toFixed(1);
const isVcReviewed = (person = {}) =>!isPendingReviewStatusFor([person.status, person.workflowStatus, person.workflow_status], "vc") && (person.status === "Reviewed" || person.status === "VC Reviewed" || person.status === "Rejected" || person.status === "VC Rejected" || n(person.vcTotal) >0);

// Grade bands per the university's official percentage-to-grade table.
const GRADE_BANDS = [
 { min: 70, label: "A+", color: "#059669" },
 { min: 65, label: "A", color: "#16a34a" },
 { min: 60, label: "B++", color: "#0ea5e9" },
 { min: 55, label: "B+", color: "#f59e0b" },
 { min: 50, label: "B", color: "#f97316" },
 { min: 0, label: "C", color: "#dc2626" },
];
const gradeForPercent = (percent) => GRADE_BANDS.find((band) => percent >= band.min) || GRADE_BANDS[GRADE_BANDS.length - 1];

// Small stroke-icon set for the VC sidebar, matching the icon style used in
// DashboardSidebar.jsx so both sidebars feel like one visual system.
function VcIcon({ name, size = 18, color = "currentColor" }) {
 const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" };
 if (name === "school") {
 return (
 <svg {...common}>
 <path d="m12 3 9 5-9 5-9-5 9-5Z" />
 <path d="M5 10.5V16c0 1.5 3.13 3 7 3s7-1.5 7-3v-5.5" />
 <path d="M21 9v6.5" />
 </svg>
 );
 }
 if (name === "clock") {
 return (
 <svg {...common}>
 <circle cx="12" cy="12" r="9" />
 <path d="M12 7v5l3.2 2" />
 </svg>
 );
 }
 if (name === "check-circle") {
 return (
 <svg {...common}>
 <circle cx="12" cy="12" r="9" />
 <path d="m8.5 12.3 2.4 2.4 4.6-5" />
 </svg>
 );
 }
 if (name === "globe") {
 return (
 <svg {...common}>
 <circle cx="12" cy="12" r="9" />
 <path d="M3 12h18" />
 <path d="M12 3a14.5 14.5 0 0 1 0 18a14.5 14.5 0 0 1 0-18Z" />
 </svg>
 );
 }
 if (name === "profile") {
 return (
 <svg {...common}>
 <path d="M19 21a7 7 0 0 0-14 0" />
 <circle cx="12" cy="8" r="4" />
 </svg>
 );
 }
 if (name === "layers") {
 return (
 <svg {...common}>
 <path d="m12 3 9 5-9 5-9-5 9-5Z" />
 <path d="m3 12 9 5 9-5" />
 <path d="m3 16 9 5 9-5" />
 </svg>
 );
 }
 if (name === "flask") {
 return (
 <svg {...common}>
 <path d="M9 3h6" />
 <path d="M10 3v6l-5.2 8.6A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.2-2.4L14 9V3" />
 <path d="M7.5 15h9" />
 </svg>
 );
 }
 if (name === "badge") {
 return (
 <svg {...common}>
 <circle cx="12" cy="9" r="5" />
 <path d="m8.5 13.5-1.8 7.2 5.3-2.4 5.3 2.4-1.8-7.2" />
 </svg>
 );
 }
 if (name === "mail") {
 return (
 <svg {...common}>
 <path d="M4 4h16v16H4z" />
 <path d="m22 6-10 7L2 6" />
 </svg>
 );
 }
 return null;
}
// --- Sub-components -----------------------------------------------------------
function ScoreBar({ score, max, color = "#0ea5e9" }) {
 return (
<div style={{ width: "100%", background: `${color}18`, borderRadius: 6, height: 5, overflow: "hidden", marginTop: 4 }}>
<div style={{ width: `${pct(score, max)}%`, height: "100%", background: `linear-gradient(90deg,${color}88,${color})`, borderRadius: 6, transition: "width .6s cubic-bezier(.4,0,.2,1)" }} />
</div>
 );
}
function SummaryBox({
 totals,
 title = "Score",
 roleScoreLabel = "Score",
 maxScores = { partA: MAX_SCORES.PART_A, partB: MAX_SCORES.PART_B, grand: MAX_SCORES.GRAND_TOTAL },
 accent = "#4c1d95",
 remarks,
 remarksTitle,
}) {
 const scoreRows = [
 ["Part A", totals.partA, maxScores.partA, "#6366f1"],
 ["Part B", totals.partB, maxScores.partB, "#0ea5e9"],
 ...(maxScores.partC !== undefined ? [["Part C", totals.partC, maxScores.partC, "#0f766e"]] : []),
 ...(maxScores.partD !== undefined ? [["Part D", totals.partD, maxScores.partD, "#f59e0b"]] : []),
 ["Total", totals.total, maxScores.grand, "#059669"],
 ];
 const hasRemarks = remarks !== undefined;
 return (
<div style={{ background: "#fff", border: "1px solid #e2e8f0", borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: "12px 14px", display: "grid", gridTemplateColumns: hasRemarks ? "minmax(300px, 0.95fr) minmax(280px, 1.05fr)" : "1fr", gap: 12, alignItems: "stretch", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
<div style={{ display: "grid", gap: 10, minWidth: 0 }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
<div>
<div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{title}</div>
<div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{roleScoreLabel}</div>
</div>
<div style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}30`, borderRadius: 999, padding: "5px 12px", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap", letterSpacing: 0.2 }}>
 {oneDecimal(totals.total)} <span style={{ fontSize: 10, opacity: 0.6 }}>/ {maxScores.grand}</span>
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(scoreRows.length, 5)}, minmax(0, 1fr))`, gap: 8 }}>
 {scoreRows.map(([label, value, max, color]) =>(
<div key={label} style={{ background: `${color}08`, border: `1px solid ${color}20`, borderRadius: 8, padding: "8px 10px", minWidth: 0 }}>
<div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline", marginBottom: 6 }}>
<span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
<span style={{ fontSize: 12, color, fontWeight: 900, whiteSpace: "nowrap" }}>{oneDecimal(value)}<span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}> /{max}</span></span>
</div>
<div style={{ height: 5, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
 <div style={{ height: "100%", width: `${pct(n(value), max)}%`, background: `linear-gradient(90deg,${color}99,${color})`, borderRadius: 3 }} />
</div>
</div>
 ))}
</div>
</div>
 {hasRemarks && (
<div style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 8, padding: "10px 12px", minWidth: 0, display: "flex", flexDirection: "column" }}>
<div style={{ fontWeight: 800, color: accent, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>{remarksTitle || `${title} Remarks`}</div>
<div style={{ color: "#334155", fontSize: 12, lineHeight: 1.55, whiteSpace: "pre-wrap", flex: 1, maxHeight: 80, overflow: "auto" }}>
 {String(remarks || "").trim() || <span style={{ color: "#cbd5e1" }}>-</span>}
</div>
</div>
 )}
</div>
 );
}
function StatusBadge({ status }) {
 const map = {
 "Pending Review":     { bg: "#fffbeb", color: "#92400e", dot: "#f59e0b", border: "#fde68a" },
 "HOD Reviewed":       { bg: "#f5f3ff", color: "#5b21b6", dot: "#7c3aed", border: "#ddd6fe" },
 "Director Reviewed":  { bg: "#eff6ff", color: "#1e40af", dot: "#3b82f6", border: "#bfdbfe" },
 "Director Approved":  { bg: "#ecfeff", color: "#164e63", dot: "#06b6d4", border: "#a5f3fc" },
 "Pending Dean Review":{ bg: "#fffbeb", color: "#92400e", dot: "#f59e0b", border: "#fde68a" },
 "Dean Reviewed":      { bg: "#f0fdf4", color: "#065f46", dot: "#10b981", border: "#bbf7d0" },
 "VC Reviewed":        { bg: "#fdf4ff", color: "#6b21a8", dot: "#a855f7", border: "#e9d5ff" },
 "Reviewed":           { bg: "#fdf4ff", color: "#6b21a8", dot: "#a855f7", border: "#e9d5ff" },
 "Rejected":           { bg: "#fef2f2", color: "#991b1b", dot: "#ef4444", border: "#fecaca" },
 "VC Rejected":        { bg: "#fef2f2", color: "#991b1b", dot: "#ef4444", border: "#fecaca" },
 "Pending VC Review":  { bg: "#f5f3ff", color: "#5b21b6", dot: "#7c3aed", border: "#ddd6fe" },
 };
 const s = map[status] || map["Pending Review"];
 const label = status === "Reviewed" ? "VC Reviewed" : status === "Pending Review" ? "Pending VC Review" : status;
 return (
<span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, color: s.color, fontSize: 9, fontWeight: 800, padding: "4px 10px", borderRadius: 999, border: `1px solid ${s.border}`, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
<span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, flexShrink: 0, boxShadow: `0 0 4px ${s.dot}88` }} />{label}
</span>
 );
}
function RoleBadge({ role }) {
 const map = {
 Director:      { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" },
 HOD:           { bg: "#ede9fe", color: "#6d28d9", border: "#c4b5fd" },
 Faculty:       { bg: "#e0f2fe", color: "#0369a1", border: "#7dd3fc" },
 Dean:          { bg: "#d1fae5", color: "#065f46", border: "#6ee7b7" },
 "Center Head": { bg: "#ccfbf1", color: "#0f766e", border: "#5eead4" },
 };
 const s = map[role] || map.Faculty;
 return (
<span style={{ display: "inline-flex", alignItems: "center", background: s.bg, color: s.color, fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 999, border: `1px solid ${s.border}`, letterSpacing: 0.4, whiteSpace: "nowrap" }}>
 {role}
</span>
 );
}
// RO imported from shared
function ScoreValue({ val, center }) {
 const empty = val === undefined || val === null || val === "";
 return<span style={{ fontSize: 11, fontFamily: "inherit", color: "#1e293b", display: "block", textAlign: center ? "center" : "left" }}>{empty ?<span style={{ color: "#cbd5e1" }}>-</span>: val}</span>;
}
function VCInput({ val, onChange, max, disabled = false }) {
 return (
<input type="number" min="0" step="0.5" value={val ?? ""}
 max={max}
 disabled={disabled}
 onChange={e =>onChange(e.target.value === "" || max === undefined ? e.target.value : String(clampScore(e.target.value, max)))}
 style={{ width: 74, height: 34, boxSizing: "border-box", textAlign: "center", border: disabled ? "1px solid #cbd5e1" : "1.5px solid #7c3aed", borderRadius: 9, padding: "6px 8px", fontSize: 13, fontFamily: "inherit", fontWeight: 800, color: disabled ? "#94a3b8" : "#111827", outline: "none", background: disabled ? "#f8fafc" : "#ffffff", cursor: disabled ? "not-allowed" : "text", boxShadow: disabled ? "none" : "0 0 0 3px rgba(124,58,237,0.08), 0 8px 18px rgba(124,58,237,0.08)", transition: "border-color 180ms ease, box-shadow 180ms ease, background 180ms ease" }}
 />
 );
}
// --- Table style constants -----------------------------------------------------
const T = { width: "100%", minWidth: 1080, tableLayout: "fixed", borderCollapse: "separate", borderSpacing: 0, fontSize: 13, color: "#111827", background: "#fff", border: "1px solid #e7eaf3", borderRadius: 10, overflow: "hidden", boxShadow: "0 6px 18px rgba(15,23,42,0.045)" };
const TH = { border: "none", borderBottom: "1px solid #e6e9f4", padding: "12px 14px", background: "linear-gradient(180deg,#fafaff 0%,#f2f5ff 100%)", color: "#273166", fontWeight: 800, textAlign: "center", fontSize: 12, letterSpacing: 0, lineHeight: 1.25, height: 50, whiteSpace: "normal" };
const TH_HOD = { ...TH, background: "linear-gradient(180deg,#f5f3ff 0%,#eef2ff 100%)", color: "#4c1d95" };
const TH_DIR = { ...TH, background: "linear-gradient(180deg,#ecfdf5 0%,#f0fdfa 100%)", color: "#047857" };
const TH_DEAN = { ...TH, background: "linear-gradient(180deg,#f5f3ff 0%,#faf5ff 100%)", color: "#6d28d9" };
const TH_VC = { ...TH, background: "linear-gradient(180deg,#faf5ff 0%,#f5f3ff 100%)", color: "#7c3aed" };
const TD = { border: "none", borderBottom: "1px solid #edf0f7", padding: "10px 12px", verticalAlign: "middle", height: 58, lineHeight: 1.35, background: "#fff", color: "#111827", overflowWrap: "anywhere" };
const TDC = { ...TD, textAlign: "center", overflowWrap: "normal" };
const TDS = { ...TD, textAlign: "center", background: "#f8fafc", minWidth: 78, fontWeight: 800, color: "#334155" };
const TDS_HOD = { ...TDS, background: "#f4f6ff", color: "#4f46e5" };
const TDS_DIR = { ...TDS, background: "#f0fdf4", color: "#047857" };
const TDS_DEAN = { ...TDS, background: "#faf5ff", color: "#6d28d9" };
const TDS_VC = { ...TDS, background: "#f8f5ff", minWidth: 82, color: "#7c3aed" };
const TDV = { ...TD, background: "#fbfcff", width: 150, minWidth: 150, maxWidth: 176, padding: "10px 12px", textAlign: "center", overflowWrap: "normal", overflow: "hidden" };

const VC_CHAIN_ROLE_META = {
 hod: {
 label: "HOD Score",
 shortLabel: "HOD",
 field: "hod",
 headerStyle: TH_HOD,
 cellStyle: TDS_HOD,
 color: "#818cf8",
 remarksKey: "hodRemarks",
 remarksTitle: "HOD Remarks",
 remarksBg: "#f0f4ff",
 remarksBorder: "#c7d2fe",
 remarksColor: "#4338ca",
 },
 center_head: {
 label: "Center Head Score",
 shortLabel: "Center Head",
 field: "hod",
 headerStyle: TH_HOD,
 cellStyle: TDS_HOD,
 color: "#0f766e",
 remarksKey: "hodRemarks",
 remarksTitle: "Center Head Remarks",
 remarksBg: "#ecfdf5",
 remarksBorder: "#99f6e4",
 remarksColor: "#0f766e",
 },
 director: {
 label: "Director Score",
 shortLabel: "Director",
 field: "director",
 headerStyle: TH_DIR,
 cellStyle: TDS_DIR,
 color: "#38bdf8",
 remarksKey: "directorRemarks",
 remarksTitle: "Director Remarks",
 remarksBg: "#f0f9ff",
 remarksBorder: "#bae6fd",
 remarksColor: "#0369a1",
 },
 dean: {
 label: "Dean Score",
 shortLabel: "Dean",
 field: "dean",
 headerStyle: TH_DEAN,
 cellStyle: TDS_DEAN,
 color: "#34d399",
 remarksKey: "deanRemarks",
 remarksTitle: "Dean Remarks",
 remarksBg: "#f0fdf4",
 remarksBorder: "#bbf7d0",
 remarksColor: "#065f46",
 },
};

const vcChainProfileFor = (person = {}, personMode = "faculty") =>({
 school: person.school || person.info?.school || "",
 department: person.department || "",
 appraisal_role: person.appraisalRole || personMode,
});

const vcPreviousRolesFor = (person = {}, personMode = "faculty") =>{
 const profile = vcChainProfileFor(person, personMode);
 return visiblePreviousReviewRoles("vc", profile);
};

const vcRoleMeta = (role) =>VC_CHAIN_ROLE_META[role] || {
 label: `${role} Score`,
 shortLabel: role,
 field: role,
 headerStyle: TH,
 cellStyle: TDS,
 color: "#64748b",
};

const vcScoreForRole = (row = {}, role) =>{
 const field = vcRoleMeta(role).field;
 const directorAlias = role === "director"
 ? (row?.dir ?? row?.dir_score ?? row?.dirScore ?? row?.dir_marks ?? row?.dirMarks)
 : undefined;
 return row?.[field] ??
  row?.[`${field}_score`] ??
  row?.[`${field}Score`] ??
  row?.[`${field}_marks`] ??
  row?.[`${field}Marks`] ??
  directorAlias ??
  (role === "center_head" ? (row.center_head_score ?? row.centerHeadScore ?? row.center_head_marks ?? row.centerHeadMarks) : undefined) ??
  row?.[`${role}_score`] ??
 row?.[`${role}Score`] ??
 row?.[`${role}_marks`] ??
 row?.[`${role}Marks`];
};
const vcTotalForRole = (person = {}, role) =>{
 if (role === "hod" || role === "center_head") return n(person.hodTotal ?? person.hodScore);
 if (role === "director") return n(person.directorTotal ?? person.directorScore);
 if (role === "dean") return n(person.deanTotal ?? person.deanScore);
 return 0;
};
const vcSelfTotalForPerson = (person = {}) =>
 n(person.declaration?.grand_total ?? person.grandTotal ?? person.grand_total ?? person.totalScore ?? person.total ?? person.selfTotal);
const rawVcTotalForRole = (person = {}, role) =>{
 if (role === "hod" || role === "center_head") return person.hodTotal ?? person.hodScore;
 if (role === "director") return person.directorTotal ?? person.directorScore;
 if (role === "dean") return person.deanTotal ?? person.deanScore;
 return undefined;
};
const hasScoreValue = (value) =>
 value !== undefined && value !== null && String(value).trim() !== "" && Number.isFinite(Number(value));
const vcAverageBeforeVc = (person = {}, personMode = "faculty", previousRoles = vcPreviousRolesFor(person, personMode)) =>{
 const scores = previousRoles
 .filter((role) =>role !== personMode)
 .map((role) =>rawVcTotalForRole(person, role))
 .filter(hasScoreValue)
 .map(Number);
 if (!scores.length) return 0;
 return scores.reduce((sum, value) =>sum + value, 0) / scores.length;
};
const firstNumberFrom = (sources = [], keys = []) =>{
 for (const source of sources) {
 if (!source || typeof source !== "object") continue;
 for (const key of keys) {
 const value = source[key];
 if (value !== undefined && value !== null && String(value).trim() !== "") return n(value);
 }
 }
 return null;
};
const legacyCardPrefixesForMode = (personMode) =>{
 if (personMode === "director") return ["director", "dir"];
 if (personMode === "dean") return ["dean"];
 if (personMode === "hod" || personMode === "center_head") return ["hod", "centerHead", "center_head"];
 return ["faculty", "self"];
};
const legacyCardTotalsForPerson = (person = {}, personMode = "faculty") =>{
 const sources = [
 person,
 person.info,
 person.payload,
 person.previousYearResponse?.payload?.totals,
 person.previousYearResponse?.totals,
 ];
 const prefixes = legacyCardPrefixesForMode(personMode);
 const partAKeys = prefixes.flatMap((prefix) =>[
 `${prefix}PartA`,
 `${prefix}PartATotal`,
 `${prefix}_part_a`,
 `${prefix}_part_a_total`,
 `${prefix}_part_a_score`,
 ]);
 const partBKeys = prefixes.flatMap((prefix) =>[
 `${prefix}PartB`,
 `${prefix}PartBTotal`,
 `${prefix}_part_b`,
 `${prefix}_part_b_total`,
 `${prefix}_part_b_score`,
 ]);
 const totalKeys = prefixes.flatMap((prefix) =>[
 `${prefix}Total`,
 `${prefix}Grand`,
 `${prefix}GrandTotal`,
 `${prefix}_total`,
 `${prefix}_grand`,
 `${prefix}_grand_total`,
 ]);
 const partA = firstNumberFrom(sources, ["partATotal", "partA", "part_a_total", ...partAKeys]);
 const partB = firstNumberFrom(sources, ["partBTotal", "partB", "part_b_total", ...partBKeys]);
 const total = firstNumberFrom(sources, ["grandTotal", "grand_total", "totalScore", "total_score", "total", ...totalKeys]);
 return {
 partA: partA ?? 0,
 partB: partB ?? 0,
 total: total ?? n(partA) + n(partB),
 };
};

const vcReviewSummaryFrom = standardReviewSummary;

const VC_REVIEW_ARRAY_KEYS = ["lectures", "courseFile", "obeRows", "projects", "mentoringRows", "quals", "feedback", "deptActs", "uniActs", "eventRows", "society", "industry", "alumniRows", "placementRows", "acr", "journals", "books", "ict", "research", "projects2", "patents", "awards", "confs", "proposals", "products", "fdps", "exhibitions"];
const VC_SECTION_MAX = { lectures: 40, courseFile: 20, obeRows: 20, projects: 20, mentoringRows: 10, quals: 10, feedback: 10, deptActs: 30, uniActs: 50, eventRows: 20, society: 20, industry: 10, alumniRows: 10, placementRows: 20, acr: 50, journals: 100, books: 30, ict: 20, research: 20, projects2: 40, patents: 40, awards: 20, confs: 20, proposals: 20, products: 20, fdps: 20, exhibitions: 30 };
const REVIEW_SCORE_FIELDS = ["hod", "director", "dean", "vc"];
const preserveSavedReviewScores = (form = {}, source = {}) =>{
 const merged = { ...form };
 merged.info = mergeFacultyInfo(form.info, source, form);
 VC_REVIEW_ARRAY_KEYS.forEach((key) =>{
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
const VC_REPORT_PART_A_SECTIONS = [
 { key: "lectures", title: "A1. Lectures / Tutorials / Practicals", max: 40, doc: "lec", fields: [["sem", "Semester"], ["code", "Course Code / Name"], ["planned", "Classes (as per course structure)"], ["conducted", "Classes Actually Conducted"], ["pctConducted", "% Conducted"]] },
 { key: "courseFile", title: "A2. Course File", max: 20, doc: "courseFile", fields: [["course", "Course / Paper"], ["title", "Program & Semester"], ["details", "IQAC Index Compliance (Yes/No, with proof)"]] },
 { key: "obeRows", title: "A5. Learning Outcomes Attainment & OBE Practice", max: 20, doc: "obe", fields: [["component", "Component"], ["evidence", "Evidence"]] },
 { key: "projects", title: "A6. Guided Students Project", max: 20, doc: "proj", fields: [["label", "Project Category"]] },
 { key: "mentoringRows", title: "A7. Student Mentoring & Counselling", max: 10, doc: "mentor", fields: [["activity", "Activity"], ["evidence", "Evidence"]] },
 { key: "quals", title: "A8. Qualification Enhancement", max: 10, doc: "qual", fields: [["label", "Qualification / Category"], ["awardingBody", "Awarding Body"], ["date", "Date"]] },
 { key: "feedback", title: "A4. Student Feedback", max: 10, doc: "fb", fields: [["code", "Course Code / Name"], ["fb1", "First Feedback(%)"], ["fb2", "Second Feedback(%)"]] },
];
const VC_REPORT_PART_C_SECTIONS = [
 { key: "uniActs", title: "C1. Administration at University Level", max: 50, doc: "uni", fields: [["activity", "Activity"], ["nature", "Nature"], ["period", "Period"]] },
 { key: "deptActs", title: "C2. Administration at School Level", max: 30, doc: "dept", fields: [["activity", "Activity"], ["nature", "Nature"], ["period", "Period"]] },
 { key: "eventRows", title: "C3. Event Organisation & Institutional Visibility", max: 20, doc: "event", fields: [["event", "Event / Contribution"], ["role", "Role"], ["fromDate", "From"], ["toDate", "To"], ["level", "Level"]] },
 { key: "society", title: "C4. Outreach, Extension & Social Responsibility", max: 20, doc: "soc", fields: [["label", "Activity"], ["details", "Details"], ["date", "Date"]] },
 { key: "industry", title: "C5. Industry Interaction & Linkages", max: 10, doc: "ind", fields: [["activity", "Activity"], ["partner", "Industry Partner"], ["date", "Date"]] },
 { key: "alumniRows", title: "C6. Alumni Engagement & Networking", max: 10, doc: "alumni", fields: [["activity", "Activity"], ["details", "Details"], ["date", "Date"]] },
 { key: "placementRows", title: "C7. Student Placement Mentoring & Career Development", max: 20, doc: "placement", fields: [["activityType", "Activity Type"], ["name", "Student / Company Name"], ["date", "Date"]] },
];
const VC_REPORT_PART_D_SECTIONS = [
 { key: "acr", title: "D1. Annual Confidential Report (ACR)", max: 50, doc: "acr", showDocuments: false, fields: [["label", "Attribute"]] },
];
const VC_REPORT_PART_B_SECTIONS = [
 { key: "journals", title: "B1. Journal Publications", max: 100, doc: "jour", fields: [["title", "Title"], ["journal", "Journal"], ["issn", "DOI No."], ["impactFactor", "Impact Factor"], ["authorPosition", "Author Position"]] },
 { key: "books", title: "B2. Books, Book Chapters & Edited Volumes", max: 30, doc: "book", fields: [["title", "Title"], ["book", "Publisher & ISBN"], ["pub", "Type"], ["level", "Level"], ["coauth", "Co-authors from DYPIU"]] },
 { key: "patents", title: "B3. Patents, Copyrights & IP and Product Development", max: 40, doc: "pat", fields: [["title", "Title"], ["type", "National / International"], ["status", "Status (Published/Granted)"], ["fileNo", "Filing / Grant No. & Date"]] },
 { key: "projects2", title: "B4. External Funded Research Projects", max: 40, doc: "project2", fields: [["title", "Title of Project"], ["agency", "Funding Agency"], ["date", "Sanction Date"], ["amount", "Amount (₹)"], ["role", "PI / Co-PI"], ["status", "Status"]] },
 { key: "research", title: "B5. Research Guidance", max: 20, doc: "res", fields: [["degree", "Degree (PhD/PG)"], ["name", "Name of Student / Scholar"], ["status", "Status (Ongoing/Awarded)"], ["date", "Date"]] },
 { key: "proposals", title: "B6. Consultancy, Testing & Training", max: 20, doc: "prop", fields: [["agency", "Client / Organisation"], ["duration", "Nature of Engagement"], ["amount", "Revenue Generated (₹)"]] },
 { key: "confs", title: "B7. Conference / FDP / Training / Workshop Contributions as Resource Person", max: 20, doc: "conf", fields: [["title", "Event / Session Title"], ["role", "Role"], ["date", "Date"], ["level", "Level (Intl./National)"]] },
 { key: "fdps", title: "B8. Conference / FDP / Industry Training - Attended", max: 20, doc: "fdp", fields: [["program", "Programme / Event"], ["fromDate", "From"], ["toDate", "To"], ["org", "Organised By"]] },
 { key: "awards", title: "B9. Research Awards, Fellowships, Reviewer of Journal & Citations", max: 20, doc: "awd", fields: [["title", "Title of Award / Fellowship / Metric"], ["agency", "Awarding Agency"], ["level", "Level"], ["date", "Date"]] },
 { key: "products", title: "B10. Innovation, Start-ups & Technology Transfer", max: 20, doc: "prod", fields: [["details", "Title / Start-up / Product"], ["role", "Role"], ["status", "Status"]] },
 { key: "ict", title: "B11. ICT Content, MOOCs & E-Learning", max: 20, doc: "ict", fields: [["title", "Title"], ["type", "Platform / Type"], ["quad", "Reach / Views (if available)"]] },
 { key: "exhibitions", title: "B12. Exhibitions — Photography, Design & Applied Arts, Documentaries, Films & Audio-Visual Productions", max: 30, doc: "exh", fields: [["title", "Title of Work / Exhibition"], ["type", "Type (Solo/Group/Curated)"], ["venueLevel", "Venue & Level (Institutional/National/Intl.)"], ["date", "Date"]] },
];

const getVcSectionMax = (key, person) => {
  const baseMax = VC_SECTION_MAX[key] || 0;
  if (key === "proposals" || key === "awards" || key === "products") {
    const school = person?.info?.school || person?.school || "";
    return isStandardAppraisalSchool(school) ? 20 : 10;
  }
  return baseMax;
};

const buildVcSectionScores = (person, vcData) =>{
 const payload = {};
 VC_REVIEW_ARRAY_KEYS.forEach((key) =>{
 const rows = key === "acr" ? createAcrRows(person.acr) : Array.isArray(person[key]) ? person[key] : [];
 payload[key] = rows.map((row, index) =>({
 ...row,
 vc: key === "society" && societyRowLocked(row)
 ? "0"
 : isSectionEmpty(key, person[key], person.docs)
    ? ""
    : clampReviewScore(key, row, vcData[key]?.[index]?.vc ?? row.vc ?? "", key === "lectures" ? 10 : getVcSectionMax(key, person)),
 }));
 });
 const innovRows = Array.isArray(person.innovRows) ? person.innovRows : [];
 const reviewInnovRows = Array.isArray(vcData.innovRows) ? vcData.innovRows : [];
 const mergedInnovRows = innovRows.map((row, index) =>({
 ...row,
 vc: clampReviewScore("innovRows", row, reviewInnovRows[index]?.vc ?? row.vc ?? "", 10),
 }));
 const innovTotal = reviewSectionScore("innovRows", mergedInnovRows, 10, "vc");
 payload.innovRows = mergedInnovRows;
 payload.innovativeTeaching = {
 vc: innovTotal ? String(innovTotal) : vcData.innovVc ?? vcData.innovVC ?? person.innovVc ?? "",
 };
 return payload;
};


// --- VC Review Form -----------------------------------------------------------
// personMode: "dean" | "director" | "hod" | "faculty"
function VCReviewForm({ person, vcData, setVcData, personMode = "director", sectionView = "partA" }) {
 const info = mergeFacultyInfo(person.info, person);
 const reviewRoles = vcPreviousRolesFor(person, personMode);
 const selfScoreLabel = personMode === "faculty" ? "Faculty Score" : "Self Score";

 const set = (section, idx, field, val) =>{
 setVcData(prev =>{
 const updated = { ...prev };
 if (!updated[section]) {
    updated[section] = section === "acr"
      ? createAcrRows(person[section])
      : JSON.parse(JSON.stringify(person[section] || []));
 }
 const sourceRow = section === "acr" && idx !== null ? createAcrRows(person.acr)[idx] : person[section]?.[idx] || {};
 const nextVal = field === "vc" && idx !== null
 ? (isSectionEmpty(section, person[section], person.docs) ? "" : clampReviewScore(section, sourceRow, val, section === "lectures" ? 10 : getVcSectionMax(section, person)))
 : val;
 if (idx === null) {
 updated[section] = Array.isArray(updated[section])
 ? (updated[section].length ? updated[section].map((r, i) =>i === 0 ? { ...r, [field]: nextVal } : r) : [{ [field]: nextVal }])
 : { ...updated[section], [field]: nextVal };
 } else updated[section] = updated[section].map((r, i) =>i === idx ? { ...r, [field]: nextVal } : r);
 return updated;
 });
 };
 const get = (section, idx, field) =>{
 if (vcData[section]) {
 const s = vcData[section];
 return idx === null
 ? (Array.isArray(s) ? (s[0]?.[field] ?? "") : (s[field] ?? ""))
 : (s[idx]?.[field] ?? person[section]?.[idx]?.[field] ?? "");
 }
 if (idx === null) {
 const source = person[section];
 return Array.isArray(source) ? (source[0]?.[field] ?? "") : (source?.[field] ?? "");
 }
 return person[section]?.[idx]?.[field] ?? "";
 };
 const { docs } = person;
 const rows = (arr) =>Array.isArray(arr) ? arr : [];
 const scoreColumnCount = reviewRoles.length + 2;
 const emptyRow = (colSpan) => <EmptySectionRow colSpan={colSpan} />;
 const sectionRows = (key) => rows(person[key]);
 const sectionEmpty = (key) => isSectionEmpty(key, sectionRows(key), docs);
 const vcRowMax = (section, row = {}) => isSectionEmpty(section, person[section], person.docs) ? 0 : reviewRowMaxForSection(section, row, section === "lectures" ? 10 : getVcSectionMax(section, person));
 const innovativeRows = Array.isArray(person.innovRows) && person.innovRows.length
 ? person.innovRows
 : [{ method: person.innovDetails || "Innovative / participatory teaching methods used", details: person.innovDetails || "", score: person.innovScore || "" }];
 const innovativeSectionEmpty = isSectionEmpty("innovRows", Array.isArray(person.innovRows) ? person.innovRows : [], docs);
 const getInnovVc = (index) =>vcData.innovRows?.[index]?.vc ?? innovativeRows[index]?.vc ?? "";
 const setInnovVc = (index, value) =>{
 const sourceRow = innovativeRows[index] || {};
 const nextValue = clampReviewScore("innovRows", sourceRow, value, 10);
 setVcData(prev =>{
 const sourceRows = Array.isArray(prev.innovRows) && prev.innovRows.length ? prev.innovRows : JSON.parse(JSON.stringify(innovativeRows));
 const nextRows = sourceRows.map((row, rowIndex) =>rowIndex === index ? { ...row, vc: nextValue } : row);
 const total = reviewSectionScore("innovRows", nextRows.map((row, rowIndex) =>({ ...innovativeRows[rowIndex], ...row })), 10, "vc");
 return { ...prev, innovRows: nextRows, innovVc: total ? String(total) : "" };
 });
 };

 const renderScoreHeaders = () =>(
<>
<th style={TH}>{selfScoreLabel}</th>
 {reviewRoles.map((role) =>{
 const meta = vcRoleMeta(role);
 return<th key={role} style={meta.headerStyle}>{meta.label}</th>;
 })}
<th style={TH_VC}>VC Score</th>
</>
 );

 const renderScoreCells = (r, section, i) =>{
 const maxForRow = vcRowMax(section, r);
 const societyLocked = section === "society" && societyRowLocked(r);
 const rowReviewable = rowHasReviewableData(section, r, docs);
 const locked = section === "acr" ? false : (societyLocked || !rowReviewable || isSectionEmpty(section, person[section], docs));
 const displayScore = (value) => maxForRow ? (String(value ?? "").trim() ? clampScore(value, maxForRow) : "") : "";
 const facultyScore = section === "research"
 ? (r.degree || r.name || r.thesis || r.score ? researchGuidanceScore(r).toFixed(1) : "")
 : section === "society"
 ? (String(r?.score ?? "").trim() ? societyRowScore(r) : "")
 : displayScore(r?.score);
 const displayReviewScore = (value) =>
 value === undefined || value === null || String(value).trim() === ""
 ? undefined
 : value;
 const displayVcScore = (value) =>
 value === undefined || value === null || String(value).trim() === ""
 ? undefined
 : displayScore(value);
 return (
<>
<td style={TDS}><ScoreValue val={facultyScore} center /></td>
 {reviewRoles.map((role) =>{
 const meta = vcRoleMeta(role);
 return<td key={role} style={meta.cellStyle}><ScoreValue val={societyLocked ? "0" : displayReviewScore(vcScoreForRole(r, role))} center /></td>;
 })}
<td style={TDS_VC}><VCInput val={societyLocked ? "0" : displayVcScore(get(section, i, "vc")) ?? ""} max={maxForRow} disabled={locked} onChange={v =>set(section, i, "vc", v)} /></td>
</>
 );
 };

 return (
<div style={{ display: "flex", flexDirection: "column" }}>
 {/* Mode banner */}
<div style={{ background: "linear-gradient(180deg,#faf5ff 0%,#f5f3ff 100%)", color: "#334155", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, fontSize: 12, border: "1px solid #ddd6fe", boxShadow: "0 4px 14px rgba(124,58,237,0.08)" }}>
<div>
<strong style={{ color: "#581c87" }}>Vice Chancellor Review Mode</strong> - Only the <span style={{ color: "#7c3aed", fontWeight: 900 }}>VC Score</span> column is editable.
 {" "}All previous scores are shown read-only for reference.
</div>
</div>

 {sectionView === "partA" && <FacultyInfoSection info={info} />}

 {sectionView === "partA" && (<div className="review-part-stack">
<div className="review-part-stack__title">PART A - Teaching &amp; Academic Activities</div>

 {/* A1 Lectures */}
<SC title="A1. Course Delivery & Classroom Engagement (Max 40)" accent="#7c3aed">
<div style={{ overflowX: "auto" }}>
<table style={T}><thead><tr>
<th style={TH}>SN</th><th style={TH}>Semester</th><th style={TH}>Course</th>
<th style={TH}>Classes (as per course structure)</th><th style={TH}>Classes Actually Conducted</th><th style={TH}>Docs</th>
 {renderScoreHeaders()}
</tr></thead>
<tbody>{sectionEmpty("lectures") ? emptyRow(6 + scoreColumnCount) : sectionRows("lectures").map((r, i) =>(
<tr key={i} style={i % 2 ? { background: "#f8fafc" } : {}}>
<td style={TDC}>{i + 1}</td><td style={TD}><RO val={r.sem} /></td><td style={TD}><RO val={r.code} /></td>
<td style={TDC}><RO val={r.planned} center /></td><td style={TDC}><RO val={r.conducted} center /></td>
<td style={TDV}><ViewDocsCell docKey={`lec-${i}`} docs={docs} /></td>
 {renderScoreCells(r, "lectures", i)}
</tr>
 ))}</tbody></table>
</div>
</SC>

 {/* A2 Course File */}
<SC title="A2. Course File & Curriculum Documentation (Max 20)" accent="#7c3aed">
<table style={T}><thead><tr>
<th style={TH}>SN</th><th style={TH}>Course</th><th style={TH}>Title</th><th style={TH}>IQAC Index Compliance (Yes/No, with proof)</th>
 {renderScoreHeaders()}
</tr></thead>
<tbody>{sectionEmpty("courseFile") ? emptyRow(4 + scoreColumnCount) : sectionRows("courseFile").map((r, i) =>(
<tr key={i} style={i % 2 ? { background: "#f8fafc" } : {}}>
<td style={TDC}>{i + 1}</td>
<td style={TD}><RO val={r.course} /></td>
<td style={TD}><RO val={r.title} /></td>
<td style={TDC}><RO val={r.details} center /></td>
 {renderScoreCells(r, "courseFile", i)}
</tr>
 ))}</tbody></table>
</SC>

 {/* A3 Innovative */}
<SC title="A3. Innovative Teaching-Learning Methods (Max 20)" accent="#7c3aed">
<table style={T}><thead><tr>
<th style={TH}>SN</th><th style={TH}>Method</th><th style={TH}>Proof Attached (Yes/No)</th>
<th style={TH}>View Docs</th>
 {renderScoreHeaders()}
</tr></thead>
<tbody>{innovativeSectionEmpty ? emptyRow(4 + scoreColumnCount) : innovativeRows.map((row, index) =>{
 const rowReviewable = rowHasReviewableData("innovRows", row);
 const previousInnovScore = (role) =>{
 const value = row[role] ?? "";
 return String(value ?? "").trim() ? clampScore(value, row.max || SCORE_LIMITS.innovativeRow) : "";
 };
 return (
<tr key={`innov-${index}`}>
<td style={TDC}>{index + 1}</td>
<td style={TD}><RO val={(row.method === "Any other innovative method" && row.methodOther) ? row.methodOther : (row.method || person.innovDetails)} /></td>
<td style={TD}><RO val={row.details} /></td>
<td style={TDV}><ViewDocsCell docKey={index === 0 ? ["innov", "innov-0"] : `innov-${index}`} docs={docs} /></td>
<td style={TDS}><ScoreValue val={String(row.score ?? "").trim() ? clampScore(row.score, row.max || SCORE_LIMITS.innovativeRow) : ""} center /></td>
 {reviewRoles.map((role) =>{
 const meta = vcRoleMeta(role);
 return<td key={role} style={meta.cellStyle}><ScoreValue val={previousInnovScore(role)} center /></td>;
 })}
<td style={TDS_VC}><VCInput val={String(getInnovVc(index) ?? "").trim() ? clampScore(getInnovVc(index), row.max || SCORE_LIMITS.innovativeRow) : ""} max={row.max || SCORE_LIMITS.innovativeRow} disabled={!rowReviewable} onChange={v =>setInnovVc(index, v)} /></td>
</tr>
 );
 })}</tbody></table>
</SC>

 {/* A4 Student Feedback */}
<SC title="A4. Student Feedback Score (Max 10)" accent="#7c3aed">
<table style={T}><thead><tr>
<th style={TH}>SN</th><th style={TH}>Course</th><th style={TH}>First Feedback(%)</th><th style={TH}>Second Feedback(%)</th><th style={TH}>Average</th>
 {renderScoreHeaders()}
</tr></thead>
<tbody>{sectionEmpty("feedback") ? emptyRow(5 + scoreColumnCount) : sectionRows("feedback").map((r, i) =>(
<tr key={i} style={i % 2 ? { background: "#f8fafc" } : {}}>
<td style={TDC}>{i + 1}</td><td style={TD}><RO val={r.code} /></td>
<td style={TDC}><RO val={r.fb1} center /></td><td style={TDC}><RO val={r.fb2} center /></td>
<td style={{ ...TDC, fontWeight: 700, color: "#0ea5e9" }}>{r.fb1 && r.fb2 ? ((n(r.fb1) + n(r.fb2)) / 2).toFixed(2) : "-"}</td>
 {renderScoreCells(r, "feedback", i)}
</tr>
 ))}</tbody></table>
</SC>

 {/* A5-A8 */}
 {[
 { title: "A5. Learning Outcomes Attainment & OBE Practice (Max 20)", key: "obeRows", docPfx: "obe", fields: [["component", "Component"], ["evidence", "Evidence Attached (Yes/No)"]] },
 { title: "A6. Student Project Guidance (Max 20)", key: "projects", docPfx: "proj", fields: [["label", "Project Title / Batch"], ["studentsCount", "No. of Students"], ["industryCollab", "Industry Collab (Y/N)"], ["awardReceived", "Award (Y/N)"], ["studentPub", "Student Pub (Y/N)"]] },
 { title: "A7. Student Mentoring & Counselling (Max 10)", key: "mentoringRows", docPfx: "mentor", fields: [["activity", "Activity"], ["evidence", "Evidence Attached (Yes/No)"]] },
 { title: "A8. Professional Development & Qualification Enhancement (Max 10)", key: "quals", docPfx: "qual", fields: [["label", "Qualification / Category"], ["awardingBody", "Awarding Body"], ["date", "Date"]] },
 ].map(({ title, key, docPfx, fields }) =>(
<SC key={key} title={title} accent="#7c3aed">
<table style={T}><thead><tr>
<th style={TH}>SN</th>{fields.map(([, label]) =><th key={label} style={TH}>{label}</th>)}<th style={TH}>Docs</th>
 {renderScoreHeaders()}
</tr></thead>
<tbody>{sectionEmpty(key) ? emptyRow(2 + fields.length + scoreColumnCount) : sectionRows(key).map((r, i) =>(
<tr key={i} style={i % 2 ? { background: "#f8fafc" } : {}}>
<td style={TDC}>{i + 1}</td>
 {fields.map(([field]) =><td key={field} style={TD}><RO val={key === "eventRows" && (field === "fromDate" || field === "toDate") ? (r[field] || r.date) : r[field]} /></td>)}
<td style={TDV}><ViewDocsCell docKey={`${docPfx}-${i}`} docs={docs} /></td>
 {renderScoreCells(r, key, i)}
</tr>
 ))}</tbody></table>
</SC>
 ))}

</div>)}
 {sectionView === "partC" && (<div className="review-part-stack">
<div className="review-part-stack__title">PART C - Administrative Role &amp; University Development Contribution</div>
 {[
 { title: "C1. Administration at University Level (Max 50)", key: "uniActs", docPfx: "uni", fields: [["activity", "Activity / Responsibility"], ["nature", "Duration Category"], ["period", "Period"]] },
 { title: "C2. Administration at School Level (Max 30)", key: "deptActs", docPfx: "dept", fields: [["activity", "Activity / Responsibility"], ["nature", "Duration Category"], ["period", "Period"]] },
 { title: "C3. Event Organisation & Institutional Visibility (Max 20)", key: "eventRows", docPfx: "event", fields: [["event", "Event / Contribution"], ["role", "Role"], ["fromDate", "From"], ["toDate", "To"], ["level", "Level"]] },
 { title: "C4. Outreach, Extension & Social Responsibility (Max 20)", key: "society", docPfx: "soc", fields: [["label", "Activity"], ["details", "Details"], ["date", "Date"]] },
 { title: "C5. Industry Interaction & Linkages (Max 10)", key: "industry", docPfx: "ind", fields: [["activity", "Activity"], ["partner", "Industry Partner"], ["date", "Date"]] },
 { title: "C6. Alumni Engagement & Networking (Max 10)", key: "alumniRows", docPfx: "alumni", fields: [["activity", "Activity"], ["details", "Details"], ["date", "Date"]] },
 { title: "C7. Student Placement Mentoring & Career Development (Max 20)", key: "placementRows", docPfx: "placement", fields: [["activityType", "Activity Type"], ["name", "Student / Company Name"], ["date", "Date"]] },
 ].map(({ title, key, docPfx, fields }) =>(
<SC key={key} title={title} accent="#0f766e">
<div style={{ overflowX: "auto" }}><table style={T}><thead><tr>
<th style={TH}>SN</th>{fields.map(([, label]) =><th key={label} style={TH}>{label}</th>)}<th style={TH}>Docs</th>
 {renderScoreHeaders()}
</tr></thead>
<tbody>{sectionEmpty(key) ? emptyRow(2 + fields.length + scoreColumnCount) : sectionRows(key).map((r, i) =>(
<tr key={i} style={key === "society" && societyRowLocked(r) ? { background: "#f1f5f9", opacity: 0.65 } : i % 2 ? { background: "#f8fafc" } : {}}>
<td style={TDC}>{i + 1}</td>
 {fields.map(([field]) =><td key={field} style={TD}><RO val={key === "eventRows" && (field === "fromDate" || field === "toDate") ? (r[field] || r.date) : r[field]} /></td>)}
<td style={TDV}><ViewDocsCell docKey={`${docPfx}-${i}`} docs={docs} /></td>
 {renderScoreCells(r, key, i)}
</tr>
 ))}</tbody></table></div>
</SC>
 ))}
</div>)}

 {sectionView === "partD" && (
 // Backend only ever produces "pending" or "released" for part_d_status (see
 // Declaration.part_d_status) - not the three-state pending_registrar/
 // registrar_approved_pending_release/released_to_vc vocabulary this used to check for,
 // which meant this gate never actually unlocked even after a real Registrar release.
 person.partDStatus === "released" ? (
<>
<LeaveManagementReadOnly ctx={{ leaveManagement: person.leaveManagement }} registrarInfo={{ status: person.partDStatus, score: person.registrarPartDScore, remarks: person.registrarPartDRemarks }} />
<div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: "#ecfeff", color: "#0e7490", fontSize: 12, fontWeight: 700 }}>
 VC view - Part D score (Registrar): {person.registrarPartDScore ?? 0}/25
</div>
</>
 ) : (
<div className="review-part-stack">
<div className="review-part-stack__title">PART D - Leave &amp; Attendance Management</div>
<div style={{ padding: "16px 18px", borderRadius: 10, background: "#fef3c7", color: "#92400e", fontSize: 13, fontWeight: 700 }}>
 Part D is still awaiting the Registrar's review and has not been released to the VC yet.
</div>
</div>
 )
 )}

 {sectionView === "partE" && (<div className="review-part-stack">
<div className="review-part-stack__title">PART E - Annual Confidential Report</div>
<SC title="E1. Annual Confidential Report (ACR) (Max 50)" accent="#ef4444">
<table style={T}><thead><tr>
<th style={TH}>SN</th><th style={TH}>Parameter</th>
 {renderScoreHeaders()}
</tr></thead>
<tbody>{createAcrRows(person.acr).map((r, i) =>(
<tr key={i} style={i % 2 ? { background: "#f8fafc" } : {}}>
<td style={TDC}>{i + 1}</td>
<td style={TD}>
<div style={{ fontWeight: 700 }}>{r.label}</div>
 {ACR_DETAIL_POINTS[r.label] && (
<ul style={{ margin: "5px 0 0 16px", padding: 0, color: "#64748b", fontSize: 10, lineHeight: 1.5 }}>
 {ACR_DETAIL_POINTS[r.label].map((point) =><li key={point}>{point}</li>)}
</ul>
 )}
</td>
 {renderScoreCells(r, "acr", i)}
</tr>
 ))}</tbody></table>
</SC>
</div>)}

 {sectionView === "partB" && (<div className="review-part-stack">
<div className="review-part-stack__title">PART B - Research &amp; Innovation</div>

 {/* B1 Journals */}
<SC title="B1. Journal Publications (Max 100)" accent="#7c3aed">
<div style={{ overflowX: "auto" }}><table style={T}><thead><tr>
<th style={TH}>SN</th><th style={TH}>Title</th><th style={TH}>Journal</th>
<th style={TH}>DOI No.</th><th style={TH}>Impact Factor</th><th style={TH}>Author Position</th><th style={TH}>Docs</th>
 {renderScoreHeaders()}
</tr></thead>
<tbody>{sectionEmpty("journals") ? emptyRow(7 + scoreColumnCount) : sectionRows("journals").map((r, i) =>(
<tr key={i} style={i % 2 ? { background: "#f8fafc" } : {}}>
<td style={TDC}>{i + 1}</td><td style={TD}><RO val={r.title} /></td><td style={TD}><RO val={r.journal} /></td>
<td style={TDC}><RO val={r.issn} center /></td><td style={TDC}><RO val={r.impactFactor || r.impact} center /></td><td style={TDC}><RO val={r.authorPosition || r.position} center /></td>
<td style={TDV}><ViewDocsCell docKey={`jour-${i}`} docs={docs} /></td>
 {renderScoreCells(r, "journals", i)}
</tr>
 ))}</tbody></table></div>
</SC>

 {/* B2-B8 */}
 {[
 { title: "B2. Books, Book Chapters & Edited Volumes (Max 30)", key: "books", docPfx: "book",
 columns: [["Title", (r) =>r.title], ["Publisher & ISBN", (r) =>r.book || r.publisherIsbn], ["Type", (r) =>r.pub || r.type], ["Level", (r) =>r.level], ["Co-authors from DYPIU", (r) =>r.coauth]] },
 { title: "B3. Patents, Copyrights & IP and Product Development (Max 40)", key: "patents", docPfx: "pat",
 columns: [["Title", (r) =>r.title], ["National / International", (r) =>r.type || r.level], ["Status", (r) =>r.status], ["Filing / Grant No. & Date", (r) =>r.fileNo || r.date]] },
 { title: "B4. External Funded Research Projects (Max 40)", key: "projects2", docPfx: "project2",
 columns: [["Title of Project", (r) =>r.title], ["Funding Agency", (r) =>r.agency], ["Sanction Date", (r) =>r.date], ["Amount", (r) =>r.amount], ["Role", (r) =>r.role], ["Status", (r) =>r.status]] },
 { title: "B5. Research Guidance (Max 20)", key: "research", docPfx: "res",
 columns: [["Degree", (r) =>r.degree], ["Name of Student / Scholar", (r) =>r.name], ["Status", (r) =>r.status || r.thesis], ["Date", (r) =>(r.status || r.thesis) === "Ongoing" ? "NA" : r.date]] },
 { title: "B6. Consultancy, Testing & Training (Max 20)", key: "proposals", docPfx: "prop",
 columns: [["Client / Organisation", (r) =>r.agency || r.title], ["Nature of Engagement", (r) =>r.duration || r.nature], ["Revenue Generated", (r) =>r.amount || r.revenue]] },
 { title: "B7. Conference / FDP / Training / Workshop Contributions as Resource Person (Max 20)", key: "confs", docPfx: "conf",
 columns: [["Event / Session Title", (r) =>r.title], ["Role", (r) =>r.role || r.type], ["Date", (r) =>r.date], ["Level", (r) =>r.level || r.org]] },
 { title: "B8. Conference / FDP / Industry Training - Attended (Max 20)", key: "fdps", docPfx: "fdp",
 columns: [["Programme / Event", (r) =>r.program], ["From", (r) =>r.fromDate], ["To", (r) =>r.toDate], ["Organised By", (r) =>r.org]] },
 { title: "B9. Research Awards, Fellowships, Reviewer of Journal & Citations (Max 20)", key: "awards", docPfx: "awd",
 columns: [["Title", (r) =>r.title], ["Awarding Agency", (r) =>r.agency], ["Level", (r) =>r.level], ["Date", (r) =>r.date]] },
 { title: "B10. Innovation, Start-ups & Technology Transfer (Max 20)", key: "products", docPfx: "prod",
 columns: [["Title / Start-up / Product", (r) =>r.details || r.title], ["Role", (r) =>r.role || r.usage], ["Status", (r) =>r.status]] },
 { title: "B11. ICT Content, MOOCs & E-Learning (Max 20)", key: "ict", docPfx: "ict",
 columns: [["Title", (r) =>r.title], ["Platform / Type", (r) =>r.type || r.desc], ["Reach / Views", (r) =>r.quad || r.reach]] },
 { title: "B12. Exhibitions - Photography, Design & Applied Arts, Documentaries, Films & Audio-Visual Productions (Max 30)", key: "exhibitions", docPfx: "exh",
 columns: [["Title of Work / Exhibition", (r) =>r.title], ["Type", (r) =>r.type], ["Venue & Level", (r) =>r.venueLevel || r.venue_level || r.level], ["Date", (r) =>r.date]] },
 ].filter(({ key }) => !(key === "exhibitions" && isStandardAppraisalSchool(person?.school || person?.schoolName || person?.info?.school || ""))).map(({ title, key, docPfx, columns }) =>(
<SC key={key} title={title} accent="#7c3aed">
<div style={{ overflowX: "auto" }}><table style={T}><thead>
<tr>
<th style={TH}>SN</th>{columns.map(([label]) =><th key={label} style={TH}>{label}</th>)}<th style={TH}>Docs</th>
 {renderScoreHeaders()}
</tr>
</thead>
<tbody>{sectionEmpty(key) ? emptyRow(2 + columns.length + scoreColumnCount) : sectionRows(key).map((r, i) =>{
 return (
<tr key={i} style={i % 2 ? { background: "#f8fafc" } : {}}>
<td style={TDC}>{i + 1}</td>
 {columns.map(([label, value]) =><td key={label} style={TD}><RO val={value(r)} /></td>)}
<td style={TDV}><ViewDocsCell docKey={`${docPfx}-${i}`} docs={docs} /></td>
 {renderScoreCells(r, key, i)}
</tr>
 );
 })}</tbody></table></div>
</SC>
 ))}
</div>)}
</div>
 );
}


// --- Score Calculator ---------------------------------------------------------
function calcVCScore(person, vcData) {
 const get = (section, idx, field) =>{
 if (vcData[section]) {
 const s = vcData[section];
 return idx === null ? n(Array.isArray(s) ? s[0]?.[field] : s[field]) : n(s[idx]?.[field]);
 }
 const source = person[section];
 return idx === null ? n(Array.isArray(source) ? source[0]?.[field] : source?.[field]) : n(source?.[idx]?.[field]);
 };
  const sectionMax = {
    ...VC_SECTION_MAX,
    proposals: getVcSectionMax("proposals", person),
    products: getVcSectionMax("products", person),
    awards: getVcSectionMax("awards", person),
  };
  const rowMax = { courseFile: () =>SCORE_LIMITS.courseFileRow, obeRows: (row) =>row.max || 20, projects: projectGuidanceRowMax, mentoringRows: (row) =>row.max || 10, quals: () =>SCORE_LIMITS.qualificationRow, feedback: () =>10, society: () =>SCORE_LIMITS.societyRow, acr: () =>SCORE_LIMITS.acrRow, research: researchGuidanceRowMax, fdps: () =>SCORE_LIMITS.fdpRow };
 const sum = (arr, s, f) =>{
 if (s !== "acr" && isSectionEmpty(s, arr, person.docs)) return 0;
 if (s === "lectures" || s === "courseFile" || s === "feedback") {
 const averageRows = (arr || []).map((row, i) =>({
 ...row,
 [f]: vcData[s]?.[i]?.[f] ?? row?.[f] ?? "",
 }));
 return reviewSectionScore(s, averageRows, sectionMax[s] || 0, f);
 }
 return clampScore((arr || []).reduce((a, row, i) =>{
 if (s === "society" && societyRowLocked(row)) return a;
 if (!rowHasReviewableData(s, row)) return a;
 const limit = rowMax[s]?.(row);
 return a + (limit ? clampScore(get(s, i, f), limit) : get(s, i, f));
 }, 0), sectionMax[s] || 0);
 };
 const innovRows = (person.innovRows || []).map((row, index) =>({
 ...row,
 vc: vcData.innovRows?.[index]?.vc ?? row.vc ?? "",
 }));
 const innov = innovRows.length ? reviewSectionScore("innovRows", innovRows, 10, "vc") : clampScore(vcData.innovVc ?? vcData.innovVC ?? person.innovVc, 10);

 const partA = sum(person.lectures, "lectures", "vc") + sum(person.courseFile, "courseFile", "vc") +
 innov + sum(person.feedback, "feedback", "vc") + sum(person.obeRows, "obeRows", "vc") +
 sum(person.projects, "projects", "vc") + sum(person.mentoringRows, "mentoringRows", "vc") +
 sum(person.quals, "quals", "vc");

 const partB = sum(person.journals, "journals", "vc") + sum(person.books, "books", "vc") +
 sum(person.patents, "patents", "vc") + sum(person.projects2, "projects2", "vc") +
 sum(person.research, "research", "vc") + sum(person.proposals, "proposals", "vc") +
 sum(person.confs, "confs", "vc") + sum(person.products, "products", "vc") +
 sum(person.fdps, "fdps", "vc") + sum(person.awards, "awards", "vc") + sum(person.ict, "ict", "vc") +
 sum(person.exhibitions, "exhibitions", "vc");

 const partC = sum(person.uniActs, "uniActs", "vc") + sum(person.deptActs, "deptActs", "vc") +
 sum(person.eventRows, "eventRows", "vc") + sum(person.society, "society", "vc") +
 sum(person.industry, "industry", "vc") + sum(person.alumniRows, "alumniRows", "vc") +
 sum(person.placementRows, "placementRows", "vc");
 const partD = sum(createAcrRows(person.acr), "acr", "vc");

 const partAMax = effectiveMaxScore(150);
 const partBMax = effectiveMaxScore(350);
 const partCMax = 150;
 const partDMax = 50;
 const cappedPartA = clampScore(partA, partAMax);
 const cappedPartB = clampScore(partB, partBMax);
 const cappedPartC = clampScore(partC, partCMax);
 const cappedPartD = clampScore(partD, partDMax);
 return { partA: cappedPartA, partB: cappedPartB, partC: cappedPartC, partD: cappedPartD, total: clampScore(cappedPartA + cappedPartB + cappedPartC + cappedPartD, partAMax + partBMax + partCMax + partDMax) };
}

// --- VC Review Panel ----------------------------------------------------------
function VCReviewPanel({ person, personMode, onBack, onSubmit, readOnly = false }) {
  if (dynamicReviewForm(person)) {
    return (
      <DynamicAuthorityReviewPanel
        subject={person}
        reviewerRole="vc"
        reviewerLabel="Vice Chancellor"
        onBack={onBack}
        onSubmit={(id, scores, remarks, sectionScores, reviewConfirmed, decision) =>
          onSubmit(id, scores, remarks, personMode, sectionScores, reviewConfirmed, decision)
        }
        readOnly={readOnly}
      />
    );
  }
  if (isCreativeSchool(person)) {
    return (
      <CreativeSchoolAuthorityReviewPanel
        person={person}
        reviewerRole="vc"
        onBack={onBack}
        onSubmit={(id, scores, remarks, sectionScores, reviewConfirmed, decision) =>
          onSubmit(id, scores, remarks, personMode, sectionScores, reviewConfirmed, decision)
        }
        readOnly={readOnly}
        showReport={readOnly}
      />
    );
  }
  return (
    <StandardVCReviewPanel
      person={person}
      personMode={personMode}
      onBack={onBack}
      onSubmit={onSubmit}
      readOnly={readOnly}
    />
  );
}

function StandardVCReviewPanel({ person, personMode, onBack, onSubmit, readOnly = false }) {
  const confirmRejection = useReviewFeedback();
  const [vcData, setVcData] = useState({});
  const [remarks, setRemarks] = useState(person.vcRemarks || "");
  const [sectionView, setSectionView] = useState("partA");
 const [reviewConfirmed, setReviewConfirmed] = useState(false);
 const [draftStatus, setDraftStatus] = useState("");
 const [savingDraft, setSavingDraft] = useState(false);
 const finalisedByVc = isAppraisalFinalisedByVc(person);
 const [editingFinalised, setEditingFinalised] = useState(false);
 const finalisedReadOnly = finalisedByVc && !editingFinalised;
 const reviewLocked = (readOnly && !finalisedByVc) || finalisedReadOnly;
 const canReject = canReviewerRejectProfile("vc", person);
 const subjectEmail = person.email || person.faculty_email || person.facultyEmail;
 const academicYear = person.academicYear || person.academic_year || person.info?.ay || APP_INFO.DEFAULT_AY || "2026-2027";

 const calculatedScores = calcVCScore(person, vcData);
 const partA = reviewLocked && n(person.vcPartA) >0 ? n(person.vcPartA) : calculatedScores.partA;
 const partB = reviewLocked && n(person.vcPartB) >0 ? n(person.vcPartB) : calculatedScores.partB;
 const partC = reviewLocked && String(person.vcPartC ?? "").trim() !== "" ? n(person.vcPartC) : calculatedScores.partC;
 const partD = reviewLocked && String(person.vcPartD ?? "").trim() !== "" ? n(person.vcPartD) : calculatedScores.partD;
 const total = reviewLocked && n(person.vcTotal) >0 ? n(person.vcTotal) : calculatedScores.total;
 const selfMaxScores = {
 partA: selfEffectivePartAMax(150),
 partB: effectiveMaxScore(350),
 partC: 150,
 partD: 50,
 grand: 0,
 };
 selfMaxScores.grand = selfMaxScores.partA + selfMaxScores.partB + selfMaxScores.partC + selfMaxScores.partD;
 const reviewerMaxScores = {
 partA: effectiveMaxScore(150),
 partB: selfMaxScores.partB,
 partC: 150,
 partD: 50,
 grand: 0,
 };
 reviewerMaxScores.grand = reviewerMaxScores.partA + reviewerMaxScores.partB + reviewerMaxScores.partC + reviewerMaxScores.partD;
 const g = grade(total, reviewerMaxScores.grand);
 const previousRoles = vcPreviousRolesFor(person, personMode);
 const selfPartA = Math.min(n(person.declaration?.part_a_total ?? person.selfPartA ?? person.partATotal), selfMaxScores.partA);
 const selfPartB = Math.min(n(person.declaration?.part_b_total ?? person.selfPartB ?? person.partBTotal), selfMaxScores.partB);
 const selfPartC = Math.min(n(person.declaration?.part_c_total ?? person.selfPartC ?? person.partCTotal), selfMaxScores.partC);
 const selfPartD = Math.min(n(person.declaration?.part_d_total ?? person.selfPartD ?? person.partDTotal), selfMaxScores.partD);
 const selfTotal = Math.min(vcSelfTotalForPerson(person), selfPartA + selfPartB + selfPartC + selfPartD, selfMaxScores.grand);
 // partD here means Part E/ACR for the reviewer-comparison table below - faculty never scores it.
 const facultyTotals = { partA: selfPartA, partB: selfPartB, partC: selfPartC, partD: 0, total: selfTotal, maxScores: selfMaxScores };
 const reviewerSummaryTotals = { partA, partB, partC, partD, total, maxScores: reviewerMaxScores };
 const roleSummaryTotalsFor = (role) =>{
 const prefix = role === "hod" || role === "center_head" ? "hod" : role;
 const rawTotal = rawVcTotalForRole(person, role);
 return {
 partA: n(person[`${prefix}PartA`]),
 partB: n(person[`${prefix}PartB`]),
 partC: n(person[`${prefix}PartC`]),
 partD: n(person[`${prefix}PartD`]),
 total: n(rawTotal),
 maxScores: reviewerMaxScores,
 hasTotal: hasScoreValue(rawTotal),
 };
 };
 const personSchoolKey = getSchoolKey(person.school || person.schoolName || person.info?.school || "");
 const facultyHasHodReview = personMode === "faculty" && previousRoles.includes("hod");
 const vcSummaryRoles = (() =>{
 const roles = [];
 if (personMode === "faculty") {
 if (previousRoles.includes("center_head")) roles.push("center_head");
 else if (facultyHasHodReview && previousRoles.includes("hod")) roles.push("hod");
 if (previousRoles.includes("director")) roles.push("director");
 if (previousRoles.includes("dean")) roles.push("dean");
 return roles;
 }
 if (personMode === "hod") return ["director", "dean"].filter((role) =>previousRoles.includes(role));
 if (personMode === "director") return previousRoles.includes("dean") ? ["dean"] : [];
 return [];
 })();
 const previousSummaryCards = vcSummaryRoles.map((role) =>{
 const meta = vcRoleMeta(role);
 return {
 role,
 meta,
 totals: roleSummaryTotalsFor(role),
 remarks: person[meta.remarksKey],
 };
 });
 const averageSourceTotals = previousSummaryCards
 .filter((item) =>item.role !== personMode && item.totals.hasTotal)
 .map((item) =>item.totals);
 const averageSummaryTotals = averageSourceTotals.length
 ? {
 partA: averageSourceTotals.reduce((sum, item) =>sum + n(item.partA), 0) / averageSourceTotals.length,
 partB: averageSourceTotals.reduce((sum, item) =>sum + n(item.partB), 0) / averageSourceTotals.length,
 partC: averageSourceTotals.reduce((sum, item) =>sum + n(item.partC), 0) / averageSourceTotals.length,
 partD: averageSourceTotals.reduce((sum, item) =>sum + n(item.partD), 0) / averageSourceTotals.length,
 total: averageSourceTotals.reduce((sum, item) =>sum + n(item.total), 0) / averageSourceTotals.length,
 maxScores: reviewerMaxScores,
 }
 : { partA: 0, partB: 0, partC: 0, partD: 0, total: 0, maxScores: reviewerMaxScores };
 const vcReviewCompleted = !isPendingReviewStatusFor([person.status, person.workflowStatus, person.workflow_status], "vc") && (person.status === "Reviewed" || person.status === "VC Reviewed" || n(person.vcTotal) >0);
 const firstReviewRoleLabel = previousRoles.includes("center_head") ? "Center Head Remarks" : "HOD Remarks";
 const personInfo = mergeFacultyInfo(person.info, person);
 useEffect(() =>{
 let active = true;
 if (reviewLocked || !subjectEmail) return undefined;
 loadReviewerDraft({ subjectEmail, academicYear, reviewerRole: "vc" })
 .then((draft) =>{
 if (!active || !draft?.payload) return;
 setVcData(draft.payload.section_scores || {});
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
 reviewerRole: "vc",
 partAScore: partA,
 partBScore: partB,
 partCScore: partC,
 partDScore: partD,
 totalScore: total,
 remarks,
 sectionScores: buildVcSectionScores(person, vcData),
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

 const generateVcReport = () =>{
 if (!vcReviewCompleted) return;
 const reportForm = {
 ...person,
 info: {
 ...personInfo,
 name: personInfo.name || person.name,
 ay: personInfo.ay || person.academicYear || APP_INFO.DEFAULT_AY,
 desig: personInfo.desig || person.designation || personMode,
 school: personInfo.school || person.schoolName || person.school,
 },
 docs: person.docs || {},
 };
 VC_REVIEW_ARRAY_KEYS.forEach((key) =>{
 const rows = Array.isArray(person[key]) ? person[key] : (person[key] ? [person[key]] : []);
 reportForm[key] = rows.map((row, index) =>({
 ...row,
 vc: key === "society" && societyRowLocked(row)
 ? "0"
 : key === "acr"
 ? (String(vcData[key]?.[index]?.vc ?? row.vc ?? "").trim() ? String(clampScore(vcData[key]?.[index]?.vc ?? row.vc, SCORE_LIMITS.acrRow)) : "")
 : vcData[key]?.[index]?.vc ?? row.vc ?? "",
 }));
 });
 reportForm.innovVc = vcData.innovVc ?? vcData.innovVC ?? person.innovVc ?? "";

 const effectivePartA = reviewLocked && String(person.vcPartA ?? "").trim() !== "" ? n(person.vcPartA) : partA;
 const effectivePartB = reviewLocked && String(person.vcPartB ?? "").trim() !== "" ? n(person.vcPartB) : partB;
 const effectivePartC = reviewLocked && String(person.vcPartC ?? "").trim() !== "" ? n(person.vcPartC) : partC;
 // vcPartD/partD here means Part E/ACR (see comment above) - Leave & Attendance (real Part D) is scored separately by the Registrar.
 const effectivePartE = reviewLocked && String(person.vcPartD ?? "").trim() !== "" ? n(person.vcPartD) : partD;
 const effectiveTotal = reviewLocked && String(person.vcTotal ?? "").trim() !== "" ? n(person.vcTotal) : total;

 const leaveMax = 25;
 const selfLeaveScore = clampScore(n(person.declaration?.part_d_total ?? person.partDTotal ?? person.selfPartD ?? 0), leaveMax);
 const leaveRows = Array.isArray(person.leaveManagement) ? person.leaveManagement : [];
 const extraSectionsHtml = `
 <div class="page-break"></div>
 <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART D - Leave &amp; Attendance Management</h3>
 <div class="remarks" style="margin-bottom:10px">Faculty-submitted data only. Registrar/reviewer assessment for this part has not yet been finalised.</div>
 <table>
 <tr><th>SN</th><th>CL Taken</th><th>ML Taken</th><th>OD Taken</th><th>C/Off Taken</th><th>Late Remarks</th><th>Working Days</th><th>Management of Leaves</th></tr>
 ${leaveRows.length ? leaveRows.map((r, i) => `<tr><td class="c">${i + 1}</td><td class="c">${displayValue(r.clTaken)}</td><td class="c">${displayValue(r.mlTaken)}</td><td class="c">${displayValue(r.odTaken)}</td><td class="c">${displayValue(r.coffTaken)}</td><td class="c">${displayValue(r.lateRemarks)}</td><td class="c">${displayValue(r.workingDays)}</td><td>${displayValue(r.managementRating)}</td></tr>`).join("") : `<tr><td colspan="8" class="c">No data submitted</td></tr>`}
 </table>`;

 const vcValues = { partA: effectivePartA, partB: effectivePartB, partC: effectivePartC, partD: effectivePartE, total: effectiveTotal };
 const valuesFor = (key) => ({
 score: facultyTotals[key],
 ...Object.fromEntries(previousSummaryCards.map((card) => [card.role, card.totals[key]])),
 vc: vcValues[key],
 });
 const summaryHtml = renderCombinedPartsSummary({
 academicYear: person.academicYear || person.info?.ay || APP_INFO.DEFAULT_AY || "",
 roles: [
 { key: "score", label: "Faculty (Self)" },
 ...previousSummaryCards.map((card) => ({ key: card.role, label: card.meta.shortLabel })),
 { key: "vc", label: "VC" },
 ],
 parts: [
 { label: "Part A - Teaching Process & Academic Activities", max: reviewerMaxScores.partA, values: valuesFor("partA") },
 { label: "Part B - Research & Academic Contributions", max: reviewerMaxScores.partB, values: valuesFor("partB") },
 { label: "Part C - Administrative Role & University Development Contribution", max: reviewerMaxScores.partC, values: valuesFor("partC") },
 { label: "Part D - Leave & Attendance Management", max: leaveMax, values: { score: selfLeaveScore } },
 { label: "Part E - Annual Confidential Report (ACR)", max: reviewerMaxScores.partD, values: valuesFor("partD") },
 ],
 grandTotal: { max: reviewerMaxScores.grand, values: valuesFor("total") },
 status: person.status,
 note: "Part D (Leave & Attendance Management) shows faculty-submitted data only - Registrar/reviewer marks are not yet confirmed. Part E (ACR) is evaluated by the review chain and is never self-scored by faculty.",
 });

 openFullFormReport({
 title: "VC Appraisal Report",
 subtitle: `${APP_INFO.UNIVERSITY_NAME} | Academic Year ${person.academicYear || person.info?.ay || APP_INFO.DEFAULT_AY || ""}`,
 form: reportForm,
 docs: reportForm.docs,
 partASections: VC_REPORT_PART_A_SECTIONS,
  partBSections: isStandardAppraisalSchool(person?.school || person?.schoolName || person?.info?.school || "") ? VC_REPORT_PART_B_SECTIONS.filter(s => s.key !== "exhibitions") : VC_REPORT_PART_B_SECTIONS,
 partCSections: VC_REPORT_PART_C_SECTIONS,
 partDSections: VC_REPORT_PART_D_SECTIONS,
 partDLabel: "E",
 partDTitle: "Annual Confidential Report (ACR)",
 extraSectionsHtml,
 totals: {
 partA: effectivePartA,
 partB: effectivePartB,
 partC: effectivePartC,
 partD: effectivePartE,
 total: effectiveTotal,
 },
 maxScores: reviewerMaxScores,
 scoreRoles: ["score", ...previousRoles, "vc"],
 roleLabel: (value) =>value === "vc" ? "VC" : vcRoleMeta(value).shortLabel || value,
 status: person.status,
 remarksSections: buildReviewRemarks({
 source: person,
 currentRole: "vc",
 currentRemarks: remarks,
 roleLabels: { hod: firstReviewRoleLabel },
 }),
 summaryHtml,
 generatedBy: sessionStorage.getItem("name") || "Vice Chancellor",
 });
 };

 const scoreCards = [
 { label: personMode === "faculty" ? "Faculty Score" : "Self Score", val: selfTotal, color: "#e2e8f0" },
 ...previousRoles.map((role) =>{
 const meta = vcRoleMeta(role);
 return { label: meta.label, val: vcTotalForRole(person, role), color: meta.color };
 }),
 ...(personMode === "dean" ? [] : [{ label: "Average Score", val: vcAverageBeforeVc(person, personMode, previousRoles), color: "#f59e0b" }]),
 ];
 const showAverageColumn = personMode !== "dean" && personMode !== "center_head";
 const vcComparisonColumns = [
 { key: "self", label: "Self", totals: facultyTotals, maxScores: facultyTotals.maxScores },
 ...previousSummaryCards.map(({ role, meta, totals }) =>({ key: role, label: meta.shortLabel, totals, maxScores: totals.maxScores })),
 ...(showAverageColumn ? [{ key: "average", label: "Average", totals: averageSummaryTotals, maxScores: averageSummaryTotals.maxScores }] : []),
 { key: "vc", label: "VC", totals: reviewerSummaryTotals, maxScores: reviewerSummaryTotals.maxScores, final: true },
 ];
 const vcComparisonRows = [
 { key: "partA", label: "Part A - Teaching & Learning", icon: "A" },
 { key: "partB", label: "Part B - Research & Innovation", icon: "B" },
 { key: "partC", label: "Part C - Administrative Contribution", icon: "C" },
 { key: "partD", label: "Part E - Annual Confidential Report", icon: "E" },
 { key: "total", label: "Grand Total", icon: "Σ" },
 ];
 const vcPartColors = { partA: "#6d5dfc", partB: "#0f9f9a", partC: "#ef6f61", partD: "#f59e0b", total: "#059669" };
 const compactReferenceCards = ["faculty", "director", "dean"].includes(personMode);
 const vcSummaryCards = [
 {
 key: "self",
 title: personMode === "faculty" ? "Self Score" : "Self Score",
 subtitle: "Self score for the engineering appraisal form.",
 totals: facultyTotals,
 maxScores: facultyTotals.maxScores,
 accent: "#0ea5e9",
 compact: compactReferenceCards,
 extraContent: <SummaryOtherInfoField value={summaryOtherInfoValueFrom(person)} readOnly rows={compactReferenceCards ? 2 : 4} />,
 },
 ...previousSummaryCards.map(({ role, meta, totals, remarks: roleRemarks }) =>({
 key: role,
 title: `${meta.shortLabel} Score`,
 subtitle: `${meta.shortLabel} score for the engineering appraisal form.`,
 totals,
 maxScores: totals.maxScores,
 accent: meta.remarksColor || meta.color,
 compact: compactReferenceCards,
 remarksTitle: `${meta.shortLabel} Remarks`,
 remarksContent: <div style={{ color: "#334155", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{String(roleRemarks || "").trim() || "-"}</div>,
 })),
 ...(showAverageColumn ? [{
 key: "average",
 title: "Average Score",
 subtitle: "Average across all reviewers.",
 totals: averageSummaryTotals,
 maxScores: averageSummaryTotals.maxScores,
 accent: "#f59e0b",
 partsLayout: personMode === "dean" ? "vertical" : "horizontal",
 compact: personMode === "dean",
 cardStyle: personMode === "dean" ? undefined : { gridColumn: "1 / -1" },
 }] : []),
 {
 key: "vc",
 title: "Vice Chancellor Score",
 subtitle: "Vice Chancellor final score.",
 totals: reviewerSummaryTotals,
 maxScores: reviewerSummaryTotals.maxScores,
 accent: "#7c3aed",
 isFinal: true,
 cardStyle: personMode === "dean" ? undefined : { gridColumn: "1 / -1" },
 sideContent: (
 <div style={{ background: "#f5f3ff", border: "2px solid #c4b5fd", borderRadius: 10, padding: "14px 15px", display: "grid", gap: 9, alignContent: "start", boxShadow: "0 0 0 4px rgba(196,181,253,0.18), 0 14px 28px rgba(124,58,237,0.10)" }}>
 <div>
 <div style={{ color: "#6d28d9", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5 }}>Vice Chancellor Remarks</div>
 <div style={{ color: "#5b21b6", fontSize: 11, fontWeight: 700, marginTop: 3 }}>Enter your assessment remarks and confirm before submitting</div>
 </div>
 <textarea value={remarks} readOnly={reviewLocked} onChange={e =>setRemarks(e.target.value)} rows={7}
 placeholder="Enter your remarks here..."
 style={{ width: "100%", height: 235, minHeight: 235, boxSizing: "border-box", border: "1px solid #c4b5fd", borderRadius: 10, padding: "10px 11px", fontFamily: "inherit", fontSize: 12, resize: "none", background: reviewLocked ? "#f8fafc" : "#fff", color: "#1e293b", outline: "none", lineHeight: 1.5 }} />
 </div>
 ),
 },
 ];
 const splitDirectorSummaryRows = personMode === "director";
 const splitDeanSummaryRows = personMode === "dean";
 const useFacultyRecordCard = ["faculty", "hod", "dean", "director", "center_head"].includes(personMode);
 const recordSchoolTrack = useFacultyRecordCard ? getDeanTrack({ school: person.school || person.info?.school, department: person.department, designation: person.designation }) : "";
 const recordSchoolGroupLabel = { engineering: "Engineering", non_engineering: "Non-Engineering", cisr: "CISR" }[recordSchoolTrack] || person.school || person.info?.school || APP_INFO.UNIVERSITY_NAME;
 const recordScoreRows = useFacultyRecordCard ? [
 { key: "self", label: "Self", icon: "user", values: facultyTotals, note: summaryOtherInfoValueFrom(person) },
 ...previousSummaryCards.map((card) => ({ key: card.role, label: card.meta.shortLabel, icon: "briefcase", values: card.totals, note: card.remarks })),
 ...(showAverageColumn ? [{ key: "average", label: "Average", icon: "chart", values: averageSummaryTotals }] : []),
 { key: "vc", label: "Vice Chancellor", icon: "crown", values: reviewerSummaryTotals, accent: true },
 ] : [];
 const splitReferenceCards = splitDirectorSummaryRows
 ? vcSummaryCards.filter((card) =>["self", "dean"].includes(card.key))
 : splitDeanSummaryRows
 ? vcSummaryCards.filter((card) =>["self", "vc"].includes(card.key))
 : [];
 const splitRemainingCards = splitDirectorSummaryRows
 ? vcSummaryCards.filter((card) =>!["self", "dean"].includes(card.key))
 : splitDeanSummaryRows
 ? vcSummaryCards.filter((card) =>!["self", "vc"].includes(card.key))
 : vcSummaryCards;

 return (
<div style={{ display: "flex", flexDirection: "column" }}>

 <ReviewerReportHeader reviewerLabel="Vice Chancellor" readOnly={reviewLocked} onBack={onBack}>
  <div className="vc-review-header__scores" aria-label="Appraisal review scores">
    {scoreCards.map(({ label, val, color }) => (
      <div key={label} className="vc-review-header__metric" style={{ "--metric-accent": color === "#e2e8f0" ? "#64748b" : color }}>
        <span className="vc-review-header__label">{label}</span>
        <strong>{oneDecimal(val)}</strong>
      </div>
    ))}
    <section className="vc-review-header__assessment" aria-label="VC assessment breakdown">
      <h3><ClipboardCheck size={13} aria-hidden="true" />VC Assessment</h3>
      <dl className="vc-review-header__breakdown">
        {[
          ["Part A", partA],
          ["Part B", partB],
          ["Part C", partC],
          ["Part E", partD],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value.toFixed(1)}</dd>
          </div>
        ))}
      </dl>
    </section>
    <div className="vc-review-header__metric vc-review-header__metric--total" style={{ "--metric-accent": g.color, background: g.bg, borderColor: `${g.color}40` }}>
      <span className="vc-review-header__label">VC Total</span>
      <strong>{total.toFixed(1)}<small>/{reviewerMaxScores.grand}</small></strong>
    </div>
  </div>
 </ReviewerReportHeader>

 {/* Section switcher */}
<div className="vc-review-navigation">
<nav className="vc-review-navigation__sections reviewer-report-tabs" aria-label="Appraisal review sections">
 {[["partA", "Part A"], ["partB", "Part B"], ["partC", "Part C"], ["partD", "Part D"], ["partE", "Part E"], ["summary", "Summary"]].map(([id, label]) =>(
<button type="button" key={id} onClick={() =>{ setSectionView(id); requestAnimationFrame(() =>{ window.scrollTo({ top: 0, left: 0, behavior: "auto" }); }); }}
 className={`vc-review-navigation__section${sectionView === id ? " is-active" : ""}`} aria-current={sectionView === id ? "step" : undefined}>
 {label}
</button>
 ))}
</nav>
 {finalisedReadOnly && (
<button onClick={() =>{ setEditingFinalised(true); setReviewConfirmed(false); }}
 style={{ padding: "10px 28px", background: "#4c1d95", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit", marginLeft: "auto", whiteSpace: "nowrap" }}>
 Edit Form
</button>
 )}
</div>

 {["partA", "partB", "partC", "partD", "partE"].includes(sectionView) && (
<fieldset disabled={reviewLocked || sectionView === "partD"} style={{ border: "none", padding: 0, margin: 0 }}>
<VCReviewForm person={person} vcData={vcData} setVcData={setVcData} personMode={personMode} sectionView={sectionView} />
</fieldset>
 )}
 {["partA", "partB", "partC", "partE"].includes(sectionView) && !reviewLocked && (
<div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, margin: "12px 0 14px", flexWrap: "wrap" }}>
<span style={{ color: "#64748b", fontSize: 11, fontWeight: 700 }}>{draftStatus}</span>
<button type="button" onClick={handleSaveDraft} disabled={savingDraft}
 style={{ padding: "8px 14px", background: "#fff", color: savingDraft ? "#94a3b8" : "#2563eb", border: "1.5px solid #2563eb", borderRadius: 7, cursor: savingDraft ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 12, fontFamily: "inherit" }}>
 {savingDraft ? "Saving..." : "Save as Draft"}
</button>
<button type="button" onClick={handleSaveAndNext} disabled={savingDraft}
 style={{ padding: "8px 14px", background: savingDraft ? "#94a3b8" : "#2563eb", color: "#fff", border: "none", borderRadius: 7, cursor: savingDraft ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 12, fontFamily: "inherit" }}>
 {savingDraft ? "Saving..." : "Save & Next"}
</button>
</div>
 )}

 {sectionView === "partD" && (
<div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, margin: "12px 0 14px", flexWrap: "wrap" }}>
<button type="button" onClick={handleNextSection}
 style={{ padding: "8px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 800, fontSize: 12, fontFamily: "inherit" }}>
 Next
</button>
</div>
 )}

 {/* Summary */}
 {sectionView === "summary" && (
<div style={{ display: "grid", gap: 14 }}>

{useFacultyRecordCard ? (
<div className="far-wrap" style={{ width: "100%" }}>
<div className="far-card" style={{ width: "100%", boxSizing: "border-box", background: FACULTY_RECORD_THEME.card, border: `1px solid ${FACULTY_RECORD_THEME.borderStrong}`, borderRadius: 16, padding: "22px 24px", display: "grid", gap: 18, boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
<FacultyRecordHeader
 title="Faculty appraisal record"
 subtitle={`${APP_INFO.UNIVERSITY_NAME} · ${recordSchoolGroupLabel} · AY ${academicYear}`}
 referenceNumber={person.employeeId}
/>
<ScoreTable
 columns={[
 { key: "partA", label: "Part A", max: MAX_SCORES.PART_A },
 { key: "partB", label: "Part B", max: MAX_SCORES.PART_B },
 { key: "partC", label: "Part C", max: MAX_SCORES.PART_C },
 { key: "partD", label: "Part E", max: MAX_SCORES.PART_E },
 { key: "total", label: "Total", max: MAX_SCORES.GRAND_TOTAL },
 ]}
 rows={recordScoreRows}
/>
<VCFinalRemarks
 value={remarks}
 onChange={setRemarks}
 readOnly={reviewLocked}
 description="This statement is entered against the official appraisal record before final submission."
/>
{!reviewLocked && (
<label style={{ display: "flex", alignItems: "flex-start", gap: 9, color: FACULTY_RECORD_THEME.textMuted, fontSize: 11, lineHeight: 1.5, cursor: "pointer" }}>
<input type="checkbox" checked={reviewConfirmed} onChange={e =>setReviewConfirmed(e.target.checked)} style={{ marginTop: 2, accentColor: FACULTY_RECORD_THEME.accent, flexShrink: 0 }} />
<span>I have verified all the details and confirm that the information provided is correct. I am responsible for the accuracy of this data.</span>
</label>
)}
{!reviewLocked && (
<FinalSubmitButton
 disabled={!reviewConfirmed || !remarks.trim()}
 onClick={() =>onSubmit(person.id, { partA, partB, partC, partD, total }, remarks, personMode, buildVcSectionScores(person, vcData), reviewConfirmed)}
>
 {finalisedByVc ? "Edit & Resubmit" : "Confirm and submit final score"}
</FinalSubmitButton>
)}
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: `1px solid ${FACULTY_RECORD_THEME.border}`, paddingTop: 14 }}>
<span style={{ color: FACULTY_RECORD_THEME.textFaint, fontSize: 10.5, fontStyle: "italic" }}>{draftStatus}</span>
<div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginLeft: "auto" }}>
<button onClick={onBack} style={{ padding: "8px 14px", background: "transparent", color: FACULTY_RECORD_THEME.textMuted, border: `1px solid ${FACULTY_RECORD_THEME.border}`, borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 11.5, fontFamily: "inherit" }}>Close</button>
{vcReviewCompleted && (
<button onClick={generateVcReport} style={{ padding: "8px 14px", background: "transparent", color: FACULTY_RECORD_THEME.accentSoft, border: "1px solid rgba(124,58,237,0.35)", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 11.5, fontFamily: "inherit" }}>Generate Report</button>
)}
{!reviewLocked && (
<>
<button onClick={handleSaveDraft} disabled={savingDraft} style={{ padding: "8px 14px", background: "transparent", color: savingDraft ? FACULTY_RECORD_THEME.textFaint : "#2563eb", border: `1px solid ${savingDraft ? FACULTY_RECORD_THEME.border : "#bfdbfe"}`, borderRadius: 8, cursor: savingDraft ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 11.5, fontFamily: "inherit" }}>
 {savingDraft ? "Saving..." : "Save Draft"}
</button>
{canReject && (
<button onClick={async () =>{ if (await confirmRejection("Reject this appraisal and send it back to the user for editing?", "reject")) { onSubmit(person.id, { partA, partB, partC, partD, total }, remarks, personMode, buildVcSectionScores(person, vcData), reviewConfirmed, "rejected"); } }}
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
) : (
<>
{splitDeanSummaryRows ? (
<>
<div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 0.68fr) minmax(640px, 1.32fr)", gap: 16, width: "100%" }}>
{splitReferenceCards.map((card) =>(
<ScoreCard key={card.key} {...card} cardStyle={{ ...(card.cardStyle || {}), width: "100%", minWidth: 0 }} />
))}
</div>
<div style={{ display: "grid", gap: 16, width: "100%" }}>
{splitRemainingCards.map((card) =>(
<ScoreCard key={card.key} {...card} />
))}
</div>
</>
) : (
<div
 className={`vc-summary-card-grid ${facultyHasHodReview ? "vc-summary-card-grid--soemr-faculty" : ""} ${personMode === "dean" ? "vc-summary-card-grid--dean" : ""}`}
 style={{ display: "grid", gap: 16, gridTemplateColumns: (personMode === "dean" || facultyHasHodReview) ? "repeat(2, minmax(330px, 1fr))" : undefined }}
>
{vcSummaryCards.map((card) =>(
<ScoreCard key={card.key} {...card} />
))}
</div>
)}

 {/* VC Actions */}
<div style={{ display: "grid", gap: 10 }}>
 {!reviewLocked && (
<label className="appraisal-confirmation-card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, color: "#334155", fontSize: 12, lineHeight: 1.5, cursor: "pointer" }}>
<input type="checkbox" checked={reviewConfirmed} onChange={e =>setReviewConfirmed(e.target.checked)} style={{ margin: 0, accentColor: "#16a34a", flexShrink: 0 }} />
<span>I have verified all the details and confirm that the information provided is correct. I am responsible for the accuracy of this data.</span>
</label>
 )}
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
<span style={{ color: "#64748b", fontSize: 11, fontStyle: "italic" }}>{draftStatus}</span>
<div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", marginLeft: "auto" }}>
<button onClick={onBack} style={{ padding: "9px 16px", background: "#fff", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit" }}>Close</button>
{vcReviewCompleted && (
<button onClick={generateVcReport}
 style={{ minWidth: 170, height: 42, padding: "0 20px", background: "linear-gradient(135deg,#7c3aed,#581c87)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 900, fontSize: 13, fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, boxShadow: "0 10px 20px rgba(88,28,135,0.20)" }}>
 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
  <path d="M7 3h7l4 4v14H7V3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  <path d="M14 3v5h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
 </svg>
 <span>Generate Report</span>
</button>
)}
 {!reviewLocked && (
<>
<button onClick={handleSaveDraft} disabled={savingDraft}
 style={{ padding: "9px 16px", background: savingDraft ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg,#1d4ed8,#3b82f6)", color: "#fff", border: "none", borderRadius: 9, cursor: savingDraft ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit", boxShadow: savingDraft ? "none" : "0 3px 12px rgba(37,99,235,0.4)" }}>
 {savingDraft ? "Saving..." : "Save Draft"}
</button>
 {canReject && (
<button onClick={async () =>{ if (await confirmRejection("Reject this appraisal and send it back to the user for editing?", "reject")) { onSubmit(person.id, { partA, partB, partC, partD, total }, remarks, personMode, buildVcSectionScores(person, vcData), reviewConfirmed, "rejected"); } }}
 disabled={!reviewConfirmed || !remarks.trim()}
 style={{ padding: "9px 16px", background: (reviewConfirmed && remarks.trim()) ? "linear-gradient(135deg,#b91c1c,#ef4444)" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 9, cursor: (reviewConfirmed && remarks.trim()) ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12, fontFamily: "inherit", boxShadow: (reviewConfirmed && remarks.trim()) ? "0 3px 12px rgba(185,28,28,0.4)" : "none" }}>
 Reject Form
</button>
 )}
<button onClick={() =>onSubmit(person.id, { partA, partB, partC, partD, total }, remarks, personMode, buildVcSectionScores(person, vcData), reviewConfirmed)}
 disabled={!reviewConfirmed || !remarks.trim()}
 style={{ padding: "9px 22px", background: (reviewConfirmed && remarks.trim()) ? "linear-gradient(135deg,#047857,#10b981)" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 9, cursor: (reviewConfirmed && remarks.trim()) ? "pointer" : "not-allowed", fontWeight: 900, fontSize: 12, fontFamily: "inherit", letterSpacing: 0.2, boxShadow: (reviewConfirmed && remarks.trim()) ? "0 4px 16px rgba(4,120,87,0.5)" : "none" }}>
 {finalisedByVc ? "Edit & Resubmit" : "Submit VC Review"}
</button>
</>
)}
</div>
</div>
</div>
</>
)}

</div>
 )}
</div>
 );
}


// --- Person Card --------------------------------------------------------------
function PersonCard({ person, role, onReview, schoolColor, showHodMetric = true, loading = false }) {
 const personMode = role === "Director" ? "director" : role === "HOD" ? "hod" : role === "Dean" ? "dean" : role === "Center Head" ? "center_head" : "faculty";
 const previousRoles = vcPreviousRolesFor(person, personMode).filter((reviewRole) => reviewRole !== "hod" || showHodMetric);
 const vcTotal = n(person.vcTotal);
 const academicYear = person.academicYear || person.academic_year || person.info?.ay;
 const legacyTwoPartCard = isLegacyTwoPartAcademicYear(academicYear);
 const scoreGrandMax = legacyTwoPartCard ? 575 : MAX_SCORES.GRAND_TOTAL;
 const scoreTiles = [
 {
 label: personMode === "faculty" ? "Faculty Score" : "Self Score",
 value: vcSelfTotalForPerson(person),
 color: "#0ea5e9",
 },
 ...previousRoles.map((reviewRole) =>{
 const meta = vcRoleMeta(reviewRole);
 return { label: meta.shortLabel, value: vcTotalForRole(person, reviewRole), color: meta.color };
 }),
 ...(personMode === "dean" ? [] : [{ label: "Average Score", value: vcAverageBeforeVc(person, personMode, previousRoles), color: "#f59e0b" }]),
 { label: "VC Score", value: vcTotal, color: "#7c3aed", isVc: true },
 ];
 const remarkTiles = previousRoles
 .map((reviewRole) =>{
 const meta = vcRoleMeta(reviewRole);
 return { label: meta.shortLabel, value: person[meta.remarksKey], color: meta.remarksColor, bg: meta.remarksBg, border: meta.color };
 })
 .filter((item) =>item.value);

 const averageTile = scoreTiles.find((tile) =>tile.label === "Average Score");
 const gradeBasisLabel = averageTile ? "Average" : (personMode === "faculty" ? "Faculty" : "Self");
 const gradeBasisValue = averageTile ? n(averageTile.value) : n(vcSelfTotalForPerson(person));
 const gradeBasisPercent = scoreGrandMax >0 ? (gradeBasisValue / scoreGrandMax) * 100 : 0;
 const gradeInfo = gradeForPercent(gradeBasisPercent);

 const ROLE_PALETTE = {
 Dean:          { color: "#059669", light: "#d1fae5", label: "Dean"        },
 Director:      { color: "#2563eb", light: "#dbeafe", label: "Director"    },
 HOD:           { color: "#7c3aed", light: "#ede9fe", label: "HOD"         },
 "Center Head": { color: "#0f766e", light: "#ccfbf1", label: "Center Head" },
 Faculty:       { color: "#0ea5e9", light: "#e0f2fe", label: "Faculty"     },
 };
 const rolePalette = ROLE_PALETTE[role] || { color: schoolColor || "#7c3aed", light: "#f3e8ff", label: role };
 const cardColor = rolePalette.color;
 return (
<div className="vc-review-card fa-fade-up" style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 16px rgba(15,23,42,0.06)", border: "1px solid #eef1f6", display: "flex", flexDirection: "column", overflow: "hidden", transition: "transform .16s ease, box-shadow .16s ease" }}>
<div style={{ padding: "18px 18px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
 {/* Header row - name & role are the largest, boldest, highest-contrast elements on the
     card on purpose; everything else (grade, scores, remarks) is deliberately quieter so the
     eye lands here first. */}
<div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
<span style={{ borderRadius: 999, padding: 2, background: `linear-gradient(135deg,${cardColor}55,${cardColor})`, flexShrink: 0, display: "inline-flex" }}>
<Avatar initials={person.avatar} src={person.avatarUrl} color={person.avatarColor || cardColor} size={48} />
</span>
<div style={{ flex: 1, minWidth: 0 }}>
<div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
<span style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", letterSpacing: -0.2 }}>{person.name}</span>
<RoleBadge role={role} />
</div>
<div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{person.designation}</div>
<div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace", marginTop: 2 }}>{person.employeeId}</div>
</div>
<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
<StatusBadge status={person.status} />
<div title={`${gradeBasisLabel} score: ${gradeBasisPercent.toFixed(2)}%`} style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", background: "#f8fafc", border: "1px solid #eef1f6", borderRadius: 999, padding: "3px 9px 3px 3px" }}>
<span style={{ width: 18, height: 18, borderRadius: "50%", background: gradeInfo.color, color: "#fff", fontSize: 9, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{gradeInfo.label}</span>
<span style={{ fontSize: 10.5, fontWeight: 800, color: "#475569" }}>{gradeBasisPercent.toFixed(1)}%</span>
</div>
</div>
</div>

<ReviewMetricsStrip
 includeDocs={false}
 metrics={scoreTiles.map((tile) => ({
   label: tile.label,
   val: n(tile.value),
   max: n(tile.value) > 0 || tile.isVc ? scoreGrandMax : undefined,
   displayValue: n(tile.value) > 0 ? n(tile.value).toFixed(1) : "-",
   showProgress: n(tile.value) > 0 || tile.isVc,
   helper: " ",
 }))}
/>

 {remarkTiles.length >0 && (
<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
 {remarkTiles.map((item) =>(
<div key={item.label} style={{ background: "#fbfcfd", border: "1px solid #f1f5f9", borderRadius: 9, padding: "8px 11px", fontSize: 11, color: "#475569", lineHeight: 1.45 }}>
<span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 800, color: "#334155", marginRight: 5 }}>
<span style={{ width: 5, height: 5, borderRadius: 999, background: cardColor, flexShrink: 0, display: "inline-block" }} />
{item.label}:
</span>{item.value.slice(0, 55)}{item.value.length >55 ? "..." : ""}
</div>
 ))}
</div>
 )}

<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
<div style={{ fontSize: 9.5, color: "#94a3b8", letterSpacing: 0.2, fontWeight: 600 }}>Submitted: {person.submittedOn || "-"}</div>
<button className="vc-action-button" onClick={() =>onReview(person, personMode)} disabled={loading}
 style={{ fontSize: 11.5, padding: "8px 18px", background: loading ? "#94a3b8" : isVcReviewed(person) ? "#ecfdf5" : "#0f172a", color: loading ? "#fff" : isVcReviewed(person) ? "#047857" : "#fff", border: !loading && isVcReviewed(person) ? "1px solid #a7f3d0" : "none", borderRadius: 9, cursor: loading ? "wait" : "pointer", fontWeight: 800, fontFamily: "inherit", letterSpacing: 0.2, boxShadow: loading ? "none" : isVcReviewed(person) ? "0 2px 8px rgba(5,150,105,0.12)" : "0 6px 14px rgba(15,23,42,0.22)", transition: "filter .15s, transform .15s" }}>
 {loading ? "Opening..." : isVcReviewed(person) ? "View Review" : "Review Form"}
</button>
</div>
</div>
</div>
 );
}

// --- School Panel -------------------------------------------------------------
function SchoolPanel({ school, deanList, dirList, hodList, centerHeadList = [], facList, onReview, reviewLoading = null }) {
 const schoolDeans = deanList.filter(d =>d.schoolId === school.id);
 const schoolDirs = dirList.filter(d =>d.schoolId === school.id);
 const schoolHods = hodList.filter(h =>h.schoolId === school.id);
 const schoolCenterHeads = centerHeadList.filter(c =>c.schoolId === school.id);
 const schoolFaculty = facList.filter(f =>f.schoolId === school.id);

 const allPeople = [
 ...schoolDeans.map(p =>({ person: p, role: "Dean" })),
 ...schoolDirs.map(p =>({ person: p, role: "Director" })),
 ...(school.hasHods ? schoolHods.map(p =>({ person: p, role: "HOD" })) : []),
 ...schoolCenterHeads.map(p =>({ person: p, role: "Center Head" })),
 ...schoolFaculty.map(p =>({ person: p, role: "Faculty" })),
 ];

 const pendingCount = allPeople.filter(p =>!isVcReviewed(p.person)).length;
 const reviewedCount = allPeople.filter(p =>isVcReviewed(p.person)).length;

 return (
<div className="vc-school-panel">
 {/* School banner */}
<div className="vc-school-summary fa-slide-top" style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", marginBottom: 16, borderLeft: `5px solid ${school.color}`, display: "flex", alignItems: "center", gap: 14 }}>
<div className="vc-school-icon" style={{ width: 48, height: 48, borderRadius: 10, background: `linear-gradient(135deg,${school.color}22,${school.color}11)`, color: school.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 900, flexShrink: 0, border: `1.5px solid ${school.color}30` }}>
 {school.icon}
</div>
<div style={{ flex: 1, minWidth: 0 }}>
<div style={{ fontWeight: 900, fontSize: 17, color: "#0f172a", letterSpacing: -0.3 }}>{school.name}</div>
<div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{school.code} - {allPeople.length} member{allPeople.length !== 1 ? "s" : ""}</div>
</div>
<div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
 {pendingCount >0 && (
<div className="vc-count-pill vc-count-pill--pending" style={{ padding: "5px 13px", fontSize: 11, fontWeight: 800 }}>{pendingCount} Pending</div>
 )}
 {reviewedCount >0 && (
<div className="vc-count-pill" style={{ background: "#fdf4ff", color: "#6b21a8", border: "1px solid #e9d5ff", borderRadius: 999, padding: "5px 13px", fontSize: 11, fontWeight: 800 }}>{reviewedCount} Reviewed</div>
 )}
 {school.hasHods && (
<div className="vc-count-pill" style={{ background: "#ede9fe", color: "#6d28d9", border: "1px solid #ddd6fe", borderRadius: 999, padding: "5px 10px", fontSize: 10, fontWeight: 700 }}>Has HODs</div>
 )}
</div>
</div>

 {allPeople.length === 0 ? (
<div className="vc-empty-state fa-fade-up" style={{ textAlign: "center", padding: "44px 20px" }}>
<div className="vc-empty-orb" style={{ width: 48, height: 48, borderRadius: 10, margin: "0 auto 14px", background: `${school.color}15`, color: school.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, border: `1.5px dashed ${school.color}44` }}>{school.code}</div>
<div style={{ fontWeight: 800, color: "#475569", fontSize: 14 }}>No submissions yet</div>
<div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>New appraisal forms will appear here automatically.</div>
</div>
 ) : (
<div className="vc-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
 {allPeople.map(({ person, role }) =>(
 <PersonCard key={`${role}-${person.id}`} person={person} role={role} onReview={onReview} schoolColor={school.color} showHodMetric={school.hasHods} loading={reviewLoading === (person.id || person.email)} />
 ))}
</div>
 )}
</div>
 );
}
// --- University Structure -----------------------------------------------------
// --- Main VC Dashboard --------------------------------------------------------
function NonTeachingCard({ item, onReview }) {
  const reviewed = isNonTeachingReviewComplete(item);
  const cardColor = "#1d4ed8";
  const flow = nonTeachingReviewFlow(item);
  const hasRo = flow.includes("ro");
  const hasRegistrar = flow.includes("registrar");
  // Same percentage-to-letter grade bands used on the Faculty review cards - based on the
  // VC score once reviewed, otherwise the staff member's own self-claimed score out of 130.
  const gradeBasisLabel = reviewed ? "VC" : "Self";
  const gradeBasisValue = reviewed ? n(item.vcTotal) : n(item.selfTotal);
  const gradeBasisPercent = (gradeBasisValue / 130) * 100;
  const gradeInfo = gradeForPercent(gradeBasisPercent);

  const scoreColumns = [
    ["Self", item.selfTotal, "#1d4ed8"],
    ...(hasRo ? [["RO", item.roTotal, "#0891b2"]] : []),
    ...(hasRegistrar ? [["Registrar", item.registrarTotal, "#155e75"]] : []),
    ["VC", item.vcTotal, "#6d28d9"],
  ];
  return (
    <div className="vc-review-card fa-fade-up" style={{ background: "#fff", borderRadius: 10, boxShadow: "0 2px 10px rgba(15,23,42,0.07)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: 4, background: `linear-gradient(90deg,${cardColor},#0ea5e9)`, flexShrink: 0 }} />

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Avatar initials={item.avatar} src={item.avatarUrl} color={item.avatarColor || cardColor} size={54} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{item.name}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{item.roleLabel} - {item.designation}</div>
            <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace", marginTop: 1 }}>{item.employeeId}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            {reviewed && <span style={{ fontSize: 9, fontWeight: 800, background: "#fdf4ff", color: "#6b21a8", border: "1px solid #e9d5ff", borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>VC Reviewed</span>}
            <div title={`${gradeBasisLabel} score: ${gradeBasisPercent.toFixed(2)}%`} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${gradeInfo.color}12`, border: `1px solid ${gradeInfo.color}45`, borderRadius: 999, padding: "4px 12px 4px 4px", whiteSpace: "nowrap" }}>
              <span style={{ width: 26, height: 26, borderRadius: "50%", background: gradeInfo.color, color: "#fff", fontSize: 12, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{gradeInfo.label}</span>
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                <span style={{ fontSize: 8.5, fontWeight: 800, color: gradeInfo.color, textTransform: "uppercase", letterSpacing: 0.4 }}>Grade</span>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#1e293b" }}>{gradeBasisPercent.toFixed(2)}% {gradeBasisLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="vc-score-strip" style={{ display: "grid", gridTemplateColumns: `repeat(${scoreColumns.length}, minmax(0, 1fr))`, gap: 6, background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
          {scoreColumns.map(([label, value, color]) => (
            <div key={label} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 900, color, lineHeight: 1 }}>{n(value).toFixed(1)}<span style={{ fontSize: 8, color: "#cbd5e1", fontWeight: 600 }}>/ 130</span></div>
              <ScoreBar score={value} max={130} color={color} />
            </div>
          ))}
        </div>

        {((hasRo && item.form?.roRemarks) || (hasRegistrar && item.form?.registrarRemarks)) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {hasRo && item.form?.roRemarks && (
              <div style={{ background: "#eff6ff", borderLeft: "3px solid #1d4ed8", borderRadius: 8, padding: "6px 10px", color: "#1e40af", fontSize: 10 }}>
                <span style={{ fontWeight: 800 }}>RO:</span>{" "}{item.form.roRemarks.slice(0, 70)}{item.form.roRemarks.length > 70 ? "..." : ""}
              </div>
            )}
            {hasRegistrar && item.form?.registrarRemarks && (
              <div style={{ background: "#ecfeff", borderLeft: "3px solid #155e75", borderRadius: 8, padding: "6px 10px", color: "#155e75", fontSize: 10 }}>
                <span style={{ fontWeight: 800 }}>Registrar:</span>{" "}{item.form.registrarRemarks.slice(0, 70)}{item.form.registrarRemarks.length > 70 ? "..." : ""}
              </div>
            )}
          </div>
        )}

<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
<div style={{ fontSize: 9, color: "#94a3b8" }}>Submitted: {item.submittedOn || "-"}</div>
<button className="vc-action-button" type="button" onClick={() =>onReview(item)} style={{ fontSize: 11, padding: "7px 16px", background: reviewed ? "#ecfdf5" : "#0f172a", color: reviewed ? "#047857" : "#fff", border: reviewed ? "1px solid #a7f3d0" : "none", borderRadius: 8, cursor: "pointer", fontWeight: 800, fontFamily: "inherit", boxShadow: reviewed ? "0 2px 8px rgba(5,150,105,0.12)" : "0 6px 14px rgba(15,23,42,0.22)" }}>
 {reviewed ? "View Review" : "Review Form"}
</button>
</div>
</div>
</div>
 );
}

const nonTeachingItemKey = (item = {}) =>
 item.id || item.email || item.staff_email || item.form?.info?.email || item.staffEmail;

const upsertNonTeachingItem = (items = [], nextItem = {}) =>{
 const nextKey = nonTeachingItemKey(nextItem);
 if (!nextKey) return [nextItem, ...items];
 const withoutExisting = items.filter((item) =>nonTeachingItemKey(item) !== nextKey);
 return [nextItem, ...withoutExisting];
};

function NonTeachingPanel({ pendingItems = [], reviewedItems = [], onReview }) {
 const pending = pendingItems.length;
 const reviewed = reviewedItems.length;
 const renderCards = (items) =>(
<div className="vc-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
 {items.map((item) =><NonTeachingCard key={nonTeachingItemKey(item)} item={item} onReview={onReview} />)}
</div>
 );

 return (
<div className="vc-school-panel">
<div className="vc-school-summary fa-slide-top" style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", marginBottom: 16, borderLeft: "5px solid #1d4ed8", display: "flex", alignItems: "center", gap: 14 }}>
<div className="vc-school-icon" style={{ width: 48, height: 48, borderRadius: 10, background: "linear-gradient(135deg,#dbeafe,#eff6ff)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8", fontWeight: 900, fontSize: 16, border: "1.5px solid #bfdbfe" }}>NT</div>
<div style={{ flex: 1, minWidth: 0 }}>
<div style={{ fontWeight: 900, fontSize: 17, color: "#0f172a", letterSpacing: -0.3 }}>Non-Teaching Staff Reviews</div>
<div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>Registrar - Reporting Officer - Staff branch</div>
</div>
 {pending >0 &&<div className="vc-count-pill vc-count-pill--pending" style={{ padding: "5px 13px", fontSize: 11, fontWeight: 800 }}>{pending} Pending</div>}
 {reviewed >0 &&<div className="vc-count-pill" style={{ background: "#fdf4ff", color: "#6b21a8", border: "1px solid #e9d5ff", borderRadius: 999, padding: "5px 13px", fontSize: 11, fontWeight: 800 }}>{reviewed} Reviewed</div>}
</div>

<div className="vc-list-section" style={{ marginBottom: 20 }}>
<div style={{ fontWeight: 800, fontSize: 12, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>Pending Reviews</div>
 {pendingItems.length === 0 ? (
<div className="vc-empty-state fa-fade-up" style={{ padding: "44px 20px", textAlign: "center" }}>
<div className="vc-empty-orb" style={{ width: 48, height: 48, borderRadius: 10, margin: "0 auto 14px", background: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, border: "1.5px dashed #bfdbfe" }}>NT</div>
<div style={{ fontWeight: 800, color: "#475569", fontSize: 14 }}>No pending reviews</div>
<div style={{ fontSize: 11, color: "#94a3b8", marginTop: 5 }}>Non-teaching submissions will appear here once approved by the Registrar.</div>
</div>
 ) : (
 renderCards(pendingItems)
 )}
</div>

<div className="vc-list-section">
<div style={{ fontWeight: 800, fontSize: 12, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>Reviewed</div>
 {reviewedItems.length === 0 ? (
<div className="vc-empty-state fa-fade-up" style={{ padding: "28px 20px", textAlign: "center" }}>
<div style={{ fontWeight: 800, color: "#64748b", fontSize: 13 }}>No reviewed submissions yet</div>
</div>
 ) : (
 renderCards(reviewedItems)
 )}
</div>
</div>
 );
}

const toVcSchool = (school, index = 0, academicYear = "") =>{
 const meta = schoolVisualMeta(school, index);
 const legacyOnlySoemrHasHod = isLegacyTwoPartAcademicYear(academicYear);
 return {
 id: school.code.toLowerCase(),
 code: school.code,
 name: school.name,
 label: school.label,
 color: meta.color || "#64748b",
 icon: meta.icon || school.code,
 hasHods: legacyOnlySoemrHasHod
 ? String(school.code || "").trim().toUpperCase() === "SOEMR"
 : Boolean(school.hasHod),
};
};

const DIVISION_SCHOOLS = {
 engineering: {
 id: "engineering",
 code: "DEAN-ENGG",
 name: "Dean of Engineering",
 label: "Engineering Division",
 color: "#4c1d95",
 icon: "DE",
 hasHods: false,
 },
 non_engineering: {
 id: "non_engineering",
 code: "DEAN-NENG",
 name: "Dean of Non-Engineering",
 label: "Non-Engineering Division",
 color: "#7c2d12",
 icon: "DN",
 hasHods: false,
 },
};

// Computed fresh on every call (not a module-level snapshot) so it always reflects the current
// UNIVERSITY_SCHOOLS - live data once GET /schools has landed, the fallback table until then.
const getHierarchySchools = (academicYear = "") => ({
 engg: UNIVERSITY_SCHOOLS
 .filter((school) =>school.deanTrack === DEAN_TRACKS.ENGINEERING)
 .map((school, index) => toVcSchool(school, index, academicYear))
 .concat(DIVISION_SCHOOLS.engineering),
 "non-engg": UNIVERSITY_SCHOOLS
 .filter((school) =>school.deanTrack === DEAN_TRACKS.NON_ENGINEERING)
 .map((school, index) => toVcSchool(school, index, academicYear))
 .concat(DIVISION_SCHOOLS.non_engineering),
 cisr: UNIVERSITY_SCHOOLS
 .filter((school) =>school.deanTrack === DEAN_TRACKS.CISR)
 .map((school, index) => toVcSchool(school, index, academicYear)),
});

const schoolIdForPerson = (person = {}) =>{
 const schoolValue = person.school || person.info?.school || "";
 const normalizedSchool = normalizeHierarchyText(schoolValue);
 if (normalizedSchool === "engineering") return "engineering";
 if (normalizedSchool === "non engineering" || normalizedSchool === "nonengineering") return "non_engineering";

 const schoolKey = getSchoolKey(schoolValue);
 return schoolKey ? schoolKey.toLowerCase() : "";
};

const withVcSchoolId = (item) =>({
 ...item,
 schoolId: item.schoolId || schoolIdForPerson(item),
});

const storedAcademicYearCycles = () =>{
 try {
 if (getSessionItem("availableCyclesSource") !== "backend") return [];
 return JSON.parse(getSessionItem("availableCycles") || "[]")
 .map((cycle) =>{
 const academicYear = normalizeAcademicYearLabel(cycle?.academic_year || cycle?.academicYear || cycle?.year || cycle?.year_label || cycle);
 return academicYear ? { academic_year: academicYear, is_open: cycle?.is_open ?? cycle?.isOpen ?? cycle?.active ?? cycle?.open ?? academicYear === APP_INFO.DEFAULT_AY } : null;
 })
 .filter(Boolean);
 } catch {
 return [];
 }
};

const previousYearFormTypeFor = (profile = {}) =>{
 if (isMediaCommSchool(profile, profile.info?.school, profile.school)) return "mediaCommunication";
 if (isDesignArtsSchool(profile, profile.info?.school, profile.school)) return "designArts";
 return "engineering";
};

function PreviousYearAuthorityResult({ item, onBack }) {
 const previousYearReviews = reviewListFrom(
 item.reviews ||
 item.review_history ||
 item.reviewHistory ||
 item.previousYearResponse?.reviews ||
 item.previousYearResponse?.review_history ||
 item.previousYearResponse?.reviewHistory ||
 item.previousYearResponse?.appraisal_reviews ||
 item.previousYearResponse?.appraisalReviews ||
 item.previousYearResponse?.payload?.reviews ||
 item.previousYearResponse?.payload?.review_history ||
 item.previousYearResponse?.payload?.reviewHistory ||
 item.previousYearResponse?.payload?.appraisal_reviews ||
 item.previousYearResponse?.payload?.appraisalReviews ||
 item.previousYearResponse?.data?.reviews ||
 item.previousYearResponse?.data?.review_history ||
 item.previousYearResponse?.data?.reviewHistory ||
 item.previousYearResponse?.data?.appraisal_reviews ||
 item.previousYearResponse?.data?.appraisalReviews ||
 item.previousYearResponse?.data?.payload?.reviews ||
 item.previousYearResponse?.data?.payload?.review_history ||
 item.previousYearResponse?.data?.payload?.reviewHistory ||
 item.previousYearResponse?.data?.payload?.appraisal_reviews ||
 item.previousYearResponse?.data?.payload?.appraisalReviews
 );
 return (
 <div style={{ display: "grid", gap: 12 }}>
 <button type="button" onClick={onBack} style={{ justifySelf: "start", border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 8, padding: "8px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Back</button>
 <PreviousYearReportViewer showTables visibleLevels={["faculty", "hod", "director", "dean", "vc"]} formType={previousYearFormTypeFor(item)} form={item} docs={item.docs || {}} response={item.previousYearResponse || item} academicYear={item.academicYear || item.academic_year || item.info?.ay} profile={item} reviews={previousYearReviews} />
 </div>
 );
}

export default function VCDashboard() {
  const showReviewFeedback = useReviewFeedback();
 useSchools(); // subscribes to live schools data so getHierarchySchools() re-renders fresh
 const navigate = useNavigate();
 const [deanTypeFilter, setDeanTypeFilter] = useState("engg");
 const [activeSchoolId, setActiveSchoolId] = useState("");
 const [reviewing, setReviewing] = useState(null);
 const [reviewLoading, setReviewLoading] = useState(null);
 const [showLogoutModal, setShowLogoutModal] = useState(false);
 const [deanList, setDeanList] = useState([]);
 const [dirList, setDirList] = useState([]);
 const [hodList, setHodList] = useState([]);
 const [centerHeadList, setCenterHeadList] = useState([]);
 const [facList, setFacList] = useState([]);
 const [nonTeachingList, setNonTeachingList] = useState([]);
 const [nonTeachingReviewedList, setNonTeachingReviewedList] = useState([]);
 const [queueLoadError, setQueueLoadError] = useState("");
 const [selectedAcademicYear, setSelectedAcademicYear] = useState(() =>getActiveAcademicYear());
 const [availableCycles, setAvailableCycles] = useState(() =>storedAcademicYearCycles());
 const [loadingYearData, setLoadingYearData] = useState(false);
 const academicYearOptions = availableCycles.length ? availableCycles : [{ academic_year: selectedAcademicYear || APP_INFO.DEFAULT_AY, is_open: true }];

 const pollingActiveRef = useRef(true);
 const prevDataRef = useRef(null);
 const yearLoadRequestRef = useRef(0);
 const dashboardMainRef = useRef(null);
 const userScrollingRef = useRef(false);
 const scrollIdleTimerRef = useRef(null);

 const handleReviewAcademicYearChange = (academicYear) =>{
 const nextAcademicYear = setActiveAcademicYear(academicYear);
 setSelectedAcademicYear(nextAcademicYear);
 setReviewing(null);
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

 // fetchReviewQueueForRole's onItemReady lets the (fast) lightweight list render immediately and
 // patches each row in place as its doc-count/legacy-score enrichment resolves in the background,
 // instead of blocking the whole queue on hundreds of per-person requests - see the comment on
 // fetchReviewQueueForRole for why that blocking was the actual cause of "switching year is slow"
 // (VC's queue spans the whole university, so it paid that cost worst).
 const applyEnrichedItem = useCallback((enrichedItem) =>{
 const routed = withVcSchoolId(enrichedItem);
 const listSetterForRole = { faculty: setFacList, hod: setHodList, center_head: setCenterHeadList, director: setDirList, dean: setDeanList };
 const setList = listSetterForRole[routed.appraisalRole];
 if (!setList) return;
 setList((prev) =>prev.map((item) =>(item.email === routed.email && item.academicYear === routed.academicYear ? routed : item)));
 }, []);

 const loadReviewQueue = useCallback(async (silent = false) =>{
 if (!pollingActiveRef.current) return;
 const requestId = silent ? yearLoadRequestRef.current : ++yearLoadRequestRef.current;
 const isCurrentRequest = () =>yearLoadRequestRef.current === requestId;
 if (!silent) {
 setLoadingYearData(true);
 setQueueLoadError("");
 }
 try {
 const items = await fetchReviewQueueForRole({
 reviewerRole: "vc",
 reviewerProfile: { ...profileFromsessionStorage(), appraisal_role: "vc" },
 academicYear: selectedAcademicYear,
 schoolValues: [
 ...UNIVERSITY_SCHOOLS.flatMap((school) =>[school.code, school.name, school.label]),
 "CioD",
 DEAN_TRACKS.ENGINEERING,
 DEAN_TRACKS.NON_ENGINEERING,
 ],
 isStale: () =>!isCurrentRequest(),
 onItemReady: applyEnrichedItem,
 });
 let nonTeachingItems = [];
 try {
 nonTeachingItems = await fetchNonTeachingQueueForRole({
 reviewerRole: "vc",
 academicYear: selectedAcademicYear,
 });
 } catch (nonTeachingErr) {
 console.warn("Could not load VC non-teaching review queue:", nonTeachingErr.message);
 }
 if (!pollingActiveRef.current) return;
 const routedItems = items.map(withVcSchoolId);
 const nextFac = routedItems.filter(item =>item.appraisalRole === "faculty");
 const nextHod = routedItems.filter(item =>item.appraisalRole === "hod");
 const nextCH = routedItems.filter(item =>item.appraisalRole === "center_head");
 const nextDir = routedItems.filter(item =>item.appraisalRole === "director");
 const nextDean = routedItems.filter(item =>item.appraisalRole === "dean");
 const nextNT = nonTeachingItems.filter((item) =>!isNonTeachingReviewComplete(item));
 const nextNTR = nonTeachingItems.filter(isNonTeachingReviewComplete);
 // On silent polls, skip state updates if nothing changed (avoids any re-render jitter)
 const snapshot = JSON.stringify({ items, nonTeachingItems });
 if (silent && prevDataRef.current === snapshot) return;
 prevDataRef.current = snapshot;
 setFacList(nextFac);
 setHodList(nextHod);
 setCenterHeadList(nextCH);
 setDirList(nextDir);
 setDeanList(nextDean);
 setNonTeachingList(nextNT);
 setNonTeachingReviewedList(nextNTR);
 } catch (err) {
 if (!silent) {
 console.error("Could not load VC review queue:", err);
 if (!pollingActiveRef.current) return;
 // A failed fetch used to fall back to an empty list, which looked identical to "nothing is
 // pending" - a reviewer had no way to tell a real error apart from a genuinely empty queue.
 setQueueLoadError(err?.message || "Could not load the review queue. Please try again.");
 setFacList([]); setHodList([]); setCenterHeadList([]); setDirList([]); setDeanList([]);
 setNonTeachingList([]);
 setNonTeachingReviewedList([]);
 }
 } finally {
 if (!silent && isCurrentRequest()) setLoadingYearData(false);
 }
 }, [selectedAcademicYear, applyEnrichedItem]);

 useEffect(() =>{
 pollingActiveRef.current = true;
 loadReviewQueue(false);
 const intervalId = setInterval(() =>{
 if (userScrollingRef.current) return;
 loadReviewQueue(true);
 }, 3000);
 return () =>{
 pollingActiveRef.current = false;
 clearInterval(intervalId);
 };
 }, [loadReviewQueue]);

 const markUserScrolling = useCallback(() =>{
 userScrollingRef.current = true;
 if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
 scrollIdleTimerRef.current = setTimeout(() =>{
 userScrollingRef.current = false;
 }, 700);
 }, []);

 useEffect(() =>{
 const mainNode = dashboardMainRef.current;
 window.addEventListener("scroll", markUserScrolling, { passive: true });
 mainNode?.addEventListener("scroll", markUserScrolling, { passive: true });
 return () =>{
 window.removeEventListener("scroll", markUserScrolling);
 mainNode?.removeEventListener("scroll", markUserScrolling);
 if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
 };
 }, [markUserScrolling]);

const handleSubmit = async (id, scores, remarks, personMode, sectionScores, reviewConfirmed = false, decision = "approved") =>{
 if (!reviewConfirmed) {
 void showReviewFeedback("Please verify and confirm the accuracy declaration before submitting the review.");
 return;
 }
 if (!remarks?.trim()) {
 void showReviewFeedback("Remarks are mandatory. Please enter your remarks before submitting the review.");
 return;
 }
 const sourceList = personMode === "dean" ? deanList : personMode === "director" ? dirList : personMode === "hod" ? hodList : personMode === "center_head" ? centerHeadList : facList;
 const item = sourceList.find(entry =>entry.id === id);
 if (!item) return;
 const wasFinalised = isAppraisalFinalisedByVc(item);
 try {
 await submitWorkflowReview({
 subjectEmail: item.email,
 academicYear: item.academicYear || item.academic_year || item.info?.ay || APP_INFO.DEFAULT_AY || "2026-2027",
 reviewerRole: "vc",
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
 const status = decision === "rejected" ? rejectedStatusFor("vc") : "Reviewed";
 const upd = (list) =>list.map(p =>p.id === id
 ? { ...p, ...(decision === "rejected"
   ? { status, workflowStatus: status, declaration: { ...(p.declaration || {}), status }, vcRemarks: remarks }
   : { ...sectionScores, innovVc: sectionScores?.innovativeTeaching?.vc ?? p.innovVc, status, workflowStatus: status, declaration: { ...(p.declaration || {}), status }, vcPartA: scores.partA, vcPartB: scores.partB, vcPartC: scores.partC, vcPartD: scores.partD, vcTotal: scores.total, vcRemarks: remarks })}
 : p);
 if (personMode === "dean") setDeanList(upd);
 else if (personMode === "director") setDirList(upd);
 else if (personMode === "hod") setHodList(upd);
 else if (personMode === "center_head") setCenterHeadList(upd);
 else if (personMode === "faculty") setFacList(upd);
 setReviewing(null);
 void showReviewFeedback(decision === "rejected" ? "Appraisal rejected and sent back for editing." : (wasFinalised ? "VC review updated." : "VC final approval submitted."), "success");
 } catch (err) {
 console.error("Could not submit VC review:", err);
 void showReviewFeedback(`Unable to submit VC review.\n\n${err.message}`);
 }
 };

 const currentSchools = getHierarchySchools(selectedAcademicYear)[deanTypeFilter] || [];
 const activeSchool = currentSchools.find(s =>s.id === activeSchoolId) || currentSchools[0] || null;

 const switchDeanType = (type) =>{
 setDeanTypeFilter(type);
 setActiveSchoolId(getHierarchySchools(selectedAcademicYear)[type]?.[0]?.id || "");
 setReviewing(null);
 };
 const switchSchool = (schoolId) =>{ setActiveSchoolId(schoolId); setReviewing(null); };

 const openTeachingReview = async (person, personMode) =>{
 const academicYear = person.academicYear || person.academic_year || person.info?.ay || APP_INFO.DEFAULT_AY || "2026-2027";
 setReviewLoading(person.id || person.email);
 try {
 const data = await fetchSavedAppraisal({
 facultyEmail: person.email,
 academicYear,
 reviewerRole: "vc",
 });
 const form = data?.payload?.form || data?.form || {};
 const docs = data?.payload?.docs || data?.docs || {};
 const reviewSummary = vcReviewSummaryFrom(person, data, data?.payload);
 const mergedForm = isCreativeSchool(form, person)
 ? normalizeSubmittedCreativeFormForReview(form, person)
 : preserveSavedReviewScores(form, person);
 const declaration = data?.declaration || person.declaration || null;
 setReviewing({
 person: { ...person, ...mergedForm, ...reviewSummary, docs, academicYear, academic_year: academicYear, declaration, previousYearResponse: data, previousYearResultOnly: isLegacyTwoPartAcademicYear(academicYear), status: declaration?.status || data?.status || person.status, workflowStatus: declaration?.status || data?.workflowStatus || person.workflowStatus },
 personMode,
 });
 } catch (err) {
 alert(`Unable to open submitted form.\n\n${err.message}`);
 } finally {
 setReviewLoading(null);
 }
 };

 const getSchoolPending = (school) =>{
 const all = [
 ...deanList.filter(p =>p.schoolId === school.id),
 ...dirList.filter(p =>p.schoolId === school.id),
 ...(school.hasHods ? hodList.filter(p =>p.schoolId === school.id) : []),
 ...centerHeadList.filter(p =>p.schoolId === school.id),
 ...facList.filter(p =>p.schoolId === school.id),
 ];
 return all.filter(p =>!isVcReviewed(p)).length;
 };

 const teachingItems = [...deanList, ...dirList, ...hodList, ...centerHeadList, ...facList];
 const totalPending = teachingItems.filter(p =>!isVcReviewed(p)).length +
 nonTeachingList.length;
 const totalReviewed = teachingItems.filter(isVcReviewed).length +
 nonTeachingReviewedList.length;

 return (
<div className="vc-app-shell" style={{ display: "flex", minHeight: "100vh", fontFamily: "inherit", background: "#f0f4ff", color: "#1e293b" }}>

 {/* -- Sidebar -- */}
<DashboardSidebar
 appInfo={APP_INFO}
 navItems={[{ id: "schoolReviews", label: "School Reviews", sub: `${totalPending} awaiting`, badge: totalPending }]}
 activeTab="schoolReviews"
 onTabSelect={() => setReviewing(null)}
 profileSubtitle={`Vice Chancellor - ${APP_INFO.SHORT_NAME}`}
 onLogout={() => setShowLogoutModal(true)}
 beforeNav={
   <section className="vc-shared-sidebar__role">
     <strong>Vice Chancellor</strong>
     <p>Full university oversight</p>
     <label htmlFor="vc-review-year">Academic year</label>
     <select id="vc-review-year" value={selectedAcademicYear} onChange={(event) => handleReviewAcademicYearChange(event.target.value)}>
       {academicYearOptions.map((cycle) => (
         <option key={cycle.academic_year} value={cycle.academic_year}>
           AY {cycle.academic_year} {cycle.is_open ? "(Active)" : "(Closed)"}
         </option>
       ))}
     </select>
   </section>
 }
 afterNav={
   <section className="vc-shared-sidebar__overview" aria-label="University overview">
     <h3><VcIcon name="globe" size={14} color="currentColor" />University Overview</h3>
     <ul><li>4 Engineering Schools</li><li>5 Non-Engineering Schools</li><li>CISR Center</li><li>Non-Teaching Branch</li></ul>
     <div className="vc-shared-sidebar__counts">
       <div><strong>{totalPending}</strong><span>Pending</span></div>
       <div><strong>{totalReviewed}</strong><span>VC Reviewed</span></div>
     </div>
   </section>
 }
/>

 {/* ===== MAIN CONTENT ===== */}
<main ref={dashboardMainRef} className="vc-dashboard-main" style={{ flex: 1, padding: "28px 30px", display: "flex", flexDirection: "column", gap: 16, overflowX: "auto", position: "relative" }}>

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

 {!reviewing && (
<>
 {/* Hero */}
<div className="vc-dashboard-hero school-review-header fa-slide-top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderRadius: 14, padding: "16px 24px", boxShadow: "0 10px 28px rgba(17,24,39,0.06)", border: "1px solid #e5e7eb", flexWrap: "wrap" }}>
<div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
<AppraisalHeaderImage logo="dypiu" style={{ alignSelf: "center" }} />
<div style={{ minWidth: 0 }}>
<h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0f172a", lineHeight: 1.15, letterSpacing: -0.5 }}>School-wise Appraisal Reviews</h1>
<p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
<span style={{ background: "#e0e7ff", color: "#3730a3", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{APP_INFO.SHORT_NAME}</span>
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
</p>
</div>
</div>
<div className="vc-hero-right" style={{ display: "flex", alignItems: "center", gap: 14 }}>
<div className="vc-total-pill" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#374151", background: "#fff", padding: "10px 18px", borderRadius: 12, border: "1px solid #ede9fe", boxShadow: "0 8px 20px rgba(109,40,217,0.10)", fontWeight: 700 }}>
<span style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#ede9fe,#ddd6fe)", color: "#6d28d9", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></svg>
</span>
<span>
<span style={{ display: "block", color: "#6d28d9", fontWeight: 900, fontSize: 17, lineHeight: 1.1 }}>{deanList.length + dirList.length + hodList.length + centerHeadList.length + facList.length + nonTeachingList.length + nonTeachingReviewedList.length}</span>
<span style={{ display: "block", fontSize: 10.5, color: "#6b7280", fontWeight: 700, marginTop: 1 }}>total submissions</span>
</span>
</div>
<AppraisalHeaderImage logo="iqas" style={{ alignSelf: "center" }} />
</div>
</div>

 {/* Division Switcher */}
<div className="vc-segmented-tabs fa-fade-up" style={{ display: "inline-flex", width: "auto", maxWidth: "max-content", gap: 2 }}>
 {[
 { key: "engg", label: "Engineering Schools", color: "#1e40af", bg: "linear-gradient(135deg,#dbeafe,#bfdbfe)", icon: "school" },
 { key: "non-engg", label: "Non-Engineering Schools", color: "#6b21a8", bg: "linear-gradient(135deg,#f3e8ff,#e9d5ff)", icon: "layers" },
 { key: "cisr", label: "CISR", color: "#0f766e", bg: "linear-gradient(135deg,#ccfbf1,#99f6e4)", icon: "flask" },
 { key: "non-teaching", label: "Non-Teaching Staff", color: "#1d4ed8", bg: "linear-gradient(135deg,#dbeafe,#bfdbfe)", icon: "badge" },
 ].map(({ key, label, color, bg, icon }) =>{
 const schoolPending = key === "non-teaching"
 ? nonTeachingList.length
 : (getHierarchySchools(selectedAcademicYear)[key] || []).reduce((a, s) =>a + getSchoolPending(s), 0);
 const isActive = deanTypeFilter === key;
 return (
<button className={`vc-segmented-tab division-selector-option${isActive ? " is-active" : ""}`} aria-pressed={isActive} key={key} onClick={() =>switchDeanType(key)}
 style={{ padding: "9px 20px", border: isActive ? `1.5px solid ${color}44` : "1.5px solid transparent", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: isActive ? bg : "none", color: isActive ? color : "#64748b", display: "flex", alignItems: "center", gap: 7, boxShadow: isActive ? `0 2px 10px ${color}1f` : "none" }}>
 <VcIcon name={icon} size={14} color={isActive ? color : "#94a3b8"} />
 {label}
 {schoolPending >0 && (
<span style={{ background: isActive ? color : "#94a3b8", color: "#fff", borderRadius: 10, padding: "2px 8px", fontSize: 9, fontWeight: 900 }}>{schoolPending}</span>
 )}
</button>
 );
 })}
</div>

 {/* School Tabs */}
 {activeSchool && (
<div className="vc-school-tabs fa-fade-up" style={{ display: "flex", background: "#fff", borderRadius: 14, border: "1px solid #eef2f7", boxShadow: "0 10px 26px rgba(15,23,42,0.05)", overflow: "hidden" }}>
 {currentSchools.map((school, idx) =>{
 const pending = getSchoolPending(school);
 const isActive = school.id === activeSchoolId;
 const shortName = school.name.replace(/^School of /i, "").replace(/^Dean of /i, "");
 return (
<button className={`vc-school-tab school-selector-option${isActive ? " is-active" : ""}`} aria-pressed={isActive} key={school.id} onClick={() =>switchSchool(school.id)}
 title={school.name}
 onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#f8fafc"; }}
 onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "none"; }}
 style={{ flex: 1, padding: "13px 6px 11px", border: "none", cursor: "pointer", fontFamily: "inherit", background: isActive ? `${school.color}12` : "none", borderBottom: isActive ? `3px solid ${school.color}` : "3px solid transparent", borderRight: idx < currentSchools.length - 1 ? "1px solid #f1f5f9" : "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, position: "relative", transition: "background 0.15s ease" }}>
<div style={{ width: 32, height: 32, borderRadius: 9, background: isActive ? `linear-gradient(135deg, ${school.color}2E, ${school.color}14)` : "#f1f5f9", color: isActive ? school.color : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, border: isActive ? `1.5px solid ${school.color}40` : "1.5px solid transparent", boxShadow: isActive ? `0 4px 10px ${school.color}26` : "none" }}>{school.icon}</div>
<div style={{ fontSize: 11, fontWeight: 800, color: isActive ? school.color : "#374151" }}>{school.code}</div>
<div style={{ fontSize: 10, color: isActive ? school.color : "#1e293b", fontWeight: 700, lineHeight: 1.3, textAlign: "center", wordBreak: "break-word", maxWidth: "100%" }}>{shortName}</div>
 {pending >0 && (
<div style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)", color: "#fff", borderRadius: 8, padding: "1px 7px", fontSize: 9, fontWeight: 900, boxShadow: "0 2px 6px rgba(245,158,11,0.35)" }}>{pending}</div>
 )}
</button>
 );
 })}
</div>
 )}

 {queueLoadError && (
<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, color: "#991b1b", fontSize: 13, fontWeight: 700, margin: "0 0 14px" }}>
 <span aria-hidden="true">!</span>
 <span>{queueLoadError}</span>
</div>
 )}

 {deanTypeFilter === "non-teaching" ? (
<NonTeachingPanel
 pendingItems={nonTeachingList}
 reviewedItems={nonTeachingReviewedList}
 onReview={(person) =>setReviewing({ person, personMode: "non_teaching" })}
 />
 ) : activeSchool ? (
<SchoolPanel
 school={activeSchool}
 deanList={deanList}
 dirList={dirList}
 hodList={hodList}
 centerHeadList={centerHeadList}
 facList={facList}
 onReview={openTeachingReview}
 reviewLoading={reviewLoading}
 />
 ) : null}
</>
 )}

 {reviewing && (
 reviewing.personMode === "non_teaching" ? (
<NonTeachingAuthorityReviewPanel
 item={reviewing.person}
 reviewerRole="vc"
 onBack={() =>setReviewing(null)}
 readOnly={isNonTeachingReviewComplete(reviewing.person)}
 onSubmitted={(updated) =>{
 setNonTeachingList((current) =>current.filter((item) =>nonTeachingItemKey(item) !== nonTeachingItemKey(updated)));
 setNonTeachingReviewedList((current) =>upsertNonTeachingItem(current, updated));
 setReviewing(null);
 }}
 />
 ) : (
reviewing.person?.previousYearResultOnly ? (
<PreviousYearAuthorityResult item={reviewing.person} onBack={() =>setReviewing(null)} />
) : (
<VCReviewPanel
person={reviewing.person}
personMode={reviewing.personMode}
onBack={() =>setReviewing(null)}
onSubmit={handleSubmit}
readOnly={isVcReviewed(reviewing.person)}
/>
)
 ))}
</main>

 {/* Logout Modal */}
 {showLogoutModal && (
<div style={{ position: "fixed", inset: 0, background: "rgba(8,9,26,0.65)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
 onClick={() =>setShowLogoutModal(false)}>
<div style={{ background: "#fff", borderRadius: 10, padding: "30px 34px", maxWidth: 360, width: "90%", boxShadow: "0 24px 56px rgba(0,0,0,0.26)", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, fontFamily: "inherit" }}
 onClick={e =>e.stopPropagation()}>
<div style={{ textAlign: "center" }}>
<div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a", marginBottom: 8, letterSpacing: -0.3 }}>Confirm Logout</div>
<div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>
 You are about to log out of <strong style={{ color: "#374151" }}>{APP_INFO.PORTAL_NAME}</strong>.<br />Any unsaved changes will be lost.
</div>
</div>
<div style={{ display: "flex", gap: 10, width: "100%" }}>
<button onClick={() =>setShowLogoutModal(false)}
 style={{ flex: 1, padding: "11px 0", background: "#f8fafc", color: "#475569", border: "1.5px solid #e2e8f0", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
 Cancel
</button>
<button onClick={() =>{ setShowLogoutModal(false); clearUserSession(); navigate("/", { replace: true }); }}
 style={{ flex: 1, minHeight: 44, padding: "10px", background: "#dc2626", color: "#ffffff", border: "1px solid #b91c1c", borderRadius: 10, cursor: "pointer", fontWeight: 900, fontSize: 13, fontFamily: "inherit" }}>
 Yes, Logout
</button>
</div>
</div>
</div>
 )}
</div>
 );
}

