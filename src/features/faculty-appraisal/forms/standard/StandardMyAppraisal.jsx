/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../../services/api";
import { scopedAppraisalSetters as scopeYearSetters } from "../../../../utils/scopedAppraisalSetters";
import { standardReadSetters } from "./standardReadCompatibility";
import { assertDraftOnline, confirmedDraftSave, draftSaveErrorMessage } from "../../../../utils/confirmedDraftSave";
import { getActiveAcademicYear, getSessionItem, setActiveAcademicYear } from "../../../../auth/session";
import {
  appraisalWindowMessage,
  appraisalWindowErrorMessage,
  canEditSelfAppraisal,
  canSaveDraft,
  canSubmitAppraisal,
  getAppraisalWindowStatus,
} from "../../../../services/appraisalWindowService";
import {
  ACR_DETAIL_POINTS,
  APP_INFO,
  createAcrRows,
} from "../../config";
import {
  loadClosedAppraisal,
  loadAppraisalDocuments,
  loadSavedAppraisal,
  resetSnapshotSetters,
  saveAppraisalDraftSection,
  submitAppraisal,
} from "../../services";
import {
  SCORE_LIMITS,
  COURSE_FILE_DETAIL_OPTIONS,
  averageSectionScore,
  clampScore,
  consultancyGuidelineScore,
  effectiveMaxScore,
  externalProjectGuidelineScore,
  feedbackAverage,
  feedbackGuidelineScore,
  feedbackSectionScore,
  isValidDDMMYYYY,
  lectureGuidelineScore,
  maskDateDDMMYYYY,
  migrateLegacyRowFields,
  normalizeCourseFileDetails,
  normalizeAutoScores,
  projectGuidanceRowMax,
  researchGuidanceRowMax,
  researchGuidanceScore,
  selfEffectivePartAMax,
  societyRowLocked,
  societyRowScore,
  stripMaxMarksFromTitle,
  sumSectionScore,
  validateCompleteRows,
} from "../../utils";
import {
  AppraisalHeaderImage,
  AppraisalSummaryActionButton,
  AppraisalSummaryTable,
  DocCell,
  InlineSvgIcon,
  RejectionNotice,
  RowButtons as RowBtns,
  SectionCard as SC,
  SectionInfoButton,
  SectionSaveFooter,
  SUMMARY_ATTACHMENTS_DECLARATION,
  SUMMARY_DECLARATION_TEXT,
  SUMMARY_ICONS,
  SummaryOtherInfoField,
  T,
  TD,
  TDC,
  TDS,
  TH,
  ViewCell,
} from "../../components";
import {
  n,
  pct,
  reportExperience,
  reportQualification,
  reportTextValue,
  RO,
  TI,
  WorkflowStatusTracker,
} from "../../shared";
import {
  getReviewChain,
  hasActiveRejection,
  pendingStatusFor,
  profileFromsessionStorage,
  reviewListFrom,
  roleLabel,
  workflowValidationError,
} from "../../../../utils/hierarchy";
import { getSchoolByValue } from "../../../../constants/universityHierarchy";
import { fetchImageAsDataUrl } from "../../../../utils/fullFormReport";
import LegacyPreviousYearReport from "./LegacyPreviousYearReport";
import OverallProgress from "../../components/OverallProgress";
import SubmissionConfirmDialog from "../../components/SubmissionConfirmDialog";
import {
  isLegacyTwoPartAcademicYear,
  legacySubmittedTotals,
} from "./legacyPreviousYearReportUtils";

const OTHER_INNOVATIVE_METHOD = "Any other innovative method";

const INNOVATIVE_METHOD_OPTIONS = [
  { value: "Blended learning", label: "Blended learning" },
  { value: "Virtual Lab", label: "Virtual Lab" },
  { value: "Conceptual videos (with class photo)", label: "Conceptual videos (with class photo)" },
  { value: "Use of Learning Management System (LMS)", label: "Use of Learning Management System (LMS)" },
  { value: "Project-Based Learning", label: "Project-Based Learning" },
  { value: "Open Course Ware (OCW) assignment", label: "Open Course Ware (OCW) assignment" },
  { value: "Quiz", label: "Quiz" },
  { value: "Group Discussion (with photo & report)", label: "Group Discussion (with photo & report)" },
  { value: "Flip classroom (with proof of material shared)", label: "Flip classroom (with proof of material shared)" },
  { value: OTHER_INNOVATIVE_METHOD, label: OTHER_INNOVATIVE_METHOD },
];

const LEGACY_INNOVATIVE_METHODS = new Set(INNOVATIVE_METHOD_OPTIONS.map((method) => method.value));

const blankInnovativeRow = () => ({ method: "", details: "", methodOther: "", score: "", max: A3_INNOVATIVE_ROW_MAX });

const sanitizeInnovativeRows = (rows) => {
  if (!Array.isArray(rows)) return [blankInnovativeRow()];
  const legacyPresetRows = rows.slice(0, INNOVATIVE_METHOD_OPTIONS.length);
  const hasLegacyPreset = legacyPresetRows.length === INNOVATIVE_METHOD_OPTIONS.length
    && legacyPresetRows.every((row = {}, index) => String(row.method ?? "").trim() === INNOVATIVE_METHOD_OPTIONS[index].value);
  const cleaned = rows.filter((row = {}, index) => {
    const method = String(row.method ?? "").trim();
    const hasEnteredData = ["details", "methodOther", "score", "hod", "director", "dean", "vc"].some((key) => String(row[key] ?? "").trim());
    if (hasLegacyPreset && index < INNOVATIVE_METHOD_OPTIONS.length && LEGACY_INNOVATIVE_METHODS.has(method) && !hasEnteredData) return false;
    return method || hasEnteredData;
  });
  const normalizedRows = cleaned.map((row) => ({ ...row, max: row.max || A3_INNOVATIVE_ROW_MAX }));
  return normalizedRows.length ? normalizedRows : [blankInnovativeRow()];
};

// Row-wise scores may legitimately sum above a section's max (e.g. multiple qualifying
// entries) - the actual stored/displayed total is already capped at the section max
// elsewhere via clampScore-based aggregation, so validation must not also block submission
// for that. `rowMax: section.rowMax || 0` additionally stops validateCompleteRows' own
// title-text fallback (matching "FDP"/"industrial training" in a label) from inventing a
// row cap for sections that never defined one.
const withRelaxedSectionCap = (sections) =>
  sections.map((section) => ({ ...section, rowMax: section.rowMax || 0, capSectionTotal: true }));

const textEncoder = new TextEncoder();
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const dosDateTime = (date = new Date()) => ({
  time: ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f),
  date: (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f),
});

const writeZipHeader = (size, writer) => {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  writer(view);
  return bytes;
};

const createZipBlob = async (entries) => {
  const parts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = dosDateTime();

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const dataBytes = new Uint8Array(await entry.blob.arrayBuffer());
    const crc = crc32(dataBytes);

    const localHeader = writeZipHeader(30, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, stamp.time, true);
      view.setUint16(12, stamp.date, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, dataBytes.length, true);
      view.setUint32(22, dataBytes.length, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);
    });

    parts.push(localHeader, nameBytes, dataBytes);

    const centralHeader = writeZipHeader(46, (view) => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, stamp.time, true);
      view.setUint16(14, stamp.date, true);
      view.setUint32(16, crc, true);
      view.setUint32(20, dataBytes.length, true);
      view.setUint32(24, dataBytes.length, true);
      view.setUint16(28, nameBytes.length, true);
      view.setUint16(30, 0, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, offset, true);
    });

    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const endHeader = writeZipHeader(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, entries.length, true);
    view.setUint16(10, entries.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, offset, true);
    view.setUint16(20, 0, true);
  });

  return new Blob([...parts, ...centralParts, endHeader], { type: "application/zip" });
};

const dataUrlToBlob = (dataUrl) => {
  const [meta, value = ""] = String(dataUrl).split(",");
  const mime = meta.match(/:(.*?);/)?.[1] || "application/octet-stream";
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

const rawAttachmentUrl = (file) =>
  typeof file === "string" ? file : file?.url || file?.file_url || file?.fileUrl || file?.document_url || file?.documentUrl || file?.path || file?.location;

const attachmentFileName = (file, fallbackName, usedNames) => {
  const rawUrl = rawAttachmentUrl(file) || "";
  const rawName = typeof file === "object" && file?.name ? file.name : rawUrl.split(/[/?#]/).filter(Boolean).pop() || fallbackName;
  const cleaned = String(rawName || fallbackName)
    .split("")
    .map((char) => (char.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(char) ? "_" : char))
    .join("")
    .trim() || fallbackName;
  if (!usedNames.has(cleaned)) {
    usedNames.add(cleaned);
    return cleaned;
  }

  const dotIndex = cleaned.lastIndexOf(".");
  const base = dotIndex > 0 ? cleaned.slice(0, dotIndex) : cleaned;
  const ext = dotIndex > 0 ? cleaned.slice(dotIndex) : "";
  let count = 2;
  let next = `${base}-${count}${ext}`;
  while (usedNames.has(next)) {
    count += 1;
    next = `${base}-${count}${ext}`;
  }
  usedNames.add(next);
  return next;
};

const fetchAttachmentBlob = async (file) => {
  const rawUrl = rawAttachmentUrl(file);
  const finalUrl = rawUrl ? api.getFileUrl(rawUrl) : "";
  if (!finalUrl) throw new Error("Attachment URL is missing.");
  if (finalUrl.startsWith("data:")) return dataUrlToBlob(finalUrl);
  const token = sessionStorage.getItem("accessToken") || sessionStorage.getItem("token");
  const response = await fetch(finalUrl, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new Error(`Attachment download failed: ${response.status}`);
  return response.blob();
};

const downloadBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const PART_A_MAX = 150;
const PART_B_MAX = 350;
const PART_C_MAX = 150;
const PART_D_MAX = 25;
const PART_E_MAX = 50;
const PART_D_RATING_OPTIONS = [
  { value: "Outstanding", label: "Outstanding (Above 20)", score: 25 },
  { value: "Above Average", label: "Above Average (16-20)", score: 20 },
  { value: "Average", label: "Average (11-15)", score: 15 },
  { value: "Below Average", label: "Below Average (6-10)", score: 10 },
  { value: "Unacceptable", label: "Unacceptable (0-5)", score: 5 },
];
const partDRatingScore = (rating) => PART_D_RATING_OPTIONS.find((option) => option.value === rating)?.score ?? "";
const blankLeaveManagementRow = () => ({
  clTaken: "", mlTaken: "", odTaken: "", coffTaken: "",
  clOutOf: "", mlOutOf: "", odOutOf: "", coffOutOf: "",
  lateRemarks: "", workingDays: "", managementRating: "", score: "",
});
const A1_COURSE_DELIVERY_MAX = 40;
const A2_COURSE_FILE_MAX = 20;
const A3_INNOVATIVE_MAX = 20;
const A3_INNOVATIVE_ROW_MAX = 4;
const A4_FEEDBACK_MAX = 10;
const A5_OBE_MAX = 20;
const A6_PROJECT_GUIDANCE_MAX = 20;
const A7_MENTORING_MAX = 10;
const A8_QUALIFICATION_MAX = 10;
const C1_UNIVERSITY_ADMIN_MAX = 50;
const C2_SCHOOL_ADMIN_MAX = 30;
const C3_EVENT_MAX = 20;
const C4_OUTREACH_MAX = 10;
const C5_INDUSTRY_MAX = 10;
const C6_ALUMNI_MAX = 10;
const C7_PLACEMENT_MAX = 20;
const B1_JOURNAL_MAX = 100;
const B2_BOOK_MAX = 30;
const B3_ICT_MAX = 20;
const B3_PATENT_MAX = 40;
const B4_PROJECT_MAX = 40;
const B5_RESEARCH_GUIDANCE_MAX = 20;
const B6_CONSULTANCY_MAX = 20;
const B7_CONFERENCE_MAX = 20;
const B8_ATTENDED_MAX = 20;
const B9_AWARDS_MAX = 20;
const B10_STARTUP_MAX = 20;
const b5RowMax = (row) => researchGuidanceRowMax(row) || B5_RESEARCH_GUIDANCE_MAX;
const B5_FIELDS = ["degree", "name", "status", "date", "score"];
const b5FieldsForRow = (row) => (row?.status === "Ongoing" ? B5_FIELDS.filter((key) => key !== "date") : B5_FIELDS);

const defaultObeRows = () => [
  { component: "CO-PO mapping sheet", evidence: "", score: "", max: 5 },
  { component: "Attainment calculation", evidence: "", score: "", max: 10 },
  { component: "Corrective action plan", evidence: "", score: "", max: 5 },
];

const defaultMentoringRows = () => [
  { activity: "Mentoring meetings conducted (min. 2/semester)", evidence: "", score: "", max: 4 },
  { activity: "Mentoring register maintained", evidence: "", score: "", max: 3 },
  { activity: "Documented academic/career counselling outcomes", evidence: "", score: "", max: 3 },
];

const evidenceClaimedOrScored = (row = {}) =>
  Boolean(String(row.score ?? "").trim()) || String(row.evidence ?? "").trim().toLowerCase() === "yes";

function SubsectionIcon({ type }) {
  const icons = {
    teaching: ["M4 19V6.5A2.5 2.5 0 0 1 6.5 4H20v15H6.5A2.5 2.5 0 0 0 4 21V6.5", "M8 8h8M8 12h6"],
    folder: ["M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"],
    lightbulb: ["M9 18h6", "M10 22h4", "M8.5 14.5A6 6 0 1 1 15.5 14.5c-.9.7-1.5 1.7-1.5 2.5h-4c0-.8-.6-1.8-1.5-2.5Z"],
    users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
    guidance: ["M12 3 4 7l8 4 8-4-8-4Z", "M4 11l8 4 8-4", "M7 13v4c2.2 2 7.8 2 10 0v-4"],
    mentoring: ["M7 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M17 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M2 21a5 5 0 0 1 10 0", "M14 21a4 4 0 0 1 8 0"],
    award: ["M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z", "M9 14l-1 7 4-2 4 2-1-7"],
    chart: ["M4 19V5", "M4 19h16", "M8 16v-5", "M12 16V8", "M16 16v-9"],
    building: ["M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16", "M20 21v-9a2 2 0 0 0-2-2h-2", "M8 7h4M8 11h4M8 15h4"],
    school: ["M3 21h18", "M5 21V8l7-5 7 5v13", "M9 21v-7h6v7", "M9 10h.01M15 10h.01"],
    event: ["M7 2v4M17 2v4", "M3 8h18", "M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"],
    outreach: ["M12 21s-7-4.4-9-9a5 5 0 0 1 9-4 5 5 0 0 1 9 4c-2 4.6-9 9-9 9Z"],
    industry: ["M3 21h18", "M5 21V9l6 3V9l6 3v9", "M7 17h2M12 17h2M17 17h2"],
    alumni: ["M12 3 22 8l-10 5L2 8l10-5Z", "M6 10v5c2 2 10 2 12 0v-5"],
    placement: ["M10 6h4", "M6 21V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13", "M8 21h8", "M9 11h6M9 15h6"],
    journal: ["M4 19.5V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-1.5Z", "M8 7h6M8 11h8M8 15h5"],
    book: ["M4 19.5V5a2 2 0 0 1 2-2h11a3 3 0 0 1 3 3v15H6a2 2 0 0 1-2-1.5Z", "M8 7h7M8 11h7M8 15h5"],
    monitor: ["M3 5h18v12H3V5Z", "M8 21h8", "M12 17v4"],
    research: ["M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M21 21l-6-6", "M14 14l1-1"],
    project: ["M4 7h16", "M4 12h16", "M4 17h10", "M6 5v14"],
    obe: ["M4 5h16v14H4V5Z", "M8 9h8", "M8 13h5", "M16 16l2 2 3-4"],
    fundedProject: ["M4 7h16v12H4V7Z", "M8 7V5h8v2", "M8 13h8", "M8 16h5"],
    externalProject: ["M5 12h14", "M13 6l6 6-6 6", "M5 5v14"],
    patent: ["M12 2l7 4v6c0 5-3 8-7 10-4-2-7-5-7-10V6l7-4Z", "M9 12l2 2 4-5"],
    trophy: ["M8 21h8", "M12 17v4", "M7 4h10v5a5 5 0 0 1-10 0V4Z", "M5 6H3a3 3 0 0 0 3 3h1", "M19 6h2a3 3 0 0 1-3 3h-1"],
    conference: ["M4 5h16v10H4V5Z", "M8 21h8", "M12 15v6"],
    consultancy: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01M3 12h.01M3 18h.01"],
    startup: ["M12 2c3 2 5 5 5 9 0 4-5 11-5 11S7 15 7 11c0-4 2-7 5-9Z", "M12 9h.01"],
    training: ["M3 7h18", "M5 7v12h14V7", "M9 11h6M9 15h4"],
    workshop: ["M4 4h16v6H4V4Z", "M6 14h12", "M8 18h8", "M10 10v4", "M14 10v4"],
    industrialTraining: ["M3 21h18", "M4 21V10l5 3v-3l5 3v-3l6 4v7", "M7 17h2M12 17h2M17 17h2"],
  };
  const paths = icons[type] || icons.project;
  return (
    <span className="appraisal-subsection-icon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {paths.map((path) => <path key={path} d={path} />)}
      </svg>
    </span>
  );
}
function SubsectionTitle({ icon, children }) {
  const displayTitle = stripMaxMarksFromTitle(children);

  return (
    <div className="appraisal-subsection-title" style={{ display: "flex", alignItems: "center", gap: 8, color: "#4338ca", fontWeight: 800 }}>
      <SubsectionIcon type={icon} />
      <span>{displayTitle}</span>
      <SectionInfoButton titleText={children} />
    </div>
  );
}

const partEParameters = [
  { parameter: "Self-motivation & Proactiveness", description: "List of activities/initiatives other than regular load/duties.", max: 10 },
  { parameter: "Knowledge & Competence", description: "Domain/technical expertise relevant to role, Understanding of policies, procedures, and compliance requirements", max: 10 },
  { parameter: "Target-based Work", description: "Tasks allotted; timely completion observed by authorities, Accuracy and thoroughness of output. Volume of work handled relative to role expectations, Adherence to deadlines and timelines", max: 10 },
  { parameter: "Leadership & Supervisory Skills", description: "Team management and delegation, Mentoring/developing subordinates, Decision-making under ambiguity", max: 10 },
  { parameter: "Adaptability & Learning", description: "Openness to change, new tools, or new processes, Response to feedback and coaching, Handling of unexpected/crisis situations", max: 10 },
];

function normalizeAcademicYearCycles(cyclesData) {
  const normalizeAcademicYearLabel = (value) => {
    const label = String(value || "").trim();
    const shortMatch = label.match(/^(\d{2})-(\d{2})$/);
    if (shortMatch) return `20${shortMatch[1]}-20${shortMatch[2]}`;
    return label;
  };

  const normalizeCycle = (cycle) => {
    if (!cycle) return null;
    if (typeof cycle === "string") {
      return { academic_year: cycle, is_open: cycle === APP_INFO.DEFAULT_AY };
    }
    const academicYear = normalizeAcademicYearLabel(cycle.academic_year || cycle.academicYear || cycle.year || cycle.year_label || "");
    if (!academicYear) return null;
    return {
      academic_year: academicYear,
      is_open: cycle.is_open ?? cycle.isOpen ?? cycle.active ?? cycle.open ?? (String(academicYear) === APP_INFO.DEFAULT_AY),
    };
  };

  let list = [];
  if (Array.isArray(cyclesData)) {
    list = cyclesData.map(normalizeCycle).filter(Boolean);
  } else if (Array.isArray(cyclesData?.cycles)) {
    list = cyclesData.cycles.map(normalizeCycle).filter(Boolean);
  } else if (Array.isArray(cyclesData?.data)) {
    list = cyclesData.data.map(normalizeCycle).filter(Boolean);
  }

  if (list.length === 0) {
    const openYear = APP_INFO.DEFAULT_AY || "2026-2027";
    list.push({ academic_year: openYear, is_open: true });
  }

  return list
    .reduce((acc, cycle) => {
      if (!acc.some((existing) => existing.academic_year === cycle.academic_year)) {
        acc.push(cycle);
      }
      return acc;
    }, [])
    .sort((a, b) => b.academic_year.localeCompare(a.academic_year));
}

const storedAcademicYearCycles = () =>
  getSessionItem("availableCyclesSource") === "backend"
    ? JSON.parse(getSessionItem("availableCycles") || "[]")
    : [];

const sessionFacultyInfo = (academicYear, defaultDesignation = "") => ({
  name: sessionStorage.getItem("name") || "",
  qual: sessionStorage.getItem("qualification") || "",
  desig: sessionStorage.getItem("designation") || defaultDesignation || "",
  school: sessionStorage.getItem("school") || sessionStorage.getItem("department") || "",
  experience: sessionStorage.getItem("experience") || "",
  ay: academicYear,
});

const profileSafeInfoForYear = (nextInfo = {}, academicYear, defaultDesignation = "") => {
  const safeAcademicYear = academicYear || nextInfo.ay || APP_INFO.DEFAULT_AY;
  if (isLegacyTwoPartAcademicYear(safeAcademicYear)) return { ...nextInfo, ay: safeAcademicYear };
  return {
    ...nextInfo,
    ...sessionFacultyInfo(safeAcademicYear, defaultDesignation),
    ay: safeAcademicYear,
  };
};

export default function StandardMyAppraisal({
  sectionTab,
  onSectionTabChange,
  showSectionSelector = false,
  defaultDesignation = sessionStorage.getItem("designation") || "",
  defaultAcademicYear = getActiveAcademicYear(),
  titleNameFallback = "Faculty",
  subtitleSeparator = ".",
} = {}) {
  const navigate = useNavigate();
  const loadRequestRef = useRef(0);
  const [localAppraisalTab, setLocalAppraisalTab] = useState("partA");
  const hodAppraisalTab = sectionTab || localAppraisalTab;
  const setHodAppraisalTab = onSectionTabChange || setLocalAppraisalTab;
  const resolvedAcademicYear = defaultAcademicYear || getActiveAcademicYear();

  // -- HOD's own appraisal form state --
  const [info, setInfo] = useState({
    ...sessionFacultyInfo(resolvedAcademicYear, defaultDesignation),
    expDyp: "",
    expPrev: "",
    expTotal: "",
  });

  useEffect(() => {
    const syncAcademicYear = (event) => {
      const nextAcademicYear = event?.detail?.academicYear || getActiveAcademicYear();
      setInfo((previousInfo) => profileSafeInfoForYear(previousInfo, nextAcademicYear, defaultDesignation));
    };

    window.addEventListener("academicYearChanged", syncAcademicYear);
    return () => window.removeEventListener("academicYearChanged", syncAcademicYear);
  }, [defaultDesignation]);

  useEffect(() => {
    setInfo((previousInfo) => profileSafeInfoForYear(previousInfo, resolvedAcademicYear, defaultDesignation));
  }, [resolvedAcademicYear, defaultDesignation]);

  const [availableCyclesState, setAvailableCyclesState] = useState(() => normalizeAcademicYearCycles(storedAcademicYearCycles()));

  useEffect(() => {
    const syncAvailableCycles = () => {
      setAvailableCyclesState(normalizeAcademicYearCycles(storedAcademicYearCycles()));
    };
    window.addEventListener("academicYearChanged", syncAvailableCycles);
    return () => window.removeEventListener("academicYearChanged", syncAvailableCycles);
  }, []);
  const inf = (k) => (v) => setInfo((p) => ({ ...p, [k]: v }));

  const [lectures, setLectures] = useState([
    { sem: "", code: "", planned: "", conducted: "", score: "", hod: "", director: "" },
  ]);
  const setLec = (i, k, v) => setLectures((p) => p.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, [k]: v };
    if (k === "planned" || k === "conducted") {
      const planned = Number(next.planned);
      const conducted = Number(next.conducted);
      next.pctConducted = planned > 0 && conducted >= 0 ? `${((conducted / planned) * 100).toFixed(1)}%` : "";
    }
    if (k === "planned" || k === "conducted" || k === "pctConducted") next.score = String(lectureGuidelineScore(next));
    return next;
  }));

  const [courseFile, setCourseFile] = useState([{ course: "", title: "", details: "", score: "", hod: "", director: "" }]);
  const setCF = (i, k, v) => setCourseFile((p) => p.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, [k]: v };
    return next;
  }));

  const [innovScore, setInnovScore] = useState("");
  const [innovDetails, setInnovDetails] = useState("");
  const [innovRows, setInnovRows] = useState([blankInnovativeRow()]);
  const setInnov = (i, k, v) => setInnovRows((p) => p.map((r, j) => j === i ? { ...r, max: r.max || A3_INNOVATIVE_ROW_MAX, [k]: v } : r));
  const [projects, setProjects] = useState([
    { label: "", score: "", hod: "", director: "" },
  ]);
  const setProj = (i, k, v) => setProjects((p) => p.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, [k]: k === "score" ? String(clampScore(v, projectGuidanceRowMax(r)) || "") : v };
    return k === "label" ? { ...next, score: String(clampScore(next.score, projectGuidanceRowMax(next)) || "") } : next;
  }));

  const [quals, setQuals] = useState([
    { label: "", score: "", hod: "", director: "" },
  ]);
  const setQual = (i, k, v) => setQuals((p) => p.map((r, j) => j === i ? { ...r, [k]: k === "score" ? String(clampScore(v, A8_QUALIFICATION_MAX) || "") : v } : r));

  const [feedback, setFeedback] = useState([
    { code: "", fb1: "", fb2: "", score: "", hod: "", director: "" },
  ]);
  const setFb = (i, k, v) => setFeedback((p) => p.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, [k]: v };
    if (k === "fb1" || k === "fb2") next.score = String(feedbackGuidelineScore(feedbackAverage(next)));
    return next;
  }));

  const [obeRows, setObeRows] = useState(defaultObeRows);
  const setObe = (i, k, v) => setObeRows((p) => p.map((r, j) => j === i ? { ...r, [k]: k === "score" ? String(clampScore(v, r.max || A5_OBE_MAX) || "") : v } : r));

  const [mentoringRows, setMentoringRows] = useState(defaultMentoringRows);
  const setMentoring = (i, k, v) => setMentoringRows((p) => p.map((r, j) => j === i ? { ...r, [k]: k === "score" ? String(clampScore(v, r.max || A7_MENTORING_MAX) || "") : v } : r));

  const [deptActs, setDeptActs] = useState([
    { activity: "", nature: "", period: "", score: "", hod: "", director: "" },
  ]);
  const setDept = (i, k, v) => setDeptActs((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [uniActs, setUniActs] = useState([
    { activity: "", nature: "", period: "", score: "", hod: "", director: "" },
  ]);
  const setUni = (i, k, v) => setUniActs((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [eventRows, setEventRows] = useState([
    { event: "", role: "", fromDate: "", toDate: "", level: "", score: "" },
  ]);
  const setEvent = (i, k, v) => setEventRows((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [society, setSociety] = useState([
    { label: "", details: "", date: "", score: "", hod: "", director: "", max: C4_OUTREACH_MAX },
  ]);
  const setSoc = (i, k, v) => setSociety((p) => p.map((r, j) => j === i ? { ...r, max: r.max || C4_OUTREACH_MAX, [k]: v } : r));

  const [industry, setIndustry] = useState([
    { activity: "", partner: "", date: "", name: "", details: "", score: "", hod: "", director: "" },
  ]);
  const setInd = (i, k, v) => setIndustry((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [alumniRows, setAlumniRows] = useState([
    { activity: "", details: "", date: "", score: "" },
  ]);
  const setAlumni = (i, k, v) => setAlumniRows((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [placementRows, setPlacementRows] = useState([
    { activityType: "", name: "", date: "", score: "" },
  ]);
  const setPlacement = (i, k, v) => setPlacementRows((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [acr, setAcr] = useState(createAcrRows);
  const setAcrRow = (i, k, v) => setAcr((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [journals, setJournals] = useState([
    { title: "", journal: "", issn: "", index: "", score: "", hod: "", director: "" },
  ]);
  const setJour = (i, k, v) => setJournals((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [books, setBooks] = useState([
    { title: "", book: "", issn: "", pub: "", coauth: "", first: "", score: "", hod: "", director: "" },
  ]);
  const setBook = (i, k, v) => setBooks((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [ict, setIct] = useState([
    { title: "", desc: "", type: "", quad: "", score: "", hod: "", director: "" },
  ]);
  const setIctRow = (i, k, v) => setIct((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [research, setResearch] = useState([
    { degree: "", name: "", thesis: "", score: "", hod: "", director: "" },
  ]);
  const setRes = (i, k, v) => setResearch((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const [projects2, setProjects2] = useState([
    { title: "", agency: "", date: "", amount: "", role: "", status: "", score: "", hod: "", max: B4_PROJECT_MAX },
  ]);
  const setPrj2 = (i, k, v) => setProjects2((p) => p.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, max: r.max || B4_PROJECT_MAX, [k]: v };
    if (k === "amount" || k === "status") next.score = String(externalProjectGuidelineScore(next));
    return next;
  }));

  const [externalProjects, setExternalProjects] = useState([
    { title: "", agency: "", date: "", amount: "", role: "", status: "", score: "", hod: "" },
  ]);
  const setExtPrj = (i, k, v) => setExternalProjects((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [patents, setPatents] = useState([
    { title: "", type: "", date: "", status: "", fileNo: "", score: "", hod: "", director: "" },
  ]);
  const setPat = (i, k, v) => setPatents((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [awards, setAwards] = useState([
    { title: "", date: "", agency: "", level: "", score: "", hod: "", director: "" },
  ]);
  const setAwd = (i, k, v) => setAwards((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [confs, setConfs] = useState([
    { title: "", type: "", org: "", level: "", score: "", hod: "", director: "" },
  ]);
  const setConf = (i, k, v) => setConfs((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [proposals, setProposals] = useState([
    { title: "", duration: "", agency: "", amount: "", score: "", hod: "", director: "" },
  ]);
  const setProp = (i, k, v) => setProposals((p) => p.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, [k]: v };
    if (k === "amount" || k === "revenue") next.score = String(consultancyGuidelineScore(next));
    return next;
  }));

  const [products, setProducts] = useState([
    { details: "", usage: "", score: "", hod: "", director: "" },
  ]);
  const setProd = (i, k, v) => setProducts((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [fdps, setFdps] = useState([
    { program: "", fromDate: "", toDate: "", org: "", score: "", hod: "", director: "" },
  ]);
  const setFdp = (i, k, v) => setFdps((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [training, setTraining] = useState([
    { company: "", duration: "", nature: "", score: "", hod: "", director: "" },
  ]);
  const setTrain = (i, k, v) => setTraining((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [exhibitions, setExhibitions] = useState([
    { title: "", type: "", venueLevel: "", date: "", score: "", hod: "", director: "" },
  ]);
  const setExh = (i, k, v) => setExhibitions((p) => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const [leaveManagement, setLeaveManagement] = useState([blankLeaveManagementRow()]);
  const setLeaveMgmt = (i, k, v) => setLeaveManagement((p) => p.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, [k]: v };
    return k === "managementRating" ? { ...next, score: String(partDRatingScore(v)) } : next;
  }));

  const [docs, setDocs] = useState({});
  const [appraisalLocked, setAppraisalLocked] = useState(false);
  const [sectionSaveStatus, setSectionSaveStatus] = useState({ partA: false, partB: false, partC: false, partD: false, partE: false });
  const [summaryOtherInfo, setSummaryOtherInfo] = useState("");
  const [savingSection, setSavingSection] = useState(null);
  const [workflowDeclaration, setWorkflowDeclaration] = useState(null);
  const [workflowReviews, setWorkflowReviews] = useState([]);
  const [legacyReportTotals, setLegacyReportTotals] = useState(null);
  const [loadingYearData, setLoadingYearData] = useState(false);
  const [loadedAcademicYear, setLoadedAcademicYear] = useState(null);
  const [yearLoadError, setYearLoadError] = useState("");
  const [declarationConfirmed, setDeclarationConfirmed] = useState(false);
  const [attachmentsConfirmed, setAttachmentsConfirmed] = useState(false);
  const [appraisalWindowStatus, setAppraisalWindowStatus] = useState(null);
  const [appraisalWindowError, setAppraisalWindowError] = useState("");
  const selectedCycle = availableCyclesState.find((cycle) => cycle.academic_year === info.ay);
  const isSelectedCycleClosed = selectedCycle ? !selectedCycle.is_open : false;
  const isSelectedCycleOpen = selectedCycle ? Boolean(selectedCycle.is_open) : false;
  const isLegacyTwoPartYear = isLegacyTwoPartAcademicYear(info.ay);
  const appraisalWindowLocked = !isLegacyTwoPartYear && !isSelectedCycleOpen && !canEditSelfAppraisal(appraisalWindowStatus, { declaration: workflowDeclaration });
  const formLocked = appraisalLocked || appraisalWindowLocked || loadingYearData || loadedAcademicYear !== info.ay;
  const partDLocked = !isLegacyTwoPartYear && hasActiveRejection(workflowDeclaration, workflowReviews);
  const closedAppraisalCycleMessage = `Appraisal cycle for Academic Year ${info.ay} is closed. The next appraisal cycle form will be available soon. For any queries, please contact appraisal@dypiu.ac.in.`;
  const appraisalWindowLockMessage = isSelectedCycleOpen || isSelectedCycleClosed ? "" : appraisalWindowError || (appraisalWindowLocked ? appraisalWindowMessage(appraisalWindowStatus, info.ay) : "");
  // The latest cycle (newest-first list) stays on the normal form, locked read-only, when
  // closed - it only becomes the compact historical report once a newer cycle exists above it.
  // Mirrors the Non-Teaching isLatestCycle/showAsHistorical rule in NonTeachingStaffDashboard.jsx.
  const isLatestCycle = (availableCyclesState[0]?.academic_year || info.ay) === info.ay;
  const showClosedReportOnly = isSelectedCycleClosed && !isLegacyTwoPartYear && !isLatestCycle;
  const sectionOptions = isLegacyTwoPartYear
    ? [
        ["partA", "Part A"],
        ["partB", "Part B"],
      ]
    : [
        ["partA", "Part A"],
        ["partB", "Part B"],
        ["partC", "Part C"],
        ["partD", "Part D"],
        ["partE", "Part E"],
        ["summary", "Summary"],
      ];

  const appraisalSetters = {
    setInfo: (value) => setInfo((currentInfo) => {
      const nextInfo = typeof value === "function" ? value(currentInfo) : value;
      return profileSafeInfoForYear(nextInfo || {}, nextInfo?.ay || currentInfo.ay || info.ay, defaultDesignation);
    }),
    setLectures, setCourseFile, setInnovRows: (rows) => setInnovRows(sanitizeInnovativeRows(rows)), setInnovDetails, setInnovScore,
    setProjects, setObeRows, setMentoringRows, setQuals, setFeedback, setDeptActs, setUniActs,
    setEventRows: (rows) => setEventRows(migrateLegacyRowFields(rows, [["fromDate", "date"], ["toDate", "date"]])),
    setSociety,
    setIndustry: (rows) => setIndustry(migrateLegacyRowFields(rows, [["activity", "name"], ["partner", "details"]])),
    setAlumniRows, setPlacementRows, setAcr,
    setJournals: (rows) => setJournals(migrateLegacyRowFields(rows, [["impactFactor", "impact"], ["authorPosition", "position"]])),
    setBooks: (rows) => setBooks(migrateLegacyRowFields(rows, [["book", "publisherIsbn"], ["pub", "type"]])),
    setIct: (rows) => setIct(migrateLegacyRowFields(rows, [["type", "desc"], ["quad", "reach"]])),
    setResearch: (rows) => setResearch(migrateLegacyRowFields(rows, [["status", "thesis"]])),
    setProjects2, setExternalProjects,
    setPatents: (rows) => setPatents(migrateLegacyRowFields(rows, [["type", "level"], ["type", "scope"], ["fileNo", "date"]])),
    setAwards,
    setConfs: (rows) => setConfs(migrateLegacyRowFields(rows, [["role", "type"], ["level", "org"]])),
    setProposals: (rows) => setProposals(migrateLegacyRowFields(rows, [["agency", "title"], ["duration", "nature"], ["amount", "revenue"]])),
    setProducts: (rows) => setProducts(migrateLegacyRowFields(rows, [["details", "title"], ["role", "usage"]])),
    setFdps, setTraining, setExhibitions, setDocs,
    setSummaryOtherInfo, setSectionSaveStatus, setLeaveManagement,
  };

  useEffect(() => {
    let active = true;
    setAppraisalWindowStatus(null);
    setAppraisalWindowError("");
    if (!info.ay) {
      setAppraisalWindowError("Please select an academic year.");
      return undefined;
    }
    if (isLegacyTwoPartYear) {
      setAppraisalWindowStatus({ academic_year: info.ay, is_open: true, status: "open" });
      return undefined;
    }
    getAppraisalWindowStatus({ academicYear: info.ay })
      .then((status) => {
        if (!active) return;
        setAppraisalWindowStatus(status);
      })
      .catch((err) => {
        if (!active) return;
        setAppraisalWindowError(appraisalWindowErrorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [info.ay, isLegacyTwoPartYear]);

  useEffect(() => {
    const userEmail = sessionStorage.getItem("username") || sessionStorage.getItem("email");
    if (!userEmail || !info.ay) return;
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    let cancelled = false;
    const requestedAcademicYear = info.ay;
    const isCurrentLoad = () => !cancelled && loadRequestRef.current === requestId;
    // Totals depend on every section, not only the currently visible tab.
    const scopedAppraisalSetters = scopeYearSetters(standardReadSetters(appraisalSetters), isCurrentLoad);
    resetSnapshotSetters(requestedAcademicYear, scopedAppraisalSetters);
    setLeaveManagement([blankLeaveManagementRow()]);
    setDeclarationConfirmed(false);
    setAttachmentsConfirmed(false);
    setLoadedAcademicYear(null);
    setYearLoadError("");
    setWorkflowDeclaration(null);
    setWorkflowReviews([]);
    setDocs({});
    setLegacyReportTotals(null);
    setLoadingYearData(true);

    const loadOwnAppraisal = async () => {
      try {
        const data = await api.get("/appraisal/status", { params: { academic_year: requestedAcademicYear } });
        if (!isCurrentLoad()) return;
        const declaration = data?.declaration || null;
        setWorkflowDeclaration(declaration);
        const loadedReviews = reviewListFrom(data?.reviews);
        setWorkflowReviews(loadedReviews);
        const submittedAlready = Boolean(declaration) && !hasActiveRejection(declaration, loadedReviews);
        setAppraisalLocked(isSelectedCycleClosed || submittedAlready);

        const savedAppraisal = await (isSelectedCycleClosed ? loadClosedAppraisal : loadSavedAppraisal)({
          facultyEmail: userEmail,
          academicYear: requestedAcademicYear,
          setters: scopedAppraisalSetters,
          // A legacy (previous-year) academic year is always a past, already-submitted
          // cycle, never the one being actively drafted - so it must be read from the
          // definitive submitted record for that exact email + academic year, not the
          // generic draft snapshot (which reflects whatever is currently being typed for
          // the active cycle and isn't reliably scoped by year).
          preferSubmitted: isLegacyTwoPartAcademicYear(requestedAcademicYear) || (Boolean(declaration) && hasActiveRejection(declaration, loadedReviews)),
        });
        if (!isCurrentLoad()) return;
        setLegacyReportTotals(isLegacyTwoPartAcademicYear(requestedAcademicYear)
          ? legacySubmittedTotals(
              savedAppraisal,
              savedAppraisal?.totals,
              savedAppraisal?.payload,
              savedAppraisal?.payload?.totals,
              savedAppraisal?.form,
              savedAppraisal?.payload?.form,
              savedAppraisal?.declaration,
              savedAppraisal?.payload?.declaration,
            )
          : null);
        const savedDeclaration = savedAppraisal?.declaration || savedAppraisal?.payload?.declaration || null;
        if (savedDeclaration && !declaration) setWorkflowDeclaration(savedDeclaration);
        const savedReviews = reviewListFrom(savedAppraisal?.reviews || savedAppraisal?.payload?.reviews);
        if (savedReviews.length && !loadedReviews.length) setWorkflowReviews(savedReviews);
        // Submission requires both confirmations. Restore them from this year's
        // submitted record, not merely from a closed/locked appraisal window.
        // Rejected records must be confirmed again before resubmission.
        const submittedDeclaration = declaration || savedDeclaration;
        const submittedReviews = loadedReviews.length ? loadedReviews : savedReviews;
        const confirmationsSubmitted = Boolean(submittedDeclaration)
          && !hasActiveRejection(submittedDeclaration, submittedReviews);
        setDeclarationConfirmed(confirmationsSubmitted);
        setAttachmentsConfirmed(confirmationsSubmitted);

        await Promise.all([
          loadAppraisalDocuments({
            facultyEmail: userEmail,
            academicYear: requestedAcademicYear,
            setDocs: (nextDocs) => {
              if (isCurrentLoad()) setDocs(nextDocs);
            },
          }),
        ]);
        if (isCurrentLoad()) setLoadedAcademicYear(requestedAcademicYear);
      } catch (err) {
        console.error("Could not load saved appraisal:", err);
        if (isCurrentLoad()) setYearLoadError("Unable to load this academic year's appraisal. Please reload before editing.");
      } finally {
        if (isCurrentLoad()) setLoadingYearData(false);
      }
    };

    loadOwnAppraisal();
    return () => {
      cancelled = true;
    };
  }, [info.ay, isSelectedCycleClosed]);

  useEffect(() => {
    if (isLegacyTwoPartYear && !["partA", "partB"].includes(hodAppraisalTab)) {
      setHodAppraisalTab("partA");
    }
  }, [isLegacyTwoPartYear, hodAppraisalTab]);


  // -- Computed scores for HOD appraisal --
  const totalLecScore = sumSectionScore(lectures, A1_COURSE_DELIVERY_MAX, "score", 10);
  const courseFileScore = sumSectionScore(courseFile, A2_COURSE_FILE_MAX, "score", SCORE_LIMITS.courseFileRow);
  const innovTotal = clampScore(innovRows.reduce((s, r) => s + clampScore(r.score, A3_INNOVATIVE_ROW_MAX), 0), A3_INNOVATIVE_MAX);
  const selectedInnovativeMethods = new Set(innovRows.map((row) => String(row.method ?? "").trim()).filter(Boolean));
  const innovativeMethodOptionsForRow = (currentMethod) => INNOVATIVE_METHOD_OPTIONS.filter((option) => option.value === currentMethod || !selectedInnovativeMethods.has(option.value));
  const innovScoreComputed = String(innovTotal);
  const projectTotal = sumSectionScore(projects, A6_PROJECT_GUIDANCE_MAX, "score", A6_PROJECT_GUIDANCE_MAX);
  const obeScore = sumSectionScore(obeRows, A5_OBE_MAX);
  const mentoringScore = sumSectionScore(mentoringRows, A7_MENTORING_MAX);
  const qualTotal = sumSectionScore(quals, A8_QUALIFICATION_MAX, "score", SCORE_LIMITS.qualificationRow);
  const teachingRaw = totalLecScore + courseFileScore + innovTotal + projectTotal + obeScore + mentoringScore + qualTotal;
  const stuFeedbackScore = feedbackSectionScore(feedback, A4_FEEDBACK_MAX);
  const deptScore = sumSectionScore(deptActs, C2_SCHOOL_ADMIN_MAX);
  const uniScore = sumSectionScore(uniActs, C1_UNIVERSITY_ADMIN_MAX);
  const eventScore = sumSectionScore(eventRows, C3_EVENT_MAX);
  const societyScore = sumSectionScore(society, C4_OUTREACH_MAX);
  const industryScore = sumSectionScore(industry, C5_INDUSTRY_MAX);
  const alumniScore = sumSectionScore(alumniRows, C6_ALUMNI_MAX);
  const placementScore = sumSectionScore(placementRows, C7_PLACEMENT_MAX);
  const acrScore = 0;
  const teachingMax = PART_A_MAX;
  const effectivePartAMax = PART_A_MAX;
  const partATotal = clampScore(teachingRaw + stuFeedbackScore, effectivePartAMax);

  const journalScore = sumSectionScore(journals, B1_JOURNAL_MAX);
  const bookScore = sumSectionScore(books, B2_BOOK_MAX);
  const ictScore = sumSectionScore(ict, B3_ICT_MAX);
  const researchScore = clampScore(research.reduce((total, row) => total + researchGuidanceScore(row), 0), B5_RESEARCH_GUIDANCE_MAX);
  const projectBScore = sumSectionScore(projects2, B4_PROJECT_MAX);
  const externalProjectScore = 0;
  const patentScore = sumSectionScore(patents, B3_PATENT_MAX);
  const awardScore = sumSectionScore(awards, B9_AWARDS_MAX);
  const confScore = sumSectionScore(confs, B7_CONFERENCE_MAX);
  const proposalScore = sumSectionScore(proposals, B6_CONSULTANCY_MAX);
  const productScore = sumSectionScore(products, B10_STARTUP_MAX);
  const fdpScore = fdps.reduce((s, r) => s + clampScore(parseFloat(r.score) || 0, B8_ATTENDED_MAX), 0);
  // Industrial Training used to be its own visible, editable section; it was folded into the
  // combined B8 table above and its input is now display:none (kept only so old printed reports
  // still list those historical rows). Its score must NOT feed the live/submitted B8 total any
  // more - a faculty member has no way to see or clear that hidden row, so counting it made the
  // total look like it defaulted to a nonzero value out of nowhere.
  const b8Score = clampScore(fdpScore, B8_ATTENDED_MAX);
  const researchGuidanceProjectMax = B4_PROJECT_MAX + B5_RESEARCH_GUIDANCE_MAX;
  const effectivePartBMax = PART_B_MAX;
  const partCTotal = clampScore(uniScore + deptScore + eventScore + societyScore + industryScore + alumniScore + placementScore, PART_C_MAX);
  const partDTotal = sumSectionScore(leaveManagement, PART_D_MAX, "score", PART_D_MAX);
  const effectiveGrandMax = effectivePartAMax + effectivePartBMax + PART_C_MAX + PART_D_MAX;
  const partBTotal = clampScore(journalScore + bookScore + ictScore + researchScore + projectBScore + patentScore + awardScore + confScore + proposalScore + productScore + b8Score, effectivePartBMax);
  const grandTotal = clampScore(partATotal + partBTotal + partCTotal + partDTotal, effectiveGrandMax);

  const partAMarksPercentage = effectivePartAMax > 0 ? ((partATotal / effectivePartAMax) * 100).toFixed(2) : "0.00";
  const partBMarksPercentage = effectivePartBMax > 0 ? ((partBTotal / effectivePartBMax) * 100).toFixed(2) : "0.00";
  const partCMarksPercentage = PART_C_MAX > 0 ? ((partCTotal / PART_C_MAX) * 100).toFixed(2) : "0.00";
  const partDMarksPercentage = PART_D_MAX > 0 ? ((partDTotal / PART_D_MAX) * 100).toFixed(2) : "0.00";
  const totalMarksPercentage = effectiveGrandMax > 0 ? ((grandTotal / effectiveGrandMax) * 100).toFixed(2) : "0.00";

  const gradeFunc = () => {
    const p = pct(grandTotal, effectiveGrandMax);
    if (p >= 85) return { label: "Outstanding", color: "#10b981" };
    if (p >= 70) return { label: "Very Good", color: "#3b82f6" };
    if (p >= 55) return { label: "Good", color: "#f59e0b" };
    if (p >= 40) return { label: "Satisfactory", color: "#f97316" };
    return { label: "Needs Improvement", color: "#ef4444" };
  };
  const g = gradeFunc();
  const overallProgress = pct(grandTotal, effectiveGrandMax);
  const partWiseProgressRows = [
    ["Part A", partATotal, effectivePartAMax],
    ["Part B", partBTotal, effectivePartBMax],
    ["Part C", partCTotal, PART_C_MAX],
    ["Part D", partDTotal, PART_D_MAX],
  ];
  const [submitting, setSubmitting] = useState(false);
  const [submitDialogState, setSubmitDialogState] = useState(null);
  const [submissionError, setSubmissionError] = useState("");
  const [attachmentDownloading, setAttachmentDownloading] = useState(false);

  const validateSelfAppraisalRows = () => {
    const sections = [
      { label: "A(i). Lectures", rows: lectures, fields: ["sem", "code", "planned", "conducted", "score"] },
      { label: "A(ii). Course File", rows: courseFile, fields: ["course", "title", "details", "score"] },
      { label: "A(iii). Innovative Teaching Methods", rows: innovRows, fields: ["method", "details", "score"], fieldsForRow: (row) => row?.method === OTHER_INNOVATIVE_METHOD ? ["method", "methodOther", "details", "score"] : ["method", "details", "score"] },
      { label: "A5. Learning Outcomes Attainment & OBE Practice", rows: obeRows, fields: ["component", "score"], isRowActive: evidenceClaimedOrScored },
      { label: "A6. Student Project Guidance", rows: projects, fields: ["label", "score"], rowMax: A6_PROJECT_GUIDANCE_MAX, maxScore: A6_PROJECT_GUIDANCE_MAX },
      { label: "A7. Student Mentoring & Counselling", rows: mentoringRows, fields: ["activity", "score"], isRowActive: evidenceClaimedOrScored },
      { label: "A8. Professional Development & Qualification Enhancement", rows: quals, fields: ["label", "score"] },
      { label: "A(vi). Student Feedback", rows: feedback, fields: ["code", "fb1", "fb2"] },
      { label: "C1. Administration at University Level", rows: uniActs, fields: ["activity", "nature", "period", "score"] },
      { label: "C2. Administration at School Level", rows: deptActs, fields: ["activity", "nature", "period", "score"] },
      { label: "C3. Event Organisation & Institutional Visibility", rows: eventRows, fields: ["event", "role", "fromDate", "toDate", "level", "score"] },
      { label: "C4. Outreach, Extension & Social Responsibility", rows: society, fields: ["label", "details", "date", "score"], rowMax: C4_OUTREACH_MAX, maxScore: C4_OUTREACH_MAX },
      { label: "C5. Industry Interaction & Linkages", rows: industry, fields: ["activity", "partner", "date", "score"], rowMax: C5_INDUSTRY_MAX, maxScore: C5_INDUSTRY_MAX },
      { label: "C6. Alumni Engagement & Networking", rows: alumniRows, fields: ["activity", "details", "date", "score"] },
      { label: "C7. Student Placement Mentoring & Career Development", rows: placementRows, fields: ["activityType", "name", "date", "score"] },
      { label: "B1. Journals", rows: journals, fields: ["title", "journal", "score"], rowMax: B1_JOURNAL_MAX, maxScore: B1_JOURNAL_MAX },
      { label: "B2. Books / Chapters", rows: books, fields: ["title", "book", "pub", "score"], rowMax: B2_BOOK_MAX, maxScore: B2_BOOK_MAX },
      { label: "B3. Patents, Copyrights & IP and Product Development", rows: patents, fields: ["title", "type", "status", "fileNo", "score"], rowMax: B3_PATENT_MAX, maxScore: B3_PATENT_MAX },
      { label: "B4. External Funded Research Projects", rows: projects2, fields: ["title", "agency", "date", "amount", "role", "status", "score"] },
      { label: "B5. Research Guidance", rows: research, fields: B5_FIELDS, fieldsForRow: b5FieldsForRow, rowMax: b5RowMax },
      { label: "B6. Consultancy, Testing & Training", rows: proposals, fields: ["agency", "duration", "amount", "score"], rowMax: B6_CONSULTANCY_MAX, maxScore: B6_CONSULTANCY_MAX },
      { label: "B7. Conference / FDP / Training / Workshop Contributions as Resource Person", rows: confs, fields: ["title", "role", "date", "level", "score"], rowMax: B7_CONFERENCE_MAX, maxScore: B7_CONFERENCE_MAX },
      { label: "B8. Conference / FDP / Industry Training Attended", rows: fdps, fields: ["program", "fromDate", "toDate", "org", "score"], rowMax: B8_ATTENDED_MAX, maxScore: B8_ATTENDED_MAX },
      { label: "B8. Industrial Training", rows: training, fields: ["company", "duration", "nature", "score"], rowMax: B8_ATTENDED_MAX, maxScore: B8_ATTENDED_MAX },
      { label: "B9. Research Awards, Fellowships & Citations", rows: awards, fields: ["title", "date", "agency", "level", "score"], rowMax: B9_AWARDS_MAX, maxScore: B9_AWARDS_MAX },
      { label: "B10. Innovation, Start-ups & Technology Transfer", rows: products, fields: ["details", "role", "status", "score"], rowMax: B10_STARTUP_MAX, maxScore: B10_STARTUP_MAX },
      { label: "B11. ICT Content, MOOCs & E-Learning", rows: ict, fields: ["title", "type", "quad", "score"], rowMax: B3_ICT_MAX, maxScore: B3_ICT_MAX },
    ];
    const errors = validateCompleteRows(withRelaxedSectionCap(sections), docs);
    [...projects2, ...externalProjects].forEach((row, index) => {
      if (row.date && !isValidDDMMYYYY(row.date)) errors.push(`B4 project row ${index + 1}: date must be DD/MM/YYYY.`);
    });
    eventRows.forEach((row, index) => {
      if (row.fromDate && !isValidDDMMYYYY(row.fromDate)) errors.push(`C3 row ${index + 1}: From date must be DD/MM/YYYY.`);
      if (row.toDate && !isValidDDMMYYYY(row.toDate)) errors.push(`C3 row ${index + 1}: To date must be DD/MM/YYYY.`);
    });
    fdps.forEach((row, index) => {
      if (row.fromDate && !isValidDDMMYYYY(row.fromDate)) errors.push(`B8 row ${index + 1}: From date must be DD/MM/YYYY.`);
      if (row.toDate && !isValidDDMMYYYY(row.toDate)) errors.push(`B8 row ${index + 1}: To date must be DD/MM/YYYY.`);
    });
    if (errors.length) { alert(errors.join("\n")); return false; }
    return true;
  };

  const validateSelfAppraisalSectionRows = (section) => {
    const partASections = [
      { label: "A(i). Lectures", rows: lectures, fields: ["sem", "code", "planned", "conducted", "score"] },
      { label: "A(ii). Course File", rows: courseFile, fields: ["course", "title", "details", "score"] },
      { label: "A(iii). Innovative Teaching Methods", rows: innovRows, fields: ["method", "details", "score"], fieldsForRow: (row) => row?.method === OTHER_INNOVATIVE_METHOD ? ["method", "methodOther", "details", "score"] : ["method", "details", "score"] },
      { label: "A5. Learning Outcomes Attainment & OBE Practice", rows: obeRows, fields: ["component", "score"], isRowActive: evidenceClaimedOrScored },
      { label: "A6. Student Project Guidance", rows: projects, fields: ["label", "score"], rowMax: A6_PROJECT_GUIDANCE_MAX, maxScore: A6_PROJECT_GUIDANCE_MAX },
      { label: "A7. Student Mentoring & Counselling", rows: mentoringRows, fields: ["activity", "score"], isRowActive: evidenceClaimedOrScored },
      { label: "A8. Professional Development & Qualification Enhancement", rows: quals, fields: ["label", "score"] },
      { label: "A(vi). Student Feedback", rows: feedback, fields: ["code", "fb1", "fb2"] },
    ];
    const partCSections = [
      { label: "C1. Administration at University Level", rows: uniActs, fields: ["activity", "nature", "period", "score"] },
      { label: "C2. Administration at School Level", rows: deptActs, fields: ["activity", "nature", "period", "score"] },
      { label: "C3. Event Organisation & Institutional Visibility", rows: eventRows, fields: ["event", "role", "fromDate", "toDate", "level", "score"] },
      { label: "C4. Outreach, Extension & Social Responsibility", rows: society, fields: ["label", "details", "date", "score"], rowMax: C4_OUTREACH_MAX, maxScore: C4_OUTREACH_MAX },
      { label: "C5. Industry Interaction & Linkages", rows: industry, fields: ["activity", "partner", "date", "score"], rowMax: C5_INDUSTRY_MAX, maxScore: C5_INDUSTRY_MAX },
      { label: "C6. Alumni Engagement & Networking", rows: alumniRows, fields: ["activity", "details", "date", "score"] },
      { label: "C7. Student Placement Mentoring & Career Development", rows: placementRows, fields: ["activityType", "name", "date", "score"] },
    ];
    const partBSections = [
      { label: "B1. Journals", rows: journals, fields: ["title", "journal", "issn", "index", "score"], rowMax: B1_JOURNAL_MAX, maxScore: B1_JOURNAL_MAX },
      { label: "B2. Books / Chapters", rows: books, fields: ["title", "book", "issn", "pub", "coauth", "first", "score"], rowMax: B2_BOOK_MAX, maxScore: B2_BOOK_MAX },
      { label: "B3. Patents, Copyrights & IP and Product Development", rows: patents, fields: ["title", "type", "status", "fileNo", "score"], rowMax: B3_PATENT_MAX, maxScore: B3_PATENT_MAX },
      { label: "B4. External Funded Research Projects", rows: projects2, fields: ["title", "agency", "date", "amount", "role", "status", "score"] },
      { label: "B5. Research Guidance", rows: research, fields: B5_FIELDS, fieldsForRow: b5FieldsForRow, rowMax: b5RowMax },
      { label: "B6. Consultancy, Testing & Training", rows: proposals, fields: ["agency", "duration", "amount", "score"], rowMax: B6_CONSULTANCY_MAX, maxScore: B6_CONSULTANCY_MAX },
      { label: "B7. Conference / FDP / Training / Workshop Contributions as Resource Person", rows: confs, fields: ["title", "role", "date", "level", "score"], rowMax: B7_CONFERENCE_MAX, maxScore: B7_CONFERENCE_MAX },
      { label: "B8. Conference / FDP / Industry Training Attended", rows: fdps, fields: ["program", "fromDate", "toDate", "org", "score"], rowMax: B8_ATTENDED_MAX, maxScore: B8_ATTENDED_MAX },
      { label: "B8. Industrial Training", rows: training, fields: ["company", "duration", "nature", "score"], rowMax: B8_ATTENDED_MAX, maxScore: B8_ATTENDED_MAX },
      { label: "B9. Research Awards, Fellowships & Citations", rows: awards, fields: ["title", "date", "agency", "level", "score"], rowMax: B9_AWARDS_MAX, maxScore: B9_AWARDS_MAX },
      { label: "B10. Innovation, Start-ups & Technology Transfer", rows: products, fields: ["details", "role", "status", "score"], rowMax: B10_STARTUP_MAX, maxScore: B10_STARTUP_MAX },
      { label: "B11. ICT Content, MOOCs & E-Learning", rows: ict, fields: ["title", "type", "quad", "score"], rowMax: B3_ICT_MAX, maxScore: B3_ICT_MAX },
    ];
    const sectionMap = { partA: partASections, partB: partBSections, partC: partCSections, partD: [], partE: [] };
    const errors = validateCompleteRows(withRelaxedSectionCap(sectionMap[section] || partASections), docs);
    if (section === "partB") {
      [...projects2, ...externalProjects].forEach((row, index) => {
        if (row.date && !isValidDDMMYYYY(row.date)) errors.push(`B4 project row ${index + 1}: date must be DD/MM/YYYY.`);
      });
      fdps.forEach((row, index) => {
        if (row.fromDate && !isValidDDMMYYYY(row.fromDate)) errors.push(`B8 row ${index + 1}: From date must be DD/MM/YYYY.`);
        if (row.toDate && !isValidDDMMYYYY(row.toDate)) errors.push(`B8 row ${index + 1}: To date must be DD/MM/YYYY.`);
      });
    }
    if (section === "partC") {
      eventRows.forEach((row, index) => {
        if (row.fromDate && !isValidDDMMYYYY(row.fromDate)) errors.push(`C3 row ${index + 1}: From date must be DD/MM/YYYY.`);
        if (row.toDate && !isValidDDMMYYYY(row.toDate)) errors.push(`C3 row ${index + 1}: To date must be DD/MM/YYYY.`);
      });
    }
    if (errors.length) {
      alert(errors.join("\n"));
      return false;
    }
    return true;
  };

  const isMyAppraisalSectionOpen = (_section) => true;

  const handleMyAppraisalSectionChange = (section) => {
    setHodAppraisalTab(section);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  };

  const getValue = (localVal) => localVal;

  const buildSelfDraftForm = (saveStatus = sectionSaveStatus) => {
    const resolvedInnovRows = getValue(innovRows, "setInnovRows", "partA");
    const resolvedInnovTotal = clampScore(resolvedInnovRows.reduce((s, r) => s + clampScore(r.score, A3_INNOVATIVE_ROW_MAX), 0), A3_INNOVATIVE_MAX);
    const resolvedInnovScore = String(resolvedInnovTotal);
    const resolvedInnovDetails = resolvedInnovRows.map((row) => row.method).filter(Boolean).join(", ");

    return normalizeAutoScores({
      info: profileSafeInfoForYear(info, info.ay, defaultDesignation),
      lectures: getValue(lectures, "setLectures", "partA"),
      courseFile: getValue(courseFile, "setCourseFile", "partA"),
      innovDetails: resolvedInnovDetails,
      innovScore: resolvedInnovScore,
      innovRows: resolvedInnovRows.map((row) => ({ ...row, max: row.max || A3_INNOVATIVE_ROW_MAX })),
      projects: getValue(projects, "setProjects", "partA"),
      obeRows: getValue(obeRows, "setObeRows", "partA"),
      mentoringRows: getValue(mentoringRows, "setMentoringRows", "partA"),
      quals: getValue(quals, "setQuals", "partA"),
      feedback: getValue(feedback, "setFeedback", "partA"),
      deptActs: getValue(deptActs, "setDeptActs", "partC"),
      uniActs: getValue(uniActs, "setUniActs", "partC"),
      eventRows: getValue(eventRows, "setEventRows", "partC"),
      society: getValue(society, "setSociety", "partC").map((row) => ({ ...row, max: row.max || C4_OUTREACH_MAX })),
      industry: getValue(industry, "setIndustry", "partC"),
      alumniRows: getValue(alumniRows, "setAlumniRows", "partC"),
      placementRows: getValue(placementRows, "setPlacementRows", "partC"),
      acr: getValue(acr, "setAcr", "partA"),
      leaveManagement: getValue(leaveManagement, "setLeaveManagement", "partD"),
      journals: getValue(journals, "setJournals", "partB"),
      books: getValue(books, "setBooks", "partB"),
      ict: getValue(ict, "setIct", "partB"),
      research: getValue(research, "setResearch", "partB"),
      projects2: getValue(projects2, "setProjects2", "partB").map((row) => ({ ...row, max: row.max || B4_PROJECT_MAX })),
      externalProjects: getValue(externalProjects, "setExternalProjects", "partB"),
      patents: getValue(patents, "setPatents", "partB"),
      awards: getValue(awards, "setAwards", "partB"),
      confs: getValue(confs, "setConfs", "partB"),
      proposals: getValue(proposals, "setProposals", "partB"),
      products: getValue(products, "setProducts", "partB"),
      fdps: getValue(fdps, "setFdps", "partB"),
      training: getValue(training, "setTraining", "partB"),
      exhibitions: getValue(exhibitions, "setExhibitions", "partB"),
      summaryOtherInfo,
      sectionSaveStatus: saveStatus
    });
  };

  const markSnapshotLocked = () => {
    setAppraisalLocked(true);
    setWorkflowDeclaration((current) => current || { status: "Submitted" });
  };

  const autoSaveReadyRef = useRef(false);
  const autoSaveInFlightRef = useRef(false);
  const queuedAutoSaveRef = useRef(null);
  const lastAutoSavedFingerprintRef = useRef("");

  useEffect(() => {
    const userEmail = sessionStorage.getItem("username") || sessionStorage.getItem("email");
    if (!autoSaveReadyRef.current) {
      autoSaveReadyRef.current = true;
      return undefined;
    }
    if (!userEmail || !info.ay || formLocked || submitting || showClosedReportOnly || isLegacyTwoPartYear || (!isSelectedCycleOpen && !canSaveDraft(appraisalWindowStatus))) return undefined;

    // Build the (potentially large) snapshot + JSON.stringify only after the debounce
    // fires, not synchronously on every keystroke - keeps the main thread free while typing
    // and scrolling. Behaviour is otherwise unchanged: same debounce, same fingerprint
    // dedupe, same payload.
    const buildAutoSavePayload = () => {
      const formSnapshot = buildSelfDraftForm();
      const totalsSnapshot = { partATotal, partBTotal, partCTotal, partDTotal, grandTotal, effectivePartAMax, effectivePartBMax, effectivePartCMax: PART_C_MAX, effectivePartDMax: PART_D_MAX, effectiveGrandMax };
      const fingerprint = JSON.stringify({ form: formSnapshot, docs, totals: totalsSnapshot });
      return {
        fingerprint,
        facultyEmail: userEmail,
        academicYear: info.ay,
        form: formSnapshot,
        totals: totalsSnapshot,
        docs,
        submitterProfile: profileFromsessionStorage(),
        sectionSaveStatus,
      };
    };

    const autoSaveRequestId = loadRequestRef.current;
    const runAutoSave = async (snapshot) => {
      if (loadRequestRef.current !== autoSaveRequestId) return;
      if (autoSaveInFlightRef.current) {
        queuedAutoSaveRef.current = snapshot;
        return;
      }
      autoSaveInFlightRef.current = true;
      try {
        await saveAppraisalDraftSection(snapshot);
        if (loadRequestRef.current === autoSaveRequestId) lastAutoSavedFingerprintRef.current = snapshot.fingerprint;
      } catch (err) {
        if (loadRequestRef.current !== autoSaveRequestId) return;
        if (err?.statusCode === 403 || err?.response?.status === 403) {
          markSnapshotLocked();
        } else {
          console.warn("Auto-save failed:", err);
        }
      } finally {
        autoSaveInFlightRef.current = false;
        const queuedSnapshot = queuedAutoSaveRef.current;
        queuedAutoSaveRef.current = null;
        if (queuedSnapshot && queuedSnapshot.fingerprint !== lastAutoSavedFingerprintRef.current) {
          window.setTimeout(() => runAutoSave(queuedSnapshot), 0);
        }
      }
    };

    const timer = window.setTimeout(() => {
      if (loadRequestRef.current !== autoSaveRequestId) return;
      const payload = buildAutoSavePayload();
      if (payload.fingerprint === lastAutoSavedFingerprintRef.current) return;
      runAutoSave(payload);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [info, lectures, courseFile, innovRows, projects, obeRows, mentoringRows, quals, feedback, deptActs, uniActs, eventRows, society, industry, alumniRows, placementRows, acr, leaveManagement, journals, books, ict, research, projects2, externalProjects, patents, awards, confs, proposals, products, fdps, training, exhibitions, summaryOtherInfo, docs, sectionSaveStatus, formLocked, submitting, showClosedReportOnly, isLegacyTwoPartYear, isSelectedCycleOpen, appraisalWindowStatus, partATotal, partBTotal, partCTotal, partDTotal, grandTotal, effectivePartAMax, effectivePartBMax, effectiveGrandMax]);

  const handleSaveCurrentSection = async (section, navigateNext = true) => {
    if (savingSection) return;
    try { assertDraftOnline(); } catch (error) { alert(draftSaveErrorMessage(error)); return; }
    if (formLocked || (section === "partD" && partDLocked)) return;
    const userEmail = sessionStorage.getItem("username") || sessionStorage.getItem("email");
    if (!userEmail) {
      alert("Please login again before saving. Your session email was not found.");
      navigate("/login", { replace: true });
      return;
    }
    if (!isSelectedCycleOpen) {
      let latestWindowStatus;
      try {
        latestWindowStatus = await getAppraisalWindowStatus({ academicYear: info.ay });
        setAppraisalWindowStatus(latestWindowStatus);
        setAppraisalWindowError("");
      } catch (err) {
        const message = appraisalWindowErrorMessage(err);
        setAppraisalWindowError(message);
        alert(message);
        return;
      }
      if (!canSaveDraft(latestWindowStatus)) {
        alert("Draft saving is disabled because appraisal submission is closed.");
        return;
      }
    }
    const nextStatus = { ...sectionSaveStatus, [section]: true };
    setSavingSection(section);
    try {
      await confirmedDraftSave(() => saveAppraisalDraftSection({
        facultyEmail: userEmail,
        academicYear: info.ay,
        form: buildSelfDraftForm(nextStatus),
        totals: { partATotal, partBTotal, partCTotal, partDTotal, grandTotal, effectivePartAMax, effectivePartBMax, effectivePartCMax: PART_C_MAX, effectivePartDMax: PART_D_MAX, effectiveGrandMax },
        docs,
        submitterProfile: profileFromsessionStorage(),
        sectionSaveStatus: nextStatus,
      }));
      setSectionSaveStatus(nextStatus);
      if (navigateNext) {
        const NEXT_SECTION = { partA: "partB", partB: "partC", partC: "partD", partD: "partE", partE: "summary" };
        const nextTab = NEXT_SECTION[section];
        if (nextTab) {
          setHodAppraisalTab(nextTab);
          requestAnimationFrame(() => {
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
          });
        }
      }
    } catch (err) {
      if (err?.statusCode === 403 || err?.response?.status === 403) {
        markSnapshotLocked();
        return;
      }
      alert(draftSaveErrorMessage(err));
    } finally {
      setSavingSection(null);
    }
  };
  const handleSubmitAppraisal = async (confirmed = false) => {
    if (formLocked) {
      alert("This appraisal has already been submitted and is locked for review.");
      return;
    }
    if (!isSelectedCycleOpen) {
      let latestWindowStatus;
      try {
        latestWindowStatus = await getAppraisalWindowStatus({ academicYear: info.ay });
        setAppraisalWindowStatus(latestWindowStatus);
        setAppraisalWindowError("");
      } catch (err) {
        const message = appraisalWindowErrorMessage(err);
        setAppraisalWindowError(message);
        alert(message);
        return;
      }
      if (!canSubmitAppraisal(latestWindowStatus)) {
        alert("Appraisal submission is closed for this academic year.");
        return;
      }
    }
    if (!declarationConfirmed) {
      alert("Please tick the declaration checkbox before submitting.");
      return;
    }
    if (!attachmentsConfirmed) {
      alert("Please confirm that all required supporting documents and attachments have been uploaded.");
      return;
    }
    if (!validateSelfAppraisalRows()) return;

    // 1. Basic Validation
    if (!info.name || !info.ay) {
      alert("Please fill in basic faculty information (Name, Academic Year).");
      setHodAppraisalTab("partA");
      return;
    }

    const userEmail = sessionStorage.getItem("username") || sessionStorage.getItem("email");
    if (!userEmail) {
      alert("Please login again before submitting. Your email was not found in this session.");
      navigate("/login", { replace: true });
      return;
    }

    const workflowError = workflowValidationError(profileFromsessionStorage());
    if (workflowError) {
      alert(workflowError);
      return;
    }

    if (confirmed !== true) {
      setSubmissionError("");
      setSubmitDialogState("confirm");
      return;
    }

    setSubmitting(true);
    try {
      const reviewChain = getReviewChain(profileFromsessionStorage());
      const nextReviewer = reviewChain[0];
      const workflowStatus = nextReviewer ? pendingStatusFor(nextReviewer) : "Submitted";

      // 2. Submit all form data via API
      const submitterProfile = profileFromsessionStorage();

      const submittedAt = new Date().toISOString();
      await submitAppraisal({
        facultyEmail: userEmail,
        academicYear: info.ay,
        form: buildSelfDraftForm(),
        totals: { partATotal, partBTotal, partCTotal, partDTotal, grandTotal, effectivePartAMax, effectivePartBMax, effectivePartCMax: PART_C_MAX, effectivePartDMax: PART_D_MAX, effectiveGrandMax },
        docs,
        submitterProfile,
        activeProfile: submitterProfile,
      });
      setSubmitDialogState("success");
      setAppraisalLocked(true);
      setWorkflowDeclaration({
        status: workflowStatus,
        submitted_at: submittedAt,
        updated_at: submittedAt,
      });
      setWorkflowReviews([]);
    } catch (err) {
      console.error("Submission error:", err);
      setSubmissionError(err.message || "Your appraisal could not be submitted. Please try again.");
      setSubmitDialogState("error");
    } finally {
      setSubmitting(false);
    }
  };

  const generateReport = async () => {
    const win = window.open('', '_blank');
    if (!win) { alert("Please allow popups to generate the report."); return; }
    const logoSrc = await fetchImageAsDataUrl("/image.png");
    const iqacLogoSrc = await fetchImageAsDataUrl("/IQAS.png");

    const html = `
  <html>
  <head>
    <title>Faculty Appraisal</title>

    <style>
      @page { size: A4; margin: 12mm; }
      * { box-sizing: border-box; }
      body { font-family: "Times New Roman", Times, serif; font-size: 10.8px; line-height: 1.34; color: #111; background: #fff; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      h1 { text-align: center; font-size: 14px; line-height: 1.18; letter-spacing: .45px; margin: 0 0 4px; text-transform: uppercase; color: #111; font-weight: 700; }
      h2 { text-align: center; font-size: 11px; line-height: 1.25; margin: 2px 0; color: #111; font-weight: 700; }
      h3 { font-size: 11px; line-height: 1.25; margin: 10px 0 5px; color: #111; break-after: avoid; font-weight: 700; }
      h3[style*="background"] { background: #f1f3f5 !important; border: none !important; border-top: 1.6px solid #111 !important; border-bottom: 1.2px solid #111 !important; border-radius: 0 !important; padding: 6px 0 !important; margin: 14px 0 8px !important; color: #111 !important; text-align: center !important; text-transform: uppercase; letter-spacing: .25px; }
      table { width: 100%; border-collapse: collapse !important; margin-bottom: 10px; table-layout: fixed; border: 1.15px solid #6b7280 !important; background: #fff; page-break-inside: auto; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      th, td { border: 1px solid #aeb6c2 !important; padding: 4.8px 6px; word-wrap: break-word; overflow-wrap: anywhere; vertical-align: top; }
      th { background: #eef0f3 !important; text-align: center; font-weight: bold; color: #111; }
      td[style*="background:#d9d9d9"] { background: #eef0f3 !important; color: #111 !important; text-transform: uppercase; letter-spacing: .2px; }
      tr[style*="background:#bfbfbf"] td { background: #d9dde3 !important; color: #111 !important; }
      .c { text-align: center; }
      .b { font-weight: bold; }
      .pb { page-break-before: always; }
      .tr { background: #f6f7f9 !important; font-weight: bold; }
      .ht { width: 100%; border: none !important; border-bottom: 2px solid #111 !important; margin-bottom: 9px; padding-bottom: 5px; background: transparent; }
      .ht td { border: none !important; padding: 0 4px; vertical-align: middle; }
      .logo { width: 17mm; max-height: 22mm; object-fit: contain; height: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .ht + table { border-color: #6b7280 !important; margin-bottom: 11px; }
      .ht + table td:first-child { background: #f6f7f9 !important; font-weight: 700; width: 35%; }
      .st { border: 1.35px solid #4b5563 !important; }
      .st th { background: #dfe3e8 !important; color: #111; }
      .st .tr, .st tr[style*="background:#bfbfbf"] { background: #dfe3e8 !important; font-weight: bold; }
      .remarks { white-space: pre-wrap; border: 1px solid #6b7280 !important; padding: 8px; min-height: 34px; margin-bottom: 10px; background: #fff; }
      .declaration-table { border: none !important; margin-bottom: 14px !important; }
      .declaration-table td { border: none !important; background: #fff !important; }
      ${isLatestCycle && !isLegacyTwoPartYear ? currentAppraisalReportStyles : ""}
    </style>
  </head>

  <body>

    <table class="ht"><tr>
      <td style="width:20%;text-align:left"><img class="logo" src="${logoSrc}" alt="DYPIU" /></td>
      <td style="text-align:center">
        <h1>D Y PATIL INTERNATIONAL UNIVERSITY, AKURDI, PUNE</h1>
        <h2>Faculty Appraisal Form - Academic Year ${info.ay || ""}</h2>
      </td>
      <td style="width:20%;text-align:right"><img class="logo" src="${iqacLogoSrc}" alt="IQAC" /></td>
    </tr></table>

    <table>
      <tr><td class="b" style="width:35%">Name of Faculty</td><td>${reportTextValue(info.name)}</td></tr>
      <tr><td class="b">Educational Qualifications</td><td>${reportQualification(info)}</td></tr>
      <tr><td class="b">Present Designation</td><td>${reportTextValue(info.desig)}</td></tr>
      <tr><td class="b">School / Department</td><td>${reportTextValue(info.school)}</td></tr>
      <tr><td class="b">Experience</td><td>${reportExperience(info)}</td></tr>
    </table>

    <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART A - Teaching Process &amp; Academic Activities</h3>

    <h3>A1. Course Delivery &amp; Classroom Engagement &nbsp;(Max 40)</h3>
    <table>
      <tr><th>SN</th><th>Semester</th><th>Course Code / Name</th><th>Classes as per Course Structure</th><th>Classes Actually Conducted</th><th>% Conducted</th><th>Self Score</th></tr>
      ${lectures.map((l, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(l.sem)}</td><td>${reportTextValue(l.code)}</td><td class="c">${reportTextValue(l.planned)}</td><td class="c">${reportTextValue(l.conducted)}</td><td class="c">${reportTextValue(l.pctConducted)}</td><td class="c">${reportTextValue(l.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="6" class="c b">Total Score (Max 40)</td><td class="c">${totalLecScore > 0 ? totalLecScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>A2. Course File &amp; Curriculum Documentation &nbsp;(Max 20)</h3>
    <table>
      <tr><th>SN</th><th>Course / Paper</th><th>Program & Semester</th><th>Details</th><th>Self Score</th></tr>
      ${courseFile.map((c, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(c.course)}</td><td>${reportTextValue(c.title)}</td><td>${reportTextValue(c.details)}</td><td class="c">${reportTextValue(c.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="4" class="c b">Total Score (Max 20)</td><td class="c">${courseFileScore > 0 ? courseFileScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>A3. Innovative Teaching-Learning Methods &nbsp;(Max 20)</h3>
    <table>
      <tr><th>SN</th><th>Methods Used</th><th>Details</th><th>Self Score</th></tr>
      ${innovRows.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(r.method)}${r.method === OTHER_INNOVATIVE_METHOD && r.methodOther ? `: ${reportTextValue(r.methodOther)}` : ""}</td><td>${reportTextValue(r.details)}</td><td class="c">${reportTextValue(r.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="3" class="c b">Total Score (Max 20)</td><td class="c">${innovTotal > 0 ? innovTotal.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>A4. Student Feedback Score &nbsp;(Max 10)</h3>
    <table>
      <tr><th>SN</th><th>Course Code / Name</th><th>First Student Feedback As per Juno</th><th>Second Student Feedback As Per Juno</th><th>Average</th><th>Self Score</th></tr>
      ${feedback.map((f, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(f.code)}</td><td class="c">${reportTextValue(f.fb1)}</td><td class="c">${reportTextValue(f.fb2)}</td><td class="c">${(f.fb1 || f.fb2) ? ((n(f.fb1) + n(f.fb2)) / ((f.fb1 ? 1 : 0) + (f.fb2 ? 1 : 0) || 1)).toFixed(2) : '&nbsp;'}</td><td class="c">${reportTextValue(f.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="5" class="c b">Total (Max 10)</td><td class="c">${stuFeedbackScore > 0 ? stuFeedbackScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>A5. Learning Outcomes Attainment &amp; OBE Practice &nbsp;(Max 20)</h3>
    <table>
      <tr><th>SN</th><th>Component</th><th>Evidence Attached (Yes/No)</th><th>Self Score</th></tr>
      ${obeRows.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(r.component)}</td><td>${reportTextValue(r.evidence)}</td><td class="c">${reportTextValue(r.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="3" class="c b">Total (Max 20)</td><td class="c">${obeScore > 0 ? obeScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    ${`
    <h3>A6. Student Project Guidance &nbsp;(Max 20)</h3>
    <table>
      <tr><th>SN</th><th>Project Title / Batch</th><th>No. of Students</th><th>Industry Collab (Y/N)</th><th>Award (Y/N)</th><th>Student Pub (Y/N)</th><th>Self Score</th></tr>
      ${projects.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(p.label)}</td><td class="c">${reportTextValue(p.studentsCount)}</td><td>${reportTextValue(p.industryCollab)}</td><td>${reportTextValue(p.awardReceived)}</td><td>${reportTextValue(p.studentPub)}</td><td class="c">${reportTextValue(clampScore(p.score, projectGuidanceRowMax(p)))}</td></tr>`).join('')}
      <tr class="tr"><td colspan="6" class="c b">Total Score (Max 20)</td><td class="c">${projectTotal > 0 ? projectTotal.toFixed(1) : "&nbsp;"}</td></tr>
    </table>`}

    <h3>A7. Student Mentoring &amp; Counselling &nbsp;(Max 10)</h3>
    <table>
      <tr><th>SN</th><th>Activity</th><th>Evidence Attached (Yes/No)</th><th>Self Score</th></tr>
      ${mentoringRows.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(r.activity)}</td><td>${reportTextValue(r.evidence)}</td><td class="c">${reportTextValue(r.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="3" class="c b">Total (Max 10)</td><td class="c">${mentoringScore > 0 ? mentoringScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>A8. Professional Development &amp; Qualification Enhancement &nbsp;(Max 10)</h3>
    <table>
      <tr><th>SN</th><th>Qualification / Category</th><th>Awarding Body</th><th>Date</th><th>Self Score</th></tr>
      ${quals.map((q, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(q.label)}</td><td>${reportTextValue(q.awardingBody)}</td><td>${reportTextValue(q.date)}</td><td class="c">${reportTextValue(String(q.score ?? "").trim() ? clampScore(q.score, A8_QUALIFICATION_MAX) : "")}</td></tr>`).join('')}
      <tr class="tr"><td colspan="4" class="c b">Total Score (Max 10)</td><td class="c">${qualTotal > 0 ? qualTotal.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <div class="pb"></div>
    <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART B - Research &amp; Innovation</h3>

    <h3>B1. Journal Publications &nbsp;(Max 100)</h3>
    <table>
      <tr><th>SN</th><th>Title</th><th>Journal</th><th>DOI No.</th><th>Impact Factor</th><th>Author Position</th><th>Self Score</th></tr>
      ${journals.map((j, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(j.title)}</td><td>${reportTextValue(j.journal)}</td><td class="c">${reportTextValue(j.issn)}</td><td class="c">${reportTextValue(j.impactFactor)}</td><td>${reportTextValue(j.authorPosition)}</td><td class="c">${reportTextValue(j.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="6" class="c b">Total (Max 100)</td><td class="c">${journalScore > 0 ? journalScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>B2. Books, Book Chapters &amp; Edited Volumes &nbsp;(Max 30)</h3>
    <table>
      <tr><th>SN</th><th>Title</th><th>Publisher &amp; ISBN</th><th>Type</th><th>Level</th><th>Co-authors from DYPIU</th><th>Self Score</th></tr>
      ${books.map((b, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(b.title)}</td><td>${reportTextValue(b.book)}</td><td>${reportTextValue(b.pub)}</td><td>${reportTextValue(b.level)}</td><td>${reportTextValue(b.coauth)}</td><td class="c">${reportTextValue(b.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="6" class="c b">Total (Max 30)</td><td class="c">${bookScore > 0 ? bookScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>B3. Patents, Copyrights &amp; IP and Product Development &nbsp;(Max 40)</h3>
    <table>
      <tr><th>SN</th><th>Title</th><th>National / International</th><th>Status (Published/Granted)</th><th>Filing / Grant No. &amp; Date</th><th>Self Score</th></tr>
      ${patents.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(p.title)}</td><td class="c">${reportTextValue(p.type)}</td><td>${reportTextValue(p.status)}</td><td class="c">${reportTextValue(p.fileNo)}</td><td class="c">${reportTextValue(p.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="5" class="c b">Total (Max 40)</td><td class="c">${patentScore > 0 ? patentScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>B4. External Funded Research Projects &nbsp;(Max 40)</h3>
    <table>
      <tr><th>SN</th><th>Title</th><th>Funding Agency</th><th>Date of Sanction</th><th>Grant Amount</th><th>Role</th><th>Status</th><th>Self Score</th></tr>
      ${projects2.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(p.title)}</td><td>${reportTextValue(p.agency)}</td><td class="c">${reportTextValue(p.date)}</td><td class="c">${reportTextValue(p.amount)}</td><td>${reportTextValue(p.role)}</td><td>${reportTextValue(p.status)}</td><td class="c">${reportTextValue(p.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="7" class="c b">Total (Max 40)</td><td class="c">${projectBScore > 0 ? projectBScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    ${isLegacyTwoPartYear ? `
    <h3>Legacy External Research Projects &nbsp;(Not counted in AY 2026-2027 total)</h3>
    <table>
      <tr><th>SN</th><th>Title</th><th>Funding Agency</th><th>Date of Sanction</th><th>Grant Amount</th><th>Role</th><th>Status</th><th>Self Score</th></tr>
      ${externalProjects.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(p.title)}</td><td>${reportTextValue(p.agency)}</td><td class="c">${reportTextValue(p.date)}</td><td class="c">${reportTextValue(p.amount)}</td><td>${reportTextValue(p.role)}</td><td>${reportTextValue(p.status)}</td><td class="c">${reportTextValue(p.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="7" class="c b">Total (Max 0)</td><td class="c">${externalProjectScore > 0 ? externalProjectScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>` : ""}

    ${`
    <h3>B5. Research Guidance &nbsp;(Max 20)</h3>
    <table>
      <tr><th>SN</th><th>Degree</th><th>Name of Student</th><th>Status</th><th>Date</th><th>Self Score</th></tr>
      ${research.map((r, i) => `<tr><td class="c">${i + 1}</td><td class="c">${reportTextValue(r.degree)}</td><td>${reportTextValue(r.name)}</td><td>${reportTextValue(r.status || r.thesis)}</td><td class="c">${(r.status || r.thesis) === "Ongoing" ? "NA" : reportTextValue(r.date)}</td><td class="c">${(r.degree || r.name || r.status || r.thesis || r.score) ? researchGuidanceScore(r).toFixed(1) : "&nbsp;"}</td></tr>`).join('')}
      <tr class="tr"><td colspan="5" class="c b">Total (Max 20)</td><td class="c">${researchScore > 0 ? researchScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>`}

    <h3>B6. Consultancy, Testing &amp; Training &nbsp;(Max 20)</h3>
    <table>
      <tr><th>SN</th><th>Client / Organisation</th><th>Nature of Engagement</th><th>Revenue Generated (INR)</th><th>Self Score</th></tr>
      ${proposals.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(p.agency)}</td><td>${reportTextValue(p.duration)}</td><td class="c">${reportTextValue(p.amount)}</td><td class="c">${reportTextValue(p.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="4" class="c b">Total (Max 20)</td><td class="c">${proposalScore > 0 ? proposalScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>B7. Conference / FDP / Training / Workshop Contributions as Resource Person &nbsp;(Max 20)</h3>
    <table>
      <tr><th>SN</th><th>Event / Session Title</th><th>Role</th><th>Date</th><th>Level (Intl./National)</th><th>Self Score</th></tr>
      ${confs.map((c, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(c.title)}</td><td>${reportTextValue(c.role)}</td><td>${reportTextValue(c.date)}</td><td>${reportTextValue(c.level)}</td><td class="c">${reportTextValue(c.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="5" class="c b">Total (Max 20)</td><td class="c">${confScore > 0 ? confScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>B8. Conference / FDP / Industry Training Attended &nbsp;(Max 20)</h3>
    <table>
      <tr><th>SN</th><th>Program</th><th>From</th><th>To</th><th>Organized By</th><th>Self Score</th></tr>
      ${fdps.map((f, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(f.program)}</td><td class="c">${reportTextValue(f.fromDate)}</td><td class="c">${reportTextValue(f.toDate)}</td><td>${reportTextValue(f.org)}</td><td class="c">${reportTextValue(clampScore(f.score, SCORE_LIMITS.fdpRow))}</td></tr>`).join('')}
      <tr class="tr"><td colspan="5" class="c b">FDP / Workshops Total</td><td class="c">${fdpScore > 0 ? fdpScore.toFixed(1) : "&nbsp;"}</td></tr>
      ${!isLegacyTwoPartYear ? `<tr class="tr"><td colspan="5" class="c b">Combined B8 Total (Max 20)</td><td class="c">${b8Score > 0 ? b8Score.toFixed(1) : "&nbsp;"}</td></tr>` : ""}
    </table>

    ${isLegacyTwoPartYear ? `
    <h3>Industrial Training</h3>
    <table>
      <tr><th>SN</th><th>Company / Industry</th><th>Duration</th><th>Nature of Training</th><th>Self Score</th></tr>
      ${training.map((t, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(t.company)}</td><td class="c">${reportTextValue(t.duration)}</td><td>${reportTextValue(t.nature)}</td><td class="c">${reportTextValue(clampScore(t.score, SCORE_LIMITS.fdpRow))}</td></tr>`).join('')}
      <tr class="tr"><td colspan="4" class="c b">Combined B8 Total (Max 20)</td><td class="c">${b8Score > 0 ? b8Score.toFixed(1) : "&nbsp;"}</td></tr>
    </table>` : ""}

    <h3>B9. Research Awards, Fellowships &amp; Citations &nbsp;(Max 20)</h3>
    <table>
      <tr><th>SN</th><th>Title of Award</th><th>Date</th><th>Awarding Agency</th><th>Level</th><th>Self Score</th></tr>
      ${awards.map((a, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(a.title)}</td><td class="c">${reportTextValue(a.date)}</td><td>${reportTextValue(a.agency)}</td><td>${reportTextValue(a.level)}</td><td class="c">${reportTextValue(a.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="5" class="c b">Total (Max 20)</td><td class="c">${awardScore > 0 ? awardScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>B10. Innovation, Start-ups &amp; Technology Transfer &nbsp;(Max 20)</h3>
    <table>
      <tr><th>SN</th><th>Title / Start-up / Product</th><th>Role</th><th>Status</th><th>Self Score</th></tr>
      ${products.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(p.details)}</td><td>${reportTextValue(p.role)}</td><td>${reportTextValue(p.status)}</td><td class="c">${reportTextValue(p.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="4" class="c b">Total (Max 20)</td><td class="c">${productScore > 0 ? productScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>B11. ICT Content, MOOCs &amp; E-Learning &nbsp;(Max 20)</h3>
    <table>
      <tr><th>SN</th><th>Title</th><th>Platform / Type</th><th>Reach / Views (if available)</th><th>Self Score</th></tr>
      ${ict.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(r.title)}</td><td>${reportTextValue(r.type)}</td><td class="c">${reportTextValue(r.quad)}</td><td class="c">${reportTextValue(r.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="4" class="c b">Total (Max 20)</td><td class="c">${ictScore > 0 ? ictScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <div class="pb"></div>
    <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART C - Administrative Role &amp; University Development Contribution</h3>

    <h3>C1. Administration at University Level &nbsp;(Max 50)</h3>
    <table>
      <tr><th>SN</th><th>Activity / Responsibility</th><th>Duration Category</th><th>Period</th><th>Self Score</th></tr>
      ${uniActs.map((u, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(u.activity)}</td><td>${reportTextValue(u.nature)}</td><td>${reportTextValue(u.period)}</td><td class="c">${reportTextValue(u.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="4" class="c b">Total (Max 50)</td><td class="c">${uniScore > 0 ? uniScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>C2. Administration at School Level &nbsp;(Max 30)</h3>
    <table>
      <tr><th>SN</th><th>Activity / Responsibility</th><th>Duration Category</th><th>Period</th><th>Self Score</th></tr>
      ${deptActs.map((d, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(d.activity)}</td><td>${reportTextValue(d.nature)}</td><td>${reportTextValue(d.period)}</td><td class="c">${reportTextValue(d.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="4" class="c b">Total (Max 30)</td><td class="c">${deptScore > 0 ? deptScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>C3. Event Organisation &amp; Institutional Visibility &nbsp;(Max 20)</h3>
    <table>
      <tr><th>SN</th><th>Event / Contribution</th><th>Role</th><th>From</th><th>To</th><th>Level</th><th>Self Score</th></tr>
      ${eventRows.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(r.event)}</td><td>${reportTextValue(r.role)}</td><td class="c">${reportTextValue(r.fromDate || r.date)}</td><td class="c">${reportTextValue(r.toDate || r.date)}</td><td>${reportTextValue(r.level)}</td><td class="c">${reportTextValue(r.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="6" class="c b">Total (Max 20)</td><td class="c">${eventScore > 0 ? eventScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>C4. Outreach, Extension &amp; Social Responsibility &nbsp;(Max 20)</h3>
    ${`<table>
      <tr><th>SN</th><th>Activity</th><th>Details</th><th>Date</th><th>Self Score</th></tr>
      ${society.map((s, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(s.label)}</td><td>${reportTextValue(s.details)}</td><td class="c">${reportTextValue(s.date)}</td><td class="c">${reportTextValue(s.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="4" class="c b">Total (Max 20)</td><td class="c">${societyScore > 0 ? societyScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>`}

    <h3>C5. Industry Interaction &amp; Linkages &nbsp;(Max 10)</h3>
    <table>
      <tr><th>SN</th><th>Activity</th><th>Industry Partner</th><th>Date</th><th>Self Score</th></tr>
      ${industry.map((ind, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(ind.activity || ind.name)}</td><td>${reportTextValue(ind.partner || ind.details)}</td><td class="c">${reportTextValue(ind.date)}</td><td class="c">${reportTextValue(ind.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="4" class="c b">Total (Max 10)</td><td class="c">${industryScore > 0 ? industryScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>C6. Alumni Engagement &amp; Networking &nbsp;(Max 10)</h3>
    <table>
      <tr><th>SN</th><th>Activity</th><th>Details</th><th>Date</th><th>Self Score</th></tr>
      ${alumniRows.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(r.activity)}</td><td>${reportTextValue(r.details)}</td><td class="c">${reportTextValue(r.date)}</td><td class="c">${reportTextValue(r.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="4" class="c b">Total (Max 10)</td><td class="c">${alumniScore > 0 ? alumniScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <h3>C7. Student Placement Mentoring &amp; Career Development &nbsp;(Max 20)</h3>
    <table>
      <tr><th>SN</th><th>Activity Type</th><th>Student / Company Name</th><th>Date</th><th>Self Score</th></tr>
      ${placementRows.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${reportTextValue(r.activityType)}</td><td>${reportTextValue(r.name)}</td><td class="c">${reportTextValue(r.date)}</td><td class="c">${reportTextValue(r.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="4" class="c b">Total (Max 20)</td><td class="c">${placementScore > 0 ? placementScore.toFixed(1) : "&nbsp;"}</td></tr>
    </table>

    <div class="pb"></div>
    <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART D - Leave &amp; Attendance Management</h3>

    <h3>D1. Leave &amp; Attendance Management &nbsp;(Max ${PART_D_MAX})</h3>
    ${isLatestCycle && !isLegacyTwoPartYear ? `
      ${leaveManagement.map((r) => `
        <table>
          <colgroup><col style="width:32%"><col style="width:17%"><col style="width:17%"><col style="width:17%"><col style="width:17%"></colgroup>
          <thead><tr><th style="text-align:left">1. No. of leaves taken in the Year</th><th>CL</th><th>ML</th><th>OD</th><th>C/Off</th></tr></thead>
          <tbody>
            <tr><td></td><td class="c">${reportTextValue(r.clTaken)}</td><td class="c">${reportTextValue(r.mlTaken)}</td><td class="c">${reportTextValue(r.odTaken)}</td><td class="c">${reportTextValue(r.coffTaken)}</td></tr>
            <tr><td class="b">Out of</td><td class="c">${reportTextValue(r.clOutOf)}</td><td class="c">${reportTextValue(r.mlOutOf)}</td><td class="c">${reportTextValue(r.odOutOf)}</td><td class="c">${reportTextValue(r.coffOutOf)}</td></tr>
          </tbody>
        </table>
        <table>
          <colgroup><col style="width:58%"><col style="width:42%"></colgroup>
          <tbody>
            <tr><td class="b">2. No. of Late Remarks in the Year</td><td class="c">${reportTextValue(r.lateRemarks)}</td></tr>
            <tr><td class="b">3. Total Actual Working Days for the current academic year</td><td class="c">${reportTextValue(r.workingDays)}</td></tr>
            <tr><td class="b">4. Management of leaves</td><td>${reportTextValue(PART_D_RATING_OPTIONS.find((option) => option.value === r.managementRating)?.label || r.managementRating)}</td></tr>
            <tr class="tr"><td class="b">Total Score out of (${PART_D_MAX}) =</td><td class="c">${reportTextValue(r.score || 0)}</td></tr>
          </tbody>
        </table>
      `).join('')}
      <table><tr class="tr"><td class="b">Total Score (Max ${PART_D_MAX})</td><td class="c">${partDTotal > 0 ? partDTotal.toFixed(1) : "&nbsp;"}</td></tr></table>
    ` : `
    <table>
      <tr><th>SN</th><th>CL Taken</th><th>ML Taken</th><th>OD Taken</th><th>C/Off Taken</th><th>Late Remarks</th><th>Working Days</th><th>Management of Leaves</th><th>Self Score</th></tr>
      ${leaveManagement.map((r, i) => `<tr><td class="c">${i + 1}</td><td class="c">${reportTextValue(r.clTaken)}</td><td class="c">${reportTextValue(r.mlTaken)}</td><td class="c">${reportTextValue(r.odTaken)}</td><td class="c">${reportTextValue(r.coffTaken)}</td><td class="c">${reportTextValue(r.lateRemarks)}</td><td class="c">${reportTextValue(r.workingDays)}</td><td>${reportTextValue(r.managementRating)}</td><td class="c">${reportTextValue(r.score)}</td></tr>`).join('')}
      <tr class="tr"><td colspan="8" class="c b">Total Score (Max ${PART_D_MAX})</td><td class="c">${partDTotal > 0 ? partDTotal.toFixed(1) : "&nbsp;"}</td></tr>
    </table>
    `}

    <div class="pb"></div>
    <h3 style="text-align:center;font-size:13px">SUMMARY OF SELF SCORES - AY ${reportTextValue(info.ay)}</h3>
    <table class="st">
      <tr><th>Sr.No.</th><th>Criteria</th><th>Max Score</th><th>Faculty Score</th></tr>
      <tr><td colspan="4" class="b" style="background:#d9d9d9;text-align:center">Part A - Teaching Process</td></tr>
      <tr><td class="c">A</td><td>Teaching &amp; Learning</td><td class="c">${effectivePartAMax}</td><td class="c">${partATotal > 0 ? partATotal.toFixed(1) : "&nbsp;"}</td></tr>
      <tr class="tr"><td colspan="2" class="c b">Part A Total</td><td class="c b">${effectivePartAMax}</td><td class="c b">${partATotal > 0 ? partATotal.toFixed(1) : "&nbsp;"}</td></tr>
      <tr class="tr"><td colspan="2" class="c b">Part A Marks Obtained (%)</td><td colspan="2" class="c b">${partATotal > 0 ? `${partAMarksPercentage}%` : "&nbsp;"}</td></tr>
      <tr><td colspan="4" class="b" style="background:#d9d9d9;text-align:center">Part B - Research &amp; Innovation</td></tr>
      <tr><td class="c">B</td><td>Research &amp; Innovation</td><td class="c">${effectivePartBMax}</td><td class="c">${partBTotal > 0 ? partBTotal.toFixed(1) : "&nbsp;"}</td></tr>
      <tr class="tr"><td colspan="2" class="c b">Part B Total</td><td class="c b">${effectivePartBMax}</td><td class="c b">${partBTotal > 0 ? partBTotal.toFixed(1) : "&nbsp;"}</td></tr>
      <tr class="tr"><td colspan="2" class="c b">Part B Marks Obtained (%)</td><td colspan="2" class="c b">${partBTotal > 0 ? `${partBMarksPercentage}%` : "&nbsp;"}</td></tr>
      <tr><td colspan="4" class="b" style="background:#d9d9d9;text-align:center">Part C - Administrative Role &amp; University Development Contribution</td></tr>
      <tr><td class="c">C</td><td>Administrative Contribution</td><td class="c">${PART_C_MAX}</td><td class="c">${partCTotal > 0 ? partCTotal.toFixed(1) : "&nbsp;"}</td></tr>
      <tr class="tr"><td colspan="2" class="c b">Part C Total</td><td class="c b">${PART_C_MAX}</td><td class="c b">${partCTotal > 0 ? partCTotal.toFixed(1) : "&nbsp;"}</td></tr>
      <tr class="tr"><td colspan="2" class="c b">Part C Marks Obtained (%)</td><td colspan="2" class="c b">${partCTotal > 0 ? `${partCMarksPercentage}%` : "&nbsp;"}</td></tr>
      <tr><td colspan="4" class="b" style="background:#d9d9d9;text-align:center">Part D - Leave &amp; Attendance Management</td></tr>
      <tr><td class="c">D</td><td>Leave &amp; Attendance Management</td><td class="c">${PART_D_MAX}</td><td class="c">${partDTotal > 0 ? partDTotal.toFixed(1) : "&nbsp;"}</td></tr>
      <tr class="tr"><td colspan="2" class="c b">Part D Total</td><td class="c b">${PART_D_MAX}</td><td class="c b">${partDTotal > 0 ? partDTotal.toFixed(1) : "&nbsp;"}</td></tr>
      <tr class="tr"><td colspan="2" class="c b">Part D Marks Obtained (%)</td><td colspan="2" class="c b">${partDTotal > 0 ? `${partDMarksPercentage}%` : "&nbsp;"}</td></tr>
      <tr style="background:#bfbfbf;font-weight:bold;font-size:13px"><td colspan="2" class="c">Grand Total (Part A + Part B + Part C + Part D)</td><td class="c">${effectiveGrandMax}</td><td class="c">${grandTotal > 0 ? grandTotal.toFixed(1) : "&nbsp;"}</td></tr>
      <tr style="background:#bfbfbf;font-weight:bold;font-size:13px"><td colspan="2" class="c">Marks Obtained (%)</td><td colspan="2" class="c">${grandTotal > 0 ? `${totalMarksPercentage}%` : "&nbsp;"}</td></tr>
    </table>

    ${String(summaryOtherInfo ?? "").trim() ? `
    <h3>Any other information not covered above</h3>
    <div class="remarks">${reportTextValue(summaryOtherInfo)}</div>
    ` : ""}

    <h3 style="text-align:center;font-size:16px;background:#d9d9d9;padding:8px;margin:18px 0 10px">DECLARATION BY FACULTY</h3>
    <table class="declaration-table" style="border:none;margin-bottom:14px">
      <tr>
        <td style="border:none;vertical-align:top;width:36px;font-size:22px">&#10003;</td>
        <td style="border:none;line-height:1.75;font-size:13px">
          I, <strong>${info.name || "________________________"}</strong>, hereby declare that all the information
          furnished in this Self-Appraisal Report is true, complete, and correct to the best of my knowledge and belief.
          I understand that in the event of any information being found false or incorrect, I shall be solely responsible
          for the consequences thereof and shall be liable for any disciplinary action as deemed fit by the University authorities.
        </td>
      </tr>
    </table>
    <table class="declaration-table" style="border:none;margin-bottom:20px">
      <tr>
        <td style="border:none;width:50%;font-size:12px;line-height:1.45">
          <div style="border-bottom:1px solid #000;min-height:36px;margin-bottom:4px">&nbsp;</div>
          <div><strong>Signature of Faculty</strong></div>
          <div style="margin-top:6px"><strong>Name:</strong> ${info.name || "&nbsp;"}</div>
          <div style="margin-top:4px"><strong>Date of Submission:</strong> ${workflowDeclaration?.submitted_at ? new Date(workflowDeclaration.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "&nbsp;"}</div>
        </td>
        <td style="border:none;width:50%">&nbsp;</td>
      </tr>
    </table>
    ${workflowReviews.length ? `
    <h3 style="text-align:center;font-size:13px;background:#d9d9d9;padding:4px;margin:0 0 8px">REVIEWERS' ACKNOWLEDGEMENT</h3>
    <p style="font-size:10px;margin:0 0 10px">The following authorities acknowledge that they have reviewed the details submitted by the faculty and confirm the accuracy of scores assigned.</p>
    <table>
      <thead><tr><th style="width:30%">Reviewer Role</th><th style="width:40%">Name &amp; Signature</th><th style="width:15%">Date</th><th style="width:15%">Stamp</th></tr></thead>
      <tbody>
        ${workflowReviews.map((rev) => `<tr>
          <td><strong>${roleLabel(rev.reviewer_role)}</strong></td>
          <td style="border-bottom:1px solid #000">${rev.reviewer_name || "&nbsp;"}</td>
          <td style="border-bottom:1px solid #000">${rev.reviewed_at ? new Date(rev.reviewed_at).toLocaleDateString("en-IN") : "&nbsp;"}</td>
          <td style="border-bottom:1px solid #000">&nbsp;</td>
        </tr>`).join("")}
      </tbody>
    </table>` : ""}

  <script>
    window.addEventListener('load', function(){
      const images = Array.from(document.images || []);
      Promise.all(images.map(function(img){
        if (img.complete) return Promise.resolve();
        return new Promise(function(resolve){
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 800);
        });
      })).then(function(){
        setTimeout(function(){ window.focus(); window.print(); }, 120);
      });
    });
  </script>
  </body>
  </html>`;

    win.document.write(html);
    win.document.close();
  };
  const workflowRejected = hasActiveRejection(workflowDeclaration, workflowReviews);
  const headerSchoolName = getSchoolByValue(info.school)?.name || info.school || "";

  const academicYearOptions = availableCyclesState.length
    ? availableCyclesState
    : [{ academic_year: info.ay || resolvedAcademicYear, is_open: true }];
  const documentKeys = Object.keys(docs || {}).filter((key) => {
    const files = Array.isArray(docs?.[key]) ? docs[key] : docs?.[key] ? [docs[key]] : [];
    return files.length > 0;
  }).sort();
  const documentCount = documentKeys.reduce((total, key) => {
    const files = Array.isArray(docs?.[key]) ? docs[key] : docs?.[key] ? [docs[key]] : [];
    return total + files.length;
  }, 0);
  const allDocumentFiles = documentKeys.flatMap((key) => {
    const files = Array.isArray(docs?.[key]) ? docs[key] : docs?.[key] ? [docs[key]] : [];
    return files.map((file, index) => ({ file, key, index }));
  });
  const handleDownloadAttachments = async () => {
    if (!allDocumentFiles.length) {
      alert("No attachments found for this academic year.");
      return;
    }
    setAttachmentDownloading(true);
    try {
      const usedNames = new Set();
      const entries = [];
      for (const item of allDocumentFiles) {
        entries.push({
          name: attachmentFileName(item.file, `${item.key}-${item.index + 1}`, usedNames),
          blob: await fetchAttachmentBlob(item.file),
        });
      }
      const zipBlob = await createZipBlob(entries);
      downloadBlob(zipBlob, `attachments-${String(info.ay || "academic-year").replace(/[^a-z0-9-]/gi, "_")}.zip`);
    } catch (error) {
      console.error("Could not download attachments:", error);
      alert("Could not download all attachments. Please try again.");
    } finally {
      setAttachmentDownloading(false);
    }
  };
  const handleAcademicYearChange = (newAcademicYear) => {
    if (newAcademicYear === info.ay) return;
    loadRequestRef.current += 1;
    setLoadingYearData(true);
    setInfo((previousInfo) => profileSafeInfoForYear(previousInfo, newAcademicYear, defaultDesignation));
    setDocs({});
    setLegacyReportTotals(null);
    setActiveAcademicYear(newAcademicYear);
    window.dispatchEvent(new CustomEvent("academicYearChanged", {
      detail: { academicYear: newAcademicYear },
    }));
  };

  return (
    <div className="appraisal-form-shell" style={{ position: "relative", display: "flex", flexDirection: "column", gap: 24 }}>
      {submitDialogState && <SubmissionConfirmDialog state={submitDialogState} academicYear={info.ay} successMessage="Your appraisal has been submitted successfully and is now locked for review." errorMessage={`Unable to submit appraisal.\n\n${submissionError}`} onCancel={() => setSubmitDialogState(null)} onConfirm={() => { setSubmitDialogState("submitting"); void handleSubmitAppraisal(true); }} />}
      {loadingYearData && (
        <div className="appraisal-year-loading-overlay" role="status" aria-live="polite">
          <div className="appraisal-year-loading-card">
            <div className="appraisal-year-loading-spinner" />
            <div className="appraisal-year-loading-textwrap">
              <div className="appraisal-year-loading-text">Loading {info.ay || "academic year"} data…</div>
              <div className="appraisal-year-loading-subtext">Fetching your appraisal records</div>
              <div className="appraisal-year-loading-dots"><span /><span /><span /></div>
            </div>
          </div>
        </div>
      )}
      {showSectionSelector && !showClosedReportOnly && !isLegacyTwoPartYear && (
      <div className="appraisal-section-selector" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 20, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", boxShadow: "0 12px 30px rgba(17,24,39,0.06)" }}>
        <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6 }}>My Appraisal Section</div>
        <select
          value={hodAppraisalTab}
          onChange={(e) => handleMyAppraisalSectionChange(e.target.value)}
          style={{ minWidth: 220, height: 44, border: "1px solid #e5e7eb", borderRadius: 12, padding: "0 14px", fontSize: 14, fontFamily: "inherit", color: "#111827", background: "#fff", outline: "none", fontWeight: 700 }}
        >
          {sectionOptions.map(([value, label]) => (
            <option key={value} value={value} disabled={!isMyAppraisalSectionOpen(value)}>{label}</option>
          ))}
        </select>
      </div>
      )}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="appraisal-page-header" style={{ background: "#fff", borderRadius: 14, padding: "16px 24px", boxShadow: "0 10px 28px rgba(17,24,39,0.06)", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 260 }}>
              <AppraisalHeaderImage logo="dypiu" height={78} />
              <div>
                <h2 className="appraisal-header-title" style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#111827", letterSpacing: 0, lineHeight: 1.05 }}>My Appraisal Form</h2>
                {headerSchoolName && (
                  <div style={{ marginTop: 6, color: "#4b5563", fontSize: 13, fontWeight: 800, lineHeight: 1.25 }}>{headerSchoolName}</div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, fontSize: 13, color: "#6b7280", fontWeight: 700, flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#111827", fontWeight: 800 }}>
                    <span className="appraisal-header-person-icon" style={{ width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#ede9fe", color: "#6d28d9", border: "1px solid #ddd6fe" }}>
                      <UserRound size={15} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span>{info.name || titleNameFallback}</span>
                  </span>
                  <span aria-hidden="true" style={{ width: 1, height: 20, background: "#cbd5e1", display: "inline-block" }} />
                  <span className="appraisal-header-year-label"><CalendarDays size={15} strokeWidth={1.8} aria-hidden="true" />Academic Year:</span>
                  <select
                    value={info.ay}
                    onChange={(event) => handleAcademicYearChange(event.target.value)}
                    className="appraisal-year-select"
                    aria-label="Academic year"
                    style={{ height: 36, minWidth: 176, border: "1px solid #d1d5db", borderRadius: 9, padding: "0 12px", fontSize: 13, fontFamily: "inherit", color: "#111827", background: "#fff", outline: "none", fontWeight: 800, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
                  >
                    {academicYearOptions.map((cycle) => (
                      <option key={cycle.academic_year} value={cycle.academic_year}>
                        {cycle.academic_year} {cycle.is_open ? "(Active)" : "(Closed / Read-Only)"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <AppraisalHeaderImage logo="iqas" height={78} />
              </div>
            </div>
            <div className="appraisal-status-grid" style={{ display: "grid", gridTemplateColumns: isSelectedCycleClosed || isLegacyTwoPartYear ? "1fr" : "minmax(0, 1fr) 316px", gap: 12, alignItems: "stretch" }}>
              <WorkflowStatusTracker
                showPartD={!isLegacyTwoPartYear}
                declaration={workflowDeclaration}
                reviews={workflowReviews}
                profile={profileFromsessionStorage()}
              />
              {!isSelectedCycleClosed && !isLegacyTwoPartYear && (
<OverallProgress total={grandTotal} max={effectiveGrandMax} percentage={overallProgress} parts={partWiseProgressRows} loading={loadingYearData || loadedAcademicYear !== info.ay} error={yearLoadError} />
              )}
            </div>
            <RejectionNotice
              declaration={workflowDeclaration}
              reviews={workflowReviews}
              status={workflowDeclaration?.status}
              alertOnceKey={`${sessionStorage.getItem("username") || ""}:${info.ay || ""}:${workflowDeclaration?.status || ""}`}
            />
            {formLocked && (
              <div role="status" className={`standard-appraisal-lock-notice appraisal-lock-notice appraisal-lock-notice--${appraisalWindowLockMessage || isSelectedCycleClosed ? "closed" : workflowRejected ? "rejected" : "submitted"}`}>
                <span className="appraisal-lock-notice__icon" aria-hidden="true">{appraisalWindowLockMessage || isSelectedCycleClosed || workflowRejected ? <Info size={18} strokeWidth={1.8} /> : <LockKeyhole size={18} strokeWidth={1.8} />}</span>
                <span>
                  {appraisalWindowLockMessage
                    ? appraisalWindowLockMessage
                    : workflowRejected
                    ? "This appraisal was rejected. Review the approval status in the tracker above."
                    : isSelectedCycleClosed
                      ? closedAppraisalCycleMessage
                      : "Submitted and locked for review. Your saved data is visible here, but editing is disabled while authorities review it."}
                </span>
              </div>
            )}

            {showClosedReportOnly ? (
              <SC title="Closed Appraisal Report" accent="#4c1d95">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  {[
                    ["Academic Year", info.ay || "-"],
                    ["Submitted Score", `${grandTotal.toFixed(1)} / ${effectiveGrandMax}`],
                    ["Documents", `${documentCount} file${documentCount === 1 ? "" : "s"}`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "13px 14px", background: "linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)", boxShadow: "0 10px 22px rgba(15,23,42,0.04)" }}>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                      <div style={{ marginTop: 6, fontSize: 18, color: "#111827", fontWeight: 900, lineHeight: 1 }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={generateReport}
                    style={{ padding: "10px 28px", background: "#4c1d95", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}
                  >
                    Generate Report
                  </button>
                </div>
                <div style={{ marginTop: 18, borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
                  <div style={{ fontSize: 13, color: "#374151", fontWeight: 900, marginBottom: 10 }}>Attachments</div>
                  {documentCount ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", background: "#fff" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#111827", fontWeight: 900 }}>Attachments for {info.ay || "selected academic year"}</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: 700 }}>{documentCount} file{documentCount === 1 ? "" : "s"} available</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadAttachments}
                        disabled={attachmentDownloading}
                        className="appraisal-report-button"
                        style={{ minWidth: 190, minHeight: 40, padding: "10px 18px", background: attachmentDownloading ? "#64748b" : "linear-gradient(180deg,#6d28d9 0%,#4c1d95 100%)", color: "#fff", border: "none", borderRadius: 9, cursor: attachmentDownloading ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 13, fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, boxShadow: attachmentDownloading ? "none" : "0 10px 20px rgba(76,29,149,0.18)", opacity: attachmentDownloading ? 0.78 : 1 }}
                      >
                        <InlineSvgIcon paths={SUMMARY_ICONS.document} size={16} />
                        {attachmentDownloading ? "Preparing..." : "Download Attachments"}
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, padding: "12px 14px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#f8fafc" }}>No attachments found for this closed appraisal year.</div>
                  )}
                </div>
              </SC>
            ) : isLegacyTwoPartYear ? (
              <LegacyPreviousYearReport
                sectionView={hodAppraisalTab}
                academicYear={info.ay}
                profile={{ ...profileFromsessionStorage(), ...info }}
                reviews={workflowReviews}
                storedTotals={legacyReportTotals}
                docs={docs}
                lectures={lectures}
                courseFile={courseFile}
                innovRows={innovRows}
                projects={projects}
                quals={quals}
                feedback={feedback}
                deptActs={deptActs}
                uniActs={uniActs}
                society={society}
                industry={industry}
                acr={acr}
                journals={journals}
                books={books}
                ict={ict}
                research={research}
                projects2={projects2}
                externalProjects={externalProjects}
                patents={patents}
                awards={awards}
                confs={confs}
                proposals={proposals}
                products={products}
                fdps={fdps}
                training={training}
              />
            ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <fieldset disabled={(formLocked && hodAppraisalTab !== "summary") || (partDLocked && hodAppraisalTab === "partD")} style={{ flex: 1, minWidth: 0, border: 0, padding: 0, margin: 0, opacity: formLocked && hodAppraisalTab !== "summary" ? 0.86 : 1 }}>

                {/* Part A Tab */}
                {hodAppraisalTab === "partA" && (
                  <SC title={`Part A - Teaching & Academic Activities (Max ${effectivePartAMax})`} accent="#5b5ceb" scoreBadge={`${partATotal.toFixed(1)} / ${effectivePartAMax}`}>
                    <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>Fill in your teaching and academic activities for the appraisal period. Enter scores for each item.</div>
                    {/* A1. Teaching Process */}
                    <div style={{ marginBottom: 16, order: 1 }}>
                      <SubsectionTitle icon="teaching">A1. Course Delivery & Classroom Engagement - Max 40 marks</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={TH}>SN</th>
                            <th style={TH}>Semester</th>
                            <th style={TH}>Course Code / Name</th>
                            <th style={TH}>Classes (as per course structure)</th>
                            <th style={TH}>Classes Actually Conducted</th>
                            <th style={TH}>% Conducted</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lectures.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.sem} onChange={(v) => setLec(i, "sem", v)} placeholder="e.g. 2026-27 Sem-I" /></td>
                              <td style={TD}><TI val={r.code} onChange={(v) => setLec(i, "code", v)} textOnly placeholder="e.g. CS201 - Data Structures" /></td>
                              <td style={TDC}><TI val={r.planned} onChange={(v) => setLec(i, "planned", v)} center numeric placeholder="Planned" /></td>
                              <td style={TDC}><TI val={r.conducted} onChange={(v) => setLec(i, "conducted", v)} center numeric placeholder="Conducted" /></td>
                              <td style={{ ...TDC, fontWeight: 700 }}>{r.pctConducted}</td>
                              <td style={TD}><DocCell id={`lec-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`lec-${i}`} docs={docs} /></td>
                              <td style={{ ...TDS, fontWeight: 800 }}>{r.score}</td>
                            </tr>
                          ))}
                          <tr style={{ background: "#eff6ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={8}>Total Score (Max 40)</td>
                            <td style={{ ...TDS, fontWeight: "bold", color: "#1e3a5f" }}>{totalLecScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns
                        onAdd={() => {
                          setLectures((p) => [...p, { sem: "", code: "", planned: "", conducted: "", score: "", hod: "", director: "" }]);
                        }}
                        onDel={() => setLectures((p) => (p.length > 1 ? p.slice(0, -1) : p))}
                        canDel={lectures.length > 1}
                      />
                    </div>

                    {/* A2. Course File */}
                    <div style={{ marginBottom: 16, order: 2 }}>
                      <SubsectionTitle icon="folder">A2. Course File & Curriculum Documentation - Max 20 marks</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Course / Paper</th>
                            <th style={TH}>Program & Semester</th>
                            <th style={TH}>IQAC Index Compliance (Yes/No, with proof)</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {courseFile.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.course} onChange={(v) => setCF(i, "course", v)} placeholder="Course code / paper name" /></td>
                              <td style={TD}><TI val={r.title} onChange={(v) => setCF(i, "title", v)} placeholder="Title / Program & Semester" /></td>
                              <td style={TD}>
                                <select value={normalizeCourseFileDetails(r.details)} onChange={(e) => setCF(i, "details", e.target.value)} style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontFamily: "inherit", fontSize: 11 }}>
                                  <option value="">Select</option>
                                  {COURSE_FILE_DETAIL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                              </td>
                              <td style={TD}><DocCell id={`courseFile-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`courseFile-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setCF(i, "score", v === "" ? "" : String(clampScore(v, SCORE_LIMITS.courseFileRow)))} numeric max={SCORE_LIMITS.courseFileRow} center /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#eff6ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={6}>Total Score (Max 20)</td>
                            <td style={{ ...TDS, fontWeight: "bold", color: "#1e3a5f" }}>{courseFileScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setCourseFile((p) => [...p, { course: "", title: "", details: "", score: "", hod: "", director: "" }])} onDel={() => setCourseFile((p) => (p.length > 1 ? p.slice(0, -1) : p))} canDel={courseFile.length > 1} />
                    </div>

                    {/* A3. Innovative Teaching */}
                    <div style={{ marginBottom: 16, order: 3 }}>
                      <SubsectionTitle icon="lightbulb">A3. Innovative Teaching-Learning Methods - Max 20 marks</SubsectionTitle>
                      <table style={T}>
                        <thead><tr>
                          <th style={{ ...TH, width: 30 }}>SN</th>
                          <th style={TH}>Methods Used</th>
                          <th style={TH}>Proof Attached (Yes/No)</th>
                          <th style={TH}>Attachment</th>
                          <th style={TH}>View Docs</th>
                          <th style={TH}>Score</th>
                        </tr></thead>
                        <tbody>
                          {innovRows.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}>
                                <select
                                  value={r.method || ""}
                                  onChange={(e) => {
                                    const nextMethod = e.target.value;
                                    setInnov(i, "method", nextMethod);
                                    if (nextMethod !== OTHER_INNOVATIVE_METHOD) setInnov(i, "methodOther", "");
                                  }}
                                  style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontFamily: "inherit", fontSize: 11 }}
                                >
                                  <option value="">Select Method</option>
                                  {r.method && !LEGACY_INNOVATIVE_METHODS.has(r.method) && <option value={r.method}>{r.method}</option>}
                                  {innovativeMethodOptionsForRow(r.method).map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                                {r.method === OTHER_INNOVATIVE_METHOD && (
                                  <input
                                    type="text"
                                    value={r.methodOther || ""}
                                    onChange={(e) => setInnov(i, "methodOther", e.target.value)}
                                    placeholder="Mention the name of the innovative method"
                                    style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontFamily: "inherit", fontSize: 11, marginTop: 6, padding: "0 8px", boxSizing: "border-box" }}
                                  />
                                )}
                              </td>
                               <td style={TD}>
                                 <select
                                   value={r.details || ""}
                                   onChange={(e) => setInnov(i, "details", e.target.value)}
                                   style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontFamily: "inherit", fontSize: 11 }}
                                 >
                                   <option value="">Select</option>
                                   <option value="Yes">Yes</option>
                                   <option value="No">No</option>
                                 </select>
                               </td>
                              <td style={TD}><DocCell id={`innov-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`innov-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setInnov(i, "score", v === "" ? "" : String(clampScore(v, A3_INNOVATIVE_ROW_MAX)))} numeric max={A3_INNOVATIVE_ROW_MAX} center /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#eff6ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={5}>Total Score (Max 20)</td>
                            <td style={{ ...TDS, fontWeight: "bold", color: "#1e3a5f" }}>{innovTotal.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setInnovRows((p) => [...p, blankInnovativeRow()])} onDel={() => setInnovRows((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={innovRows.length > 1} />
                    </div>

                    {/* A4. Student Feedback */}
                    <div style={{ marginBottom: 16, order: 4 }}>
                      <SubsectionTitle icon="chart">A4. Student Feedback Score - Max 10 marks</SubsectionTitle>
                      <table style={{ ...T, tableLayout: "fixed" }}>
                        <colgroup>
                          <col style={{ width: "6%" }} />
                          <col style={{ width: "32%" }} />
                          <col style={{ width: "18%" }} />
                          <col style={{ width: "18%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "13%" }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th style={TH}>SN</th>
                            <th style={TH}>Course Code / Name</th>
                            <th style={TH}>First Student Feedback As per Juno</th>
                            <th style={TH}>Second Student Feedback As Per Juno</th>
                            <th style={TH}>Average</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {feedback.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.code} onChange={(v) => setFb(i, "code", v)} textOnly placeholder="Course code / name" /></td>
                              <td style={TDC}><TI val={r.fb1} onChange={(v) => setFb(i, "fb1", v)} center numeric max={5} deferClampWhileTyping placeholder="0-5" /></td>
                              <td style={TDC}><TI val={r.fb2} onChange={(v) => setFb(i, "fb2", v)} center numeric max={5} deferClampWhileTyping placeholder="0-5" /></td>
                              <td style={{ ...TDC, fontWeight: 700, color: "#0ea5e9" }}>{r.fb1 || r.fb2 ? feedbackAverage(r).toFixed(2) : ""}</td>
                              <td style={{ ...TDS, fontWeight: 800 }}>{r.fb1 || r.fb2 ? r.score || "0" : ""}</td>
                            </tr>
                          ))}
                          <tr style={{ background: "#eff6ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={5}>Total Score (Max 10)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{stuFeedbackScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setFeedback((p) => [...p, { code: "", fb1: "", fb2: "", score: "" }])} onDel={() => setFeedback((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={feedback.length > 1} />
                    </div>

                    {/* A5. OBE Practice */}
                    <div style={{ marginBottom: 16, order: 5 }}>
                      <SubsectionTitle icon="obe">A5. Learning Outcomes Attainment & OBE Practice - Max 20 marks</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Component</th>
                            <th style={TH}>Evidence Attached (Yes/No)</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {obeRows.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.component} onChange={(v) => setObe(i, "component", v)} placeholder="CO-PO / attainment / corrective action" /></td>
                               <td style={TD}>
                                 <select
                                   value={r.evidence || ""}
                                   onChange={(e) => setObe(i, "evidence", e.target.value)}
                                   style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontFamily: "inherit", fontSize: 11 }}
                                 >
                                   <option value="">Select</option>
                                   <option value="Yes">Yes</option>
                                   <option value="No">No</option>
                                 </select>
                               </td>
                              <td style={TD}><DocCell id={`obe-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`obe-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setObe(i, "score", v)} center numeric max={r.max || A5_OBE_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#eff6ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={5}>Total Score (Max 20)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{obeScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* A6. Guided Students Project */}
                    <div style={{ marginBottom: 16, order: 6 }}>
                      <SubsectionTitle icon="guidance">A6. Student Project Guidance - Max 20 marks</SubsectionTitle>
                      <>
                        <table style={T}>
                          <thead>
                            <tr>
                              <th style={{ ...TH, width: 30 }}>SN</th>
                              <th style={TH}>Project Title / Batch</th>
                              <th style={TH}>No. of Students</th>
                              <th style={TH}>Industry Collab (Y/N)</th>
                              <th style={TH}>Award (Y/N)</th>
                              <th style={TH}>Student Pub (Y/N)</th>
                              <th style={TH}>Attachment</th>
                              <th style={TH}>View Docs</th>
                              <th style={TH}>Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projects.map((r, i) => (
                              <tr key={i}>
                                <td style={TDC}>{i + 1}</td>
                                <td style={TD}>
                                  <TI 
                                    val={r.label} 
                                    onChange={(v) => setProj(i, "label", v)} 
                                    placeholder="Project Title / Batch" 
                                  />
                                </td>
                                <td style={TDC}><TI val={r.studentsCount} onChange={(v) => setProj(i, "studentsCount", v)} center numeric integer placeholder="No." /></td>
                                <td style={TDC}>
                                  <select value={r.industryCollab || ""} onChange={(e) => setProj(i, "industryCollab", e.target.value)} style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 11 }}>
                                    <option value="">Select</option>
                                    <option value="Yes">Yes</option>
                                    <option value="No">No</option>
                                  </select>
                                </td>
                                <td style={TDC}>
                                  <select value={r.awardReceived || ""} onChange={(e) => setProj(i, "awardReceived", e.target.value)} style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 11 }}>
                                    <option value="">Select</option>
                                    <option value="Yes">Yes</option>
                                    <option value="No">No</option>
                                  </select>
                                </td>
                                <td style={TDC}>
                                  <select value={r.studentPub || ""} onChange={(e) => setProj(i, "studentPub", e.target.value)} style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 11 }}>
                                    <option value="">Select</option>
                                    <option value="Yes">Yes</option>
                                    <option value="No">No</option>
                                  </select>
                                </td>
                                <td style={TD}><DocCell id={`proj-${i}`} docs={docs} setDocs={setDocs} /></td>
                                <td style={TD}><ViewCell id={`proj-${i}`} docs={docs} /></td>
                                <td style={TDS}><TI val={r.score} onChange={(v) => setProj(i, "score", v)} center numeric max={A6_PROJECT_GUIDANCE_MAX} /></td>
                              </tr>
                            ))}
                            <tr style={{ background: "#eff6ff" }}>
                              <td style={{ ...TDC, fontWeight: "bold" }} colSpan={8}>Total Score (Max 20)</td>
                              <td style={{ ...TDS, fontWeight: "bold" }}>{projectTotal.toFixed(1)}</td>
                            </tr>
                          </tbody>
                        </table>
                        <RowBtns onAdd={() => setProjects((p) => [...p, { label: "", studentsCount: "", industryCollab: "", awardReceived: "", studentPub: "", score: "" }])} onDel={() => setProjects((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={projects.length > 1} />
                      </>
                    </div>

                    {/* A7. Mentoring */}
                    <div style={{ marginBottom: 16, order: 7 }}>
                      <SubsectionTitle icon="mentoring">A7. Student Mentoring & Counselling - Max 10 marks</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Activity</th>
                            <th style={TH}>Evidence Attached (Yes/No)</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mentoringRows.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.activity} onChange={(v) => setMentoring(i, "activity", v)} placeholder="Meeting / register / counselling outcome" /></td>
                              <td style={TD}>
                                <select
                                  value={r.evidence || ""}
                                  onChange={(e) => setMentoring(i, "evidence", e.target.value)}
                                  style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontFamily: "inherit", fontSize: 11 }}
                                >
                                  <option value="">Select</option>
                                  <option value="Yes">Yes</option>
                                  <option value="No">No</option>
                                </select>
                              </td>
                              <td style={TD}><DocCell id={`mentor-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`mentor-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setMentoring(i, "score", v)} center numeric max={r.max || A7_MENTORING_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#eff6ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={5}>Total Score (Max 10)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{mentoringScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* A8. Qualifications */}
                    <div style={{ marginBottom: 16, order: 8 }}>
                      <SubsectionTitle icon="award">A8. Professional Development & Qualification Enhancement - Max 10 marks</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Qualification / Certification Title</th>
                            <th style={TH}>Awarding Body</th>
                            <th style={TH}>Date</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quals.map((r, i) => (
                            <tr key={i}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}>
                                <TI 
                                  val={r.label} 
                                  onChange={(v) => setQual(i, "label", v)} 
                                  placeholder="Higher qualification / Certification Title" 
                                />
                              </td>
                              <td style={TD}><TI val={r.awardingBody} onChange={(v) => setQual(i, "awardingBody", v)} placeholder="Awarding Body" /></td>
                              <td style={TDC}><TI val={r.date} onChange={(v) => setQual(i, "date", maskDateDDMMYYYY(v))} placeholder="DD/MM/YYYY" /></td>
                              <td style={TD}><DocCell id={`qual-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`qual-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={String(r.score ?? "").trim() ? clampScore(r.score, A8_QUALIFICATION_MAX) : ""} onChange={(v) => setQual(i, "score", v)} center numeric max={A8_QUALIFICATION_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#eff6ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={6}>Total Score (Max 10)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{qualTotal.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setQuals((p) => [...p, { label: "", awardingBody: "", date: "", score: "" }])} onDel={() => setQuals((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={quals.length > 1} />
                    </div>
                  </SC>
                )}

                {/* Part C Tab */}
                {!isLegacyTwoPartYear && hodAppraisalTab === "partC" && (
                  <SC title={`Part C - Administrative Role & University Development Contribution (Max ${PART_C_MAX})`} accent="#0f766e" scoreBadge={`${partCTotal.toFixed(1)} / ${PART_C_MAX}`}>
                    <div style={{ marginBottom: 14, padding: "8px 12px", background: "#ccfbf1", borderRadius: 6, fontSize: 12, color: "#115e59", fontWeight: 600 }}>
                      Total Part C Score: {partCTotal.toFixed(1)}/{PART_C_MAX}
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <SubsectionTitle icon="building">C1. Administration at University Level - Max 50 marks</SubsectionTitle>
                      <table style={T}>
                        <thead><tr>
                          <th style={{ ...TH, width: 30 }}>Sr. No.</th>
                          <th style={TH}>Activity / Responsibility</th>
                          <th style={TH}>Duration Category</th>
                          <th style={TH}>Period</th>
                          <th style={TH}>Attachment</th>
                          <th style={TH}>View Docs</th>
                          <th style={TH}>Faculty Score</th>
                        </tr></thead>
                        <tbody>
                          {uniActs.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.activity} onChange={(v) => setUni(i, "activity", v)} placeholder="Committee / cell / university responsibility" /></td>
                              <td style={TD}><TI val={r.nature} onChange={(v) => setUni(i, "nature", v)} placeholder="Full year / semester / event based" /></td>
                              <td style={TD}><TI val={r.period} onChange={(v) => setUni(i, "period", v)} placeholder="e.g. Jul 2026 - Dec 2026" /></td>
                              <td style={TD}><DocCell id={`uni-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`uni-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setUni(i, "score", v)} center numeric max={C1_UNIVERSITY_ADMIN_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#ccfbf1" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={6}>Total (Max 50)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{uniScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setUniActs((p) => [...p, { activity: "", nature: "", period: "", score: "" }])} onDel={() => setUniActs((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={uniActs.length > 1} />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <SubsectionTitle icon="school">C2. Administration at School Level - Max 30 marks</SubsectionTitle>
                      <table style={T}>
                        <thead><tr>
                          <th style={{ ...TH, width: 30 }}>Sr. No.</th>
                          <th style={TH}>Activity / Responsibility</th>
                          <th style={TH}>Duration Category</th>
                          <th style={TH}>Period</th>
                          <th style={TH}>Attachment</th>
                          <th style={TH}>View Docs</th>
                          <th style={TH}>Faculty Score</th>
                        </tr></thead>
                        <tbody>
                          {deptActs.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.activity} onChange={(v) => setDept(i, "activity", v)} placeholder="School committee / coordinator role" /></td>
                              <td style={TD}><TI val={r.nature} onChange={(v) => setDept(i, "nature", v)} placeholder="Full year / semester / event based" /></td>
                              <td style={TD}><TI val={r.period} onChange={(v) => setDept(i, "period", v)} placeholder="e.g. AY 2026-2027" /></td>
                              <td style={TD}><DocCell id={`dept-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`dept-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setDept(i, "score", v)} center numeric max={C2_SCHOOL_ADMIN_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#ccfbf1" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={6}>Total (Max 30)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{deptScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setDeptActs((p) => [...p, { activity: "", nature: "", period: "", score: "" }])} onDel={() => setDeptActs((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={deptActs.length > 1} />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <SubsectionTitle icon="event">C3. Event Organisation & Institutional Visibility - Max 20 marks</SubsectionTitle>
                      <table style={T}>
                        <thead><tr>
                          <th style={{ ...TH, width: 30 }}>Sr. No.</th>
                          <th style={TH}>Event / Contribution</th>
                          <th style={TH}>Role</th>
                          <th style={TH}>From</th>
                          <th style={TH}>To</th>
                          <th style={TH}>Level</th>
                          <th style={TH}>Attachment</th>
                          <th style={TH}>View Docs</th>
                          <th style={TH}>Faculty Score</th>
                        </tr></thead>
                        <tbody>
                          {eventRows.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.event} onChange={(v) => setEvent(i, "event", v)} placeholder="Event / conference / workshop name" /></td>
                              <td style={TD}><TI val={r.role} onChange={(v) => setEvent(i, "role", v)} placeholder="Convener / coordinator / member" /></td>
                              <td style={TD}><TI val={r.fromDate} onChange={(v) => setEvent(i, "fromDate", maskDateDDMMYYYY(v))} placeholder="DD/MM/YYYY" /></td>
                              <td style={TD}><TI val={r.toDate} onChange={(v) => setEvent(i, "toDate", maskDateDDMMYYYY(v))} placeholder="DD/MM/YYYY" /></td>
                              <td style={TD}>
                                 <select
                                   value={r.level || ""}
                                   onChange={(e) => setEvent(i, "level", e.target.value)}
                                   style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontSize: 11, fontFamily: "inherit" }}
                                 >
                                   <option value="">Select Level</option>
                                   <option value="University">University</option>
                                   <option value="National">National</option>
                                   <option value="International">International</option>
                                 </select>
                               </td>
                              <td style={TD}><DocCell id={`event-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`event-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setEvent(i, "score", v)} center numeric max={C3_EVENT_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#ccfbf1" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={8}>Total (Max 20)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{eventScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setEventRows((p) => [...p, { event: "", role: "", fromDate: "", toDate: "", level: "", score: "" }])} onDel={() => setEventRows((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={eventRows.length > 1} />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <SubsectionTitle icon="outreach">C4. Outreach, Extension & Social Responsibility - Max 10 marks</SubsectionTitle>
                      <>
                        <table style={T}>
                          <thead><tr>
                            <th style={{ ...TH, width: 30 }}>Sr. No.</th>
                            <th style={TH}>Activity</th>
                            <th style={TH}>Details</th>
                            <th style={TH}>Date</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Faculty Score</th>
                          </tr></thead>
                          <tbody>
                            {society.map((r, i) => {
                              const socLocked = societyRowLocked(r);
                              return (
                                <tr key={i} style={socLocked ? { background: "#f1f5f9", opacity: 0.65 } : i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                                  <td style={TDC}>{i + 1}</td>
                                  <td style={TD}><TI val={r.label} onChange={(v) => setSoc(i, "label", v)} placeholder="Outreach / NSS / extension activity" readOnly={socLocked} /></td>
                                  <td style={TD}><TI val={r.details} onChange={(v) => setSoc(i, "details", v)} placeholder="Beneficiaries, location, outcome" readOnly={socLocked} /></td>
                                  <td style={TD}><TI val={r.date} onChange={(v) => setSoc(i, "date", maskDateDDMMYYYY(v))} placeholder="DD/MM/YYYY" readOnly={socLocked} /></td>
                                  <td style={TD}><DocCell id={`soc-${i}`} docs={docs} setDocs={setDocs} readOnly={socLocked} /></td>
                                  <td style={TD}><ViewCell id={`soc-${i}`} docs={docs} /></td>
                                  <td style={TDS}><TI val={r.score} onChange={(v) => setSoc(i, "score", v === "" ? "" : String(clampScore(v, C4_OUTREACH_MAX)))} numeric max={C4_OUTREACH_MAX} center readOnly={socLocked} /></td>
                                </tr>
                              );
                            })}
                            <tr style={{ background: "#ccfbf1" }}>
                              <td style={{ ...TDC, fontWeight: "bold" }} colSpan={6}>Total (Max 10)</td>
                              <td style={{ ...TDS, fontWeight: "bold" }}>{societyScore.toFixed(1)}</td>
                            </tr>
                          </tbody>
                        </table>
                        <RowBtns onAdd={() => setSociety((p) => [...p, { label: "", details: "", date: "", score: "", max: C4_OUTREACH_MAX }])} onDel={() => setSociety((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={society.length > 1} />
                      </>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <SubsectionTitle icon="industry">C5. Industry Interaction & Linkages - Max 10 marks</SubsectionTitle>
                      <table style={T}>
                        <thead><tr>
                          <th style={{ ...TH, width: 30 }}>Sr. No.</th>
                          <th style={TH}>Activity (MOU / CoE / Drive / Programme)</th>
                          <th style={TH}>Industry Partner</th>
                          <th style={TH}>Date</th>
                          <th style={TH}>Attachment</th>
                          <th style={TH}>View Docs</th>
                          <th style={TH}>Faculty Score</th>
                        </tr></thead>
                        <tbody>
                          {industry.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.activity} onChange={(v) => setInd(i, "activity", v)} placeholder="MOU / CoE / drive / guest lecture" /></td>
                              <td style={TD}><TI val={r.partner} onChange={(v) => setInd(i, "partner", v)} placeholder="Industry partner name" /></td>
                              <td style={TD}><TI val={r.date} onChange={(v) => setInd(i, "date", maskDateDDMMYYYY(v))} placeholder="DD/MM/YYYY" /></td>
                              <td style={TD}><DocCell id={`ind-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`ind-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setInd(i, "score", v)} center numeric max={C5_INDUSTRY_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#ccfbf1" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={6}>Total (Max 10)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{industryScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setIndustry((p) => [...p, { activity: "", partner: "", date: "", score: "" }])} onDel={() => setIndustry((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={industry.length > 1} />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <SubsectionTitle icon="alumni">C6. Alumni Engagement & Networking - Max 10 marks</SubsectionTitle>
                      <table style={T}>
                        <thead><tr>
                          <th style={{ ...TH, width: 30 }}>Sr. No.</th>
                          <th style={TH}>Activity</th>
                          <th style={TH}>Details</th>
                          <th style={TH}>Date</th>
                          <th style={TH}>Attachment</th>
                          <th style={TH}>View Docs</th>
                          <th style={TH}>Faculty Score</th>
                        </tr></thead>
                        <tbody>
                          {alumniRows.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.activity} onChange={(v) => setAlumni(i, "activity", v)} placeholder="Alumni talk / meet / mentoring" /></td>
                              <td style={TD}><TI val={r.details} onChange={(v) => setAlumni(i, "details", v)} placeholder="Alumni name, batch, outcome" /></td>
                              <td style={TD}><TI val={r.date} onChange={(v) => setAlumni(i, "date", maskDateDDMMYYYY(v))} placeholder="DD/MM/YYYY" /></td>
                              <td style={TD}><DocCell id={`alumni-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`alumni-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setAlumni(i, "score", v)} center numeric max={C6_ALUMNI_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#ccfbf1" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={6}>Total (Max 10)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{alumniScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setAlumniRows((p) => [...p, { activity: "", details: "", date: "", score: "" }])} onDel={() => setAlumniRows((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={alumniRows.length > 1} />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <SubsectionTitle icon="placement">C7. Student Placement Mentoring & Career Development - Max 20 marks</SubsectionTitle>
                      <table style={T}>
                        <thead><tr>
                          <th style={{ ...TH, width: 30 }}>Sr. No.</th>
                          <th style={TH}>Activity Type</th>
                          <th style={TH}>Student / Company Name</th>
                          <th style={TH}>Date</th>
                          <th style={TH}>Attachment</th>
                          <th style={TH}>View Docs</th>
                          <th style={TH}>Faculty Score</th>
                        </tr></thead>
                        <tbody>
                          {placementRows.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.activityType} onChange={(v) => setPlacement(i, "activityType", v)} placeholder="Mock interview / placement mentoring" /></td>
                              <td style={TD}><TI val={r.name} onChange={(v) => setPlacement(i, "name", v)} placeholder="Student / company name" /></td>
                              <td style={TD}><TI val={r.date} onChange={(v) => setPlacement(i, "date", maskDateDDMMYYYY(v))} placeholder="DD/MM/YYYY" /></td>
                              <td style={TD}><DocCell id={`placement-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`placement-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setPlacement(i, "score", v)} center numeric max={C7_PLACEMENT_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#ccfbf1" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={6}>Total (Max 20)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{placementScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setPlacementRows((p) => [...p, { activityType: "", name: "", date: "", score: "" }])} onDel={() => setPlacementRows((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={placementRows.length > 1} />
                    </div>
                  </SC>
                )}

                {/* Part D Tab */}
                {!isLegacyTwoPartYear && hodAppraisalTab === "partD" && (
                  <SC title={`Part D - Leave & Attendance Management (Max ${PART_D_MAX})`} accent="#0891b2" scoreBadge={`${partDTotal.toFixed(1)} / ${PART_D_MAX}`}>
                    <div style={{ marginBottom: 14, padding: "8px 12px", background: "#ecfeff", borderRadius: 6, fontSize: 12, color: "#155e75", fontWeight: 600 }}>
                      1. Unacceptable (0-5) &nbsp; 2. Below Average (6-10) &nbsp; 3. Average (11-15) &nbsp; 4. Above Average (16-20) &nbsp; 5. Outstanding (Above 20)
                    </div>
                    {leaveManagement.map((r, i) => {
                      const totalTaken = n(r.clTaken) + n(r.mlTaken) + n(r.odTaken) + n(r.coffTaken);
                      const totalOutOf = n(r.clOutOf) + n(r.mlOutOf) + n(r.odOutOf) + n(r.coffOutOf);
                      return (
                        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                          <table style={{ ...T, minWidth: 0, tableLayout: "fixed" }}>
                            <colgroup>
                              <col style={{ width: "28%" }} />
                              <col style={{ width: "16%" }} />
                              <col style={{ width: "16%" }} />
                              <col style={{ width: "16%" }} />
                              <col style={{ width: "16%" }} />
                              <col style={{ width: "8%" }} />
                            </colgroup>
                            <thead><tr>
                              <th style={{ ...TH, textAlign: "left" }}>1. No. of leaves taken in the Year</th>
                              <th style={TH}>CL</th>
                              <th style={TH}>ML</th>
                              <th style={TH}>OD</th>
                              <th style={TH}>C/Off</th>
                              <th style={TH}>Total</th>
                            </tr></thead>
                            <tbody>
                              <tr>
                                <td style={TD} />
                                <td style={TDS}><TI val={r.clTaken} onChange={(v) => setLeaveMgmt(i, "clTaken", v)} center numeric /></td>
                                <td style={TDS}><TI val={r.mlTaken} onChange={(v) => setLeaveMgmt(i, "mlTaken", v)} center numeric /></td>
                                <td style={TDS}><TI val={r.odTaken} onChange={(v) => setLeaveMgmt(i, "odTaken", v)} center numeric /></td>
                                <td style={TDS}><TI val={r.coffTaken} onChange={(v) => setLeaveMgmt(i, "coffTaken", v)} center numeric /></td>
                                <td style={{ ...TDC, fontWeight: 700 }}>{totalTaken || ""}</td>
                              </tr>
                              <tr style={{ background: "#f8fafc" }}>
                                <td style={{ ...TD, fontWeight: 700 }}>Out of</td>
                                <td style={TDS}><TI val={r.clOutOf} onChange={(v) => setLeaveMgmt(i, "clOutOf", v)} center numeric /></td>
                                <td style={TDS}><TI val={r.mlOutOf} onChange={(v) => setLeaveMgmt(i, "mlOutOf", v)} center numeric /></td>
                                <td style={TDS}><TI val={r.odOutOf} onChange={(v) => setLeaveMgmt(i, "odOutOf", v)} center numeric /></td>
                                <td style={TDS}><TI val={r.coffOutOf} onChange={(v) => setLeaveMgmt(i, "coffOutOf", v)} center numeric /></td>
                                <td style={{ ...TDC, fontWeight: 700 }}>{totalOutOf || ""}</td>
                              </tr>
                            </tbody>
                          </table>
                          <table style={{ ...T, minWidth: 0, tableLayout: "fixed" }}>
                            <colgroup>
                              <col style={{ width: "58%" }} />
                              <col style={{ width: "42%" }} />
                            </colgroup>
                            <tbody>
                              <tr>
                                <td style={{ ...TD, fontWeight: 700 }}>2. No. of Late Remarks in the Year</td>
                                <td style={TDS}><TI val={r.lateRemarks} onChange={(v) => setLeaveMgmt(i, "lateRemarks", v)} center numeric /></td>
                              </tr>
                              <tr style={{ background: "#f8fafc" }}>
                                <td style={{ ...TD, fontWeight: 700 }}>3. Total Actual Working Days for the current academic year</td>
                                <td style={TDS}><TI val={r.workingDays} onChange={(v) => setLeaveMgmt(i, "workingDays", v)} center numeric /></td>
                              </tr>
                              <tr>
                                <td style={{ ...TD, fontWeight: 700 }}>4. Management of leaves</td>
                                <td style={TD}>
                                  <select
                                    value={r.managementRating}
                                    onChange={(e) => setLeaveMgmt(i, "managementRating", e.target.value)}
                                    style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12.5 }}
                                  >
                                    <option value="">Select rating...</option>
                                    {PART_D_RATING_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>{option.label} - {option.score} marks</option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                              <tr style={{ background: "#ecfeff" }}>
                                <td style={{ ...TD, fontWeight: "bold", textAlign: "right" }}>Total Score out of ({PART_D_MAX}) =</td>
                                <td style={{ ...TDS, fontWeight: "bold" }}>{r.score || 0}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </SC>
                )}

                {/* Part E Tab */}
                {!isLegacyTwoPartYear && hodAppraisalTab === "partE" && (
                  <SC title={`Part E - Annual Confidential Report (Max ${PART_E_MAX})`} accent="#b45309" scoreBadge={`0.0 / ${PART_E_MAX}`}>
                    <div style={{ marginBottom: 14, padding: "8px 12px", background: "#fef3c7", borderRadius: 6, fontSize: 12, color: "#92400e", fontWeight: 600 }}>
                      Evaluated by HOD/Director only. This part has no faculty self-score input.
                    </div>
                    <table style={T}>
                      <thead><tr>
                        <th style={{ ...TH, width: 30 }}>Sr. No.</th>
                        <th style={TH}>Parameter</th>
                        <th style={TH}>Description / Indicators</th>
                        <th style={TH}>Max Marks</th>
                      </tr></thead>
                      <tbody>
                        {partEParameters.map((row, index) => (
                          <tr key={row.parameter} style={index % 2 === 1 ? { background: "#f8fafc" } : {}}>
                            <td style={TDC}>{`E${index + 1}`}</td>
                            <td style={{ ...TD, fontWeight: 700 }}>{row.parameter}</td>
                            <td style={TD}>{row.description}</td>
                            <td style={TDC}>{row.max}</td>
                          </tr>
                        ))}
                        <tr style={{ background: "#fef3c7" }}>
                          <td style={{ ...TDC, fontWeight: "bold" }} colSpan={3}>Part E Total (Max: {PART_E_MAX})</td>
                          <td style={{ ...TDS, fontWeight: "bold" }}>{PART_E_MAX}</td>
                        </tr>
                      </tbody>
                    </table>
                  </SC>
                )}

                {/* Part B Tab */}
                {hodAppraisalTab === "partB" && (
                  <SC title={`Part B - Research & Innovation (Max ${effectivePartBMax})`} accent="#7c3aed" scoreBadge={`${partBTotal.toFixed(1)} / ${effectivePartBMax}`}>
                    <div style={{ marginBottom: 14, padding: "8px 12px", background: "#ede9fe", borderRadius: 6, fontSize: 12, color: "#6d28d9", fontWeight: 600 }}>
                      Total Part B Score: {partBTotal.toFixed(1)}/{effectivePartBMax}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>Enter your research publications, patents, conferences, and other academic contributions.</div>

                    {/* B1. Journal Publications */}
                    <div style={{ marginBottom: 16, order: 1 }}>
                      <SubsectionTitle icon="journal">B1. Journal Publications - Max 100 marks</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Title</th>
                            <th style={TH}>Journal</th>
                            <th style={TH}>DOI No.</th>
                            <th style={TH}>Impact Factor</th>
                            <th style={TH}>Author Position</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {journals.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.title} onChange={(v) => setJour(i, "title", v)} textOnly placeholder="Paper title" /></td>
                              <td style={TD}><TI val={r.journal} onChange={(v) => setJour(i, "journal", v)} placeholder="Journal name, volume, issue" /></td>
                              <td style={TD}><TI val={r.issn} onChange={(v) => setJour(i, "issn", v)} placeholder="DOI / URL" /></td>
                              <td style={TD}><TI val={r.impactFactor} onChange={(v) => setJour(i, "impactFactor", v)} placeholder="Impact Factor" /></td>
                              <td style={TD}><TI val={r.authorPosition} onChange={(v) => setJour(i, "authorPosition", v)} placeholder="1st / Corresponding / Co-Author" /></td>
                              <td style={TD}><DocCell id={`jour-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`jour-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setJour(i, "score", v)} center numeric max={B1_JOURNAL_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#f3e8ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={8}>Total Score (Max 100)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{journalScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setJournals((p) => [...p, { title: "", journal: "", issn: "", impactFactor: "", authorPosition: "", score: "" }])} onDel={() => setJournals((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={journals.length > 1} />
                    </div>

                    {/* B2. Books / Chapters */}
                    <div style={{ marginBottom: 16, order: 2 }}>
                      <SubsectionTitle icon="book">B2. Books, Book Chapters & Edited Volumes - Max 30 marks</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Title</th>
                            <th style={TH}>Publisher & ISBN</th>
                            <th style={TH}>Type</th>
                            <th style={TH}>Level</th>
                            <th style={TH}>Co-authors from DYPIU</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {books.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.title} onChange={(v) => setBook(i, "title", v)} textOnly placeholder="Book / chapter title" /></td>
                              <td style={TD}><TI val={r.book} onChange={(v) => setBook(i, "book", v)} placeholder="Publisher & ISBN" /></td>
                              <td style={TD}>
                                <select
                                  value={r.pub || ""}
                                  onChange={(e) => setBook(i, "pub", e.target.value)}
                                  style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontSize: 11, fontFamily: "inherit" }}
                                >
                                  <option value="">Select Type</option>
                                  {["Book", "Chapter", "Editor", "Translation"].map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={TD}>
                                <select
                                  value={r.level || ""}
                                  onChange={(e) => setBook(i, "level", e.target.value)}
                                  style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontSize: 11, fontFamily: "inherit" }}
                                >
                                  <option value="">Select Level</option>
                                  {["International", "National", "Local"].map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={TD}><TI val={r.coauth} onChange={(v) => setBook(i, "coauth", v)} placeholder="Co-authors from DYPIU" /></td>
                              <td style={TD}><DocCell id={`book-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`book-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setBook(i, "score", v)} center numeric max={B2_BOOK_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#f3e8ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={8}>Total Score (Max 30)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{bookScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setBooks((p) => [...p, { title: "", book: "", pub: "", level: "", coauth: "", score: "" }])} onDel={() => setBooks((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={books.length > 1} />
                    </div>

                    {/* B11. ICT Content, MOOCs & E-Learning */}
                    <div style={{ marginBottom: 16, order: 11 }}>
                      <SubsectionTitle icon="monitor">B11. ICT Content, MOOCs & E-Learning - Max 20 marks</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Title</th>
                            <th style={TH}>Platform / Type</th>
                            <th style={TH}>Reach / Views (if available)</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ict.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.title} onChange={(v) => setIctRow(i, "title", v)} textOnly placeholder="Title" /></td>
                              <td style={TD}><TI val={r.type} onChange={(v) => setIctRow(i, "type", v)} placeholder="Platform / Type" /></td>
                              <td style={TD}><TI val={r.quad} onChange={(v) => setIctRow(i, "quad", v)} placeholder="Reach / Views" /></td>
                              <td style={TD}><DocCell id={`ict-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`ict-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setIctRow(i, "score", v)} center numeric max={B3_ICT_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#f3e8ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={6}>Total Score (Max 20)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{ictScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setIct((p) => [...p, { title: "", type: "", quad: "", score: "" }])} onDel={() => setIct((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={ict.length > 1} />
                    </div>

                    {/* B5. Research Guidance */}
                    <div style={{ marginBottom: 16, order: 5 }}>
                      <SubsectionTitle icon="research">B5. Research Guidance - Max 20 marks</SubsectionTitle>
                      <>
                        <table style={T}>
                          <thead>
                            <tr>
                              <th style={{ ...TH, width: 30 }}>SN</th>
                              <th style={TH}>Degree (PhD)</th>
                              <th style={TH}>Name of Student / Scholar</th>
                              <th style={TH}>Status (Ongoing/Awarded)</th>
                              <th style={TH}>Date</th>
                              <th style={TH}>Attachment</th>
                              <th style={TH}>View Docs</th>
                              <th style={TH}>Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {research.map((r, i) => (
                              <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                                <td style={TDC}>{i + 1}</td>
                                <td style={TD}>
                                  <select
                                    value={r.degree || ""}
                                    onChange={(event) => setRes(i, "degree", event.target.value)}
                                    style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontSize: 11, fontFamily: "inherit" }}
                                  >
                                    <option value="">Select</option>
                                    <option value="PhD">PhD</option>
                                  </select>
                                </td>
                                <td style={TD}><TI val={r.name} onChange={(v) => setRes(i, "name", v)} textOnly placeholder="Name of Student / Scholar" /></td>
                                <td style={TD}>
                                  <select
                                    value={r.status || ""}
                                    onChange={(event) => {
                                      const nextStatus = event.target.value;
                                      setRes(i, "status", nextStatus);
                                      if (nextStatus === "Ongoing") setRes(i, "date", "");
                                    }}
                                    style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontSize: 11, fontFamily: "inherit" }}
                                  >
                                    <option value="">Select</option>
                                    <option value="Ongoing">Ongoing</option>
                                    <option value="Awarded">Awarded</option>
                                  </select>
                                </td>
                                <td style={TD}><TI val={r.date} onChange={(v) => setRes(i, "date", maskDateDDMMYYYY(v))} placeholder={r.status === "Ongoing" ? "Not required" : "DD/MM/YYYY"} readOnly={r.status === "Ongoing"} /></td>
                                <td style={TD}><DocCell id={`res-${i}`} docs={docs} setDocs={setDocs} /></td>
                                <td style={TD}><ViewCell id={`res-${i}`} docs={docs} /></td>
                                <td style={TDS}><TI val={r.score} onChange={(v) => setRes(i, "score", v)} center numeric max={b5RowMax(r)} /></td>
                              </tr>
                            ))}
                            <tr style={{ background: "#f3e8ff" }}>
                              <td style={{ ...TDC, fontWeight: "bold" }} colSpan={7}>Total Score (Max 20)</td>
                              <td style={{ ...TDS, fontWeight: "bold" }}>{researchScore.toFixed(1)}</td>
                            </tr>
                          </tbody>
                        </table>
                        <RowBtns onAdd={() => setResearch((p) => [...p, { degree: "PhD", name: "", status: "", date: "", score: "" }])} onDel={() => setResearch((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={research.length > 1} />
                      </>
                    </div>

                    {/* B4. External Funded Research Projects */}
                    <div style={{ marginBottom: 16, order: 4 }}>
                      <SubsectionTitle icon="fundedProject">B4. External Funded Research Projects - Max 40 marks</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Title of Project</th>
                            <th style={TH}>Funding Agency</th>
                            <th style={TH}>Sanction Date</th>
                            <th style={TH}>Amount (₹)</th>
                            <th style={TH}>PI / Co-PI</th>
                            <th style={TH}>Status</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projects2.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.title} onChange={(v) => setPrj2(i, "title", v)} textOnly placeholder="Project title" /></td>
                              <td style={TD}><TI val={r.agency} onChange={(v) => setPrj2(i, "agency", v)} textOnly placeholder="Funding agency" /></td>
                              <td style={TD}><TI val={r.date} onChange={(v) => setPrj2(i, "date", maskDateDDMMYYYY(v))} placeholder="DD/MM/YYYY" /></td>
                              <td style={TD}><TI val={r.amount} onChange={(v) => setPrj2(i, "amount", v)} integer placeholder="Amount in INR" /></td>
                              <td style={TD}>
                                <select
                                  value={r.role || ""}
                                  onChange={(e) => setPrj2(i, "role", e.target.value)}
                                  style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontSize: 11, fontFamily: "inherit" }}
                                >
                                  <option value="">Select Role</option>
                                  {["PI", "Co-PI", "Consultant", "Project Director"].map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={TD}>
                                <select
                                  value={r.status || ""}
                                  onChange={(e) => setPrj2(i, "status", e.target.value)}
                                  style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontSize: 11, fontFamily: "inherit" }}
                                >
                                  <option value="">Select Status</option>
                                  {["Ongoing", "Completed", "Sanctioned", "Submitted"].map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={TD}><DocCell id={`project2-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`project2-${i}`} docs={docs} /></td>
                              <td style={{ ...TDS, fontWeight: 800 }}>{r.score}</td>
                            </tr>
                          ))}
                          <tr style={{ background: "#f3e8ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={9}>Total Score (Max 40)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{projectBScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setProjects2((p) => [...p, { title: "", agency: "", date: "", amount: "", role: "", status: "", score: "", max: B4_PROJECT_MAX }])} onDel={() => setProjects2((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={projects2.length > 1} />
                    </div>

                    {/* Legacy external projects retained only for old saved data */}
                    <div style={{ marginBottom: 16, display: "none" }}>
                      <SubsectionTitle icon="externalProject">Legacy External Research Projects - Not counted in AY 2026-2027 total</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Title</th>
                            <th style={TH}>Funding Agency</th>
                            <th style={TH}>Date of Sanction</th>
                            <th style={TH}>Grant Amount</th>
                            <th style={TH}>Role PI / Co-PI / Consultant</th>
                            <th style={TH}>Status</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {externalProjects.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.title} onChange={(v) => setExtPrj(i, "title", v)} textOnly placeholder="Project title" /></td>
                              <td style={TD}><TI val={r.agency} onChange={(v) => setExtPrj(i, "agency", v)} textOnly placeholder="Funding agency" /></td>
                              <td style={TD}><TI val={r.date} onChange={(v) => setExtPrj(i, "date", maskDateDDMMYYYY(v))} placeholder="DD/MM/YYYY" /></td>
                              <td style={TD}><TI val={r.amount} onChange={(v) => setExtPrj(i, "amount", v)} numeric placeholder="Grant amount" /></td>
                              <td style={TD}><TI val={r.role} onChange={(v) => setExtPrj(i, "role", v)} textOnly placeholder="PI / Co-PI / Consultant" /></td>
                              <td style={TD}><TI val={r.status} onChange={(v) => setExtPrj(i, "status", v)} textOnly placeholder="Ongoing / Completed" /></td>
                              <td style={TD}><DocCell id={`externalProject-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`externalProject-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setExtPrj(i, "score", v)} center numeric max={0} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#f3e8ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={9}>Total Score (Max 0)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{externalProjectScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setExternalProjects((p) => [...p, { title: "", agency: "", date: "", amount: "", role: "", status: "", score: "" }])} onDel={() => setExternalProjects((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={externalProjects.length > 1} />
                    </div>

                    {/* B3. Patents, Copyrights & IP and Product Development */}
                    <div style={{ marginBottom: 16, order: 3 }}>
                      <SubsectionTitle icon="patent">B3. Patents, Copyrights & IP and Product Development - Max 40 marks</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Title</th>
                            <th style={TH}>National / International</th>
                            <th style={TH}>Status (Published/Granted)</th>
                            <th style={TH}>Filing / Grant No. & Date</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {patents.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.title} onChange={(v) => setPat(i, "title", v)} textOnly placeholder="Patent / IP title" /></td>
                              <td style={TD}>
                                <select
                                  value={r.type || ""}
                                  onChange={(e) => setPat(i, "type", e.target.value)}
                                  style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontSize: 11, fontFamily: "inherit" }}
                                >
                                  <option value="">Select Scope</option>
                                  {["National", "International"].map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={TD}>
                                <select
                                  value={r.status || ""}
                                  onChange={(e) => setPat(i, "status", e.target.value)}
                                  style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontSize: 11, fontFamily: "inherit" }}
                                >
                                  <option value="">Select Status</option>
                                  {["Published", "Granted"].map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={TD}><TI val={r.fileNo} onChange={(v) => setPat(i, "fileNo", v)} placeholder="Filing / grant no. and date" /></td>
                              <td style={TD}><DocCell id={`pat-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`pat-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setPat(i, "score", v)} center numeric max={B3_PATENT_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#f3e8ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={7}>Total Patents Score (Max 40)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{patentScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setPatents((p) => [...p, { title: "", type: "", date: "", status: "", fileNo: "", score: "" }])} onDel={() => setPatents((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={patents.length > 1} />
                    </div>

                    {/* B9. Research Awards, Fellowships, Reviewer of Journal & Citations */}
                    <div style={{ marginBottom: 16, order: 9 }}>
                      <SubsectionTitle icon="trophy">B9. Research Awards, Fellowships, Reviewer of Journal & Citations - Max 20 marks</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Title of Award / Fellowship / Metric</th>
                            <th style={TH}>Awarding Agency</th>
                            <th style={TH}>Level</th>
                            <th style={TH}>Date</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {awards.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.title} onChange={(v) => setAwd(i, "title", v)} textOnly placeholder="Title of Award / Fellowship / Metric" /></td>
                              <td style={TD}><TI val={r.agency} onChange={(v) => setAwd(i, "agency", v)} textOnly placeholder="Awarding Agency" /></td>
                              <td style={TD}><TI val={r.level} onChange={(v) => setAwd(i, "level", v)} textOnly placeholder="Level" /></td>
                              <td style={TD}><TI val={r.date} onChange={(v) => setAwd(i, "date", maskDateDDMMYYYY(v))} placeholder="DD/MM/YYYY" /></td>
                              <td style={TD}><DocCell id={`awd-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`awd-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setAwd(i, "score", v)} center numeric max={B9_AWARDS_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#f3e8ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={7}>Total Score (Max 20)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{awardScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setAwards((p) => [...p, { title: "", agency: "", level: "", date: "", score: "" }])} onDel={() => setAwards((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={awards.length > 1} />
                    </div>

                    {/* B7. Conference / FDP / Training / Workshop Contributions as Resource Person */}
                    <div style={{ marginBottom: 16, order: 7 }}>
                      <SubsectionTitle icon="conference">B7. Conference / FDP / Training / Workshop Contributions as Resource Person - Max 20 marks</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Event / Session Title</th>
                            <th style={TH}>Role</th>
                            <th style={TH}>Date</th>
                            <th style={TH}>Level (Intl./National)</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {confs.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.title} onChange={(v) => setConf(i, "title", v)} textOnly placeholder="Event / Session Title" /></td>
                              <td style={TD}><TI val={r.role} onChange={(v) => setConf(i, "role", v)} placeholder="Role (e.g. Coordinator)" /></td>
                              <td style={TD}><TI val={r.date} onChange={(v) => setConf(i, "date", maskDateDDMMYYYY(v))} placeholder="DD/MM/YYYY" /></td>
                              <td style={TD}><TI val={r.level} onChange={(v) => setConf(i, "level", v)} placeholder="Intl. / National" /></td>
                              <td style={TD}><DocCell id={`conf-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`conf-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setConf(i, "score", v)} center numeric max={B7_CONFERENCE_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#f3e8ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={7}>Total Score (Max 20)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{confScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setConfs((p) => [...p, { title: "", role: "", date: "", level: "", score: "" }])} onDel={() => setConfs((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={confs.length > 1} />
                    </div>

                    {/* B6. Consultancy, Testing & Training */}
                    <div style={{ marginBottom: 16, order: 6 }}>
                      <SubsectionTitle icon="consultancy">B6. Consultancy, Testing & Training - Max 20 marks</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Client / Organisation</th>
                            <th style={TH}>Nature of Engagement</th>
                            <th style={TH}>Revenue Generated (₹)</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {proposals.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.agency} onChange={(v) => setProp(i, "agency", v)} textOnly placeholder="Client / Organisation" /></td>
                              <td style={TD}><TI val={r.duration} onChange={(v) => setProp(i, "duration", v)} placeholder="Nature of Engagement" /></td>
                              <td style={TD}><TI val={r.amount} onChange={(v) => setProp(i, "amount", v)} numeric placeholder="Revenue (₹)" /></td>
                              <td style={TD}><DocCell id={`prop-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`prop-${i}`} docs={docs} /></td>
                              <td style={{ ...TDS, fontWeight: 800 }}>{r.score}</td>
                            </tr>
                          ))}
                          <tr style={{ background: "#f3e8ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={6}>Total Score (Max 20)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{proposalScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setProposals((p) => [...p, { agency: "", duration: "", amount: "", score: "" }])} onDel={() => setProposals((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={proposals.length > 1} />
                    </div>

                    {/* B10. Innovation, Start-ups & Technology Transfer */}
                    <div style={{ marginBottom: 16, order: 10 }}>
                      <SubsectionTitle icon="startup">B10. Innovation, Start-ups & Technology Transfer - Max 20 marks</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Title / Start-up / Product</th>
                            <th style={TH}>Role</th>
                            <th style={TH}>Status</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.details} onChange={(v) => setProd(i, "details", v)} placeholder="Title / start-up / product" /></td>
                              <td style={TD}><TI val={r.role} onChange={(v) => setProd(i, "role", v)} placeholder="Founder / mentor / developer" /></td>
                              <td style={TD}><TI val={r.status} onChange={(v) => setProd(i, "status", v)} placeholder="Prototype / registered / commercialized" /></td>
                              <td style={TD}><DocCell id={`prod-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`prod-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setProd(i, "score", v)} center numeric max={B10_STARTUP_MAX} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#f3e8ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={6}>Total Score (Max 20)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{productScore.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setProducts((p) => [...p, { details: "", role: "", status: "", score: "" }])} onDel={() => setProducts((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={products.length > 1} />
                    </div>

                    {/* B8. Conference / FDP / Industry Training - Attended */}
                    <div style={{ marginBottom: 16, order: 8 }}>
                      <SubsectionTitle icon="workshop">B8. Conference / FDP / Industry Training - Attended - Max 20 marks</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Programme / Event</th>
                            <th style={TH}>From</th>
                            <th style={TH}>To</th>
                            <th style={TH}>Organised By</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fdps.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.program} onChange={(v) => setFdp(i, "program", v)} placeholder="Programme / Event" /></td>
                              <td style={TD}><TI val={r.fromDate} onChange={(v) => setFdp(i, "fromDate", maskDateDDMMYYYY(v))} placeholder="DD/MM/YYYY" /></td>
                              <td style={TD}><TI val={r.toDate} onChange={(v) => setFdp(i, "toDate", maskDateDDMMYYYY(v))} placeholder="DD/MM/YYYY" /></td>
                              <td style={TD}><TI val={r.org} onChange={(v) => setFdp(i, "org", v)} placeholder="Organised By" /></td>
                              <td style={TD}><DocCell id={`fdp-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`fdp-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setFdp(i, "score", v)} center numeric max={SCORE_LIMITS.fdpRow} /></td>
                            </tr>
                          ))}
                          <tr style={{ background: "#f3e8ff" }}>
                            <td style={{ ...TDC, fontWeight: "bold" }} colSpan={7}>Total B8 Score (Max 20)</td>
                            <td style={{ ...TDS, fontWeight: "bold" }}>{b8Score.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setFdps((p) => [...p, { program: "", fromDate: "", toDate: "", org: "", score: "" }])} onDel={() => setFdps((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={fdps.length > 1} />
                    </div>

                    {/* Legacy B8(b) Industrial Training section retained hidden for backwards compatibility */}
                    <div style={{ display: "none" }}>
                      <SubsectionTitle icon="industrialTraining">B8(b). Industrial Training</SubsectionTitle>
                      <table style={T}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 30 }}>SN</th>
                            <th style={TH}>Company</th>
                            <th style={TH}>Duration</th>
                            <th style={TH}>Nature</th>
                            <th style={TH}>Attachment</th>
                            <th style={TH}>View Docs</th>
                            <th style={TH}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {training.map((r, i) => (
                            <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                              <td style={TDC}>{i + 1}</td>
                              <td style={TD}><TI val={r.company} onChange={(v) => setTrain(i, "company", v)} placeholder="Company / industry name" /></td>
                              <td style={TD}><TI val={r.duration} onChange={(v) => setTrain(i, "duration", v)} placeholder="Duration" /></td>
                              <td style={TD}><TI val={r.nature} onChange={(v) => setTrain(i, "nature", v)} placeholder="Nature of training" /></td>
                              <td style={TD}><DocCell id={`train-${i}`} docs={docs} setDocs={setDocs} /></td>
                              <td style={TD}><ViewCell id={`train-${i}`} docs={docs} /></td>
                              <td style={TDS}><TI val={r.score} onChange={(v) => setTrain(i, "score", v)} center numeric max={SCORE_LIMITS.fdpRow} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <RowBtns onAdd={() => setTraining((p) => [...p, { company: "", duration: "", nature: "", score: "" }])} onDel={() => setTraining((p) => p.length > 1 ? p.slice(0, -1) : p)} canDel={training.length > 1} />
                    </div>
                  </SC>
                )}

                {["partA", "partB", "partC", "partD", "partE"].includes(hodAppraisalTab) && !formLocked && !(partDLocked && hodAppraisalTab === "partD") && (
                  <SectionSaveFooter
                    label={{ partA: "Part A", partB: "Part B", partC: "Part C", partD: "Part D", partE: "Part E" }[hodAppraisalTab]}
                    saved={Boolean(sectionSaveStatus[hodAppraisalTab])}
                    saving={savingSection === hodAppraisalTab}
                    locked={formLocked}
                    onSaveDraft={() => handleSaveCurrentSection(hodAppraisalTab, false)}
                    onSaveNext={() => handleSaveCurrentSection(hodAppraisalTab, true)}
                  />
                )}

                {/* Summary Tab */}
                {!isLegacyTwoPartYear && hodAppraisalTab === "summary" && (
                  <SC title="Appraisal Summary & Submission" accent="#10b981">
                    <AppraisalSummaryTable rows={[
                      { label: "Part A - Teaching & Learning", score: partATotal, max: effectivePartAMax, color: "#4f46e5", tone: "#eef2ff", iconTone: "#eef2ff", icon: "book" },
                      { label: "Part B - Research & Innovation", score: partBTotal, max: effectivePartBMax, color: "#7c3aed", tone: "#f3e8ff", iconTone: "#f5f3ff", icon: "flask" },
                      { label: "Part C - Administrative Contribution", score: partCTotal, max: PART_C_MAX, color: "#0f766e", tone: "#ccfbf1", iconTone: "#ccfbf1", icon: "building" },
                      { label: "Part D - Leave & Attendance Management", score: partDTotal, max: PART_D_MAX, color: "#0891b2", tone: "#cffafe", iconTone: "#cffafe", icon: "calendar" },
                      { label: "Grand Total", score: grandTotal, max: effectiveGrandMax, color: g.color, tone: "#ffe4e6", iconTone: "#f1f5f9", icon: "sigma" },
                    ]} />

                    <SummaryOtherInfoField
                      value={summaryOtherInfo}
                      onChange={setSummaryOtherInfo}
                      readOnly={formLocked}
                      rows={5}
                    />

                    <label className={declarationConfirmed ? "appraisal-declaration-card appraisal-confirmation-card is-checked" : "appraisal-declaration-card appraisal-confirmation-card"} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 18px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, marginBottom: 0, color: "#334155", fontSize: 13, lineHeight: 1.5, cursor: formLocked ? "not-allowed" : "pointer", transition: "background 180ms ease, border-color 180ms ease, box-shadow 180ms ease" }}>
                      <input
                        type="checkbox"
                        checked={declarationConfirmed}
                        onChange={(e) => setDeclarationConfirmed(e.target.checked)}
                        disabled={submitting || formLocked}
                        style={{ marginTop: 2, width: 18, height: 18, accentColor: "#2563eb", flexShrink: 0 }}
                      />
                      <span><strong className="declaration-heading">Declaration of accuracy</strong>{SUMMARY_DECLARATION_TEXT}</span>
                    </label>

                    <label className={attachmentsConfirmed ? "appraisal-declaration-card is-checked" : "appraisal-declaration-card"} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 18px", background: attachmentsConfirmed ? "#dcfce7" : "#ecfdf5", border: `1px solid ${attachmentsConfirmed ? "#86efac" : "#bbf7d0"}`, borderRadius: 12, marginBottom: 0, color: "#334155", fontSize: 13, lineHeight: 1.5, cursor: formLocked ? "not-allowed" : "pointer", transition: "background 180ms ease, border-color 180ms ease, box-shadow 180ms ease", boxShadow: attachmentsConfirmed ? "0 10px 24px rgba(16,185,129,0.10)" : "none" }}>
                      <input
                        type="checkbox"
                        checked={attachmentsConfirmed}
                        onChange={(e) => setAttachmentsConfirmed(e.target.checked)}
                        disabled={submitting || formLocked}
                        style={{ marginTop: 2, width: 18, height: 18, accentColor: "#10b981", flexShrink: 0 }}
                      />
                      <span><strong className="declaration-heading">Supporting documents</strong>{SUMMARY_ATTACHMENTS_DECLARATION}</span>
                    </label>

                    <div className="appraisal-summary-actions" style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
                      <AppraisalSummaryActionButton onClick={generateReport}>
                        Generate Report
                      </AppraisalSummaryActionButton>
                      <AppraisalSummaryActionButton
                        variant="submit"
                        onClick={handleSubmitAppraisal}
                        disabled={submitting || formLocked || !declarationConfirmed || !attachmentsConfirmed}
                        locked={formLocked}
                        loading={submitting}
                      >
                        {formLocked ? "Submitted & Locked" : submitting ? "Submitting..." : "Submit Appraisal"}
                      </AppraisalSummaryActionButton>
                    </div>
                  </SC>
                )}
              </fieldset>
            </div>
            )}
          </div>
    </div>
  );
}
import { UserRound, CalendarDays, Info, LockKeyhole } from "lucide-react";
import { currentAppraisalReportStyles } from "./currentAppraisalReportStyles";
import "./appraisalHeaderDetails.css";
