import ReviewerReportHeader from "../../../../components/dashboard/ReviewerReportHeader";
import { confirmedDraftSave, draftSaveErrorMessage } from "../../../../utils/confirmedDraftSave";
/* @refresh skip */
/* eslint-disable no-unused-vars, react-refresh/only-export-components */
import { useReviewFeedback } from "../../../../components/reviewFeedbackContext";
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, LogoutConfirmModal, ScoreBar, ScoreCard, StatusBadge } from "../../../../components/dashboard/dashboardPrimitives";
import { getSchoolByValue, getSchoolKey, UNIVERSITY_SCHOOLS } from "../../../../constants/universityHierarchy";
import { api } from "../../../../services/api";
import {
  ACR_DETAIL_POINTS,
  APP_INFO,
  createAcrRows,
  CREATIVE_FORM_VARIANTS,
  FORM_TYPES,
  creativeFormVariantForSchool,
  isCreativeAppraisalSchool,
  normalizeCreativeVariant,
  fetchSavedAppraisal,
  loadAppraisalDocuments,
  loadSavedAppraisal,
  mergeFacultyInfo,
  saveAppraisalDraftSection,
  submitAppraisal,
  fetchReviewQueueForRole,
  loadReviewerDraft,
  saveReviewerDraft,
  submitWorkflowReview,
  buildReviewRemarks,
  openFullFormReport,
  generateMediaCommReport,
  renderCombinedPartsSummary,
  INNOVATIVE_METHODS,
  SCORE_LIMITS,
  COURSE_FILE_DETAIL_OPTIONS,
  averageSectionScore,
  clampScore,
  consultancyGuidelineScore,
  courseFileRowScore,
  effectiveMaxScore,
  externalProjectGuidelineScore,
  feedbackAverage,
  feedbackGuidelineScore,
  feedbackSectionScore,
  innovativeSelectionsFromDetails,
  innovativeTeachingScore,
  isValidDDMMYYYY,
  lectureGuidelineScore,
  maskDateDDMMYYYY,
  normalizeCourseFileDetails,
  normalizeAutoScores,
  projectGuidanceRowMax,
  researchGuidanceRowMax,
  clampReviewScore,
  reviewRowMaxForSection,
  reviewSectionScore,
  rowHasAnyValue,
  rowHasReviewableData,
  scoreSectionRows,
  selfEffectivePartAMax,
  societyRowLocked,
  societyRowScore,
  sumSectionScore,
  toggleInnovativeMethod,
  validateCompleteRows,
  AppraisalHeaderImage,
  SummaryOtherInfoField,
  summaryOtherInfoValueFrom,
  RejectionNotice,
  DocCell,
  ViewCell,
  ViewDocsCell,
  SectionSaveFooter,
  RowButtons as RowBtns,
  SectionCard as SC,
  SUMMARY_DECLARATION_TEXT,
} from "../../index";
import { canReviewerRejectProfile, getDeanTrack, getReviewChain, pendingStatusFor, profileFromsessionStorage, reviewedStatusFor, roleLabel, visiblePreviousReviewRoles, workflowValidationError, isAppraisalFinalisedByVc, isRejectedStatus, isPendingReviewStatusFor, hasActiveRejection, reviewListFrom } from "../../../../utils/hierarchy";
import { n, pct, RO, TI } from "../../shared";
import SectionShell from "./common/SectionShell";
import { tableStyle, thStyle, tdStyle, tdCenter } from "./common/TableStyles";
import FacultyInfoSection from "../../../../components/appraisal/common/FacultyInfoSection";
import { ALL_ARRAY_KEYS } from "./arrayKeys";
import { FacultyRecordHeader, ScoreTable, VCFinalRemarks, FinalSubmitButton, FACULTY_RECORD_THEME } from "../../../../components/dashboard/FacultyAppraisalRecord";

export const ACCENT = "#4f46e5";
export const ACCENT2 = "#4338ca";
const VERIFY_TEXT = SUMMARY_DECLARATION_TEXT;
const smallButton = (background) => ({ padding: "8px 14px", background, color: "#fff", border: "none", borderRadius: 7, cursor: background === "#94a3b8" ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 12, fontFamily: "inherit" });
const clampDirectorReviewScore = (sectionKey, row, value, maxScore) => {
  if (String(value ?? "").trim() === "") return "";
  const strictValue = clampReviewScore(sectionKey, row, value, maxScore);
  return strictValue === "" ? String(clampScore(value, maxScore)) : strictValue;
};
export const PART_A_MAX = 150;
export const PART_B_MAX = 350;
export const PART_C_MAX = 150;
export const PART_D_MAX = 25;
export const PART_E_MAX = 50;
export const GRAND_MAX = 725;
export const PART_D_RATING_OPTIONS = [
  { value: "Outstanding", label: "Outstanding (Above 20)", score: 25 },
  { value: "Above Average", label: "Above Average (16-20)", score: 20 },
  { value: "Average", label: "Average (11-15)", score: 15 },
  { value: "Below Average", label: "Below Average (6-10)", score: 10 },
  { value: "Unacceptable", label: "Unacceptable (0-5)", score: 5 },
];
export const partDRatingScore = (rating) => PART_D_RATING_OPTIONS.find((option) => option.value === rating)?.score ?? "";
export const blankLeaveManagementRow = () => ({
  clTaken: "", mlTaken: "", odTaken: "", coffTaken: "",
  clOutOf: "", mlOutOf: "", odOutOf: "", coffOutOf: "",
  lateRemarks: "", workingDays: "", managementRating: "", score: "",
});
const CREATIVE_INNOVATIVE_ROW_MAX = 4;
const CREATIVE_INNOVATIVE_SECTION_MAX = 20;

export const titleCase = (value) => String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);

export const creativeSchoolName = (...sources) => {
  const candidates = sources.flatMap((source) => {
    if (!source) return [];
    if (typeof source === "string") return [source];
    if (typeof source !== "object") return [];

    return [
      source.school,
      source.school_name,
      source.schoolName,
      source.info?.school,
      source.profile?.school,
    ];
  });

  for (const candidate of candidates) {
    const schoolObj = getSchoolByValue(candidate);
    if (schoolObj) return schoolObj.name;
  }

  return "School of Design & Creative Arts";
};

export const designArtsSchoolName = creativeSchoolName;

const defaultCreativeSchoolLabel = (variant) => {
  const normalizedVariant = normalizeCreativeVariant(variant);
  const matchedByVariant = UNIVERSITY_SCHOOLS.find((school) =>
    school.defaultForm === "creative" && normalizeCreativeVariant(school.formVariant) === normalizedVariant
  );
  if (matchedByVariant?.label) return matchedByVariant.label;
  return UNIVERSITY_SCHOOLS.find((school) => school.defaultForm === "creative")?.label || "Creative School";
};

const schoolValueFromSource = (source) => {
  if (!source) return "";
  if (typeof source === "string") return source;
  if (typeof source !== "object") return "";
  return source.school || source.schoolName || source.school_name || source.info?.school || source.profile?.school || source.schoolCode || "";
};

const creativeVariantFromSource = (source) => {
  if (!source) return "";
  const explicitVariant = typeof source === "object"
    ? source.formVariant || source.form_variant || source.creativeFormVariant || source.creative_form_variant
    : "";
  return normalizeCreativeVariant(explicitVariant) || creativeFormVariantForSchool(schoolValueFromSource(source));
};

export const isMediaCommSchool = (...sources) => {
  for (const source of sources) {
    if (!source) continue;
    if (creativeVariantFromSource(source) === CREATIVE_FORM_VARIANTS.MEDIA_COMMUNICATION) return true;
  }
  return false;
};

export const isDesignArtsSchool = (...sources) => {
  for (const source of sources) {
    if (!source) continue;
    if (creativeVariantFromSource(source) === CREATIVE_FORM_VARIANTS.DESIGN_ARTS) return true;
  }
  return false;
};

export const isCreativeSchool = (...sources) => {
  for (const source of sources) {
    if (!source) continue;
    if (isMediaCommSchool(source) || isDesignArtsSchool(source)) return true;
    const str = schoolValueFromSource(source);
    const formType = typeof source === "object" ? (source.formType || source.form_type || "") : "";
    if (formType === FORM_TYPES.MEDIA_COMM || formType === FORM_TYPES.DESIGN_ARTS) return true;
    if (isCreativeAppraisalSchool(str)) return true;
  }
  return false;
};

export const getPartBSectionsForSchool = (...sources) => {
  const isMedia = isMediaCommSchool(...sources);
  const isDesign = isDesignArtsSchool(...sources);

  return PART_B_SECTIONS.filter((section) => {
    if (section.key === "popularWritings" && isDesign && !isMedia) return false;
    if (section.key === "ipr" && isMedia && !isDesign) return false;
    return true;
  }).map((section) => {
    if (section.key === "popularWritings" && isMedia) {
      return { ...section, title: "B3. Popular Writing — Newspaper & Magazine Articles, Columns & Reviews" };
    }
    if (section.key === "ipr" && isDesign) {
      return { ...section, title: "B3. Patents, Copyrights, IP & Creative Product Development" };
    }
    return section;
  });
};

const withCreativeInnovativeLimits = (row = {}) => ({
  ...row,
  max: row.max || CREATIVE_INNOVATIVE_ROW_MAX,
  sectionMax: row.sectionMax || row.section_max || CREATIVE_INNOVATIVE_SECTION_MAX,
});

export const isReviewerReviewComplete = (item = {}, reviewerRole = "") => {
  const status = String(item?.status || item?.workflowStatus || item?.workflow_status || "");
  if (isPendingReviewStatusFor([item?.status, item?.workflowStatus, item?.workflow_status], reviewerRole)) return false;
  const reviewerLabel = roleLabel(reviewerRole);
  return (
    n(item?.[`${reviewerRole}Total`]) > 0 ||
    String(item?.[`${reviewerRole}Remarks`] ?? "").trim() !== "" ||
    status === reviewedStatusFor(reviewerRole) ||
    new RegExp(`${reviewerLabel}\\s*(Reviewed|Approved|Rejected)`, "i").test(status)
  );
};

export const userInitials = (name) =>
  String(name || "User")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const defaultObeRows = () => [
  { component: "1. CO-PO mapping sheet (5 Marks)", evidence: "", score: "", max: 5 },
  { component: "2. Attainment calculation (10 Marks)", evidence: "", score: "", max: 10 },
  { component: "3. Corrective action plan (5 Marks)", evidence: "", score: "", max: 5 },
];

export const defaultMentoringRows = () => [
  { activity: "1. Mentoring meetings conducted (min. 2/semester)", evidence: "", score: "", max: 4 },
  { activity: "2. Mentoring register maintained", evidence: "", score: "", max: 3 },
  { activity: "3. Documented academic/career counselling outcomes", evidence: "", score: "", max: 3 },
];

export const emptyCreativeSchoolForm = (defaultSchool = defaultCreativeSchoolLabel()) => ({
  info: {
    name: sessionStorage.getItem("name") || "",
    qual: sessionStorage.getItem("qualification") || "",
    desig: sessionStorage.getItem("designation") || "",
    experience: sessionStorage.getItem("experience") || "",
    ay: sessionStorage.getItem("academicYear") || APP_INFO.DEFAULT_AY,
    school: sessionStorage.getItem("school") || defaultSchool,
  },
  lectures: [{ sem: "", code: "", planned: "", conducted: "", score: "" }],
  courseFile: [{ course: "", title: "", details: "", score: "" }],
  innovDetails: "",
  innovScore: "",
  innovRows: [{ method: "", details: "", methodOther: "", score: "", max: CREATIVE_INNOVATIVE_ROW_MAX, sectionMax: CREATIVE_INNOVATIVE_SECTION_MAX }],
  obeRows: defaultObeRows(),
  mentoringRows: defaultMentoringRows(),
  projects: [{ label: "", score: "" }],
  quals: [{ title: "", body: "", date: "", score: "" }],
  feedback: [{ code: "", fb1: "", fb2: "", score: "" }],
  uniActs: [{ activity: "", durationCat: "", period: "", score: "" }],
  deptActs: [{ activity: "", durationCat: "", period: "", score: "" }],
  events: [{ event: "", role: "", fromDate: "", toDate: "", level: "", score: "" }],
  society: [{ activity: "", details: "", date: "", score: "", max: 10 }],
  industry: [{ activity: "", partner: "", date: "", score: "" }],
  alumni: [{ activity: "", details: "", date: "", score: "" }],
  placements: [{ type: "", name: "", date: "", score: "" }],
  acr: createAcrRows(),
  leaveManagement: [blankLeaveManagementRow()],
  journals: [{ title: "", journal: "", doi: "", index: "", impact: "", coAuthors: "", firstAuthor: "", score: "" }],
  popularWritings: [{ title: "", pubName: "", type: "", circulation: "", media: "", film: "", score: "" }],
  books: [{ title: "", book: "", isbn: "", publisher: "", coAuthors: "", first: "", score: "" }],
  ipr: [{ title: "", scope: "", status: "", fileNo: "", score: "" }],
  externalProjects: [{ title: "", agency: "", date: "", amount: "", role: "", status: "", score: "", max: 20 }],
  research: [{ degree: "", name: "", thesis: "", score: "" }],
  consultancy: [{ title: "", agency: "", date: "", amount: "", role: "", status: "", score: "" }],
  confs: [{ title: "", type: "", org: "", level: "", score: "" }],
  fdps: [{ program: "", fromDate: "", toDate: "", org: "", score: "" }],
  awards: [{ title: "", date: "", agency: "", level: "", score: "" }],
  innovation: [{ title: "", details: "", impact: "", score: "" }],
  products: [{ title: "", details: "", used: "", status: "", score: "" }],
  ict: [{ title: "", desc: "", type: "", quad: "", score: "" }],
  exhibitions: [{ title: "", type: "", venueLevel: "", date: "", score: "" }],
  training: [{ company: "", duration: "", nature: "", score: "" }],
  summaryOtherInfo: "",
});

export const emptyDesignArtsForm = () => emptyCreativeSchoolForm(defaultCreativeSchoolLabel(CREATIVE_FORM_VARIANTS.DESIGN_ARTS));
export const emptyMediaForm = (defaultSchool) => {
  const schoolVal = defaultSchool || (typeof sessionStorage !== "undefined" ? (sessionStorage.getItem("school") || sessionStorage.getItem("schoolName")) : null) || defaultCreativeSchoolLabel(CREATIVE_FORM_VARIANTS.MEDIA_COMMUNICATION);
  const schoolObj = getSchoolByValue(schoolVal);
  return emptyCreativeSchoolForm(schoolObj?.label || schoolVal || defaultCreativeSchoolLabel(CREATIVE_FORM_VARIANTS.MEDIA_COMMUNICATION));
};

export const SECTION_OPTIONS = [
  { value: "partA", label: "Part A — Teaching & Learning (Max: 150)" },
  { value: "partB", label: "Part B — Research & Creative Output (Max: 350)" },
  { value: "partC", label: "Part C — Administrative Role & Contribution (Max: 150)" },
  { value: "partD", label: "Part D — Leave & Attendance Management (Max: 25)" },
  { value: "partE", label: "Part E — Annual Confidential Report (Max: 50)" },
  { value: "summary", label: "Summary & Verification (Grand Total: 725)" },
];

export const PART_A_SECTIONS = [
  { key: "lectures", title: "A1. Course Delivery & Classroom Engagement", max: 40, rowMax: 10, doc: "lec", fields: [["sem", "Semester"], ["code", "Course Code / Name"], ["planned", "Classes (as per course structure)"], ["conducted", "Classes Actually Conducted"], ["pctConducted", "% Conducted"]] },
  { key: "courseFile", title: "A2. Course File & Curriculum Documentation", max: 20, doc: "cf", rowMax: SCORE_LIMITS.courseFileRow, fields: [["course", "Course / Paper"], ["title", "Program & Semester"], ["details", "IQAC Index Compliance (Yes/No, with proof)"]] },
  { key: "feedback", title: "A4. Student Feedback Score", max: 10, doc: "fb", fields: [["code", "Course Code / Name"], ["fb1", "First Student Feedback As per Juno"], ["fb2", "Second Student Feedback As Per Juno"]] },
  { key: "projects", title: "A6. Student Project Guidance", max: 20, doc: "proj", rowMax: projectGuidanceRowMax, fields: [["label", "Project Category"]] },
  { key: "quals", title: "A8. Qualification Enhancement", max: 10, doc: "qual", rowMax: SCORE_LIMITS.qualificationRow, fields: [["title", "Qualification / Certification Title"], ["body", "Awarding Body"], ["date", "Date"]] },
];

export const PART_B_SECTIONS = [
  { key: "journals", title: "B1. Journal Publications / Academic Research Papers", max: 60, doc: "jour", fields: [["title", "Title (with page nos.)"], ["journal", "Journal Details"], ["doi", "DOI No."], ["index", "Indexing (Q1/Q2/Q3/Q4)"], ["impact", "Impact Factor"], ["coAuthors", "Co-authors"], ["firstAuthor", "First Author?"]] },
  { key: "books", title: "B2. Books, Book Chapters & Edited Volumes", max: 30, doc: "book", fields: [["title", "Title"], ["publisher", "Publisher & ISBN"], ["type", "Type"], ["level", "Level"], ["coAuthors", "Co-authors from DYPIU"]] },
  { key: "popularWritings", title: "B3 (Part 1). Popular Writing — Newspaper & Magazine Articles, Columns & Reviews", max: 40, doc: "pop", fields: [["title", "Title of Article / Column"], ["pubName", "Publication Name & Date"], ["type", "Type (Article/Column/Review/Op-ed)"], ["circulation", "Circulation (Local/Regional/National/Intl.)"]] },
  { key: "ipr", title: "B3 (Part 2). Patents, Copyrights, IP & Creative Product Development", max: 40, doc: "ipr", fields: [["title", "Title"], ["scope", "National / International"], ["status", "Status (Published/Granted)"], ["fileNo", "Filing / Grant No. & Date"]] },
  { key: "externalProjects", title: "B4. Funded Research / Creative Projects & Grants", max: 20, doc: "ext", fields: [["title", "Title of Project / Grant"], ["agency", "Funding Agency"], ["date", "Sanction Date"], ["amount", "Amount (₹)"], ["role", "PI / Co-PI"], ["status", "Status"]] },
  { key: "research", title: "B5. Research / Creative Guidance", max: 20, doc: "res", rowMax: researchGuidanceRowMax, fields: [["degree", "Degree"], ["name", "Name of Student / Scholar"], ["status", "Status (Ongoing/Awarded)"], ["date", "Date"]] },
  { key: "consultancy", title: "B6. Consultancy, Training & Creative Commissions", max: 30, doc: "con", fields: [["client", "Client / Organisation"], ["nature", "Nature of Engagement"], ["amount", "Revenue Generated (₹)"]] },
  { key: "confs", title: "B7. Conference / FDP / Training / Workshop Contributions as Resource Person", max: 20, doc: "conf", fields: [["title", "Event / Session Title"], ["role", "Role"], ["date", "Date"], ["level", "Level (Intl./National)"]] },
  { key: "fdps", title: "B8. Conference / FDP / Industry-Studio Training Attended", max: 20, doc: "fdp", fields: [["program", "Programme / Event"], ["fromDate", "From"], ["toDate", "To"], ["org", "Organised By"]] },
  { key: "awards", title: "B9. Research Awards, Fellowships, Reviewer & Citations", max: 20, doc: "awd", fields: [["title", "Title of Award / Fellowship / Metric"], ["agency", "Awarding Agency"], ["level", "Level"], ["date", "Date"]] },
  { key: "innovation", title: "B10. Innovation, Start-ups & Technology Transfer", max: 20, doc: "inn", fields: [["title", "Title / Start-up / Product"], ["role", "Role"], ["status", "Status"]] },
  { key: "ict", title: "B11. ICT Content, MOOCs & E-Learning", max: 40, doc: "ict", fields: [["title", "Title"], ["platform", "Platform / Type"], ["reach", "Reach / Views (if available)"]] },
  { key: "exhibitions", title: "B12. Exhibitions — Photography, Design & Applied Arts, Documentaries, Films & Audio-Visual Productions", max: 30, doc: "exh", fields: [["title", "Title of Work / Exhibition"], ["type", "Type (Solo/Group/Curated)"], ["venueLevel", "Venue & Level (Institutional/National/Intl.)"], ["date", "Date"]] },
];

export const PART_C_SECTIONS = [
  { key: "uniActs", title: "C1. Administration at University Level", max: 50, doc: "uni", fields: [["activity", "Activity / Responsibility"], ["durationCat", "Duration Category"], ["period", "Period"]] },
  { key: "deptActs", title: "C2. Administration at School Level", max: 30, doc: "dept", fields: [["activity", "Activity / Responsibility"], ["durationCat", "Duration Category"], ["period", "Period"]] },
  { key: "events", title: "C3. Event Organisation & Institutional Visibility", max: 20, doc: "evt", fields: [["event", "Event / Contribution"], ["role", "Role"], ["fromDate", "From"], ["toDate", "To"], ["level", "Level"]] },
  { key: "society", title: "C4. Mentoring Student Clubs, Outreach, Extension & Social Responsibility", max: 10, doc: "soc", fields: [["activity", "Activity"], ["details", "Details"], ["date", "Date"]] },
  { key: "industry", title: "C5. Industry Interaction & Linkages", max: 10, doc: "ind", fields: [["activity", "Activity (MOU / CoE / Drive / Programme)"], ["partner", "Industry Partner"], ["date", "Date"]] },
  { key: "alumni", title: "C6. Alumni Engagement & Networking", max: 10, doc: "alm", fields: [["activity", "Activity"], ["details", "Details"], ["date", "Date"]] },
  { key: "placements", title: "C7. Student Placement Mentoring & Career Development", max: 20, doc: "plc", fields: [["type", "Activity Type"], ["name", "Student / Company Name"], ["date", "Date"]] },
];

export const PART_D_SECTIONS = [
  { key: "leaveManagement", title: "Part D — Leave & Attendance Management - Max 25 marks", max: 25, fields: [["clTaken", "CL Taken"], ["mlTaken", "ML Taken"], ["odTaken", "OD Taken"], ["coffTaken", "C/Off Taken"], ["lateRemarks", "Late Remarks"], ["workingDays", "Working Days"], ["managementRating", "Management of Leaves"]] },
];

export const PART_E_SECTIONS = [
  { key: "acr", title: "Part E — Annual Confidential Report (ACR) - Max 50 marks", max: 50, doc: "acr", rowMax: SCORE_LIMITS.acrRow, fields: [["label", "Attribute", true]], selfReadOnlyScore: true },
];

const SECTION_MAX_BY_KEY = Object.fromEntries([...PART_A_SECTIONS, ...PART_B_SECTIONS, ...PART_C_SECTIONS, ...PART_D_SECTIONS, ...PART_E_SECTIONS, { key: "obeRows", max: 20 }, { key: "mentoringRows", max: 10 }].map((section) => [section.key, section.max]));
const REVIEW_SCORE_FIELDS = ["hod", "director", "dean", "vc"];

export const preserveSavedReviewScores = (form = {}, source = {}) => {
  const merged = { ...form };
  merged.info = mergeFacultyInfo(form.info, source, form);
  ALL_ARRAY_KEYS.forEach((key) => {
    if (!Array.isArray(form[key])) return;
    const sourceRows = sourceRowsForKey(source, key);
    merged[key] = form[key].map((row, index) => {
      const sourceRow = sourceRows[index] || {};
      const next = { ...row };
      REVIEW_SCORE_FIELDS.forEach((field) => {
        if (String(next[field] ?? "").trim() === "" && String(sourceRow[field] ?? "").trim() !== "") {
          next[field] = sourceRow[field];
        }
      });
      return next;
    });
  });
  ["innovHod", "innovDirector", "innovDean", "innovVc"].forEach((field) => {
    if (String(merged[field] ?? "").trim() === "" && String(source[field] ?? "").trim() !== "") {
      merged[field] = source[field];
    }
  });
  if (Array.isArray(form.innovRows)) {
    const sourceRows = Array.isArray(source.innovRows) ? source.innovRows : [];
    merged.innovRows = form.innovRows.map((row, index) => {
      const sourceRow = sourceRows[index] || {};
      const next = { ...row };
      REVIEW_SCORE_FIELDS.forEach((field) => {
        if (String(next[field] ?? "").trim() === "" && String(sourceRow[field] ?? "").trim() !== "") {
          next[field] = sourceRow[field];
        }
      });
      return next;
    });
  }
  return merged;
};

const scoreKeyForInnov = (role) => ({
  hod: "innovHod",
  director: "innovDirector",
  dean: "innovDean",
  vc: "innovVc",
}[role] || "innovScore");

export const calculateCreativeSchoolTotals = (form, scoreKey = "score") => {
  const maxScores = getCreativeSchoolEffectiveMaxScores(form, { self: scoreKey === "score" });
  const rowSum = (key, max) => scoreSectionRows(key, form[key] || [], max, scoreKey, key === "research" ? { autoFillResearchScore: false } : undefined);
  const lecturesScore = scoreSectionRows("lectures", form.lectures || [], 40, scoreKey);
  const courseFileScore = scoreSectionRows("courseFile", form.courseFile || [], 20, scoreKey);
  const innovativeScore = scoreKey === "score" && Array.isArray(form.innovRows)
    ? clampScore(form.innovRows.reduce((total, row) => total + clampScore(row.score, row.max || CREATIVE_INNOVATIVE_ROW_MAX), 0), CREATIVE_INNOVATIVE_SECTION_MAX)
    : scoreKey === "score" ? innovativeTeachingScore(form.innovDetails, form.innovScore, CREATIVE_INNOVATIVE_SECTION_MAX) : clampScore(form[scoreKeyForInnov(scoreKey)], CREATIVE_INNOVATIVE_SECTION_MAX);
  const obeScore = scoreSectionRows("obeRows", form.obeRows || [], 20, scoreKey);
  const mentoringScore = scoreSectionRows("mentoringRows", form.mentoringRows || [], 10, scoreKey);

  const partA = clampScore(
    lecturesScore + courseFileScore + innovativeScore + obeScore + mentoringScore +
    rowSum("projects", 20) + rowSum("quals", 10) +
    (scoreKey === "score" ? feedbackSectionScore(form.feedback, 10) : reviewSectionScore("feedback", form.feedback || [], 10, scoreKey)),
    maxScores.partA,
  );

  const partB = clampScore(
    PART_B_SECTIONS
      .reduce((total, section) => total + rowSum(section.key, section.max), 0),
    maxScores.partB,
  );

  const partC = clampScore(
    rowSum("uniActs", 50) + rowSum("deptActs", 30) + rowSum("events", 20) +
    rowSum("society", 10) + rowSum("industry", 10) + rowSum("alumni", 10) + rowSum("placements", 20),
    maxScores.partC,
  );

  // partD is now the new faculty-filled Leave & Attendance section (25 marks, faculty-scored).
  // partE is the section that used to be called Part D (the ACR, 50 marks) - reviewer-only, faculty always 0.
  const partD = clampScore(rowSum("leaveManagement", 25), maxScores.partD);
  const partE = scoreKey === "score" ? 0 : clampScore(rowSum("acr", 50), maxScores.partE);
  const total = clampScore(partA + partB + partC + partD + partE, maxScores.grand);

  return { partA, partB, partC, partD, partE, total, maxScores };
};

export const calculateDesignArtsTotals = calculateCreativeSchoolTotals;
export const calculateMediaTotals = calculateCreativeSchoolTotals;

export const getCreativeSchoolEffectiveMaxScores = (form = {}, { self = false } = {}) => {
  const getSessionRole = () => {
    if (typeof sessionStorage !== "undefined" && sessionStorage) {
      return sessionStorage.getItem("role");
    }
    return null;
  };
  const isFacultyUser = self || getSessionRole() === "faculty";
  if (isFacultyUser) {
    return { partA: PART_A_MAX, partB: PART_B_MAX, partC: PART_C_MAX, partD: PART_D_MAX, partE: 0, grand: PART_A_MAX + PART_B_MAX + PART_C_MAX + PART_D_MAX };
  }
  return { partA: PART_A_MAX, partB: PART_B_MAX, partC: PART_C_MAX, partD: PART_D_MAX, partE: PART_E_MAX, grand: GRAND_MAX };
};

export const getDesignArtsEffectiveMaxScores = getCreativeSchoolEffectiveMaxScores;
export const getMediaEffectiveMaxScores = getCreativeSchoolEffectiveMaxScores;

export const summaryRow = (applicability = {}, key, row) => [row];
export const b8summaryRow = (applicability = {}, row) => [row];

const uid = () => Date.now() + Math.random();
const ensureIds = (rows) => Array.isArray(rows) ? rows.map((row) => (row._id ? row : { ...row, _id: uid() })) : rows;
const cloneRows = (rows) => (rows || []).map((row) => ({ ...row, _id: row._id || uid() }));

const firstPresent = (row, keys = []) => {
  for (const key of keys) {
    const value = row?.[key];
    if (String(value ?? "").trim() !== "") return value;
  }
  return "";
};

const rowHasSubmittedValue = (row = {}) =>
  Object.entries(row || {}).some(([key, value]) =>
    !["_id", "id", "max", "sectionMax", "section_max"].includes(key) &&
    String(value ?? "").trim() !== ""
  );

const sourceRowsForKey = (source = {}, key) => {
  const aliases = {
    events: ["eventRows"],
    alumni: ["alumniRows"],
    placements: ["placementRows"],
    popularWritings: ["popularWritingRows"],
    ipr: ["patents"],
    externalProjects: ["fundedProjects", "projects2"],
    confs: ["conferenceRows"],
    consultancy: ["consultancyRows", "creativeCommissions", "proposals"],
    innovation: ["products", "startupRows", "innovationRows"],
  }[key] || [];
  for (const sourceKey of [key, ...aliases]) {
    if (Array.isArray(source[sourceKey]) && source[sourceKey].some(rowHasSubmittedValue)) return source[sourceKey];
  }
  return [];
};

const withFallbackValue = (next, source, target, aliases) => {
  if (String(next[target] ?? "").trim() !== "") return next;
  const value = firstPresent(source, aliases);
  return String(value ?? "").trim() !== "" ? { ...next, [target]: value } : next;
};

const DOC_KEY_ALIASES = {
  courseFile: ["courseFile"],
  events: ["event"],
  alumni: ["alumni"],
  placements: ["placement"],
  ipr: ["pat"],
  externalProjects: ["project2", "externalProject"],
  consultancy: ["prop", "con"],
  innovation: ["prod"],
};

const docKeysForSectionRow = (section, index) => {
  if (!section?.doc || section.key === "acr") return [];
  return [
    `${section.doc}-${index}`,
    ...(DOC_KEY_ALIASES[section.key] || []).map((prefix) => `${prefix}-${index}`),
  ];
};

const normalizeCreativeRow = (key, row = {}, index = 0) => {
  let next = { ...row };

  if (key === "innovRows") {
    next = withFallbackValue(next, row, "method", ["method", "methods_used", "methodsUsed", "method_used", "methodUsed", "title"]);
    next = withFallbackValue(next, row, "details", ["details", "description", "proof", "evidence"]);
    return {
      ...next,
      max: next.max || CREATIVE_INNOVATIVE_ROW_MAX,
      sectionMax: next.sectionMax || next.section_max || CREATIVE_INNOVATIVE_SECTION_MAX,
    };
  }

  if (key === "obeRows") {
    const fallback = defaultObeRows()[index] || {};
    next = { ...fallback, ...next };
    next = withFallbackValue(next, row, "component", ["component", "activity", "title", "label", "particular"]);
    next = withFallbackValue(next, row, "evidence", ["evidence", "details", "proof", "attached"]);
    return next;
  }

  if (key === "mentoringRows") {
    const fallback = defaultMentoringRows()[index] || {};
    next = { ...fallback, ...next };
    next = withFallbackValue(next, row, "activity", ["activity", "component", "title", "label", "particular"]);
    next = withFallbackValue(next, row, "evidence", ["evidence", "details", "proof", "attached"]);
    return next;
  }

  const fieldAliases = {
    courseFile: {
      details: ["details", "availability", "iqac_format", "iqacFormat", "availability_iqac", "availabilityIqac"],
    },
    journals: {
      doi: ["doi", "issn", "eissn", "e_issn"],
      impact: ["impact", "impactFactor", "impact_factor"],
      coAuthors: ["coAuthors", "coauthors", "co_authors", "authorPosition", "author_position", "position"],
      firstAuthor: ["firstAuthor", "first_author", "first", "authorPosition", "author_position", "position"],
    },
    books: {
      publisher: ["publisher", "pub", "book", "isbn", "issn"],
      coAuthors: ["coAuthors", "coauthors", "co_authors", "coauth"],
      first: ["first", "firstAuthor", "first_author"],
    },
    quals: {
      title: ["title", "label", "qualification", "qualificationTitle", "certification", "certificationTitle", "name"],
      body: ["body", "details", "awardingBody", "awarding_body", "agency", "institution", "institute", "university"],
      date: ["date", "completionDate", "awardDate"],
    },
    popularWritings: {
      pubName: ["pubName", "publication", "publicationName", "publisher", "journal", "magazine"],
      type: ["type", "category"],
      circulation: ["circulation", "level", "scope"],
    },
    ipr: {
      scope: ["scope", "type", "level"],
      fileNo: ["fileNo", "filingNo", "filing_no", "applicationNo", "grantNo", "patentNo"],
    },
    research: {
      status: ["status", "thesis", "stage"],
      date: ["date", "awardDate", "registrationDate"],
    },
    consultancy: {
      client: ["client", "organisation", "organization", "agency", "company", "title"],
      nature: ["nature", "type", "role", "status", "details"],
    },
    externalProjects: {
      date: ["date", "sanctionDate", "sanction_date", "projectDate", "project_date"],
      amount: ["amount", "grantAmount", "grant_amount", "sanctionedAmount", "sanctioned_amount"],
      role: ["role", "position", "responsibility"],
      status: ["status", "projectStatus", "project_status"],
    },
    confs: {
      role: ["role", "type", "org", "organisedBy"],
      date: ["date", "duration"],
      level: ["level", "scope"],
    },
    events: {
      event: ["event", "activity", "title", "name"],
      role: ["role", "responsibility"],
      date: ["date", "period"],
      level: ["level", "scope"],
    },
    uniActs: {
      durationCat: ["durationCat", "duration_cat", "nature", "duration"],
    },
    deptActs: {
      durationCat: ["durationCat", "duration_cat", "nature", "duration"],
    },
    society: {
      // Persistence normalizes C4 "society" rows with activity -> label (for the legacy standard
      // form). Read it back so the Activity column survives a fetch for higher-authority reviewers.
      activity: ["activity", "label", "society_activity", "societyActivity"],
      details: ["details", "description"],
      date: ["date", "period"],
    },
    alumni: {
      activity: ["activity", "event", "title", "type"],
      details: ["details", "description", "name", "role"],
      date: ["date", "period"],
    },
    placements: {
      type: ["type", "activityType", "activity", "event"],
      name: ["name", "student", "company", "organisation", "organization", "details"],
      date: ["date", "period"],
    },
    ict: {
      platform: ["platform", "type", "desc", "description"],
      reach: ["reach", "quad", "quadrant", "views"],
    },
    innovation: {
      title: ["title", "details", "name"],
      role: ["role", "details", "nature"],
      status: ["status", "impact", "usage", "used"],
    },
  };

  Object.entries(fieldAliases[key] || {}).forEach(([target, aliases]) => {
    next = withFallbackValue(next, row, target, aliases);
  });
  if (key === "courseFile") return { ...next, details: normalizeCourseFileDetails(next.details) };
  if (key === "society") {
    // `activity` is this engine's real field; drop the `label` ghost that persistence backfills
    // so a stale pre-edit value can never resurface on the next round-trip / submit.
    const { label: _societyLabelGhost, ...societyRow } = next;
    return { ...societyRow, max: next.max || 10 };
  }
  if (key === "externalProjects") return { ...next, max: next.max || 20 };
  return next;
};

const normalizeRowsForKey = (key, rows) => {
  const sourceRows = Array.isArray(rows) ? rows : [];
  if (key === "obeRows" || key === "mentoringRows") {
    const defaults = key === "obeRows" ? defaultObeRows() : defaultMentoringRows();
    const fixedRows = defaults.map((defaultRow, index) =>
      normalizeCreativeRow(key, { ...defaultRow, ...(sourceRows[index] || {}) }, index)
    );
    const extraRows = sourceRows.slice(defaults.length).map((row, index) => normalizeCreativeRow(key, row, defaults.length + index));
    return ensureIds([...fixedRows, ...extraRows]);
  }
  return ensureIds(sourceRows.map((row, index) => normalizeCreativeRow(key, row, index)));
};

export const mergeForm = (base, incoming = {}) => {
  const merged = { ...base, ...incoming };
  ALL_ARRAY_KEYS.forEach((key) => {
    const incomingRows = sourceRowsForKey(incoming, key);
    const rows = incomingRows.length
      ? incomingRows
      : (Array.isArray(base[key]) && base[key].length > 0 ? base[key] : [{ _id: uid() }]);
    merged[key] = normalizeRowsForKey(key, rows);
  });
  merged.info = { ...base.info, ...(incoming.info || {}) };
  merged.acr = createAcrRows(incoming.acr || base.acr);
  return merged;
};

export const normalizeSubmittedCreativeFormForReview = (submittedForm = {}, source = {}) => {
  const baseForm = isMediaCommSchool(submittedForm, source)
    ? emptyMediaForm(submittedForm?.info?.school || source?.school || source?.info?.school)
    : emptyDesignArtsForm();
  return preserveSavedReviewScores(mergeForm(baseForm, submittedForm), source);
};

export const normalizeScoresForSubmit = (form) => normalizeAutoScores(form);

export const validateCreativeSchoolBeforeSubmit = (form, docs = {}, sectionView = "all") => {
  const partBSections = getPartBSectionsForSchool(form?.info?.school || form);
  const sectionsToValidate = sectionView === "partA"
    ? PART_A_SECTIONS
    : sectionView === "partB"
    ? partBSections
    : sectionView === "partC"
    ? PART_C_SECTIONS
    : [...PART_A_SECTIONS, ...partBSections, ...PART_C_SECTIONS];
  const rowSections = sectionsToValidate.map((section) => {
    const fields = [
      ...section.fields.filter(([, , readOnly]) => !readOnly).map(([key]) => key),
      ...(section.selfReadOnlyScore || section.autoScore || section.key === "feedback" ? [] : ["score"]),
    ];
    return {
      label: section.title,
      rows: form[section.key] || [],
      fields,
      fieldsForRow: section.key === "research"
        ? (row) => (row?.status === "Ongoing" ? fields.filter((key) => key !== "date") : fields)
        : undefined,
      // Explicit 0 (not undefined) when a section defines no per-row cap, so the shared
      // validator's title-text fallback (e.g. matching "FDP" inside B7's title) never
      // invents a row cap the UI never enforced in the first place.
      rowMax: section.rowMax || 0,
      maxScore: section.key === "feedback" ? undefined : section.max,
      docPrefix: section.key !== "acr" ? section.doc : "",
      docKey: section.key !== "acr" && DOC_KEY_ALIASES[section.key]?.length
        ? (_row, index) => docKeysForSectionRow(section, index)
        : undefined,
      capSectionTotal: true,
    };
  });
  const errors = validateCompleteRows(rowSections, docs);

  if (sectionView !== "partA") ["internalProjects", "externalProjects"].forEach((key) => {
    (form[key] || []).forEach((row, index) => {
      if (row.date && !isValidDDMMYYYY(row.date)) {
        errors.push(`${key === "internalProjects" ? "B4(b)" : "B5"}, row ${index + 1}: date must be DD/MM/YYYY.`);
      }
    });
  });

  if (sectionView !== "partA") (form.fdps || []).forEach((row, index) => {
    if (row.fromDate && !isValidDDMMYYYY(row.fromDate)) {
      errors.push(`B8, row ${index + 1}: From date must be DD/MM/YYYY.`);
    }
    if (row.toDate && !isValidDDMMYYYY(row.toDate)) {
      errors.push(`B8, row ${index + 1}: To date must be DD/MM/YYYY.`);
    }
  });

  if (sectionView !== "partB") {
    const innovRows = Array.isArray(form.innovRows) && form.innovRows.length
      ? form.innovRows
      : [{ method: form.innovDetails, details: form.innovDetails, score: form.innovScore }];
    errors.push(...validateCompleteRows([{
      label: "A3. Innovative Teaching Methods",
      rows: innovRows,
      fields: ["method", "details", "score"],
      fieldsForRow: (row) => row?.method === OTHER_INNOVATIVE_METHOD ? ["method", "methodOther", "details", "score"] : ["method", "details", "score"],
      docPrefix: "innov",
      rowMax: CREATIVE_INNOVATIVE_ROW_MAX,
      maxScore: CREATIVE_INNOVATIVE_SECTION_MAX,
      capSectionTotal: true,
    }], docs));
  }

  return errors;
};

export const validateDesignArtsBeforeSubmit = validateCreativeSchoolBeforeSubmit;
export const validateMediaBeforeSubmit = validateCreativeSchoolBeforeSubmit;

const NUMERIC_KEYS = new Set(["planned", "conducted", "fb1", "fb2", "amount"]);
const DATE_FIELD_KEYS = new Set(["date", "fromDate", "toDate"]);
const TEXT_ONLY_KEYS = new Set(["title", "body", "course", "name", "degree", "thesis", "agency", "role", "status", "type", "level", "activity", "nature", "journal", "book", "publisher", "org", "program", "company", "desc", "coAuthors", "media", "film", "client", "platform"]);

const FIELD_PLACEHOLDERS = {
  sem: "e.g. Sem-II / 2026-27 Sem-I",
  code: "e.g. CS201 - Data Structures",
  planned: "Total classes planned",
  conducted: "Classes conducted",
  course: "e.g. CS201 - Data Structures",
  title: "Enter exact title",
  details: "Enter brief verifiable details",
  fb1: "0-5",
  fb2: "0-5",
  label: "Select or enter category",
  body: "Awarding body / institute",
  date: "DD/MM/YYYY",
  fromDate: "DD/MM/YYYY",
  toDate: "DD/MM/YYYY",
  journal: "Journal name, volume, issue",
  doi: "DOI / URL",
  index: "Q1/Q2/Scopus/WoS",
  impact: "Impact factor",
  coAuthors: "Names of co-authors",
  firstAuthor: "Yes / No",
  publisher: "Publisher and ISBN",
  pubName: "Publication name and date",
  circulation: "Local / National / International",
  scope: "National / International",
  status: "Ongoing / Completed / Published",
  fileNo: "Application / filing no. and date",
  agency: "Funding agency / organisation",
  amount: "Amount in INR",
  role: "PI / Co-PI / Coordinator",
  degree: "PhD",
  name: "Student / scholar / company name",
  client: "Client / organisation",
  nature: "Nature of work / responsibility",
  program: "Programme / event name",
  duration: "Duration category",
  org: "Organised by",
  platform: "Platform / type",
  reach: "Reach / views",
  activity: "Activity / responsibility",
  durationCat: "Full year / semester / event",
  period: "e.g. Jan 2026 - Mar 2026",
  event: "Event / contribution name",
  partner: "Industry / alumni partner",
  type: "Type / category",
  venueLevel: "Venue and level",
};

const placeholderForField = (sectionKey, fieldKey) => {
  if (sectionKey === "feedback" && fieldKey === "code") return "Course code / name";
  if (sectionKey === "events" && fieldKey === "level") return "University / National / International";
  if (sectionKey === "industry" && fieldKey === "activity") return "MOU / CoE / guest lecture";
  if (sectionKey === "placements" && fieldKey === "type") return "Placement / mentoring activity";
  return FIELD_PLACEHOLDERS[fieldKey] || "Enter accurate information";
};

const DROPDOWN_FIELD_OPTIONS = {
  // Part A
  lectures: {
    semester: ["Odd Semester", "Even Semester", "Semester I", "Semester II", "Semester III", "Semester IV", "Semester V", "Semester VI", "Semester VII", "Semester VIII"],
  },
  projects: {
    label: ["B.Tech / UG Major Project", "M.Tech / PG Dissertation", "UG Design / Media Capstone", "PG Thesis Guidance", "Mini Project / Internship"],
  },

  // Part B
  journals: {
    index: ["Q1", "Q2", "Q3", "Q4", "Scopus", "Web of Science", "UGC Care", "Peer Reviewed"],
    firstAuthor: ["Yes", "No"],
  },
  books: {
    type: ["Book", "Chapter", "Editor", "Translation"],
    level: ["International", "National", "Local"],
  },
  popularWritings: {
    type: ["Article", "Column", "Review", "Op-ed"],
    circulation: ["Local", "Regional", "National", "International"],
  },
  ipr: {
    scope: ["National", "International"],
    status: ["Published", "Granted", "Filed"],
  },
  patents: {
    scope: ["National", "International"],
    type: ["National", "International"],
    status: ["Published", "Granted", "Filed"],
  },
  externalProjects: {
    role: ["PI", "Co-PI", "Consultant", "Project Director"],
    status: ["Ongoing", "Completed", "Sanctioned", "Submitted"],
  },
  research: {
    degree: ["PhD"],
    status: ["Ongoing", "Awarded"],
  },
  consultancy: {
    nature: ["Consultancy", "Corporate Training", "Creative Commission", "Technical Advisory", "Testing / Retainership"],
    status: ["Ongoing", "Completed", "Sanctioned"],
  },
  confs: {
    role: ["Convener", "Co-Convener", "Organising Secretary", "Session Chair", "Resource Person", "Member"],
    level: ["International", "National", "State / Regional", "University / Institutional"],
  },
  awards: {
    level: ["International", "National", "State / Regional", "University / Institutional"],
  },
  innovation: {
    role: ["Founder / Co-Founder", "Mentor / Advisor", "Developer", "Innovator"],
    status: ["Incubated", "Registered", "Commercialized", "Transferred", "Prototype"],
  },
  ict: {
    platform: ["SWAYAM / NPTEL", "Coursera / edX", "Institutional LMS", "YouTube / Video Portal", "E-Content / Quadrant", "Open CourseWare"],
    type: ["SWAYAM / NPTEL", "Coursera / edX", "Institutional LMS", "YouTube / Video Portal", "E-Content / Quadrant", "Open CourseWare"],
  },
  exhibitions: {
    type: ["Solo Exhibition", "Group Exhibition", "Curated Show", "Film / Documentary Production", "Audio-Visual Release"],
    venueLevel: ["International", "National", "State / Regional", "Institutional"],
  },
  training: {
    duration: ["1 Week", "2 Weeks", "1 Month", "More than 1 Month"],
    nature: ["Industrial Training", "Studio Immersion", "Faculty Internship", "Field Work"],
  },

  // Part C
  uniActs: {
    durationCat: ["Full Year", "One Semester", "Event / Task Based", "Ongoing"],
  },
  deptActs: {
    durationCat: ["Full Year", "One Semester", "Event / Task Based", "Ongoing"],
  },
  events: {
    role: ["Convener", "Co-Convener", "Organising Team Lead", "Member", "Coordinator"],
    level: ["University", "National", "International"],
  },
  industry: {
    activity: ["MOU Signed", "Center of Excellence (CoE)", "Placement Drive", "Guest Lecture / Workshop", "Faculty Industry Attachment", "Joint Research Project"],
  },
  alumni: {
    activity: ["Alumni Talk / Guest Interaction", "Mentoring Session", "Alumni Meet Organisation", "Placement / Internship Support", "Curriculum Feedback Session"],
  },
  placements: {
    type: ["Campus Placement Support", "Industry Mock Interviews", "CV / Portfolio Review", "Higher Education Counselling", "Entrepreneurship Guidance"],
  },
};

function SectionTable({ section, form, setForm, docs, setDocs, mode, locked, reviewerRole, reviewData, setReviewData, previousRoles }) {
  const rows = form[section.key] || [];
  const reviewRows = reviewData?.[section.key] || [];
  const editableSelf = mode === "self" && !locked;
  const reviewLocked = mode === "review" && locked;
  const currentRole = reviewerRole;
  const showingReviewColumns = mode === "review" && currentRole;
  const reviewColumnCount = showingReviewColumns ? previousRoles.length + 1 : 0;
  const selfLocked = mode === "self" && section.key === "acr";
  const earned = scoreSectionRows(section.key, rows, section.max, "score", section.key === "research" ? { autoFillResearchScore: false } : undefined);
  const docPrefix = section.doc || section.key;
  const docKeysForRow = (index) => docKeysForSectionRow({ ...section, doc: docPrefix }, index);
  const totalLabel = section.key === "feedback"
    ? `Faculty Score (Max ${section.max})`
    : `Total Score (Max ${section.max})`;
  const totalLabelColSpan = 1 + section.fields.length + (section.key === "feedback" ? 1 : 0) + 2;
  const sectionTotalScore = (sourceRows = rows, scoreKey = "score") => {
    if (scoreKey !== "score") return reviewSectionScore(section.key, sourceRows, section.max, scoreKey);
    return scoreSectionRows(section.key, sourceRows, section.max, scoreKey);
  };
  const renderHeaderLabel = (label) => {
    const text = String(label);
    return (
      <span style={{ display: "block", maxWidth: "100%", whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word", lineHeight: 1.25 }}>
        {text}
      </span>
    );
  };
  const columnWidthFor = (key) => {
    if (section.key === "feedback") {
      if (showingReviewColumns) {
        return {
          code: "20%",
          fb1: "10%",
          fb2: "10%",
        }[key];
      }
      return { code: "28%", fb1: "15%", fb2: "15%" }[key];
    }
    if (section.key !== "books") return undefined;
    if (showingReviewColumns) {
      if (reviewColumnCount >= 4) {
        return {
          title: "10%",
          publisher: "10%",
          type: "7%",
          level: "7%",
          coAuthors: "9%",
        }[key];
      }
      if (reviewColumnCount >= 3) {
        return {
          title: "11%",
          publisher: "11%",
          type: "8%",
          level: "8%",
          coAuthors: "10%",
        }[key];
      }
      return {
        title: "12%",
        publisher: "12%",
        type: "8%",
        level: "8%",
        coAuthors: "10%",
      }[key];
    }
    return {
      title: "14%",
      publisher: "14%",
      type: "15%",
      level: "14%",
      coAuthors: "14%",
    }[key];
  };

  if (section.key === "acr" && mode === "self") {
    const acrRows = createAcrRows(rows);
    const acrTotal = scoreSectionRows(section.key, acrRows, section.max);
    return (
      <SectionShell title="Part D - Annual Confidential Report (ACR) - Max 50 marks" max={section.max} earned={acrTotal} accent={ACCENT2} showScoreSummary={false}>
        <div style={{ overflowX: "visible", width: "100%" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ height: "auto" }}>
                <th style={thStyle}>SN</th>
                <th style={thStyle}>Parameter</th>
                <th style={thStyle}>Assessment Points</th>
                <th style={thStyle}>Self Score</th>
              </tr>
            </thead>
            <tbody>
              {acrRows.map((row, index) => (
                <tr key={row.label}>
                  <td style={tdCenter}>{index + 1}</td>
                  <td style={tdStyle}>{row.label}</td>
                  <td style={tdStyle}>
                    <ul style={{ margin: "0 0 0 16px", padding: 0, color: "#64748b", fontSize: 10, lineHeight: 1.5 }}>
                      {(ACR_DETAIL_POINTS[row.label] || []).map((point) => <li key={point}>{point}</li>)}
                    </ul>
                  </td>
                  <td style={tdCenter}>-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionShell>
    );
  }

  const rowSelfScore = (row) => {
    if (section.key === "feedback") return clampScore(row.score, section.max);
    if (section.key === "courseFile") return courseFileRowScore(row);
    if (section.key === "research") return clampScore(row.score, researchGuidanceRowMax(row));
    if (section.key === "society") return societyRowScore(row);
    return clampScore(row.score, section.rowMax ? (typeof section.rowMax === "function" ? section.rowMax(row) : section.rowMax) : section.max);
  };

  const updateRow = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      [section.key]: (prev[section.key] || []).map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const rowMax = section.rowMax ? (typeof section.rowMax === "function" ? section.rowMax(row) : section.rowMax) : section.max;
        const nextValue = DATE_FIELD_KEYS.has(key) ? maskDateDDMMYYYY(value) : key === "score" ? (value === "" ? "" : clampScore(value, rowMax)) : value;
        const nextRow = { ...row, [key]: nextValue };
        if (section.key === "research" && key === "status" && nextValue === "Ongoing") {
          nextRow.date = "";
        }
        if (section.key === "lectures" && (key === "planned" || key === "conducted")) {
          const planned = Number(nextRow.planned);
          const conducted = Number(nextRow.conducted);
          if (planned > 0 && conducted >= 0) {
            const pct = (conducted / planned) * 100;
            nextRow.pctConducted = `${pct.toFixed(1)}%`;
          } else {
            nextRow.pctConducted = "";
          }
        }
        if (section.key === "lectures" && (key === "planned" || key === "conducted" || key === "pctConducted")) {
          nextRow.score = String(lectureGuidelineScore(nextRow));
        }
        if (section.key === "feedback" && (key === "fb1" || key === "fb2")) {
          nextRow.score = String(feedbackGuidelineScore(feedbackAverage(nextRow)));
        }
        if (section.key === "externalProjects" && (key === "amount" || key === "status")) {
          nextRow.score = String(externalProjectGuidelineScore(nextRow));
        }
        if (section.key === "consultancy" && (key === "amount" || key === "revenue")) {
          nextRow.score = String(consultancyGuidelineScore(nextRow));
        }
        return nextRow;
      }),
    }));
  };

  const updateReview = (index, value) => {
    setReviewData((prev) => {
      const source = prev[section.key] || cloneRows(rows);
      const nextRows = source.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const sourceRow = rows[rowIndex] || row;
        const nextValue = currentRole === "director"
          ? clampDirectorReviewScore(section.key, sourceRow, value, section.max)
          : clampReviewScore(section.key, sourceRow, value, section.max);
        return { ...row, [currentRole]: nextValue };
      });
      return { ...prev, [section.key]: nextRows };
    });
  };

  const addRow = () => {
    if (section.maxRows && rows.length >= section.maxRows) {
      alert(`${section.title} allows a maximum of ${section.maxRows} rows.`);
      return;
    }
    const blank = Object.fromEntries(section.fields.map(([key]) => [key, ""]));
    setForm((prev) => ({
      ...prev,
      [section.key]: [...(prev[section.key] || []), { ...blank, score: "", _id: Date.now() + Math.random() }],
    }));
  };

  const deleteRow = () => {
    if (rows.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      [section.key]: prev[section.key].slice(0, -1),
    }));
  };
  const booksReviewScoreWidth = reviewColumnCount >= 4 ? "7%" : "9%";
  const booksColumnWidthFor = (kind) => {
    if (section.key !== "books") return undefined;
    if (!showingReviewColumns) {
      return { sn: "5%", attachment: "9%", viewDocs: "8%", facultyScore: "7%", reviewScore: undefined }[kind];
    }
    return {
      sn: "4%",
      attachment: reviewColumnCount >= 4 ? "6%" : "7%",
      viewDocs: reviewColumnCount >= 4 ? "6%" : "7%",
      facultyScore: reviewColumnCount >= 4 ? "7%" : "8%",
      reviewScore: booksReviewScoreWidth,
    }[kind];
  };

  return (
    <SectionShell title={section.title} max={section.max} earned={earned} accent={ACCENT2}>
      <>
        <div style={{ overflowX: "visible", width: "100%" }}>
          <table style={{ ...tableStyle, tableLayout: section.key === "feedback" || section.key === "books" ? "fixed" : tableStyle.tableLayout }}>
            <thead>
              <tr style={{ height: "auto" }}>
                <th style={{ ...thStyle, width: section.key === "feedback" ? (showingReviewColumns ? "4%" : "5%") : section.key === "books" ? booksColumnWidthFor("sn") : 46 }}>SN</th>
                {section.fields.map(([key, label]) => <th key={label} style={{ ...thStyle, width: columnWidthFor(key) }}>{renderHeaderLabel(label)}</th>)}
                {section.key === "feedback" && <th style={{ ...thStyle, width: showingReviewColumns ? "8%" : "10%" }}>Average</th>}
                <th style={{ ...thStyle, width: section.key === "feedback" ? (showingReviewColumns ? "8%" : "9%") : booksColumnWidthFor("attachment") }}>Attachment</th>
                <th style={{ ...thStyle, width: section.key === "feedback" ? (showingReviewColumns ? "7%" : "8%") : booksColumnWidthFor("viewDocs") }}>View Docs</th>
                <th style={{ ...thStyle, width: section.key === "feedback" ? (showingReviewColumns ? "8%" : "10%") : booksColumnWidthFor("facultyScore") }}>Faculty Score</th>
                {mode === "review" && previousRoles.map((role) => <th key={role} style={{ ...thStyle, width: section.key === "feedback" ? "10%" : booksColumnWidthFor("reviewScore") }}>{roleLabel(role)} Score</th>)}
                {mode === "review" && <th style={{ ...thStyle, width: section.key === "feedback" ? "10%" : booksColumnWidthFor("reviewScore") }}>{roleLabel(currentRole)} Score</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const socRowLocked = section.key === "society" && societyRowLocked(row);
                const rowReviewable = rowHasReviewableData(section.key, row, docs, `${docPrefix}-${index}`) ||
                  docKeysForRow(index).some((docKey) => rowHasReviewableData(section.key, row, docs, docKey));
                const reviewerCanScoreRow = rowReviewable;
                const currentRowMax = reviewRowMaxForSection(section.key, row, section.max);
                const displayScore = (value) => String(value ?? "").trim() ? clampScore(value, currentRowMax) : "";
                return (
                  <tr key={row._id ?? `${section.key}-${index}`} style={socRowLocked ? { background: "#f1f5f9", opacity: 0.65, height: "auto" } : { height: "auto" }}>
                    <td style={tdCenter}>{index + 1}</td>
                    {section.fields.map(([key, , readOnlyField]) => (
                      <td key={key} style={tdStyle}>
                        {mode !== "self" ? (
                          key === "pctConducted" ? (
                            <RO value={row.pctConducted || (Number(row.planned) > 0 && Number(row.conducted) >= 0 ? `${((Number(row.conducted) / Number(row.planned)) * 100).toFixed(1)}%` : "")} placeholder="%" center />
                          ) : section.key === "research" && key === "date" ? (
                            <RO value={row.status === "Ongoing" ? "NA" : row[key]} />
                          ) : section.key === "events" && (key === "fromDate" || key === "toDate") ? (
                            <RO value={row[key] || row.date} />
                          ) : (
                            <RO value={row[key]} />
                          )
                        ) : key === "first" ? (
                          <select
                            value={normalizeCourseFileDetails(row[key])}
                            disabled={!editableSelf || readOnlyField || selfLocked}
                            onChange={(event) => updateRow(index, key, event.target.value)}
                            style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontFamily: "inherit", fontSize: 11 }}
                          >
                            <option value="">Select</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        ) : section.key === "research" && key === "degree" ? (
                          <select
                            value={row[key] || ""}
                            disabled={!editableSelf || readOnlyField || selfLocked}
                            onChange={(event) => updateRow(index, key, event.target.value)}
                            style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontFamily: "inherit", fontSize: 11 }}
                          >
                            <option value="">Select</option>
                            <option value="PhD">PhD</option>
                          </select>
                        ) : section.key === "courseFile" && key === "details" ? (
                          <select
                            value={row[key] || ""}
                            disabled={!editableSelf || selfLocked}
                            onChange={(event) => updateRow(index, key, event.target.value)}
                            style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontFamily: "inherit", fontSize: 11 }}
                          >
                            <option value="">Select</option>
                            {COURSE_FILE_DETAIL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        ) : DROPDOWN_FIELD_OPTIONS[section.key]?.[key] ? (
                          <select
                            value={row[key] || ""}
                            disabled={!editableSelf || readOnlyField || selfLocked}
                            onChange={(event) => updateRow(index, key, event.target.value)}
                            style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontFamily: "inherit", fontSize: 11 }}
                          >
                            <option value="">Select</option>
                            {row[key] && !DROPDOWN_FIELD_OPTIONS[section.key][key].includes(row[key]) && (
                              <option value={row[key]}>{row[key]}</option>
                            )}
                            {DROPDOWN_FIELD_OPTIONS[section.key][key].map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : key === "pctConducted" ? (
                          <RO value={row.pctConducted} center />
                        ) : (
                          <>
                            <TI value={row[key]} type={key === "amount" ? "integer" : NUMERIC_KEYS.has(key) ? "number" : "text"} center={section.key === "courseFile" && key === "title"} placeholder={section.key === "research" && key === "date" && row.status === "Ongoing" ? "Not required" : placeholderForField(section.key, key)} max={key === "fb1" || key === "fb2" ? 5 : undefined} deferClampWhileTyping={key === "fb1" || key === "fb2"} textOnly={TEXT_ONLY_KEYS.has(key) && !(section.key === "courseFile" && key === "title")} readOnly={!editableSelf || readOnlyField || selfLocked || socRowLocked || (section.key === "research" && key === "date" && row.status === "Ongoing")} onChange={(value) => updateRow(index, key, value)} />
                            {section.key === "acr" && key === "label" && ACR_DETAIL_POINTS[row[key]] && (
                              <ul style={{ margin: "5px 0 0 16px", padding: 0, color: "#64748b", fontSize: 10, lineHeight: 1.5 }}>
                                {ACR_DETAIL_POINTS[row[key]].map((point) => <li key={point}>{point}</li>)}
                              </ul>
                            )}
                            {DATE_FIELD_KEYS.has(key) && row[key] && !isValidDDMMYYYY(row[key]) && (
                              <div style={{ color: "#dc2626", fontSize: 10, marginTop: 3 }}>Use DD/MM/YYYY</div>
                            )}
                          </>
                        )}
                      </td>
                    ))}
                    {section.key === "feedback" && <td style={tdCenter}>{row.fb1 || row.fb2 ? feedbackAverage(row).toFixed(2) : ""}</td>}
                    <td style={tdStyle}><DocCell id={`${section.doc}-${index}`} docs={docs} setDocs={setDocs} readOnly={!editableSelf || selfLocked || socRowLocked} /></td>
                    <td style={tdStyle}><ViewDocsCell docKey={docKeysForRow(index)} docs={docs} emptyText="" compact /></td>
                    <td style={tdCenter}>
                      {mode === "self"
                        ? section.autoScore || section.key === "feedback" || section.key === "lectures" || section.key === "externalProjects" || section.key === "consultancy"
                            ? <RO value={rowSelfScore(row) ? rowSelfScore(row).toFixed(1) : ""} center />
                            : <TI value={row.score} type="number" center placeholder="Marks" max={section.rowMax ? (typeof section.rowMax === "function" ? section.rowMax(row) : section.rowMax) : section.max} readOnly={!editableSelf || section.selfReadOnlyScore || selfLocked || socRowLocked} onChange={(value) => updateRow(index, "score", value)} />
                        : <RO value={rowSelfScore(row) ? rowSelfScore(row).toFixed(1) : ""} center />}
                    </td>
                    {mode === "review" && previousRoles.map((role) => <td key={role} style={tdCenter}><RO value={socRowLocked ? "0" : displayScore(row[role])} center /></td>)}
                    {mode === "review" && (
                      <td style={tdCenter}>
                        <TI type="number" center max={currentRowMax} readOnly={reviewLocked || socRowLocked || !reviewerCanScoreRow} value={socRowLocked ? "0" : displayScore(reviewRows[index]?.[currentRole] ?? row[currentRole] ?? "")} onChange={(value) => updateReview(index, value)} />
                      </td>
                    )}
                  </tr>
                );
              })}
              <tr className="appraisal-total-row" style={{ background: "#f0f3ff", borderTop: "1px solid #c7d2fe", height: "auto" }}>
                <td style={{ ...tdCenter, fontWeight: 800, color: "#3730a3", fontSize: 14, padding: "12px 14px", textAlign: "center", background: "#f0f3ff" }} colSpan={totalLabelColSpan}>{totalLabel}</td>
                <td style={{ ...tdCenter, fontWeight: 800, color: "#3730a3", fontSize: 14, padding: "12px 14px", textAlign: "center", background: "#f0f3ff" }}>{earned.toFixed(1)}</td>
                {mode === "review" && previousRoles.map((role) => (
                  <td key={role} style={{ ...tdCenter, fontWeight: 800, color: "#3730a3", fontSize: 14, padding: "12px 14px", textAlign: "center", background: "#f0f3ff" }}>
                    {sectionTotalScore(rows, role).toFixed(1)}
                  </td>
                ))}
                {mode === "review" && (
                  <td style={{ ...tdCenter, fontWeight: 800, color: "#3730a3", fontSize: 14, padding: "12px 14px", textAlign: "center", background: "#f0f3ff" }}>
                    {sectionTotalScore(reviewRows.length ? reviewRows : rows, currentRole).toFixed(1)}
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
        {editableSelf && !section.selfReadOnlyScore && section.key !== "acr" && (
          <RowBtns onAdd={addRow} onDel={deleteRow} canDel={rows.length > 1} />
        )}
      </>
    </SectionShell>
  );
}

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

function InnovativeSection({ form, setForm, docs, setDocs, mode, locked, reviewerRole, reviewData, setReviewData, previousRoles }) {
  const currentScore = scoreKeyForInnov(reviewerRole);
  const editableSelf = mode === "self" && !locked;
  const reviewLocked = mode === "review" && locked;
  const innovRows = (Array.isArray(form.innovRows) && form.innovRows.length ? form.innovRows : [{ method: form.innovDetails || "", details: form.innovDetails || "", methodOther: "", score: form.innovScore || "" }]).map(withCreativeInnovativeLimits);
  const visibleInnovRows = innovRows;
  const selectedInnovativeMethods = new Set(visibleInnovRows.map((row) => String(row.method ?? "").trim()).filter(Boolean));
  const innovativeMethodOptionsForRow = (currentMethod) =>
    INNOVATIVE_METHOD_OPTIONS.filter((option) => option.value === currentMethod || !selectedInnovativeMethods.has(option.value));
  const facultyScore = clampScore(innovRows.reduce((total, row) => total + clampScore(row.score, row.max || CREATIVE_INNOVATIVE_ROW_MAX), 0), CREATIVE_INNOVATIVE_SECTION_MAX);
  const rowReviewScore = (role, row, index) => {
    if (!rowHasReviewableData("innovRows", row) && role !== "director") return "";
    const value = reviewData.innovRows?.[index]?.[role] ?? row[role] ?? "";
    return String(value ?? "").trim() ? clampScore(value, row.max || CREATIVE_INNOVATIVE_ROW_MAX) : "";
  };
  const roleInnovTotal = (role) => {
    const total = reviewSectionScore("innovRows", visibleInnovRows.map((row, index) => ({
      ...row,
      [role]: reviewData.innovRows?.[index]?.[role] ?? row[role] ?? "",
    })), CREATIVE_INNOVATIVE_SECTION_MAX, role);
    return total || form[scoreKeyForInnov(role)] || "";
  };
  const currentInnovTotal = () => reviewSectionScore("innovRows", visibleInnovRows.map((row, index) => ({
    ...row,
    [reviewerRole]: reviewData.innovRows?.[index]?.[reviewerRole] ?? row[reviewerRole] ?? "",
  })), CREATIVE_INNOVATIVE_SECTION_MAX, reviewerRole);
  const updateReview = (index, value) => {
    const sourceRow = visibleInnovRows[index] || {};
    const nextValue = reviewerRole === "director"
      ? clampDirectorReviewScore("innovRows", sourceRow, value, CREATIVE_INNOVATIVE_SECTION_MAX)
      : clampReviewScore("innovRows", sourceRow, value, CREATIVE_INNOVATIVE_SECTION_MAX);
    setReviewData((prev) => {
      const sourceRows = Array.isArray(prev.innovRows) && prev.innovRows.length ? prev.innovRows : cloneRows(visibleInnovRows);
      const nextRows = sourceRows.map((row, rowIndex) => rowIndex === index ? { ...row, [reviewerRole]: nextValue } : row);
      const total = reviewSectionScore("innovRows", nextRows.map((row, rowIndex) => ({
        ...visibleInnovRows[rowIndex],
        ...row,
      })), CREATIVE_INNOVATIVE_SECTION_MAX, reviewerRole);
      return {
        ...prev,
        innovRows: nextRows,
        innovativeTeaching: { ...(prev.innovativeTeaching || {}), [reviewerRole]: total ? String(total) : "" },
      };
    });
  };
  const updateSelfRow = (index, field, value) => {
    setForm((prev) => {
      const baseRows = Array.isArray(prev.innovRows) && prev.innovRows.length ? prev.innovRows : [{ method: prev.innovDetails || "", details: prev.innovDetails || "", methodOther: "", score: prev.innovScore || "" }];
      const nextRows = baseRows.map((row, rowIndex) => rowIndex === index ? withCreativeInnovativeLimits({ ...row, [field]: value }) : withCreativeInnovativeLimits(row));
      const hasAnyScore = nextRows.some((row) => String(row.score ?? "").trim() !== "");
      const nextScore = hasAnyScore
        ? String(clampScore(nextRows.reduce((total, row) => total + clampScore(row.score, row.max || CREATIVE_INNOVATIVE_ROW_MAX), 0), CREATIVE_INNOVATIVE_SECTION_MAX))
        : "";
      return { ...prev, innovRows: nextRows, innovDetails: nextRows.map((row) => row.method).filter(Boolean).join(", "), innovScore: nextScore };
    });
  };
  const addInnovRow = () => setForm((prev) => {
    const baseRows = Array.isArray(prev.innovRows) && prev.innovRows.length ? prev.innovRows : [{ method: prev.innovDetails || "", details: prev.innovDetails || "", methodOther: "", score: prev.innovScore || "" }];
    return { ...prev, innovRows: [...baseRows.map(withCreativeInnovativeLimits), withCreativeInnovativeLimits({ method: "", details: "", methodOther: "", score: "" })] };
  });
  const deleteInnovRow = () => setForm((prev) => {
    const baseRows = Array.isArray(prev.innovRows) && prev.innovRows.length ? prev.innovRows : [{ method: prev.innovDetails || "", details: prev.innovDetails || "", methodOther: "", score: prev.innovScore || "" }];
    return { ...prev, innovRows: baseRows.length > 1 ? baseRows.slice(0, -1) : baseRows };
  });

  return (
    <SectionShell title="A3. Innovative Teaching-Learning Methodologies - Max 20 marks" max={20} earned={facultyScore}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 46 }}>SN</th>
            <th style={thStyle}>Methods Used</th>
            <th style={thStyle}>Proof Attached (Yes/No)</th>
            <th style={thStyle}>Attachment</th>
            <th style={thStyle}>View Docs</th>
            <th style={thStyle}>{mode === "self" ? "Score" : "Faculty Score"}</th>
            {mode === "review" && previousRoles.map((role) => <th key={role} style={thStyle}>{roleLabel(role)} Score</th>)}
            {mode === "review" && <th style={thStyle}>{roleLabel(reviewerRole)} Score</th>}
          </tr>
        </thead>
        <tbody>
          {visibleInnovRows.map((row, index) => {
            const rowReviewable = rowHasReviewableData("innovRows", row);
            return (
                  <tr key={index} style={{ height: "auto" }}>
                <td style={tdCenter}>{index + 1}</td>
                <td style={tdStyle}>
                  {mode === "self" ? (
                    <>
                      <select
                        value={row.method || ""}
                        disabled={!editableSelf}
                        onChange={(e) => {
                          const nextMethod = e.target.value;
                          updateSelfRow(index, "method", nextMethod);
                          if (nextMethod !== OTHER_INNOVATIVE_METHOD) updateSelfRow(index, "methodOther", "");
                        }}
                        style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontFamily: "inherit", fontSize: 11 }}
                      >
                        <option value="">Select Method</option>
                        {row.method && !LEGACY_INNOVATIVE_METHODS.has(row.method) && <option value={row.method}>{row.method}</option>}
                        {innovativeMethodOptionsForRow(row.method).map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      {row.method === OTHER_INNOVATIVE_METHOD && (
                        <input
                          type="text"
                          value={row.methodOther || ""}
                          disabled={!editableSelf}
                          onChange={(e) => updateSelfRow(index, "methodOther", e.target.value)}
                          placeholder="Mention the name of the innovative method"
                          style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontFamily: "inherit", fontSize: 11, marginTop: 6, padding: "0 8px", boxSizing: "border-box" }}
                        />
                      )}
                    </>
                  ) : (
                    <RO value={(row.method === OTHER_INNOVATIVE_METHOD && row.methodOther) ? row.methodOther : (row.method || form.innovDetails)} />
                  )}
                </td>
                <td style={tdStyle}>
                  {mode === "self" ? (
                    <select
                      value={row.details || ""}
                      disabled={!editableSelf}
                      onChange={(e) => updateSelfRow(index, "details", e.target.value)}
                      style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontFamily: "inherit", fontSize: 11 }}
                    >
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  ) : (
                    <RO value={row.details} />
                  )}
                </td>
                <td style={tdStyle}><DocCell id={`innov-${index}`} docs={docs} setDocs={setDocs} readOnly={!editableSelf} /></td>
                <td style={tdStyle}><ViewCell id={`innov-${index}`} docs={docs} /></td>
                <td style={tdCenter}>{mode === "self" ? <TI type="number" center max={row.max || CREATIVE_INNOVATIVE_ROW_MAX} readOnly={!editableSelf} value={row.score} onChange={(value) => updateSelfRow(index, "score", value)} /> : <RO value={row.score || form.innovScore} center />}</td>
                {mode === "review" && previousRoles.map((role) => <td key={role} style={tdCenter}><RO value={rowReviewScore(role, row, index)} center /></td>)}
                {mode === "review" && <td style={tdCenter}><TI type="number" center max={row.max || CREATIVE_INNOVATIVE_ROW_MAX} readOnly={reviewLocked || !rowReviewable} value={rowReviewScore(reviewerRole, row, index)} onChange={(value) => updateReview(index, value)} /></td>}
              </tr>
            );
          })}
          <tr style={{ background: "#eff6ff" }}>
            <td style={{ ...tdCenter, fontWeight: 800 }} colSpan={5}>Total Score (Max 20)</td>
            <td style={{ ...tdCenter, fontWeight: 800 }}>{facultyScore.toFixed(1)}</td>
            {mode === "review" && previousRoles.map((role) => <td key={role} style={{ ...tdCenter, fontWeight: 800 }}><RO value={roleInnovTotal(role)} center /></td>)}
            {mode === "review" && <td style={{ ...tdCenter, fontWeight: 800 }}><RO value={currentInnovTotal() || reviewData.innovativeTeaching?.[reviewerRole] || form[currentScore]} center /></td>}
          </tr>
        </tbody>
      </table>
      {mode === "self" && !locked && (
        <>
          <RowBtns onAdd={addInnovRow} onDel={deleteInnovRow} canDel={visibleInnovRows.length > 1} />
        </>
      )}
    </SectionShell>
  );
}

function PartCardContainer({ title, subtitle, max, score, accent = "#4f46e5", children }) {
  const scoreBadge = score !== undefined ? `${Number(score).toFixed(1)} / ${max}` : max ? `${max}` : undefined;
  return (
    <SC title={title} subtitle={subtitle} accent={accent} scoreBadge={scoreBadge}>
      {children}
    </SC>
  );
}

function ObeSection({ form, setForm, docs, setDocs, mode, locked, reviewerRole, reviewData, setReviewData, previousRoles }) {
  const editableSelf = mode === "self" && !locked;
  const reviewLocked = mode === "review" && locked;
  const obeRows = Array.isArray(form.obeRows) && form.obeRows.length ? form.obeRows : defaultObeRows();
  const visibleObeRows = obeRows;

  const facultyScore = clampScore(
    obeRows.reduce((total, row) => total + clampScore(row.score, row.max || 20), 0),
    20
  );

  const currentRole = reviewerRole;

  const rowReviewScore = (role, row, index) => {
    if (!rowHasReviewableData("obeRows", row)) return "";
    const value = reviewData.obeRows?.[index]?.[role] ?? row[role] ?? "";
    return String(value ?? "").trim() ? clampScore(value, row.max || 20) : "";
  };

  const roleObeTotal = (role) => {
    const total = reviewSectionScore("obeRows", visibleObeRows.map((row, index) => ({
      ...row,
      [role]: reviewData.obeRows?.[index]?.[role] ?? row[role] ?? "",
    })), 20, role);
    return total || "";
  };

  const currentObeTotal = () => reviewSectionScore("obeRows", visibleObeRows.map((row, index) => ({
    ...row,
    [reviewerRole]: reviewData.obeRows?.[index]?.[reviewerRole] ?? row[reviewerRole] ?? "",
  })), 20, reviewerRole);

  const updateReview = (index, value) => {
    const source = reviewData.obeRows || cloneRows(obeRows);
    const updated = source.map((row, i) => {
      if (i !== index) return row;
      const sourceRow = obeRows[i] || row;
      return { ...row, [currentRole]: clampReviewScore("obeRows", sourceRow, value, sourceRow.max || 20) };
    });
    setReviewData((prev) => ({ ...prev, obeRows: updated }));
  };

  const updateSelfRow = (index, field, value) => {
    setForm((prev) => {
      const baseRows = Array.isArray(prev.obeRows) && prev.obeRows.length ? prev.obeRows : defaultObeRows();
      const updatedRows = baseRows.map((row, i) => (i === index ? { ...row, [field]: value } : row));
      return { ...prev, obeRows: updatedRows };
    });
  };

  const addObeRow = () => setForm((prev) => {
    const baseRows = Array.isArray(prev.obeRows) && prev.obeRows.length ? prev.obeRows : defaultObeRows();
    return { ...prev, obeRows: [...baseRows, { component: "", evidence: "", score: "", max: 20 }] };
  });

  const deleteObeRow = () => setForm((prev) => {
    const baseRows = Array.isArray(prev.obeRows) && prev.obeRows.length ? prev.obeRows : defaultObeRows();
    return { ...prev, obeRows: baseRows.length > 3 ? baseRows.slice(0, -1) : baseRows };
  });

  return (
    <SectionShell title="A5. Learning Outcomes Attainment & OBE Practice (Max: 20)" max={20} earned={facultyScore}>
      <div style={{ fontSize: 11, fontStyle: "italic", color: "#475569", marginBottom: 8 }}>
        CO-PO mapping — 5 marks; attainment computation — 10 marks; corrective action taken — 5 marks.
      </div>
      <div style={{ overflowX: "visible", width: "100%" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 46 }}>SN</th>
              <th style={thStyle}>Component</th>
              <th style={thStyle}>Evidence Attached (Yes/No)</th>
              <th style={thStyle}>Attachment</th>
              <th style={thStyle}>View Docs</th>
              <th style={thStyle}>{mode === "self" ? "Score" : "Faculty Score"}</th>
              {mode === "review" && previousRoles.map((role) => <th key={role} style={thStyle}>{roleLabel(role)} Score</th>)}
              {mode === "review" && <th style={thStyle}>{roleLabel(reviewerRole)} Score</th>}
            </tr>
          </thead>
          <tbody>
            {visibleObeRows.map((row, index) => {
              const rowReviewable = rowHasReviewableData("obeRows", row);
              return (
                <tr key={index}>
                  <td style={tdCenter}>{index + 1}</td>
                  <td style={tdStyle}>
                    {mode === "self" && index >= 3 ? (
                      <TI value={row.component} textOnly readOnly={!editableSelf} onChange={(value) => updateSelfRow(index, "component", value)} />
                    ) : (
                      <RO value={row.component} />
                    )}
                  </td>
                  <td style={tdStyle}>
                    {mode === "self" ? (
                      <select
                        value={row.evidence || ""}
                        disabled={!editableSelf}
                        onChange={(e) => updateSelfRow(index, "evidence", e.target.value)}
                        style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontFamily: "inherit", fontSize: 11 }}
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    ) : (
                      <RO value={row.evidence} />
                    )}
                  </td>
                  <td style={tdStyle}><DocCell id={`obe-${index}`} docs={docs} setDocs={setDocs} readOnly={!editableSelf} /></td>
                  <td style={tdStyle}><ViewCell id={`obe-${index}`} docs={docs} /></td>
                  <td style={tdCenter}>
                    {mode === "self" ? (
                      <TI type="number" center max={row.max || 20} readOnly={!editableSelf} value={row.score} onChange={(value) => updateSelfRow(index, "score", value)} />
                    ) : (
                      <RO value={row.score} center />
                    )}
                  </td>
                  {mode === "review" && previousRoles.map((role) => <td key={role} style={tdCenter}><RO value={rowReviewScore(role, row, index)} center /></td>)}
                  {mode === "review" && <td style={tdCenter}><TI type="number" center max={row.max || 20} readOnly={reviewLocked || !rowReviewable} value={rowReviewScore(reviewerRole, row, index)} onChange={(value) => updateReview(index, value)} /></td>}
                </tr>
              );
            })}
                <tr className="appraisal-total-row" style={{ background: "#f0f3ff", borderTop: "1px solid #c7d2fe", height: "auto" }}>
              <td style={{ ...tdCenter, fontWeight: 800, color: "#3730a3", fontSize: 14, padding: "12px 14px", textAlign: "center", background: "#f0f3ff" }} colSpan={5}>Total (Max: 20)</td>
              <td style={{ ...tdCenter, fontWeight: 800, color: "#3730a3", fontSize: 14, padding: "12px 14px", textAlign: "center", background: "#f0f3ff" }}>{facultyScore.toFixed(1)}</td>
              {mode === "review" && previousRoles.map((role) => <td key={role} style={{ ...tdCenter, fontWeight: 800, color: "#3730a3", fontSize: 14, padding: "12px 14px", textAlign: "center", background: "#f0f3ff" }}><RO value={roleObeTotal(role)} center /></td>)}
              {mode === "review" && <td style={{ ...tdCenter, fontWeight: 800, color: "#3730a3", fontSize: 14, padding: "12px 14px", textAlign: "center", background: "#f0f3ff" }}><RO value={currentObeTotal()} center /></td>}
            </tr>
          </tbody>
        </table>
      </div>
    </SectionShell>
  );
}

function MentoringSection({ form, setForm, docs, setDocs, mode, locked, reviewerRole, reviewData, setReviewData, previousRoles }) {
  const editableSelf = mode === "self" && !locked;
  const reviewLocked = mode === "review" && locked;
  const mentoringRows = Array.isArray(form.mentoringRows) && form.mentoringRows.length ? form.mentoringRows : defaultMentoringRows();
  const visibleMentoringRows = mentoringRows;

  const facultyScore = clampScore(
    mentoringRows.reduce((total, row) => total + clampScore(row.score, row.max || 10), 0),
    10
  );

  const currentRole = reviewerRole;

  const rowReviewScore = (role, row, index) => {
    if (!rowHasReviewableData("mentoringRows", row)) return "";
    const value = reviewData.mentoringRows?.[index]?.[role] ?? row[role] ?? "";
    return String(value ?? "").trim() ? clampScore(value, row.max || 10) : "";
  };

  const roleMentoringTotal = (role) => {
    const total = reviewSectionScore("mentoringRows", visibleMentoringRows.map((row, index) => ({
      ...row,
      [role]: reviewData.mentoringRows?.[index]?.[role] ?? row[role] ?? "",
    })), 10, role);
    return total || "";
  };

  const currentMentoringTotal = () => reviewSectionScore("mentoringRows", visibleMentoringRows.map((row, index) => ({
    ...row,
    [reviewerRole]: reviewData.mentoringRows?.[index]?.[reviewerRole] ?? row[reviewerRole] ?? "",
  })), 10, reviewerRole);

  const updateReview = (index, value) => {
    const source = reviewData.mentoringRows || cloneRows(mentoringRows);
    const updated = source.map((row, i) => {
      if (i !== index) return row;
      const sourceRow = mentoringRows[i] || row;
      return { ...row, [currentRole]: clampReviewScore("mentoringRows", sourceRow, value, sourceRow.max || 10) };
    });
    setReviewData((prev) => ({ ...prev, mentoringRows: updated }));
  };

  const updateSelfRow = (index, field, value) => {
    setForm((prev) => {
      const baseRows = Array.isArray(prev.mentoringRows) && prev.mentoringRows.length ? prev.mentoringRows : defaultMentoringRows();
      const updatedRows = baseRows.map((row, i) => (i === index ? { ...row, [field]: value } : row));
      return { ...prev, mentoringRows: updatedRows };
    });
  };

  const addMentoringRow = () => setForm((prev) => {
    const baseRows = Array.isArray(prev.mentoringRows) && prev.mentoringRows.length ? prev.mentoringRows : defaultMentoringRows();
    return { ...prev, mentoringRows: [...baseRows, { activity: "", evidence: "", score: "", max: 10 }] };
  });

  const deleteMentoringRow = () => setForm((prev) => {
    const baseRows = Array.isArray(prev.mentoringRows) && prev.mentoringRows.length ? prev.mentoringRows : defaultMentoringRows();
    return { ...prev, mentoringRows: baseRows.length > 3 ? baseRows.slice(0, -1) : baseRows };
  });

  return (
    <SectionShell title="A7. Student Mentoring & Counselling (Max: 10)" max={10} earned={facultyScore}>
      <div style={{ overflowX: "visible", width: "100%" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 46 }}>SN</th>
              <th style={thStyle}>Activity</th>
              <th style={thStyle}>Evidence Attached (Yes/No)</th>
              <th style={thStyle}>Attachment</th>
              <th style={thStyle}>View Docs</th>
              <th style={thStyle}>{mode === "self" ? "Score" : "Faculty Score"}</th>
              {mode === "review" && previousRoles.map((role) => <th key={role} style={thStyle}>{roleLabel(role)} Score</th>)}
              {mode === "review" && <th style={thStyle}>{roleLabel(reviewerRole)} Score</th>}
            </tr>
          </thead>
          <tbody>
            {visibleMentoringRows.map((row, index) => {
              const rowReviewable = rowHasReviewableData("mentoringRows", row);
              return (
                <tr key={index}>
                  <td style={tdCenter}>{index + 1}</td>
                  <td style={tdStyle}>
                    {mode === "self" && index >= 3 ? (
                      <TI value={row.activity} textOnly readOnly={!editableSelf} onChange={(value) => updateSelfRow(index, "activity", value)} />
                    ) : (
                      <RO value={row.activity} />
                    )}
                  </td>
                  <td style={tdStyle}>
                    {mode === "self" ? (
                      <select
                        value={row.evidence || ""}
                        disabled={!editableSelf}
                        onChange={(e) => updateSelfRow(index, "evidence", e.target.value)}
                        style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", fontFamily: "inherit", fontSize: 11 }}
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    ) : (
                      <RO value={row.evidence} />
                    )}
                  </td>
                  <td style={tdStyle}><DocCell id={`mentor-${index}`} docs={docs} setDocs={setDocs} readOnly={!editableSelf} /></td>
                  <td style={tdStyle}><ViewCell id={`mentor-${index}`} docs={docs} /></td>
                  <td style={tdCenter}>
                    {mode === "self" ? (
                      <TI type="number" center max={row.max || 10} readOnly={!editableSelf} value={row.score} onChange={(value) => updateSelfRow(index, "score", value)} />
                    ) : (
                      <RO value={row.score} center />
                    )}
                  </td>
                  {mode === "review" && previousRoles.map((role) => <td key={role} style={tdCenter}><RO value={rowReviewScore(role, row, index)} center /></td>)}
                  {mode === "review" && <td style={tdCenter}><TI type="number" center max={row.max || 10} readOnly={reviewLocked || !rowReviewable} value={rowReviewScore(reviewerRole, row, index)} onChange={(value) => updateReview(index, value)} /></td>}
                </tr>
              );
            })}
            <tr className="appraisal-total-row" style={{ background: "#f0f3ff", borderTop: "1px solid #c7d2fe" }}>
              <td style={{ ...tdCenter, fontWeight: 800, color: "#3730a3", fontSize: 14, padding: "12px 14px", textAlign: "center", background: "#f0f3ff" }} colSpan={5}>Total (Max: 10)</td>
              <td style={{ ...tdCenter, fontWeight: 800, color: "#3730a3", fontSize: 14, padding: "12px 14px", textAlign: "center", background: "#f0f3ff" }}>{facultyScore.toFixed(1)}</td>
              {mode === "review" && previousRoles.map((role) => <td key={role} style={{ ...tdCenter, fontWeight: 800, color: "#3730a3", fontSize: 14, padding: "12px 14px", textAlign: "center", background: "#f0f3ff" }}><RO value={roleMentoringTotal(role)} center /></td>)}
              {mode === "review" && <td style={{ ...tdCenter, fontWeight: 800, color: "#3730a3", fontSize: 14, padding: "12px 14px", textAlign: "center", background: "#f0f3ff" }}><RO value={currentMentoringTotal()} center /></td>}
            </tr>
          </tbody>
        </table>
      </div>
    </SectionShell>
  );
}

function PartA({ sections, SectionTable, InnovativeSection, ObeSection, MentoringSection, sectionTableProps }) {
  const totals = calculateCreativeSchoolTotals(sectionTableProps.form || {});
  return (
    <PartCardContainer
      title={`Part A - Teaching & Academic Activities (Max ${PART_A_MAX})`}
      subtitle="Fill in your teaching and academic activities for the appraisal period. Enter scores for each item."
      max={PART_A_MAX}
      score={totals.partA}
      accent="#4f46e5"
    >
      <SectionTable key={sections[0].key} section={sections[0]} {...sectionTableProps} />
      <SectionTable key={sections[1].key} section={sections[1]} {...sectionTableProps} />
      <InnovativeSection {...sectionTableProps} />
      <SectionTable key={sections[2].key} section={sections[2]} {...sectionTableProps} />
      <ObeSection {...sectionTableProps} />
      <SectionTable key={sections[3].key} section={sections[3]} {...sectionTableProps} />
      <MentoringSection {...sectionTableProps} />
      <SectionTable key={sections[4].key} section={sections[4]} {...sectionTableProps} />
    </PartCardContainer>
  );
}

function PartB({ sections, SectionTable, sectionTableProps }) {
  const totals = calculateCreativeSchoolTotals(sectionTableProps.form || {});
  return (
    <PartCardContainer
      title={`Part B - Research, Publications & Creative Output (Max ${PART_B_MAX})`}
      subtitle="Fill in your research papers, books, creative projects, consultancy, and patents. Enter scores for each item."
      max={PART_B_MAX}
      score={totals.partB}
      accent="#4f46e5"
    >
      {sections.map((section) => (
        <SectionTable key={section.key} section={section} {...sectionTableProps} />
      ))}
    </PartCardContainer>
  );
}

function PartC({ sections, SectionTable, sectionTableProps }) {
  const totals = calculateCreativeSchoolTotals(sectionTableProps.form || {});
  return (
    <PartCardContainer
      title={`Part C - Administrative Role & University Development (Max ${PART_C_MAX})`}
      subtitle="Fill in your university/school administrative roles, event organization, student mentoring, and placement activities."
      max={PART_C_MAX}
      score={totals.partC}
      accent="#4f46e5"
    >
      {sections.map((section) => (
        <SectionTable key={section.key} section={section} {...sectionTableProps} />
      ))}
    </PartCardContainer>
  );
}

const ACR_PARAM_DETAILS = [
  {
    id: "D1",
    label: "Self-motivation & Proactiveness",
    desc: "Initiative, enthusiasm, taking ownership of tasks, self-driven work attitude.",
    max: 10,
  },
  {
    id: "D2",
    label: "Knowledge & Competence",
    desc: "Domain expertise, subject knowledge, teaching competence, academic standards.",
    max: 10,
  },
  {
    id: "D3",
    label: "Target-based Work",
    desc: "Meeting departmental/institutional deadlines, task execution, target completion.",
    max: 10,
  },
  {
    id: "D4",
    label: "Leadership & Supervisory Skills",
    desc: "Guiding colleagues/students, event coordination, teamwork, administrative initiative.",
    max: 10,
  },
  {
    id: "D5",
    label: "Adaptability & Learning",
    desc: "Openness to new technologies, institutional changes, constructive feedback, continuous learning.",
    max: 10,
  },
];

function PartD({ sectionTableProps }) {
  const { form = {}, setForm = () => {}, mode = "self", locked = false } = sectionTableProps || {};
  const rows = Array.isArray(form.leaveManagement) && form.leaveManagement.length ? form.leaveManagement : [blankLeaveManagementRow()];
  const readOnly = mode !== "self" || locked;
  const setRow = (index, key, value) => {
    if (readOnly) return;
    setForm((prev) => {
      const prevRows = Array.isArray(prev.leaveManagement) && prev.leaveManagement.length ? prev.leaveManagement : [blankLeaveManagementRow()];
      const nextRows = prevRows.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, [key]: value };
        if (key === "managementRating") next.score = String(partDRatingScore(value));
        return next;
      });
      return { ...prev, leaveManagement: nextRows };
    });
  };

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Part D - Leave &amp; Attendance Management</h3>
        <div style={{ background: "#0891b2", color: "#ffffff", padding: "6px 14px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
          Total Score: {n(rows[0]?.score).toFixed(1)} / 25
        </div>
      </div>
      {readOnly && (
        <div style={{ background: "#ecfeff", border: "1px solid #a5f3fc", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#155e75", fontSize: 12, fontWeight: 600 }}>
          Faculty-submitted data - view only. This section is not editable by reviewers.
        </div>
      )}
      {rows.map((r, i) => {
        const totalTaken = n(r.clTaken) + n(r.mlTaken) + n(r.odTaken) + n(r.coffTaken);
        const totalOutOf = n(r.clOutOf) + n(r.mlOutOf) + n(r.odOutOf) + n(r.coffOutOf);
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <table style={{ ...tableStyle, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "28%" }} /><col style={{ width: "16%" }} /><col style={{ width: "16%" }} /><col style={{ width: "16%" }} /><col style={{ width: "16%" }} /><col style={{ width: "8%" }} />
              </colgroup>
              <thead><tr>
                <th style={{ ...thStyle, textAlign: "left" }}>1. No. of leaves taken in the Year</th>
                <th style={thStyle}>CL</th><th style={thStyle}>ML</th><th style={thStyle}>OD</th><th style={thStyle}>C/Off</th><th style={thStyle}>Total</th>
              </tr></thead>
              <tbody>
                <tr>
                  <td style={tdStyle} />
                  <td style={tdCenter}>{readOnly ? (r.clTaken || "-") : <TI type="number" center value={r.clTaken} onChange={(v) => setRow(i, "clTaken", v)} />}</td>
                  <td style={tdCenter}>{readOnly ? (r.mlTaken || "-") : <TI type="number" center value={r.mlTaken} onChange={(v) => setRow(i, "mlTaken", v)} />}</td>
                  <td style={tdCenter}>{readOnly ? (r.odTaken || "-") : <TI type="number" center value={r.odTaken} onChange={(v) => setRow(i, "odTaken", v)} />}</td>
                  <td style={tdCenter}>{readOnly ? (r.coffTaken || "-") : <TI type="number" center value={r.coffTaken} onChange={(v) => setRow(i, "coffTaken", v)} />}</td>
                  <td style={{ ...tdCenter, fontWeight: 700 }}>{totalTaken || ""}</td>
                </tr>
                <tr style={{ background: "#f8fafc" }}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>Out of</td>
                  <td style={tdCenter}>{readOnly ? (r.clOutOf || "-") : <TI type="number" center value={r.clOutOf} onChange={(v) => setRow(i, "clOutOf", v)} />}</td>
                  <td style={tdCenter}>{readOnly ? (r.mlOutOf || "-") : <TI type="number" center value={r.mlOutOf} onChange={(v) => setRow(i, "mlOutOf", v)} />}</td>
                  <td style={tdCenter}>{readOnly ? (r.odOutOf || "-") : <TI type="number" center value={r.odOutOf} onChange={(v) => setRow(i, "odOutOf", v)} />}</td>
                  <td style={tdCenter}>{readOnly ? (r.coffOutOf || "-") : <TI type="number" center value={r.coffOutOf} onChange={(v) => setRow(i, "coffOutOf", v)} />}</td>
                  <td style={{ ...tdCenter, fontWeight: 700 }}>{totalOutOf || ""}</td>
                </tr>
              </tbody>
            </table>
            <table style={{ ...tableStyle, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "58%" }} /><col style={{ width: "42%" }} />
              </colgroup>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>2. No. of Late Remarks in the Year</td>
                  <td style={tdCenter}>{readOnly ? (r.lateRemarks || "-") : <TI type="number" center value={r.lateRemarks} onChange={(v) => setRow(i, "lateRemarks", v)} />}</td>
                </tr>
                <tr style={{ background: "#f8fafc" }}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>3. Total Actual Working Days for the current academic year</td>
                  <td style={tdCenter}>{readOnly ? (r.workingDays || "-") : <TI type="number" center value={r.workingDays} onChange={(v) => setRow(i, "workingDays", v)} />}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>4. Management of leaves</td>
                  <td style={tdStyle}>
                    {readOnly ? (r.managementRating || "-") : (
                      <select value={r.managementRating} onChange={(e) => setRow(i, "managementRating", e.target.value)} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12.5 }}>
                        <option value="">Select rating...</option>
                        {PART_D_RATING_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label} - {option.score} marks</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
                <tr className="appraisal-total-row" style={{ background: "#ecfeff" }}>
                  <td style={{ ...tdStyle, textAlign: "right", color: "#155e75", fontSize: 14, fontWeight: 800, background: "#ecfeff" }}>Total Score out of (25) =</td>
                  <td style={{ ...tdCenter, fontWeight: 800, color: "#155e75", fontSize: 14, background: "#ecfeff" }}>{r.score || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function PartE({ sectionTableProps }) {
  const { form = {}, mode = "self", locked = false, reviewerRole = "", reviewData = {}, setReviewData = () => {}, previousRoles = [] } = sectionTableProps || {};
  const rows = form.acr || [];
  const acrRows = createAcrRows(rows);
  const currentRole = reviewerRole;
  const currentRoleAcrRows = mode === "review" && !locked && !Array.isArray(reviewData?.acr)
    ? acrRows.map((row) => {
      const next = { ...row };
      delete next[currentRole];
      if (currentRole === "director") delete next.dir;
      return next;
    })
    : (reviewData?.acr || rows);

  const partDScore = mode === "review"
    ? scoreSectionRows("acr", currentRoleAcrRows, 50, currentRole)
    : 0;

  const updateReviewScore = (index, value) => {
    setReviewData((prev) => {
      const source = prev.acr || cloneRows(acrRows.map((row) => {
        const next = { ...row };
        delete next[currentRole];
        if (currentRole === "director") delete next.dir;
        return next;
      }));
      const nextRows = source.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const sourceRow = rows[rowIndex] || row;
        return { ...row, [currentRole]: clampReviewScore("acr", sourceRow, value, 10) };
      });
      return { ...prev, acr: nextRows };
    });
  };

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
            Part E - Annual Confidential Report
          </h3>
          <span
            title="Evaluated by HOD/Director only. This part has no faculty self-score input."
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "#e2e8f0", color: "#475469", fontSize: 11, fontWeight: 700, cursor: "help" }}
          >
            ℹ
          </span>
        </div>
        <div style={{ background: "#4f46e5", color: "#ffffff", padding: "6px 14px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
          Total Score: {partDScore.toFixed(1)} / 50
        </div>
      </div>

      {/* Notice Banner */}
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, color: "#1e40af", fontSize: 12, fontWeight: 600 }}>
        <span style={{ fontSize: 16 }}>ℹ️</span>
        <span>Evaluated by HOD/Director only. This part has no faculty self-score input.</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "visible", width: "100%" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 46 }}>Sr. No.</th>
              <th style={{ ...thStyle, width: 220, textAlign: "left" }}>Parameter</th>
              <th style={{ ...thStyle, textAlign: "left" }}>Description / Indicators</th>
              <th style={{ ...thStyle, width: 90 }}>Max Marks</th>
              {mode === "review" && previousRoles.map((role) => (
                <th key={role} style={{ ...thStyle, width: 110 }}>{roleLabel(role)} Score</th>
              ))}
              {mode === "review" && (
                <th style={{ ...thStyle, width: 120 }}>{roleLabel(currentRole)} Score</th>
              )}
            </tr>
          </thead>
          <tbody>
            {ACR_PARAM_DETAILS.map((param, index) => {
              const row = acrRows[index] || {};
              const hasCurrentReviewData = Array.isArray(reviewData?.acr);
              const reviewRow = hasCurrentReviewData ? (reviewData.acr[index] || {}) : row;
              const currentRoleScore = locked
                ? (reviewRow[currentRole] ?? row[currentRole] ?? "")
                : hasCurrentReviewData ? (reviewRow[currentRole] ?? "") : "";
              return (
                <tr key={param.id} style={{ background: index % 2 === 1 ? "#f8fafc" : "#ffffff" }}>
                  <td style={tdCenter}>{param.id}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#0f172a" }}>{param.label}</td>
                  <td style={{ ...tdStyle, color: "#334155" }}>{param.desc}</td>
                  <td style={tdCenter}>{param.max}</td>
                  {mode === "review" && previousRoles.map((role) => (
                    <td key={role} style={tdCenter}>
                      <RO value={reviewRow[role] ?? row[role]} center />
                    </td>
                  ))}
                  {mode === "review" && (
                    <td style={tdCenter}>
                      <TI
                        type="number"
                        center
                        max={10}
                        readOnly={locked}
                        value={currentRoleScore}
                        onChange={(val) => updateReviewScore(index, val)}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
            <tr className="appraisal-total-row" style={{ background: "#f0f3ff", borderTop: "1px solid #c7d2fe" }}>
              <td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#3730a3", fontSize: 14, fontWeight: 800, background: "#f0f3ff" }}>
                Part E Total (Max 50)
              </td>
              <td style={{ ...tdCenter, fontWeight: 800, color: "#3730a3", fontSize: 14, background: "#f0f3ff" }}>50</td>
              {mode === "review" && previousRoles.map((role) => {
                const prevTotal = scoreSectionRows("acr", reviewData?.acr || rows, 50, role);
                return (
                  <td key={role} style={{ ...tdCenter, fontWeight: 800, color: "#3730a3", fontSize: 14, background: "#f0f3ff" }}>
                    {prevTotal.toFixed(1)}
                  </td>
                );
              })}
              {mode === "review" && (
                <td style={{ ...tdCenter, fontWeight: 800, color: "#3730a3", fontSize: 14, background: "#f0f3ff" }}>
                  {partDScore.toFixed(1)}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PartDRubricInfoCard() {
  return null;
}

export function CreativeSchoolForm({ form, setForm, docs, setDocs, mode = "self", locked = false, partDLocked = false, reviewerRole = "", reviewData = {}, setReviewData = () => {}, previousRoles = [], sectionView = "partA" }) {
  const sectionTableProps = { form, setForm, docs, setDocs, mode, locked, reviewerRole, reviewData, setReviewData, previousRoles };
  const partBSections = getPartBSectionsForSchool(form?.info?.school || form);
  return (
    <div className="appraisal-form-shell">
      {(sectionView === "partA" || sectionView === "all") && (
        <PartA sections={PART_A_SECTIONS} SectionTable={SectionTable} InnovativeSection={InnovativeSection} ObeSection={ObeSection} MentoringSection={MentoringSection} sectionTableProps={sectionTableProps} />
      )}
      {(sectionView === "partB" || sectionView === "all") && (
        <PartB sections={partBSections} SectionTable={SectionTable} sectionTableProps={sectionTableProps} />
      )}
      {(sectionView === "partC" || sectionView === "all") && (
        <PartC sections={PART_C_SECTIONS} SectionTable={SectionTable} sectionTableProps={sectionTableProps} />
      )}
      {(sectionView === "partD" || sectionView === "all") && (
        <PartD sectionTableProps={{ ...sectionTableProps, locked: locked || partDLocked }} />
      )}
      {(sectionView === "partE" || sectionView === "all") && (
        <PartE sectionTableProps={sectionTableProps} />
      )}
    </div>
  );
}

export const DesignArtsForm = CreativeSchoolForm;
export const MediaForm = CreativeSchoolForm;

export function AccuracyCheckbox({ checked, onChange, disabled = false }) {
  return (
    <label className="appraisal-confirmation-card" style={{ display: "flex", gap: 14, alignItems: "flex-start", fontSize: 13, color: "#334155", lineHeight: 1.5, padding: "14px 18px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, cursor: disabled ? "not-allowed" : "pointer" }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} style={{ marginTop: 2, width: 18, height: 18, accentColor: "#16a34a", flexShrink: 0 }} />
      <span>{VERIFY_TEXT}</span>
    </label>
  );
}

export function SummaryBox({ totals, roleScoreLabel = "Score", maxScores = { partA: PART_A_MAX, partB: PART_B_MAX, partC: PART_C_MAX, partD: PART_D_MAX, partE: PART_E_MAX, grand: GRAND_MAX } }) {
  const rows = [
    ["Part A", totals.partA, maxScores.partA, "#4f46e5"],
    ["Part B", totals.partB, maxScores.partB, "#4338ca"],
    ["Part C", totals.partC, maxScores.partC, "#6366f1"],
    maxScores.partD > 0 && ["Part D", totals.partD, maxScores.partD, "#0891b2"],
    maxScores.partE > 0 && ["Part E", totals.partE, maxScores.partE, "#3730a3"],
    ["Grand Total", totals.total, maxScores.grand, "#4338ca"],
  ].filter(Boolean);
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, display: "grid", gap: 12 }}>
      {rows.map(([label, value, max, color]) => (
        <div key={label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
            <strong>{label}</strong><span style={{ color, fontWeight: 900 }}>{n(value).toFixed(1)} / {max}</span>
          </div>
          <ScoreBar score={value} max={max} color={color} />
        </div>
      ))}
      <div style={{ fontSize: 11, color: "#64748b" }}>{roleScoreLabel}</div>
    </div>
  );
}

export function CompactAuthoritySummaryCard({ title, subtitle, totals, maxScores, accent = "#4f46e5", remarksTitle, remarksContent }) {
  const rows = [
    ["Part A", totals.partA, maxScores.partA, "#4f46e5"],
    ["Part B", totals.partB, maxScores.partB, "#4338ca"],
    ["Part C", totals.partC, maxScores.partC, "#6366f1"],
    maxScores.partD > 0 && ["Part D", totals.partD, maxScores.partD, "#0891b2"],
    maxScores.partE > 0 && ["Part E", totals.partE, maxScores.partE, "#3730a3"],
    ["Total", totals.total, maxScores.grand, "#4338ca"],
  ].filter(Boolean);
  const hasRemarks = Boolean(remarksContent);
  return (
    <div style={{ background: "#fff", border: "1px solid #dbe3ef", borderRadius: 8, padding: 12, display: "grid", gridTemplateColumns: hasRemarks ? "minmax(300px, 0.95fr) minmax(280px, 1.05fr)" : "1fr", gap: 12, alignItems: "stretch", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ display: "grid", gap: 9, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{title}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{subtitle}</div>
          </div>
          <div style={{ background: `${accent}14`, color: accent, border: `1px solid ${accent}33`, borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
            {n(totals.total).toFixed(1)} / {maxScores.grand}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
          {rows.map(([label, value, max, color]) => (
            <div key={label} style={{ background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 7, padding: "8px 9px", minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline", marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>{label}</span>
                <span style={{ fontSize: 11, color, fontWeight: 900, whiteSpace: "nowrap" }}>{n(value).toFixed(1)} / {max}</span>
              </div>
              <ScoreBar score={value} max={max} color={color} />
            </div>
          ))}
        </div>
      </div>
      {hasRemarks && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, padding: "9px 10px", minWidth: 0 }}>
          <div style={{ fontWeight: 900, color: accent, fontSize: 12, marginBottom: 5 }}>{remarksTitle}</div>
          {remarksContent}
        </div>
      )}
    </div>
  );
}

export function SectionSelector({ value, onChange, label = "Appraisal Section", isOptionDisabled = () => false }) {
  const shortLabels = {
    partA: "Part A",
    partB: "Part B",
    partC: "Part C",
    partD: "Part D",
    partE: "Part E",
    summary: "Summary",
  };
  const handleChange = (nextValue) => {
    onChange(nextValue);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  };

  return (
    <div aria-label={label} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {SECTION_OPTIONS.map((option) => {
        const active = value === option.value;
        const disabled = isOptionDisabled(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleChange(option.value)}
            disabled={disabled}
            style={{
              padding: "7px 18px",
              border: "none",
              borderRadius: 6,
              cursor: disabled ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 700,
              background: active ? "#4c1d95" : "#e2e8f0",
              color: active ? "#ddd6fe" : "#475569",
              opacity: disabled ? 0.55 : 1,
            }}
          >
            {shortLabels[option.value] || option.label}
          </button>
        );
      })}
    </div>
  );
}

export function WorkflowTracker({ declaration, reviews, profile }) {
  const chain = getReviewChain(profile);
  if (!declaration) {
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: "18px 24px",
          fontSize: 14,
          color: "#374151",
          boxShadow: "0 10px 28px rgba(17,24,39,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: "50%", background: "#eef2ff", color: "#4338ca", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900, flexShrink: 0, fontSize: 16 }}>i</span>
        <span>Submit the appraisal to see the approval route and live authority status here.</span>
      </div>
    );
  }
  const reviewList = reviewListFrom(reviews);
  const reviewed = new Map(reviewList.map((review) => [review.reviewer_role, review]));
  const next = chain.find((role) => !reviewed.has(role));
  const stateStyle = {
    Done: { emoji: "📤", bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd", chip: "#dbeafe" },
    Reviewed: { emoji: "✅", bg: "#ecfdf5", color: "#166534", border: "#86efac", chip: "#dcfce7" },
    Pending: { emoji: "⏳", bg: "#fffbeb", color: "#92400e", border: "#fcd34d", chip: "#fef3c7" },
    Waiting: { emoji: "🕒", bg: "#f8fafc", color: "#64748b", border: "#e2e8f0", chip: "#f1f5f9" },
  };
  return (
    <div className="appraisal-approval-tracker" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px 24px", boxShadow: "0 12px 34px rgba(17,24,39,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>Approval Status Tracker</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {next ? `Next: ${roleLabel(next)}` : "All approval stages are complete."}
          </div>
        </div>
        <StatusBadge status={next ? pendingStatusFor(next) : "VC Reviewed"} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${chain.length + 1}, minmax(0, 1fr))`, gap: 16, overflowX: "visible", paddingBottom: 4 }}>
        {[{ label: "Submitted", state: "Done", time: declaration.submitted_at }, ...chain.map((role) => {
          const review = reviewed.get(role);
          return { label: roleLabel(role), state: review ? "Reviewed" : next === role ? "Pending" : "Waiting", time: review?.reviewed_at };
        })].map((step, index, steps) => {
          const colors = stateStyle[step.state] || stateStyle.Waiting;
          const isLast = index === steps.length - 1;
          return (
            <div
              key={step.label}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 18,
                padding: "10px 12px",
                minHeight: 84,
                background: `linear-gradient(180deg, ${colors.bg} 0%, #ffffff 100%)`,
                boxShadow: "0 10px 24px rgba(15,23,42,0.07)",
                position: "relative",
                overflow: "visible",
              }}
            >
              {!isLast && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    right: -17,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    color: "#64748b",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 900,
                    zIndex: 3,
                    boxShadow: "0 6px 14px rgba(15,23,42,0.08)",
                  }}
                >
                  →
                </span>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, fontWeight: 900, color: colors.color, textTransform: "uppercase", letterSpacing: 0.5 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: colors.chip,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.65)",
                  }}
                >
                  {colors.emoji}
                </span>
                <span>{step.state}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, marginTop: 6, color: "#0f172a", lineHeight: 1.18 }}>{step.label}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, lineHeight: 1.25 }}>{step.time ? new Date(step.time).toLocaleString() : "No timestamp yet"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildCreativeSchoolSectionScores(person, reviewData, reviewerRole) {
  const payload = {};
  ALL_ARRAY_KEYS.forEach((key) => {
    const rows = Array.isArray(person[key]) ? person[key] : [];
    const reviewRows = Array.isArray(reviewData[key]) ? reviewData[key] : [];
    payload[key] = rows.map((row, index) => ({
      ...row,
      [reviewerRole]: key === "society" && societyRowLocked(row)
        ? "0"
        : key === "acr"
          ? (String(reviewRows[index]?.[reviewerRole] ?? row[reviewerRole] ?? "").trim() ? String(clampScore(reviewRows[index]?.[reviewerRole] ?? row[reviewerRole], SCORE_LIMITS.acrRow)) : "")
          : reviewRows[index]?.[reviewerRole] ?? row[reviewerRole] ?? "",
    }));
  });
  const innovRows = Array.isArray(person.innovRows) ? person.innovRows.map(withCreativeInnovativeLimits) : [];
  const reviewInnovRows = Array.isArray(reviewData.innovRows) ? reviewData.innovRows : [];
  const mergedInnovRows = innovRows.map((row, index) => ({
    ...row,
    [reviewerRole]: reviewerRole === "director"
      ? clampDirectorReviewScore("innovRows", row, reviewInnovRows[index]?.[reviewerRole] ?? row[reviewerRole] ?? "", CREATIVE_INNOVATIVE_SECTION_MAX)
      : clampReviewScore("innovRows", row, reviewInnovRows[index]?.[reviewerRole] ?? row[reviewerRole] ?? "", CREATIVE_INNOVATIVE_SECTION_MAX),
  }));
  const innovTotal = reviewSectionScore("innovRows", mergedInnovRows, CREATIVE_INNOVATIVE_SECTION_MAX, reviewerRole);
  payload.innovRows = mergedInnovRows;
  payload.innovativeTeaching = {
    [reviewerRole]: innovTotal ? String(innovTotal) : reviewData.innovativeTeaching?.[reviewerRole] ?? person[scoreKeyForInnov(reviewerRole)] ?? "",
  };
  return payload;
}

export function CreativeSchoolAuthorityReviewPanel({ person, reviewerRole, onBack, onSubmit, readOnly = false, showReport = true }) {
  const confirmRejection = useReviewFeedback();
  const [sectionView, setSectionView] = useState("partA");
  const [reviewData, setReviewData] = useState({});
  const [remarks, setRemarks] = useState(person?.[`${reviewerRole}Remarks`] || "");
  const [confirmed, setConfirmed] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const form = useMemo(() => mergeForm(emptyCreativeSchoolForm(), person || {}), [person]);
  const [docs, setDocs] = useState(form.docs || {});
  const subjectProfile = { school: person?.school || form.info?.school, department: person?.department, appraisal_role: person?.appraisalRole || person?.appraisal_role || person?.role };
  const visiblePreviousRoles = visiblePreviousReviewRoles(reviewerRole, subjectProfile);
  const workflowChain = getReviewChain(subjectProfile);
  const workflowPreviousRoles = workflowChain.includes(reviewerRole)
    ? workflowChain.slice(0, workflowChain.indexOf(reviewerRole))
    : [];
  const schoolDisplayName = creativeSchoolName(person, form);
  const finalisedByVc = isAppraisalFinalisedByVc(person);
  const [editingFinalised, setEditingFinalised] = useState(false);
  const finalisedVcReadOnly = reviewerRole === "vc" && finalisedByVc && !editingFinalised;
  const panelReadOnly = reviewerRole === "vc" ? finalisedVcReadOnly : (readOnly || finalisedByVc);
  const canReject = canReviewerRejectProfile(reviewerRole, person);
  const subjectEmail = person?.email || person?.faculty_email || person?.facultyEmail;
  const academicYear = person?.academicYear || person?.academic_year || person?.info?.ay || APP_INFO.DEFAULT_AY || "2026-2027";

  const reviewerForm = useMemo(() => {
    const merged = { ...form };
    ALL_ARRAY_KEYS.forEach((key) => {
      merged[key] = (form[key] || []).map((row, index) => ({
        ...row,
        [reviewerRole]: key === "society" && societyRowLocked(row)
          ? "0"
          : reviewerRole === "director"
            ? clampDirectorReviewScore(key, row, reviewData[key]?.[index]?.[reviewerRole] ?? row[reviewerRole] ?? "", SECTION_MAX_BY_KEY[key] || 0)
            : clampReviewScore(key, row, reviewData[key]?.[index]?.[reviewerRole] ?? row[reviewerRole] ?? "", SECTION_MAX_BY_KEY[key] || 0),
      }));
    });
    merged.innovRows = (form.innovRows || []).map((row, index) => ({
      ...withCreativeInnovativeLimits(row),
      [reviewerRole]: reviewerRole === "director"
        ? clampDirectorReviewScore("innovRows", withCreativeInnovativeLimits(row), reviewData.innovRows?.[index]?.[reviewerRole] ?? row[reviewerRole] ?? "", CREATIVE_INNOVATIVE_SECTION_MAX)
        : clampReviewScore("innovRows", withCreativeInnovativeLimits(row), reviewData.innovRows?.[index]?.[reviewerRole] ?? row[reviewerRole] ?? "", CREATIVE_INNOVATIVE_SECTION_MAX),
    }));
    const innovTotal = reviewSectionScore("innovRows", merged.innovRows, CREATIVE_INNOVATIVE_SECTION_MAX, reviewerRole);
    merged[scoreKeyForInnov(reviewerRole)] = innovTotal ? String(innovTotal) : reviewData.innovativeTeaching?.[reviewerRole] ?? form[scoreKeyForInnov(reviewerRole)] ?? "";
    return merged;
  }, [form, reviewData, reviewerRole]);
  const facultyTotals = calculateCreativeSchoolTotals(form, "score");
  const totals = calculateCreativeSchoolTotals(reviewerForm, reviewerRole);
  const reviewCompleted = panelReadOnly || isReviewerReviewComplete(person, reviewerRole);
  const savedReviewerTotalKeys = [`${reviewerRole}PartA`, `${reviewerRole}PartB`, `${reviewerRole}PartC`, `${reviewerRole}PartD`, `${reviewerRole}Total`];
  const hasSavedReviewerTotals = savedReviewerTotalKeys.some((key) => String(person?.[key] ?? "").trim() !== "");
  const reviewerSummaryTotals = panelReadOnly && hasSavedReviewerTotals ? {
    ...totals,
    partA: String(person?.[`${reviewerRole}PartA`] ?? "").trim() !== "" ? n(person?.[`${reviewerRole}PartA`]) : totals.partA,
    partB: String(person?.[`${reviewerRole}PartB`] ?? "").trim() !== "" ? n(person?.[`${reviewerRole}PartB`]) : totals.partB,
    partC: String(person?.[`${reviewerRole}PartC`] ?? "").trim() !== "" ? n(person?.[`${reviewerRole}PartC`]) : totals.partC,
    partE: String(person?.[`${reviewerRole}PartD`] ?? "").trim() !== "" ? n(person?.[`${reviewerRole}PartD`]) : totals.partE,
    total: String(person?.[`${reviewerRole}Total`] ?? "").trim() !== "" ? n(person?.[`${reviewerRole}Total`]) : totals.total,
  } : totals;
  const roleSummaryTotalsFor = (role) => {
    const prefix = role === "center_head" ? "hod" : role;
    const rawTotal = person?.[`${prefix}Total`];
    return {
      partA: n(person?.[`${prefix}PartA`]),
      partB: n(person?.[`${prefix}PartB`]),
      partC: n(person?.[`${prefix}PartC`]),
      // `${prefix}PartD` is the historical wire field, which has always meant Part E/ACR (reviewer-scored).
      partD: 0,
      partE: n(person?.[`${prefix}PartD`]),
      total: n(rawTotal),
      maxScores: totals.maxScores,
      hasTotal: rawTotal !== undefined && rawTotal !== null && String(rawTotal).trim() !== "",
    };
  };
  const subjectRole = person?.appraisalRole || person?.appraisal_role || person?.role || "faculty";
  const normalizedSubjectRole = String(subjectRole || "").trim().toLowerCase();
  const subjectSchoolKey = getSchoolKey(person?.school || form.info?.school || person?.info?.school || "");
  const facultyHasHodInChain = normalizedSubjectRole === "faculty" && workflowChain.includes("hod");
  const visibleSummaryRoles = reviewerRole === "vc" ? (() => {
    if (normalizedSubjectRole === "faculty") {
      const roles = [];
      if (visiblePreviousRoles.includes("center_head")) roles.push("center_head");
      else if (visiblePreviousRoles.includes("hod")) roles.push("hod");
      if (visiblePreviousRoles.includes("director")) roles.push("director");
      if (visiblePreviousRoles.includes("dean")) roles.push("dean");
      return roles;
    }
    if (normalizedSubjectRole === "hod") return ["director", "dean"].filter((role) => visiblePreviousRoles.includes(role));
    if (normalizedSubjectRole === "director") return visiblePreviousRoles.includes("dean") ? ["dean"] : [];
    return [];
  })() : [];
  const previousSummaryCards = visibleSummaryRoles.map((role) => {
    const prefix = role === "center_head" ? "hod" : role;
    const label = role === "center_head" ? "Center Head" : roleLabel(role);
    return {
      role,
      label,
      totals: roleSummaryTotalsFor(role),
      remarks: person?.[`${prefix}Remarks`],
    };
  });
  const authorityPreviousRoles = reviewerRole === "vc" ? [] : (() => {
    if (normalizedSubjectRole !== "faculty") return [];
    if (reviewerRole === "dean") {
      const roles = [];
      if (workflowPreviousRoles.includes("center_head")) roles.push("center_head");
      else if (workflowPreviousRoles.includes("hod")) roles.push("hod");
      if (workflowPreviousRoles.includes("director")) roles.push("director");
      return roles;
    }
    if (reviewerRole === "director") {
      if (visiblePreviousRoles.includes("center_head")) return ["center_head"];
      return visiblePreviousRoles.includes("hod") ? ["hod"] : [];
    }
    return [];
  })();
  const authorityPreviousSummaryCards = authorityPreviousRoles.map((role) => {
    const prefix = role === "center_head" ? "hod" : role;
    const label = role === "center_head" ? "Center Head" : roleLabel(role);
    return {
      role,
      label,
      totals: roleSummaryTotalsFor(role),
      remarks: person?.[`${prefix}Remarks`],
    };
  });
  const averageSourceTotals = previousSummaryCards
    .filter((item) => item.role !== subjectRole && item.totals.hasTotal)
    .map((item) => item.totals);
  const averageSummaryTotals = averageSourceTotals.length ? {
    partA: averageSourceTotals.reduce((sum, item) => sum + n(item.partA), 0) / averageSourceTotals.length,
    partB: averageSourceTotals.reduce((sum, item) => sum + n(item.partB), 0) / averageSourceTotals.length,
    partC: averageSourceTotals.reduce((sum, item) => sum + n(item.partC), 0) / averageSourceTotals.length,
    partD: averageSourceTotals.reduce((sum, item) => sum + n(item.partD), 0) / averageSourceTotals.length,
    total: averageSourceTotals.reduce((sum, item) => sum + n(item.total), 0) / averageSourceTotals.length,
    maxScores: totals.maxScores,
  } : { partA: 0, partB: 0, partC: 0, partD: 0, total: 0, maxScores: totals.maxScores };
  const partDReportRoles = Array.from(new Set([
    ...(reviewerRole === "vc" ? visiblePreviousRoles : authorityPreviousRoles),
    reviewerRole,
  ])).filter((role) => role && role !== "faculty" && role !== "score");
  const showAverageColumn = !(reviewerRole === "vc" && normalizedSubjectRole === "dean");
  const comparisonColumns = [
    { key: "self", label: "Self", totals: facultyTotals, maxScores: facultyTotals.maxScores },
    ...previousSummaryCards.map(({ role, label, totals: roleTotals }) => ({ key: role, label, totals: roleTotals, maxScores: roleTotals.maxScores })),
    ...(showAverageColumn ? [{ key: "average", label: "Average", totals: averageSummaryTotals, maxScores: averageSummaryTotals.maxScores }] : []),
    { key: "vc", label: "VC", totals: reviewerSummaryTotals, maxScores: totals.maxScores, final: true },
  ];
  const comparisonRows = [
    { key: "partA", label: "Part A - Teaching & Learning", icon: "A" },
    { key: "partB", label: "Part B - Research & Innovation", icon: "B" },
    { key: "partC", label: "Part C - Administrative Contribution", icon: "C" },
    { key: "partD", label: "Part D - Annual Confidential Report", icon: "D" },
    { key: "total", label: "Grand Total", icon: "Σ" },
  ];
  const comparisonColors = { partA: "#6d5dfc", partB: "#0f9f9a", partC: "#ef6f61", partD: "#f59e0b", total: "#059669" };
  const vcSummaryCards = [
    {
      key: "self",
      title: "Self Score",
      subtitle: `Self score for the ${schoolDisplayName} appraisal form.`,
      totals: facultyTotals,
      maxScores: facultyTotals.maxScores,
      accent: "#0ea5e9",
      compact: normalizedSubjectRole === "director" || normalizedSubjectRole === "dean" || normalizedSubjectRole === "faculty",
      extraContent: <SummaryOtherInfoField value={summaryOtherInfoValueFrom(person)} readOnly rows={(normalizedSubjectRole === "director" || normalizedSubjectRole === "dean" || normalizedSubjectRole === "faculty") ? 2 : 4} />,
    },
    ...previousSummaryCards.map(({ role, label, totals: roleTotals, remarks: roleRemarks }) => ({
      key: role,
      title: `${label} Score`,
      subtitle: `${label} score for the ${schoolDisplayName} appraisal form.`,
      totals: roleTotals,
      maxScores: roleTotals.maxScores,
      accent: role === "director" ? "#2563eb" : "#0f766e",
      compact: normalizedSubjectRole === "director" || normalizedSubjectRole === "dean" || normalizedSubjectRole === "faculty",
      remarksTitle: `${label} Remarks`,
      remarksContent: <div style={{ color: "#334155", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{String(roleRemarks || "").trim() || "-"}</div>,
    })),
    ...(showAverageColumn ? [{
      key: "average",
      title: "Average Score",
      subtitle: "Average across all reviewers.",
      totals: averageSummaryTotals,
      maxScores: averageSummaryTotals.maxScores,
      accent: "#f59e0b",
      partsLayout: normalizedSubjectRole === "dean" ? "vertical" : "horizontal",
      compact: normalizedSubjectRole === "dean",
      cardStyle: normalizedSubjectRole === "dean" ? undefined : { gridColumn: "1 / -1" },
    }] : []),
    {
      key: "vc",
      title: "Vice Chancellor Score",
      subtitle: "Vice Chancellor final score.",
      totals: reviewerSummaryTotals,
      maxScores: totals.maxScores,
      accent: "#7c3aed",
      isFinal: true,
      cardStyle: normalizedSubjectRole === "dean" ? undefined : { gridColumn: "1 / -1" },
      sideContent: (
        <div style={{ background: "#f5f3ff", border: "2px solid #c4b5fd", borderRadius: 10, padding: "14px 15px", display: "grid", gap: 9, alignContent: "start", boxShadow: "0 0 0 4px rgba(196,181,253,0.18), 0 14px 28px rgba(124,58,237,0.10)" }}>
          <div>
            <div style={{ color: "#6d28d9", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5 }}>Vice Chancellor Remarks</div>
            <div style={{ color: "#5b21b6", fontSize: 11, fontWeight: 700, marginTop: 3 }}>Enter your assessment remarks and confirm before submitting</div>
          </div>
          <textarea value={remarks} readOnly={panelReadOnly} onChange={(event) => setRemarks(event.target.value)} rows={7} placeholder="Enter your remarks here..." style={{ width: "100%", height: 235, minHeight: 235, boxSizing: "border-box", border: "1px solid #c4b5fd", borderRadius: 10, padding: "10px 11px", fontFamily: "inherit", fontSize: 12, color: "#334155", resize: "none", background: panelReadOnly ? "#f8fafc" : "#fff", outline: "none", lineHeight: 1.5 }} />
        </div>
      ),
    },
  ];
  const splitVcDirectorSummaryRows = reviewerRole === "vc" && normalizedSubjectRole === "director";
  const splitVcDeanSummaryRows = reviewerRole === "vc" && normalizedSubjectRole === "dean";
  const vcSplitReferenceCards = splitVcDirectorSummaryRows
    ? vcSummaryCards.filter((card) => ["self", "dean"].includes(card.key))
    : splitVcDeanSummaryRows
    ? vcSummaryCards.filter((card) => ["self", "vc"].includes(card.key))
    : [];
  const vcSplitRemainingCards = splitVcDirectorSummaryRows
    ? vcSummaryCards.filter((card) => !["self", "dean"].includes(card.key))
    : splitVcDeanSummaryRows
    ? vcSummaryCards.filter((card) => !["self", "vc"].includes(card.key))
    : vcSummaryCards;
  const reviewerAccent = reviewerRole === "dean" ? "#7c3aed" : reviewerRole === "director" ? "#2563eb" : "#0f766e";
  const deanRemarksSideContent = (
    <div style={{ background: "#eff6ff", border: "2px solid #93c5fd", borderRadius: 10, padding: "14px 15px", display: "flex", flexDirection: "column", minWidth: 0, boxShadow: "0 0 0 4px rgba(147,197,253,0.16), 0 14px 28px rgba(37,99,235,0.08)" }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Dean Remarks Required</div>
      <div style={{ color: "#1e40af", fontSize: 11, fontWeight: 700, marginBottom: 10 }}>Please enter remarks before submitting the review.</div>
      <textarea value={remarks} readOnly={panelReadOnly} onChange={(event) => setRemarks(event.target.value)} rows={7} placeholder="Enter your remarks here..." style={{ width: "100%", height: 235, minHeight: 235, boxSizing: "border-box", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 11px", fontFamily: "inherit", fontSize: 12, color: "#334155", resize: "none", background: "#fff", outline: "none", lineHeight: 1.5 }} />
    </div>
  );
  const directorRemarksSideContent = (
    <div style={{ background: "#eff6ff", border: "2px solid #93c5fd", borderRadius: 10, padding: "14px 15px", display: "flex", flexDirection: "column", minWidth: 0, boxShadow: "0 0 0 4px rgba(147,197,253,0.16), 0 14px 28px rgba(37,99,235,0.08)" }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Director Remarks Required</div>
      <div style={{ color: "#1e40af", fontSize: 11, fontWeight: 700, marginBottom: 10 }}>Please enter remarks before submitting the review.</div>
      <textarea value={remarks} readOnly={panelReadOnly} onChange={(event) => setRemarks(event.target.value)} rows={7} placeholder="Enter your remarks here..." style={{ width: "100%", height: 235, minHeight: 235, boxSizing: "border-box", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 11px", fontFamily: "inherit", fontSize: 12, color: "#334155", resize: "none", background: "#fff", outline: "none", lineHeight: 1.5 }} />
    </div>
  );
  const authoritySummaryCards = [
    ...(["faculty", "hod", "director", "dean", "center_head"].includes(normalizedSubjectRole) ? [{
      key: "self",
      title: "Self Score",
      subtitle: `Self score for the ${schoolDisplayName} appraisal form.`,
      totals: facultyTotals,
      maxScores: facultyTotals.maxScores,
      accent: "#0ea5e9",
      compact: ["director", "dean", "center_head"].includes(normalizedSubjectRole),
      extraContent: <SummaryOtherInfoField value={summaryOtherInfoValueFrom(person)} readOnly rows={["director", "dean", "center_head"].includes(normalizedSubjectRole) ? 2 : 4} />,
    }] : []),
    ...authorityPreviousSummaryCards.map(({ role, label, totals: roleTotals, remarks: roleRemarks }) => ({
      key: role,
      title: `${label} Score`,
      subtitle: `${label} score for the ${schoolDisplayName} appraisal form.`,
      totals: roleTotals,
      maxScores: roleTotals.maxScores,
      accent: role === "director" ? "#2563eb" : "#0f766e",
      remarksTitle: `${label} Remarks`,
      remarksContent: <div style={{ color: "#334155", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{String(roleRemarks || "").trim() || "-"}</div>,
    })),
    {
      key: reviewerRole,
      title: `${roleLabel(reviewerRole)} Score`,
      subtitle: `${roleLabel(reviewerRole)} score for the ${schoolDisplayName} appraisal form.`,
      totals: reviewerSummaryTotals,
      maxScores: totals.maxScores,
      accent: reviewerAccent,
      isFinal: true,
      ...(["dean", "director"].includes(reviewerRole)
        ? { sideContent: reviewerRole === "director" ? directorRemarksSideContent : deanRemarksSideContent }
        : {
            remarksTitle: `${roleLabel(reviewerRole)} Remarks`,
            remarksContent: <textarea value={remarks} readOnly={panelReadOnly} onChange={(event) => setRemarks(event.target.value)} rows={7} style={{ width: "100%", height: 235, minHeight: 235, border: "none", padding: 0, fontFamily: "inherit", fontSize: 12, color: "#334155", resize: "none", background: "transparent", outline: "none", lineHeight: 1.5 }} />,
          }),
    },
  ];
  const splitAuthorityDirectorFacultyRows = reviewerRole === "director" && normalizedSubjectRole === "faculty" && !facultyHasHodInChain;
  const splitAuthorityDeanFacultyRows = reviewerRole === "dean" && normalizedSubjectRole === "faculty" && !facultyHasHodInChain;
  const splitAuthorityDeanDirectorRows = reviewerRole === "dean" && normalizedSubjectRole === "director";
  const authorityDirectorFacultySelfCards = splitAuthorityDirectorFacultyRows
    ? authoritySummaryCards.filter((card) => card.key === "self")
    : [];
  const authorityDirectorFacultyReviewCards = splitAuthorityDirectorFacultyRows
    ? authoritySummaryCards.filter((card) => card.key === reviewerRole)
    : [];
  const authorityFacultyReferenceCards = splitAuthorityDeanFacultyRows
    ? authoritySummaryCards.filter((card) => card.key !== reviewerRole)
    : [];
  const authorityFacultyReviewCards = splitAuthorityDeanFacultyRows
    ? authoritySummaryCards.filter((card) => card.key === reviewerRole)
    : [];
  const authorityDirectorSelfCards = splitAuthorityDeanDirectorRows
    ? authoritySummaryCards.filter((card) => card.key === "self")
    : [];
  const authorityDirectorReviewCards = splitAuthorityDeanDirectorRows
    ? authoritySummaryCards.filter((card) => card.key === reviewerRole)
    : [];
  const useAuthorityRecordCard = reviewerRole === "hod" || reviewerRole === "dean" || reviewerRole === "director" || reviewerRole === "vc";
  const authorityRecordSchoolTrack = useAuthorityRecordCard ? getDeanTrack({ school: person?.school || form.info?.school, department: person?.department, designation: person?.designation }) : "";
  const authorityRecordSchoolGroupLabel = { engineering: "Engineering", non_engineering: "Non-Engineering", cisr: "CISR" }[authorityRecordSchoolTrack] || person?.school || form.info?.school || APP_INFO.UNIVERSITY_NAME;
  // The "Faculty appraisal record" summary table (below) mirrors the reviewer dashboards:
  // every non-VC reviewer's record shows only Self + their own score - never intermediate
  // reviewers' scores (e.g. the Dean's record must not surface HOD/Director scores). Only the
  // VC, who reviews last, sees the full prior-reviewer chain.
  const authorityRecordPreviousCards = reviewerRole === "vc" ? previousSummaryCards : [];
  const authorityRecordReviewerLabel = reviewerRole === "vc" ? "Vice Chancellor" : roleLabel(reviewerRole);
  const authorityRecordReviewerIcon = reviewerRole === "vc" ? "crown" : "briefcase";
  const authorityRecordScoreRows = useAuthorityRecordCard ? [
    { key: "self", label: "Self", icon: "user", values: facultyTotals, note: summaryOtherInfoValueFrom(person) },
    ...authorityRecordPreviousCards.map((card) => ({ key: card.role, label: card.label, icon: "briefcase", values: card.totals, note: card.remarks })),
    ...(reviewerRole === "vc" && showAverageColumn ? [{ key: "average", label: "Average", icon: "chart", values: averageSummaryTotals }] : []),
    { key: reviewerRole, label: authorityRecordReviewerLabel, icon: authorityRecordReviewerIcon, values: reviewerSummaryTotals, accent: true },
  ] : [];
  useEffect(() => {
    let active = true;
    if (panelReadOnly || !subjectEmail) return undefined;
    loadReviewerDraft({ subjectEmail, academicYear, reviewerRole })
      .then((draft) => {
        if (!active || !draft?.payload) return;
        setReviewData(draft.payload.section_scores || {});
        setRemarks(draft.payload.remarks ?? "");
        setDraftStatus(draft.updated_at ? `Last saved: ${new Date(draft.updated_at).toLocaleString()}` : "Draft loaded");
      })
      .catch((err) => {
        if (!active) return;
        console.error("Could not load reviewer draft:", err);
        setDraftStatus(err?.message || "Could not load draft.");
      });
    return () => { active = false; };
  }, [academicYear, panelReadOnly, reviewerRole, subjectEmail]);

  const buildReviewerDraftPayload = () => ({
    subjectEmail,
    academicYear,
    reviewerRole,
    partAScore: totals.partA,
    partBScore: totals.partB,
    partCScore: totals.partC,
    partDScore: totals.partD,
    totalScore: totals.total,
    remarks,
    sectionScores: buildCreativeSchoolSectionScores(form, reviewData, reviewerRole),
  });

  const manualDraftSaveRef = useRef(false);
  const handleSaveDraft = async () => {
    if (manualDraftSaveRef.current || panelReadOnly) return false;
    manualDraftSaveRef.current = true;
    try {
      setSavingDraft(true);
      setDraftStatus("Saving draft...");
      await confirmedDraftSave(() => saveReviewerDraft(buildReviewerDraftPayload()));
      setDraftStatus(`Draft saved: ${new Date().toLocaleString()}`);
      return true;
    } catch (err) {
      console.error("Could not save reviewer draft:", err);
      const message = draftSaveErrorMessage(err);
      setDraftStatus(message);
      alert(message);
      return false;
    } finally {
      manualDraftSaveRef.current = false;
      setSavingDraft(false);
    }
  };

  const autoSaveReadyRef = useRef(false);
  const autoSaveInFlightRef = useRef(false);
  const queuedAutoSaveRef = useRef(null);
  const lastAutoSavedFingerprintRef = useRef("");

  useEffect(() => {
    if (!autoSaveReadyRef.current) {
      autoSaveReadyRef.current = true;
      return undefined;
    }
    if (panelReadOnly || !subjectEmail || !academicYear || !reviewerRole) return undefined;

    // Build the snapshot + JSON.stringify only after the debounce fires, not synchronously
    // on every keystroke - keeps the main thread free while typing and scrolling. Behaviour
    // is otherwise unchanged: same debounce, same fingerprint dedupe, same payload.
    const buildSnapshot = () => {
      const payload = {
        subjectEmail,
        academicYear,
        reviewerRole,
        partAScore: totals.partA,
        partBScore: totals.partB,
        partCScore: totals.partC,
        partDScore: totals.partD,
        totalScore: totals.total,
        remarks,
        sectionScores: buildCreativeSchoolSectionScores(form, reviewData, reviewerRole),
      };
      return { fingerprint: JSON.stringify(payload), payload };
    };

    const runAutoSave = async (nextSnapshot) => {
      if (autoSaveInFlightRef.current) {
        queuedAutoSaveRef.current = nextSnapshot;
        return;
      }
      autoSaveInFlightRef.current = true;
      try {
        await saveReviewerDraft(nextSnapshot.payload);
        lastAutoSavedFingerprintRef.current = nextSnapshot.fingerprint;
      } catch (err) {
        console.warn("Auto-save failed:", err);
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
      const snapshot = buildSnapshot();
      if (snapshot.fingerprint === lastAutoSavedFingerprintRef.current) return;
      runAutoSave(snapshot);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [academicYear, form, panelReadOnly, remarks, reviewData, reviewerRole, subjectEmail, totals.partA, totals.partB, totals.partC, totals.partD, totals.total]);

  const handleSaveAndNext = async () => {
    if (!await handleSaveDraft()) return;
    const NEXT_SECTION_MAP = { partA: "partB", partB: "partC", partC: "partD", partD: "partE", partE: "summary" };
    const nextSection = NEXT_SECTION_MAP[sectionView];
    if (nextSection) {
      setSectionView(nextSection);
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    }
  };

  const generateReviewReport = () => {
    if (!reviewCompleted) return;
    const applicability = {};
    const rowSum = (key, max) => scoreSectionRows(key, reviewerForm[key] || [], max, "score", key === "research" ? { autoFillResearchScore: false } : undefined);
    const lecScore = scoreSectionRows("lectures", reviewerForm.lectures || [], 40, "score");
    const cfScore = scoreSectionRows("courseFile", reviewerForm.courseFile || [], 20, "score");
    const innovScore = clampScore(
      Array.isArray(reviewerForm.innovRows)
        ? reviewerForm.innovRows.reduce((t, r) => t + clampScore(r.score, r.max || CREATIVE_INNOVATIVE_ROW_MAX), 0)
        : innovativeTeachingScore(reviewerForm.innovDetails, reviewerForm.innovScore, CREATIVE_INNOVATIVE_SECTION_MAX),
      CREATIVE_INNOVATIVE_SECTION_MAX
    );
    const maxScores = getCreativeSchoolEffectiveMaxScores(reviewerForm);
    const partATotal = panelReadOnly && String(person?.[`${reviewerRole}PartA`] ?? "").trim() !== "" ? n(person?.[`${reviewerRole}PartA`]) : totals.partA;
    const partBTotal = panelReadOnly && String(person?.[`${reviewerRole}PartB`] ?? "").trim() !== "" ? n(person?.[`${reviewerRole}PartB`]) : totals.partB;
    const partCTotal = panelReadOnly && String(person?.[`${reviewerRole}PartC`] ?? "").trim() !== "" ? n(person?.[`${reviewerRole}PartC`]) : totals.partC;
    const partDTotal = panelReadOnly && String(person?.[`${reviewerRole}PartD`] ?? "").trim() !== "" ? n(person?.[`${reviewerRole}PartD`]) : totals.partD;
    const grandTotal = panelReadOnly && String(person?.[`${reviewerRole}Total`] ?? "").trim() !== "" ? n(person?.[`${reviewerRole}Total`]) : totals.total;
    const b8Score = clampScore(rowSum("fdps", 20) + rowSum("training", 20), 20);
    const isVcReport = reviewerRole === "vc";
    const vcSummaryValuesFor = (key) => ({
      score: facultyTotals[key],
      ...Object.fromEntries(previousSummaryCards.map((card) => [card.role, card.totals[key]])),
      vc: reviewerSummaryTotals[key],
    });
    const summaryHtml = isVcReport
      ? renderCombinedPartsSummary({
          academicYear: person?.academicYear || person?.academic_year || reviewerForm?.info?.ay || "",
          roles: [
            { key: "score", label: "Faculty (Self)" },
            ...previousSummaryCards.map((card) => ({ key: card.role, label: card.label })),
            { key: "vc", label: "VC" },
          ],
          parts: [
            { label: "Part A - Teaching Process & Academic Activities", max: maxScores.partA, values: vcSummaryValuesFor("partA") },
            { label: "Part B - Research & Academic Contributions", max: maxScores.partB, values: vcSummaryValuesFor("partB") },
            { label: "Part C - Administrative Role & Contribution", max: maxScores.partC, values: vcSummaryValuesFor("partC") },
            { label: "Part D - Leave & Attendance Management", max: maxScores.partD, values: { score: facultyTotals.partD } },
            { label: "Part E - Annual Confidential Report (ACR)", max: maxScores.partE, values: vcSummaryValuesFor("partE") },
          ],
          grandTotal: { max: maxScores.grand, values: vcSummaryValuesFor("total") },
          status: person?.status,
          note: "Part D (Leave & Attendance Management) shows faculty-submitted data only - Registrar/reviewer marks are not yet confirmed. Part E (ACR) is evaluated by the review chain and is never self-scored by faculty.",
        })
      : null;
    generateMediaCommReport({
      title: `${schoolDisplayName} Appraisal Report`,
      subtitle: `${roleLabel(reviewerRole)} review`,
      form: reviewerForm,
      docs,
      partASections: PART_A_SECTIONS,
      partBSections: getPartBSectionsForSchool(person, reviewerForm?.info?.school),
      partCSections: PART_C_SECTIONS,
      partDSections: PART_D_SECTIONS,
      partDScoreRoles: isVcReport ? ["score"] : partDReportRoles,
      ...(isVcReport
        ? {
            scoreRoles: ["score", ...partDReportRoles],
            partDTitle: "Leave & Attendance Management",
            partDIncludesSelfScore: true,
            partESections: PART_E_SECTIONS,
            partETitle: "Annual Confidential Report (ACR)",
            partEScoreRoles: partDReportRoles,
            summaryHtml,
          }
        : {}),
      roleLabel,
      totals: { partA: partATotal, partB: partBTotal, partC: partCTotal, partD: partDTotal, total: grandTotal },
      maxScores,
      generatedBy: sessionStorage.getItem("name") || roleLabel(reviewerRole),
      remarksSections: buildReviewRemarks({
        source: person,
        currentRole: reviewerRole,
        currentRemarks: remarks,
        roleLabels: { hod: visiblePreviousRoles.includes("center_head") ? "Center Head Remarks" : "HOD Remarks" },
      }),
      detailedSummaryRows: [
        { isHeader: true, label: "Part A - Teaching Process & Academic Activities" },
        ...summaryRow(applicability, "lectures", { id: "A(i)", label: "Lectures / Tutorials / Practicals", max: 40, score: lecScore }),
        ...summaryRow(applicability, "courseFile", { id: "A(ii)", label: "Course File", max: 20, score: cfScore }),
        { id: "A(iii)", label: "Innovative Teaching-Learning Methodologies", max: 20, score: innovScore },
        ...summaryRow(applicability, "projects", { id: "A(iv)", label: "Project Guidance", max: 20, score: rowSum("projects", 20) }),
        ...summaryRow(applicability, "quals", { id: "A(v)", label: "Qualification Enhancement", max: 10, score: rowSum("quals", 10) }),
        ...summaryRow(applicability, "feedback", { id: "A(vi)", label: "Students' Feedback", max: 10, score: feedbackSectionScore(reviewerForm.feedback || [], 10) }),
        ...summaryRow(applicability, "deptActs", { id: "A(vii)", label: "Departmental / School Activities", max: 20, score: rowSum("deptActs", 20) }),
        ...summaryRow(applicability, "uniActs", { id: "A(viii)", label: "University Level Activities", max: 30, score: rowSum("uniActs", 30) }),
        ...summaryRow(applicability, "society", { id: "A(ix)", label: "Contribution to Society", max: 10, score: rowSum("society", 10) }),
        ...summaryRow(applicability, "industry", { id: "A(x)", label: "Industry Connect", max: 5, score: rowSum("industry", 5) }),
        { isTotal: true, label: "Part A Total", max: maxScores.partA, score: partATotal },
        { isHeader: true, label: "Part B - Research & Academic Contributions" },
        ...summaryRow(applicability, "journals", { id: "B1(i)", label: "Published Papers in Journals", max: 80, score: rowSum("journals", 80) }),
        ...summaryRow(applicability, "books", { id: "B2", label: "Articles / Chapters in Books", max: 60, score: rowSum("books", 60) }),
        ...(isMediaCommSchool(person, reviewerForm?.info?.school) ? summaryRow(applicability, "popularWritings", { id: "B3", label: "Popular Writing — Newspaper & Magazine Articles", max: 40, score: rowSum("popularWritings", 40) }) : []),
        ...(isDesignArtsSchool(person, reviewerForm?.info?.school) ? summaryRow(applicability, "ipr", { id: "B3", label: "Patents, Copyrights, IP & Creative Product Development", max: 40, score: rowSum("ipr", 40) }) : []),
        ...summaryRow(applicability, "externalProjects", { id: "B4", label: "External Research / Consultancy Projects", max: 20, score: rowSum("externalProjects", 20) }),
        ...summaryRow(applicability, "research", { id: "B5", label: "Research Guidance - PhD", max: 20, score: rowSum("research", 20) }),
        ...summaryRow(applicability, "consultancy", { id: "B6", label: "Consultancy, Training & Creative Commissions", max: 30, score: rowSum("consultancy", 30) }),
        ...summaryRow(applicability, "confs", { id: "B7", label: "Conference / FDP / Training / Workshop Contributions as Resource Person", max: 20, score: rowSum("confs", 20) }),
        ...b8summaryRow(applicability, { id: "B8", label: "FDP / Self Development + Industrial Training", max: 20, score: b8Score }),
        ...summaryRow(applicability, "awards", { id: "B9", label: "Research Awards", max: 20, score: rowSum("awards", 20) }),
        ...summaryRow(applicability, "innovation", { id: "B10", label: "Innovation, Start-ups & Technology Transfer", max: 20, score: rowSum("innovation", 20) }),
        ...summaryRow(applicability, "ict", { id: "B11", label: "ICT Content, MOOCs & E-Learning", max: 40, score: rowSum("ict", 40) }),
        ...summaryRow(applicability, "exhibitions", { id: "B12", label: "Exhibitions — Photography, Design & Applied Arts, Documentaries, Films & Audio-Visual Productions", max: 30, score: rowSum("exhibitions", 30) }),
        { isTotal: true, label: "Part B Total", max: maxScores.partB, score: partBTotal },
        { isHeader: true, label: "Part C - Administrative Role & Contribution" },
        ...summaryRow(applicability, "uniActs", { id: "C1", label: "Administration at University Level", max: 50, score: rowSum("uniActs", 50) }),
        ...summaryRow(applicability, "deptActs", { id: "C2", label: "School / Department Level Activities", max: 30, score: rowSum("deptActs", 30) }),
        ...summaryRow(applicability, "events", { id: "C3", label: "Event Organisation", max: 20, score: rowSum("events", 20) }),
        ...summaryRow(applicability, "society", { id: "C4", label: "Contribution to Society", max: 10, score: rowSum("society", 10) }),
        ...summaryRow(applicability, "industry", { id: "C5", label: "Industry Connect", max: 10, score: rowSum("industry", 10) }),
        ...summaryRow(applicability, "alumni", { id: "C6", label: "Alumni Engagement", max: 10, score: rowSum("alumni", 10) }),
        ...summaryRow(applicability, "placements", { id: "C7", label: "Placement & Internship Support", max: 20, score: rowSum("placements", 20) }),
        { isTotal: true, label: "Part C Total", max: maxScores.partC, score: totals.partC },
        { isHeader: true, label: "Part D - Annual Confidential Report (ACR)" },
        ...summaryRow(applicability, "acr", { id: "D1", label: "Annual Confidential Report", max: 50, score: partDTotal }),
        { isTotal: true, label: "Part D Total", max: maxScores.partD, score: partDTotal },
        { isGrandTotal: true, label: "Grand Total", max: maxScores.grand, score: grandTotal },
      ],
    });
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <ReviewerReportHeader reviewerLabel={titleCase(reviewerRole)} readOnly={panelReadOnly} onBack={onBack}>
        <StatusBadge status={person?.status} />
      </ReviewerReportHeader>
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <SectionSelector value={sectionView} onChange={setSectionView} label="Review Section" />
      </div>
      {sectionView === "partA" && <FacultyInfoSection info={form.info} />}
      {finalisedVcReadOnly && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => { setEditingFinalised(true); setConfirmed(false); }} style={smallButton("#4c1d95")}>
            Edit Form
          </button>
        </div>
      )}
      {(sectionView === "partA" || sectionView === "partB" || sectionView === "partC" || sectionView === "partD" || sectionView === "partE") && (
        <CreativeSchoolForm
          form={form}
          setForm={() => { }}
          docs={docs}
          setDocs={setDocs}
          mode="review"
          locked={panelReadOnly}
          reviewerRole={reviewerRole}
          reviewData={reviewData}
          setReviewData={setReviewData}
          previousRoles={visiblePreviousRoles}
          sectionView={sectionView}
        />
      )}
      {(sectionView === "partA" || sectionView === "partB" || sectionView === "partC" || sectionView === "partD" || sectionView === "partE") && !panelReadOnly && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, margin: "12px 0 14px", flexWrap: "wrap" }}>
          <span style={{ color: "#64748b", fontSize: 11, fontWeight: 700 }}>{draftStatus}</span>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            style={{ ...smallButton(savingDraft ? "#94a3b8" : "#ffffff"), color: savingDraft ? "#94a3b8" : "#2563eb", border: "1.5px solid #2563eb" }}
          >
            {savingDraft ? "Saving..." : "Save as Draft"}
          </button>
          <button
            type="button"
            onClick={handleSaveAndNext}
            disabled={savingDraft}
            style={smallButton(savingDraft ? "#94a3b8" : "#2563eb")}
          >
            {savingDraft ? "Saving..." : "Save & Next"}
          </button>
        </div>
      )}
      {sectionView === "summary" && useAuthorityRecordCard && (
        <div className="far-wrap" style={{ width: "100%" }}>
          <div className="far-card" style={{ width: "100%", boxSizing: "border-box", background: FACULTY_RECORD_THEME.card, border: `1px solid ${FACULTY_RECORD_THEME.borderStrong}`, borderRadius: 16, padding: "22px 24px", display: "grid", gap: 18, boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
            <FacultyRecordHeader
              title="Faculty appraisal record"
              subtitle={`${APP_INFO.UNIVERSITY_NAME} · ${authorityRecordSchoolGroupLabel} · AY ${academicYear}`}
              referenceNumber={person?.employeeId}
            />
            <ScoreTable
              columns={[
                { key: "partA", label: "Part A", max: PART_A_MAX },
                { key: "partB", label: "Part B", max: PART_B_MAX },
                { key: "partC", label: "Part C", max: PART_C_MAX },
                { key: "partD", label: "Part D", max: PART_D_MAX },
                { key: "partE", label: "Part E", max: PART_E_MAX },
                { key: "total", label: "Total", max: GRAND_MAX },
              ]}
              rows={authorityRecordScoreRows}
            />
            <VCFinalRemarks
              title={`${authorityRecordReviewerLabel} final remarks`}
              icon={authorityRecordReviewerIcon}
              value={remarks}
              onChange={setRemarks}
              readOnly={panelReadOnly}
              description="This statement is entered against the official appraisal record before final submission."
            />
            {!panelReadOnly && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: 9, color: FACULTY_RECORD_THEME.textMuted, fontSize: 11, lineHeight: 1.5, cursor: "pointer" }}>
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: 2, accentColor: FACULTY_RECORD_THEME.accent, flexShrink: 0 }} />
                <span>{VERIFY_TEXT}</span>
              </label>
            )}
            {!panelReadOnly && (
              <FinalSubmitButton
                disabled={!confirmed || !remarks.trim()}
                onClick={() => onSubmit(person.id, { partA: totals.partA, partB: totals.partB, partC: totals.partC, partD: totals.partE, total: totals.total }, remarks, buildCreativeSchoolSectionScores(form, reviewData, reviewerRole), confirmed)}
              >
                Confirm and submit final score
              </FinalSubmitButton>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: `1px solid ${FACULTY_RECORD_THEME.border}`, paddingTop: 14 }}>
              <span style={{ color: FACULTY_RECORD_THEME.textFaint, fontSize: 10.5, fontStyle: "italic" }}>{draftStatus}</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginLeft: "auto" }}>
                <button onClick={onBack} style={{ padding: "8px 14px", background: "transparent", color: FACULTY_RECORD_THEME.textMuted, border: `1px solid ${FACULTY_RECORD_THEME.border}`, borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 11.5, fontFamily: "inherit" }}>Close</button>
                {showReport && (
                  <button onClick={generateReviewReport} disabled={!reviewCompleted} style={{ padding: "8px 14px", background: "transparent", color: reviewCompleted ? FACULTY_RECORD_THEME.accentSoft : FACULTY_RECORD_THEME.textFaint, border: `1px solid ${reviewCompleted ? "rgba(124,58,237,0.35)" : FACULTY_RECORD_THEME.border}`, borderRadius: 8, cursor: reviewCompleted ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 11.5, fontFamily: "inherit" }}>
                    Generate Report
                  </button>
                )}
                {!panelReadOnly && (
                  <>
                    <button onClick={handleSaveDraft} disabled={savingDraft} style={{ padding: "8px 14px", background: "transparent", color: savingDraft ? FACULTY_RECORD_THEME.textFaint : "#2563eb", border: `1px solid ${savingDraft ? FACULTY_RECORD_THEME.border : "#bfdbfe"}`, borderRadius: 8, cursor: savingDraft ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 11.5, fontFamily: "inherit" }}>
                      {savingDraft ? "Saving..." : "Save Draft"}
                    </button>
                    {canReject && (
                      <button
                        onClick={async () => {
                          if (await confirmRejection("Reject this appraisal and send it back to the user for editing?", "reject")) {
                            onSubmit(person.id, { partA: totals.partA, partB: totals.partB, partC: totals.partC, partD: totals.partE, total: totals.total }, remarks, buildCreativeSchoolSectionScores(form, reviewData, reviewerRole), confirmed, "rejected");
                          }
                        }}
                        disabled={!confirmed || !remarks.trim()}
                        style={{ padding: "8px 14px", background: "transparent", color: (confirmed && remarks.trim()) ? "#dc2626" : FACULTY_RECORD_THEME.textFaint, border: `1px solid ${(confirmed && remarks.trim()) ? "#fecaca" : FACULTY_RECORD_THEME.border}`, borderRadius: 8, cursor: (confirmed && remarks.trim()) ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 11.5, fontFamily: "inherit" }}
                      >
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
      {sectionView === "summary" && !useAuthorityRecordCard && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, display: "grid", gap: 10 }}>
          {reviewerRole === "vc" ? (
            <>
              {(splitVcDirectorSummaryRows || splitVcDeanSummaryRows) ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: splitVcDeanSummaryRows ? "minmax(280px, 0.68fr) minmax(640px, 1.32fr)" : "repeat(2, minmax(0, 1fr))", gap: 16, width: "100%" }}>
                    {vcSplitReferenceCards.map((card) => (
                      <ScoreCard key={card.key} {...card} cardStyle={{ ...(card.cardStyle || {}), width: "100%", minWidth: 0 }} />
                    ))}
                  </div>
                  <div style={{ display: "grid", gap: 16, width: "100%" }}>
                    {vcSplitRemainingCards.map((card) => (
                      <ScoreCard key={card.key} {...card} />
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 16 }}>
                  {vcSummaryCards.map((card) => (
                    <ScoreCard key={card.key} {...card} />
                  ))}
                </div>
              )}
            </>
          ) : splitAuthorityDirectorFacultyRows ? (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 0.72fr) minmax(640px, 1.28fr)", gap: 16, width: "100%", alignItems: "stretch" }}>
              {authorityDirectorFacultySelfCards.map((card) => (
                <ScoreCard key={card.key} {...card} cardStyle={{ ...(card.cardStyle || {}), width: "100%", minWidth: 0 }} />
              ))}
              {authorityDirectorFacultyReviewCards.map((card) => (
                <ScoreCard key={card.key} {...card} cardStyle={{ ...(card.cardStyle || {}), width: "100%", minWidth: 0 }} />
              ))}
            </div>
          ) : splitAuthorityDeanFacultyRows ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, width: "100%", alignItems: "stretch" }}>
                {authorityFacultyReferenceCards.map((card) => (
                  <ScoreCard key={card.key} {...card} cardStyle={{ ...(card.cardStyle || {}), width: "100%", minWidth: 0 }} />
                ))}
              </div>
              <div style={{ display: "grid", gap: 16, width: "100%" }}>
                {authorityFacultyReviewCards.map((card) => (
                  <ScoreCard key={card.key} {...card} />
                ))}
              </div>
            </>
          ) : splitAuthorityDeanDirectorRows ? (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 0.72fr) minmax(640px, 1.28fr)", gap: 16, width: "100%", alignItems: "stretch" }}>
              {authorityDirectorSelfCards.map((card) => (
                <ScoreCard key={card.key} {...card} cardStyle={{ ...(card.cardStyle || {}), width: "100%", minWidth: 0 }} />
              ))}
              {authorityDirectorReviewCards.map((card) => (
                <ScoreCard key={card.key} {...card} cardStyle={{ ...(card.cardStyle || {}), width: "100%", minWidth: 0 }} />
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 16 }}>
              {authoritySummaryCards.map((card) => (
                <ScoreCard key={card.key} {...card} />
              ))}
            </div>
          )}
          {!panelReadOnly && <AccuracyCheckbox checked={confirmed} onChange={setConfirmed} />}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ color: "#64748b", fontSize: 11, fontWeight: 700 }}>{draftStatus}</span>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginLeft: "auto" }}>
              <button onClick={onBack} style={smallButton("#64748b")}>Close</button>
              {showReport && (
                <button onClick={generateReviewReport} disabled={!reviewCompleted} style={smallButton(reviewCompleted ? "#4c1d95" : "#94a3b8")}>
                  Generate Report
                </button>
              )}
              {!panelReadOnly && (
                <>
                  <button
                    onClick={handleSaveDraft}
                    disabled={savingDraft}
                    style={smallButton(savingDraft ? "#94a3b8" : "#2563eb")}
                  >
                    {savingDraft ? "Saving..." : "Save Draft"}
                  </button>
                  {canReject && (
                    <button
                      onClick={async () => {
                        if (await confirmRejection("Reject this appraisal and send it back to the user for editing?", "reject")) {
                          onSubmit(person.id, { partA: totals.partA, partB: totals.partB, partC: totals.partC, partD: totals.partE, total: totals.total }, remarks, buildCreativeSchoolSectionScores(form, reviewData, reviewerRole), confirmed, "rejected");
                        }
                      }}
                      disabled={!confirmed || !remarks.trim()}
                      style={smallButton((confirmed && remarks.trim()) ? "#dc2626" : "#94a3b8")}
                    >
                      Reject Form
                    </button>
                  )}
                  <button
                    onClick={() => onSubmit(person.id, { partA: totals.partA, partB: totals.partB, partC: totals.partC, partD: totals.partE, total: totals.total }, remarks, buildCreativeSchoolSectionScores(form, reviewData, reviewerRole), confirmed)}
                    disabled={!confirmed || !remarks.trim()}
                    style={smallButton((confirmed && remarks.trim()) ? "#059669" : "#94a3b8")}
                  >
                    {reviewerRole === "vc" && finalisedByVc ? "Edit & Resubmit" : `Submit ${roleLabel(reviewerRole)} Review`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const DesignArtsAuthorityReviewPanel = CreativeSchoolAuthorityReviewPanel;
export const MediaCommAuthorityReviewPanel = CreativeSchoolAuthorityReviewPanel;
