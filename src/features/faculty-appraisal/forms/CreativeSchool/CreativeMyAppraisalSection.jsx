/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { scopedAppraisalSetters } from "../../../../utils/scopedAppraisalSetters";
import { useNavigate } from "react-router-dom";
import { getActiveAcademicYear, getSessionItem, setActiveAcademicYear } from "../../../../auth/session";
import { api } from "../../../../services/api";
import {
  appraisalWindowErrorMessage,
  appraisalWindowMessage,
  canEditSelfAppraisal,
  canSaveDraft,
  canSubmitAppraisal,
  getAppraisalWindowStatus,
} from "../../../../services/appraisalWindowService";
import { loadClosedAppraisal } from "../../../../services/appraisalPersistence";
import { pendingStatusFor, profileFromsessionStorage, getReviewChain, roleLabel, workflowValidationError, hasActiveRejection, reviewListFrom } from "../../../../utils/hierarchy";
import { PreviousYearReportViewer } from "../../../previousYearReport";
import { isLegacyTwoPartAcademicYear } from "../standard/legacyPreviousYearReportUtils";
import {
  AppraisalHeaderImage,
  AppraisalSummaryActionButton,
  AppraisalSummaryTable,
  InlineSvgIcon,
  RejectionNotice,
  SectionSaveFooter,
  SUMMARY_ATTACHMENTS_DECLARATION,
  SUMMARY_ICONS,
  SummaryOtherInfoField,
  ViewDocsCell,
} from "../../components";
import { loadAppraisalDocuments, loadSavedAppraisal, saveAppraisalDraftSection, submitAppraisal } from "../../services";
import { WorkflowStatusTracker } from "../../shared";
import { clampScore, feedbackSectionScore, generateMediaCommReport, innovativeTeachingScore, migrateLegacyRowFields, scoreSectionRows } from "../../utils";
import { previousYearFormTypeForSchool } from "../../../../constants/formRouting";
import { ALL_ARRAY_KEYS } from "./arrayKeys";
import { creativeReloadData } from './creativeReloadData';
import { assertDraftOnline, confirmedDraftSave, draftSaveErrorMessage } from '../../../../utils/confirmedDraftSave';
import {
  ACCENT,
  AccuracyCheckbox,
  CreativeSchoolForm,
  PART_A_SECTIONS,
  PART_C_SECTIONS,
  PART_D_SECTIONS,
  SECTION_OPTIONS,
  SummaryBox,
  calculateMediaTotals,
  emptyMediaForm,
  getMediaEffectiveMaxScores,
  getPartBSectionsForSchool,
  mergeForm,
  normalizeScoresForSubmit,
  summaryRow,
  titleCase,
  validateMediaBeforeSubmit,
} from "./CreativeSchoolAppraisalForm";
import { getSchoolByValue, getSchoolKey } from "../../../../constants/universityHierarchy";
import OverallProgress from "../../components/OverallProgress";
import SubmissionConfirmDialog from "../../components/SubmissionConfirmDialog";

const normalizeAcademicYearLabel = (value) => {
  const label = String(value || "").trim();
  const shortMatch = label.match(/^(\d{2})-(\d{2})$/);
  if (shortMatch) return `20${shortMatch[1]}-20${shortMatch[2]}`;
  return label;
};

const normalizeAcademicYearCycles = (cyclesData) => {
  const normalizeCycle = (cycle) => {
    if (!cycle) return null;
    if (typeof cycle === "string") return { academic_year: normalizeAcademicYearLabel(cycle), is_open: false };
    const academicYear = normalizeAcademicYearLabel(cycle.academic_year || cycle.academicYear || cycle.year || cycle.year_label || "");
    if (!academicYear) return null;
    return {
      academic_year: academicYear,
      is_open: cycle.is_open ?? cycle.isOpen ?? cycle.active ?? cycle.open ?? false,
    };
  };

  const source = Array.isArray(cyclesData) ? cyclesData : cyclesData?.cycles || cyclesData?.data || [];
  const list = source.map(normalizeCycle).filter(Boolean);
  if (!list.length) list.push({ academic_year: getActiveAcademicYear() || "2026-2027", is_open: true });
  return list.sort((a, b) => b.academic_year.localeCompare(a.academic_year));
};

const storedAcademicYearCycles = () =>
  getSessionItem("availableCyclesSource") === "backend"
    ? JSON.parse(getSessionItem("availableCycles") || "[]")
    : [];

function CreativeReportButton({ onClick }) {
  return (
    <AppraisalSummaryActionButton onClick={onClick}>
      Generate Report
    </AppraisalSummaryActionButton>
  );
}

export default function CreativeMyAppraisalSection({
  sectionTab = "partA",
  onSectionTabChange,
  defaultAcademicYear,
  defaultDesignation = "",
}) {
  const navigate = useNavigate();
  const profile = profileFromsessionStorage();
  const userEmail = profile.email || "";
  const role = profile.appraisal_role || "faculty";
  const initialSchool = profile.school || getSessionItem("schoolName") || "";
  const initialSchoolObj = getSchoolByValue(initialSchool);
  const initialSchoolLabel = initialSchoolObj?.label || initialSchool || "School";
  const [form, setForm] = useState(() => {
    const base = emptyMediaForm(initialSchoolLabel);
    return {
      ...base,
      info: {
        ...base.info,
        ay: defaultAcademicYear || getActiveAcademicYear() || base.info.ay,
        desig: defaultDesignation || base.info.desig,
      },
    };
  });
  const [docs, setDocs] = useState({});
  const [sectionSaveStatus, setSectionSaveStatus] = useState({ partA: false, partB: false, partC: false, partD: false, partE: false });
  const [savingSection, setSavingSection] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitDialogState, setSubmitDialogState] = useState(null);
  const [submissionError, setSubmissionError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [attachmentsConfirmed, setAttachmentsConfirmed] = useState(false);
  const [declaration, setDeclaration] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [availableCycles, setAvailableCycles] = useState(() => normalizeAcademicYearCycles(storedAcademicYearCycles()));
  const [previousYearResponse, setPreviousYearResponse] = useState(null);
  const [appraisalWindowStatus, setAppraisalWindowStatus] = useState(null);
  const [appraisalWindowError, setAppraisalWindowError] = useState("");
  const [loadingYearData, setLoadingYearData] = useState(false);
  const [loadedAcademicYear, setLoadedAcademicYear] = useState(null);
  const [yearLoadError, setYearLoadError] = useState("");
  const yearLoadRequestRef = useRef(0);

  const academicYear = form.info?.ay || defaultAcademicYear || getActiveAcademicYear();
  const schoolValue = form.info?.school || initialSchoolLabel;
  const school = getSchoolByValue(schoolValue);
  const schoolCode = school?.code || getSchoolKey(schoolValue) || "School";
  const schoolName = school?.name || schoolValue;
  const totals = calculateMediaTotals(form, "score");
  const progressMaxScores = totals.maxScores || getMediaEffectiveMaxScores(form, { self: true });
  const effectiveGrandMax = progressMaxScores.grand || 1;
  const overallProgress = Math.min(100, Math.round((Number(totals.total || 0) / effectiveGrandMax) * 100));
  const partWiseProgressRows = [
    ["Part A", totals.partA || 0, progressMaxScores.partA || 0],
    ["Part B", totals.partB || 0, progressMaxScores.partB || 0],
    ["Part C", totals.partC || 0, progressMaxScores.partC || 0],
    (progressMaxScores.partD || 0) > 0 && ["Part D", totals.partD || 0, progressMaxScores.partD || 0],
    (progressMaxScores.partE || 0) > 0 && ["Part E", totals.partE || 0, progressMaxScores.partE || 0],
  ].filter(Boolean);
  const isLegacyTwoPartYear = isLegacyTwoPartAcademicYear(academicYear);
  const selectedCycle = availableCycles.find((cycle) => cycle.academic_year === academicYear);
  const isSelectedCycleClosed = selectedCycle ? !selectedCycle.is_open : false;
  const isSelectedCycleOpen = selectedCycle ? Boolean(selectedCycle.is_open) : false;
  const isLatestCycle = (availableCycles[0]?.academic_year || academicYear) === academicYear;
  const workflowRejected = hasActiveRejection(declaration, reviews);
  const partDLocked = !isLegacyTwoPartYear && workflowRejected;
  const appraisalWindowLocked = !isSelectedCycleOpen && !canEditSelfAppraisal(appraisalWindowStatus, { declaration });
  const locked = loadingYearData || loadedAcademicYear !== academicYear || appraisalWindowLocked || isSelectedCycleClosed || (Boolean(declaration) && !workflowRejected);
  const lockMessage = isSelectedCycleOpen || isSelectedCycleClosed ? "" : appraisalWindowError || (appraisalWindowLocked ? appraisalWindowMessage(appraisalWindowStatus, academicYear) : "");

  const setters = useMemo(() => Object.fromEntries([
    ["setInfo", (value) => setForm((prev) => ({ ...prev, info: { ...prev.info, ...(typeof value === "function" ? value(prev.info) : value), ay: prev.info.ay } }))],
    ...ALL_ARRAY_KEYS.map((key) => [`set${titleCase(key)}`, (value) => setForm((prev) => ({
      ...prev,
      [key]: key === "events"
        ? migrateLegacyRowFields(value, [["fromDate", "date"], ["toDate", "date"]])
        : value,
    }))]),
    ["setDocs", setDocs],
    ["setSummaryOtherInfo", (value) => setForm((prev) => ({ ...prev, summaryOtherInfo: value }))],
    ["setSectionSaveStatus", (value) => setSectionSaveStatus((prev) => ({ ...prev, ...(value || {}) }))],
  ]), [setDocs, setForm, setSectionSaveStatus]);

  useEffect(() => {
    const syncAvailableCycles = () => setAvailableCycles(normalizeAcademicYearCycles(storedAcademicYearCycles()));
    syncAvailableCycles();
    window.addEventListener("academicYearChanged", syncAvailableCycles);
    return () => window.removeEventListener("academicYearChanged", syncAvailableCycles);
  }, []);

  useEffect(() => {
    if (isLegacyTwoPartYear && !["partA", "partB"].includes(sectionTab)) {
      onSectionTabChange?.("partA");
    }
  }, [isLegacyTwoPartYear, onSectionTabChange, sectionTab]);

  useEffect(() => {
    let active = true;
    setAppraisalWindowStatus(null);
    setAppraisalWindowError("");
    if (!academicYear) return undefined;
    getAppraisalWindowStatus({ academicYear })
      .then((status) => {
        if (active) setAppraisalWindowStatus(status);
      })
      .catch((err) => {
        if (active) setAppraisalWindowError(appraisalWindowErrorMessage(err));
      });
    return () => { active = false; };
  }, [academicYear]);

  useEffect(() => {
    if (!userEmail || !academicYear) return;
    const requestId = ++yearLoadRequestRef.current;
    let cancelled = false;
    const isCurrentLoad = () => !cancelled && yearLoadRequestRef.current === requestId;
    const scopedSetters = scopedAppraisalSetters(setters, isCurrentLoad);
    setLoadedAcademicYear(null);
    setYearLoadError("");
    setForm((prev) => ({ ...emptyMediaForm(schoolValue), info: { ...prev.info, ay: academicYear } }));
    setDeclaration(null);
    setReviews([]);
    setSectionSaveStatus({ partA: false, partB: false, partC: false, partD: false, partE: false });
    setConfirmed(false);
    setAttachmentsConfirmed(false);
    setDocs({});
    setPreviousYearResponse(null);
    setLoadingYearData(true);
    const loadAll = async () => {
      try {
        const statusData = await api.get("/appraisal/status", { params: { academic_year: academicYear } });
        if (!isCurrentLoad()) return;
        const declarationRow = statusData?.declaration || null;
        const loadedReviews = reviewListFrom(statusData?.reviews);
        setDeclaration(declarationRow);
        setReviews(loadedReviews);
        const preferSubmitted = Boolean(declarationRow) && hasActiveRejection(declarationRow, loadedReviews);
        const loader = isLegacyTwoPartYear
          ? loadClosedAppraisal
          : (isSelectedCycleClosed ? loadClosedAppraisal : loadSavedAppraisal);
        const [loadedAppraisal] = await Promise.all([
          loader({ facultyEmail: userEmail, academicYear, setters: scopedSetters, preferSubmitted }),
          loadAppraisalDocuments({ facultyEmail: userEmail, academicYear, setDocs: scopedSetters.setDocs }),
        ]);
        if (!isCurrentLoad()) return;
        if (loadedAppraisal?.form || loadedAppraisal) {
          const loadedForm = loadedAppraisal?.payload?.form || loadedAppraisal?.form;
          if (loadedForm) {
            setForm((normalizedState) => {
              const incoming = creativeReloadData(loadedForm, normalizedState, ALL_ARRAY_KEYS);
              const merged = mergeForm(emptyMediaForm(incoming.info?.school || schoolValue), incoming);
              return { ...merged, info: { ...merged.info, ay: academicYear } };
            });
          }
        }
        setPreviousYearResponse(loadedAppraisal || null);
        setLoadedAcademicYear(academicYear);
      } catch (err) {
        if (isCurrentLoad()) setYearLoadError("Unable to load this academic year's appraisal. Please reload before editing.");
        console.error(`Could not load ${schoolCode} appraisal:`, err);
      } finally {
        if (isCurrentLoad()) setLoadingYearData(false);
      }
    };
    loadAll().catch((err) => console.error(`Could not load ${schoolCode} appraisal:`, err));
    return () => { cancelled = true; };
  }, [academicYear, isLegacyTwoPartYear, isSelectedCycleClosed, schoolCode, schoolValue, setters, userEmail]);

  const handleAcademicYearChange = (newAy) => {
    if (newAy === academicYear) return;
    yearLoadRequestRef.current += 1;
    setLoadingYearData(true);
    setForm((prev) => ({ ...prev, info: { ...prev.info, ay: newAy } }));
    setActiveAcademicYear(newAy);
    window.dispatchEvent(new CustomEvent("academicYearChanged", { detail: { academicYear: newAy } }));
  };

  const handleSectionChange = (section) => {
    onSectionTabChange?.(section);
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  };

  const handleSaveSelfSection = async (section, navigateNext = true) => {
    if (savingSection) return;
    try { assertDraftOnline(); } catch (error) { alert(draftSaveErrorMessage(error)); return; }
    if (section === "partD" && partDLocked) return;
    if (locked) return;
    if (!userEmail) {
      alert("Please login again before saving. Your session email was not found.");
      navigate("/login", { replace: true });
      return;
    }
    if (!isSelectedCycleOpen) {
      try {
        const latestWindowStatus = await getAppraisalWindowStatus({ academicYear });
        setAppraisalWindowStatus(latestWindowStatus);
        setAppraisalWindowError("");
        if (!canSaveDraft(latestWindowStatus)) {
          alert("Draft saving is disabled because appraisal submission is closed.");
          return;
        }
      } catch (err) {
        const message = appraisalWindowErrorMessage(err);
        setAppraisalWindowError(message);
        alert(message);
        return;
      }
    }
    const nextStatus = { ...sectionSaveStatus, [section]: true };
    setSavingSection(section);
    try {
      await confirmedDraftSave(() => saveAppraisalDraftSection({
        facultyEmail: userEmail,
        academicYear,
        form: { ...form, info: { ...form.info, school: schoolValue }, sectionSaveStatus: nextStatus },
        docs,
        totals: {
          partATotal: totals.partA,
          partBTotal: totals.partB,
          partCTotal: totals.partC,
          partDTotal: totals.partD,
          grandTotal: totals.total,
          effectivePartAMax: totals.maxScores.partA,
          effectivePartBMax: totals.maxScores.partB,
          effectivePartCMax: totals.maxScores.partC,
          effectivePartDMax: totals.maxScores.partD,
          effectiveGrandMax: totals.maxScores.grand,
        },
        submitterProfile: { ...profile, school: schoolValue, appraisal_role: role },
        sectionSaveStatus: nextStatus,
      }));
      setSectionSaveStatus(nextStatus);
      const nextSection = { partA: "partB", partB: "partC", partC: "partD", partD: "partE", partE: "summary" }[section];
      if (navigateNext && nextSection) handleSectionChange(nextSection);
    } catch (err) {
      alert(draftSaveErrorMessage(err));
    } finally {
      setSavingSection(null);
    }
  };

  const handleSubmitAppraisal = async (confirmedByUser = false) => {
    if (locked) {
      alert("This appraisal has already been submitted and is locked for review.");
      return;
    }
    if (!confirmed || !attachmentsConfirmed) {
      alert("Please tick both declaration checkboxes before submitting.");
      return;
    }
    if (!userEmail) {
      alert("Please login again before submitting. Your session email was not found.");
      navigate("/login", { replace: true });
      return;
    }
    if (!isSelectedCycleOpen) {
      try {
        const latestWindowStatus = await getAppraisalWindowStatus({ academicYear });
        setAppraisalWindowStatus(latestWindowStatus);
        setAppraisalWindowError("");
        if (!canSubmitAppraisal(latestWindowStatus)) {
          alert("Appraisal submission is closed for this academic year.");
          return;
        }
      } catch (err) {
        const message = appraisalWindowErrorMessage(err);
        setAppraisalWindowError(message);
        alert(message);
        return;
      }
    }

    const submitterProfile = { ...profile, school: schoolValue, appraisal_role: role };
    const workflowError = workflowValidationError(submitterProfile);
    if (workflowError) {
      alert(workflowError);
      return;
    }
    const normalizedForm = normalizeScoresForSubmit({ ...form, info: { ...form.info, school: schoolValue } });
    const validationErrors = validateMediaBeforeSubmit(normalizedForm, docs);
    if (validationErrors.length) {
      alert(validationErrors.join("\n"));
      return;
    }
    if (confirmedByUser !== true) {
      setSubmissionError("");
      setSubmitDialogState("confirm");
      return;
    }

    const finalSectionSaveStatus = { ...sectionSaveStatus, partA: true, partB: true, partC: true, partD: true };
    setSubmitting(true);
    try {
      const submittedAt = new Date().toISOString();
      await submitAppraisal({
        facultyEmail: userEmail,
        academicYear,
        form: { ...normalizedForm, sectionSaveStatus: finalSectionSaveStatus },
        docs,
        totals: {
          partATotal: totals.partA,
          partBTotal: totals.partB,
          partCTotal: totals.partC,
          partDTotal: totals.partD,
          grandTotal: totals.total,
          effectivePartAMax: totals.maxScores.partA,
          effectivePartBMax: totals.maxScores.partB,
          effectivePartCMax: totals.maxScores.partC,
          effectivePartDMax: totals.maxScores.partD,
          effectiveGrandMax: totals.maxScores.grand,
        },
        submitterProfile,
        activeProfile: submitterProfile,
      });
      setSectionSaveStatus(finalSectionSaveStatus);
      const nextReviewer = getReviewChain(submitterProfile)[0];
      setDeclaration({ status: nextReviewer ? pendingStatusFor(nextReviewer) : "Submitted", submitted_at: submittedAt, updated_at: submittedAt });
      setReviews([]);
      setSubmitDialogState("success");
    } catch (err) {
      setSubmissionError(err.message || "Your appraisal could not be submitted. Please try again.");
      setSubmitDialogState("error");
    } finally {
      setSubmitting(false);
    }
  };

  const generateSelfReport = async () => {
    const rowSum = (key, max) => scoreSectionRows(key, form[key] || [], max, "score", key === "research" ? { autoFillResearchScore: false } : undefined);
    const maxScores = getMediaEffectiveMaxScores(form, { self: true });
    await generateMediaCommReport({
      title: `${schoolCode} Faculty Appraisal Report`,
      subtitle: schoolName,
      form,
      docs,
      partASections: PART_A_SECTIONS,
      partBSections: getPartBSectionsForSchool(form?.info?.school || form),
      partCSections: PART_C_SECTIONS,
      partDSections: PART_D_SECTIONS,
      partDTitle: "Leave & Attendance Management",
      partDIncludesSelfScore: true,
      totals,
      maxScores,
      generatedBy: profile.full_name || roleLabel(role),
      declaration,
      reviewChain: reviews.map((rev) => ({
        label: roleLabel(rev.reviewer_role),
        name: rev.reviewer_name || "",
        date: rev.reviewed_at ? new Date(rev.reviewed_at).toLocaleDateString("en-IN") : "",
      })),
      detailedSummaryRows: [
        { isHeader: true, label: "Part A - Teaching Process & Academic Activities" },
        ...summaryRow({}, "lectures", { id: "A1", label: "Lectures / Tutorials / Practicals", max: 40, score: rowSum("lectures", 40) }),
        ...summaryRow({}, "courseFile", { id: "A2", label: "Course File", max: 20, score: rowSum("courseFile", 20) }),
        { id: "A3", label: "Innovative Teaching-Learning Methodologies", max: 10, score: clampScore(innovativeTeachingScore(form.innovDetails, form.innovScore, 10), 10) },
        ...summaryRow({}, "feedback", { id: "A4", label: "Students' Feedback", max: 10, score: feedbackSectionScore(form.feedback || [], 10) }),
        { isTotal: true, label: "Part A Total", max: maxScores.partA, score: totals.partA },
        { isHeader: true, label: "Part B - Research, Publications & Creative Output" },
        ...getPartBSectionsForSchool(form?.info?.school || form).map((section) => ({ id: section.title.split(".")[0], label: section.title.replace(/^B\d+\.\s*/, ""), max: section.max, score: rowSum(section.key, section.max) })),
        { isTotal: true, label: "Part B Total", max: maxScores.partB, score: totals.partB },
        { isHeader: true, label: "Part C - Administrative Role & University Development" },
        ...PART_C_SECTIONS.map((section) => ({ id: section.title.split(".")[0], label: section.title.replace(/^C\d+\.\s*/, ""), max: section.max, score: rowSum(section.key, section.max) })),
        { isTotal: true, label: "Part C Total", max: maxScores.partC, score: totals.partC },
        { isHeader: true, label: "Part D - Leave & Attendance Management" },
        { id: "D1", label: "Management of Leaves", max: maxScores.partD, score: totals.partD },
        { isGrandTotal: true, label: "Grand Total", max: maxScores.grand, score: totals.total },
      ],
    });
  };

  const academicYearOptions = availableCycles.length
    ? availableCycles
    : [{ academic_year: academicYear || defaultAcademicYear || "2026-2027", is_open: true }];

  return (
    <div className="appraisal-form-shell" style={{ position: "relative", display: "flex", flexDirection: "column", gap: 24 }}>
      {submitDialogState && <SubmissionConfirmDialog state={submitDialogState} academicYear={academicYear} successMessage={`${schoolCode} appraisal submitted successfully and is now locked for review.`} errorMessage={`Unable to submit appraisal.\n\n${submissionError}`} onCancel={() => setSubmitDialogState(null)} onConfirm={() => { setSubmitDialogState("submitting"); void handleSubmitAppraisal(true); }} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="appraisal-page-header" style={{ background: "#fff", borderRadius: 14, padding: "16px 24px", boxShadow: "0 10px 28px rgba(17,24,39,0.06)", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 260 }}>
            <AppraisalHeaderImage logo="dypiu" height={78} />
            <div>
              <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#111827", letterSpacing: 0, lineHeight: 1.05 }}>My Appraisal Form</h2>
              <div style={{ marginTop: 6, color: "#4b5563", fontSize: 13, fontWeight: 800, lineHeight: 1.25 }}>{schoolName}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, fontSize: 13, color: "#6b7280", fontWeight: 700, flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#111827", fontWeight: 800 }}>
                  <span style={{ width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#ede9fe", color: "#6d28d9", border: "1px solid #ddd6fe", fontSize: 13, fontWeight: 900 }}>
                    {(form.info?.name || profile.full_name || "U").trim().charAt(0).toUpperCase()}
                  </span>
                  <span>{form.info?.name || profile.full_name || "Faculty"}</span>
                </span>
                <span aria-hidden="true" style={{ width: 1, height: 20, background: "#cbd5e1", display: "inline-block" }} />
                <span>Academic Year:</span>
                <select value={academicYear} onChange={(event) => handleAcademicYearChange(event.target.value)} className="appraisal-year-select" style={{ height: 36, minWidth: 176, border: "1px solid #d1d5db", borderRadius: 9, padding: "0 12px", fontSize: 13, fontFamily: "inherit", color: "#111827", background: "#fff", outline: "none", fontWeight: 800, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
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
            declaration={declaration}
            reviews={reviews}
            profile={{ ...profile, school: schoolName, appraisal_role: role }}
          />
          {!isSelectedCycleClosed && !isLegacyTwoPartYear && (
<OverallProgress total={totals.total} max={effectiveGrandMax} percentage={overallProgress} parts={partWiseProgressRows} loading={loadingYearData || loadedAcademicYear !== academicYear} error={yearLoadError} />
          )}
        </div>
      </div>

      <RejectionNotice declaration={declaration} reviews={reviews} form={form} status={declaration?.status || form.status} alertOnceKey={`${userEmail}:${academicYear}:${declaration?.status || form.status || ""}`} />

      {locked && (
        <div role="status" style={{ background: lockMessage || isSelectedCycleClosed ? "#fffbeb" : "#fef2f2", border: lockMessage || isSelectedCycleClosed ? "1px solid #fde68a" : workflowRejected ? "1px solid #fecaca" : "none", color: lockMessage || isSelectedCycleClosed ? "#92400e" : "#991b1b", borderRadius: 9, padding: "11px 14px", fontSize: 12, fontWeight: 750 }}>
          {lockMessage || (workflowRejected ? "This appraisal was rejected. Review the approval status above." : isSelectedCycleClosed ? `Appraisal cycle for Academic Year ${academicYear} is closed.` : "Submitted and locked for review.")}
        </div>
      )}

      {loadingYearData && <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>Loading saved appraisal...</div>}

      {isLegacyTwoPartYear ? (
        <PreviousYearReportViewer
          visibleLevels={["faculty"]}
          formType={previousYearFormTypeForSchool(schoolValue)}
          form={form}
          docs={docs}
          response={previousYearResponse}
          academicYear={academicYear}
          profile={profile}
          reviews={reviews}
        />
      ) : isSelectedCycleClosed && !isLatestCycle ? (
        <div className="fa-section-card appraisal-section-card" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 18px 50px rgba(17,24,39,0.08)", padding: 24, border: "1px solid #e5e7eb" }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: ACCENT, marginBottom: 16 }}>Closed Appraisal Report - {academicYear}</div>
          <SummaryBox totals={totals} maxScores={totals.maxScores} />
          <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
            <CreativeReportButton onClick={generateSelfReport} />
          </div>
          <div style={{ marginTop: 22, borderTop: "1px solid #e5e7eb", paddingTop: 18 }}>
            <div style={{ fontSize: 14, color: "#374151", fontWeight: 900, marginBottom: 12 }}>Attachments</div>
            {Object.keys(docs).length ? Object.keys(docs).map((key) => (
              <div key={key} style={{ display: "grid", gridTemplateColumns: "minmax(120px,180px) minmax(0,1fr)", gap: 12, border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", background: "#fff", marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#475569", fontWeight: 800 }}>{key}</div>
                <ViewDocsCell docKey={key} docs={docs} />
              </div>
            )) : <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>No attachments found for this closed appraisal year.</div>}
          </div>
        </div>
      ) : sectionTab === "summary" ? (
        <div className="fa-section-card appraisal-section-card" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 18px 50px rgba(17,24,39,0.08)", padding: 24, border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "-24px -24px 20px", padding: "18px 24px", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: "#ecfdf5", color: "#10b981", border: "1px solid #a7f3d0", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <InlineSvgIcon paths={SUMMARY_ICONS.report} size={18} />
            </span>
            <div style={{ fontWeight: 900, fontSize: 18, color: ACCENT, lineHeight: 1.25 }}>Appraisal Summary & Submission</div>
          </div>
          <AppraisalSummaryTable rows={[
            { label: "Part A - Teaching & Learning", score: totals.partA, max: (totals.maxScores || progressMaxScores).partA, color: "#4f46e5", tone: "#eef2ff", iconTone: "#eef2ff", icon: "book" },
            { label: "Part B - Research & Innovation", score: totals.partB, max: (totals.maxScores || progressMaxScores).partB, color: "#7c3aed", tone: "#f3e8ff", iconTone: "#f5f3ff", icon: "flask" },
            { label: "Part C - Administrative Contribution", score: totals.partC, max: (totals.maxScores || progressMaxScores).partC, color: "#0f766e", tone: "#ccfbf1", iconTone: "#ccfbf1", icon: "building" },
            (totals.maxScores || progressMaxScores).partD > 0 && { label: "Part D - Leave & Attendance Management", score: totals.partD, max: (totals.maxScores || progressMaxScores).partD, color: "#0891b2", tone: "#cffafe", iconTone: "#cffafe", icon: "calendar" },
            (totals.maxScores || progressMaxScores).partE > 0 && { label: "Part E - Annual Confidential Report", score: totals.partE, max: (totals.maxScores || progressMaxScores).partE, color: "#9333ea", tone: "#f3e8ff", iconTone: "#f5f3ff", icon: "report" },
            { label: "Grand Total", score: totals.total, max: (totals.maxScores || progressMaxScores).grand, color: "#ef4444", tone: "#fee2e2", iconTone: "#f1f5f9", icon: "sigma" },
          ]} />
          <SummaryOtherInfoField value={form.summaryOtherInfo} onChange={(value) => setForm((prev) => ({ ...prev, summaryOtherInfo: value }))} readOnly={locked} rows={5} />
          {!locked && (
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              <AccuracyCheckbox checked={confirmed} onChange={setConfirmed} />
              <label className={attachmentsConfirmed ? "appraisal-declaration-card is-checked" : "appraisal-declaration-card"} style={{ display: "flex", gap: 14, alignItems: "flex-start", fontSize: 13, color: "#334155", lineHeight: 1.5, padding: "14px 18px", background: attachmentsConfirmed ? "#dcfce7" : "#ecfdf5", border: `1px solid ${attachmentsConfirmed ? "#86efac" : "#bbf7d0"}`, borderRadius: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={attachmentsConfirmed} onChange={(e) => setAttachmentsConfirmed(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, accentColor: "#10b981", flexShrink: 0 }} />
                <span>{SUMMARY_ATTACHMENTS_DECLARATION}</span>
              </label>
            </div>
          )}
          <div className="appraisal-summary-actions" style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", marginTop: 18 }}>
            <CreativeReportButton onClick={generateSelfReport} />
            <AppraisalSummaryActionButton
              variant="submit"
              onClick={handleSubmitAppraisal}
              disabled={submitting || locked || !confirmed || !attachmentsConfirmed}
              locked={locked}
              loading={submitting}
            >
              {locked ? "Submitted & Locked" : submitting ? "Submitting..." : "Submit Appraisal"}
            </AppraisalSummaryActionButton>
          </div>
        </div>
      ) : (
        <>
          <CreativeSchoolForm form={form} setForm={setForm} docs={docs} setDocs={setDocs} mode="self" locked={locked} partDLocked={partDLocked} sectionView={sectionTab} />
          <SectionSaveFooter
            label={SECTION_OPTIONS.find((option) => option.value === sectionTab)?.label || sectionTab}
            saved={Boolean(sectionSaveStatus[sectionTab])}
            saving={savingSection === sectionTab}
            locked={locked || (sectionTab === "partD" && partDLocked)}
            onSave={(navigateNext) => handleSaveSelfSection(sectionTab, navigateNext)}
          />
        </>
      )}
    </div>
  );
}
