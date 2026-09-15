import { SectionCard as SC } from "../../components";
import { clampScore, filesForDocValue } from "../../utils";
import { n } from "../../shared";
import PreviousYearReportActions from "../../../previousYearReport/components/PreviousYearReportActions";
import { normalizeEngineeringPreviousYearReport } from "../../../previousYearReport/normalizers/engineeringPreviousYearNormalizer";

const legacyScore = (row = {}) => {
  const keys = ["score", "self_score", "faculty_score", "selfScore", "facultyScore"];
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
};

const legacyRows = (rows = []) => {
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  return list.length ? list : [{}];
};

const LEGACY_SCORE_KEYS = new Set([
  "score",
  "self_score",
  "faculty_score",
  "selfScore",
  "facultyScore",
  "hod",
  "hod_score",
  "hodScore",
  "center_head_score",
  "director",
  "director_score",
  "directorScore",
  "dean",
  "dean_score",
  "deanScore",
]);

const LEGACY_META_KEYS = new Set(["label", "max", "sectionMax", "section_max"]);

const legacyScoreCard = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "13px 14px",
  background: "linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)",
  boxShadow: "0 10px 22px rgba(15,23,42,0.04)",
  minWidth: 0,
};

const legacyRowHasMeaningfulData = (row = {}) => {
  const entries = Object.entries(row || {});
  const hasScore = entries.some(([key, value]) =>
    LEGACY_SCORE_KEYS.has(key) && String(value ?? "").trim() && n(value) > 0
  );
  const hasUserValue = entries.some(([key, value]) =>
    !LEGACY_SCORE_KEYS.has(key) &&
    !LEGACY_META_KEYS.has(key) &&
    String(value ?? "").trim()
  );
  return hasScore || hasUserValue;
};

const legacySectionTotal = (sections) =>
  sections.reduce((total, section) => total + clampScore(legacyRows(section.rows)
    .filter((row) => Object.values(row || {}).some((value) => String(value ?? "").trim()))
    .reduce((sum, row) => sum + n(legacyScore(row)), 0), section.max), 0);

const legacySectionsHaveData = (sections) =>
  sections.some((section) => legacyRows(section.rows).some(legacyRowHasMeaningfulData));

const legacySectionsHaveScores = (sections) =>
  sections.some((section) => legacyRows(section.rows).some((row) =>
    String(legacyScore(row) ?? "").trim() !== ""
  ));

const legacyDocsHaveFiles = (docs = {}) =>
  Object.values(docs || {}).some((files) => filesForDocValue(files).length > 0);

export default function LegacyPreviousYearReport({
  academicYear = "2025-2026",
  profile,
  reviews = [],
  storedTotals,
  docs,
  lectures,
  courseFile,
  innovRows,
  projects,
  quals,
  feedback,
  deptActs,
  uniActs,
  society,
  industry,
  acr,
  journals,
  books,
  ict,
  research,
  projects2,
  externalProjects,
  patents,
  awards,
  confs,
  proposals,
  products,
  fdps,
  training,
}) {
  const partASections = [
    { max: 50, rows: lectures },
    { max: 20, rows: courseFile },
    { max: 10, rows: innovRows },
    { max: 10, rows: projects },
    { max: 10, rows: quals },
    { max: 10, rows: feedback },
    { max: 20, rows: deptActs },
    { max: 30, rows: uniActs },
    { max: 10, rows: society },
    { max: 5, rows: industry },
    { max: 25, rows: acr },
  ];
  const partBSections = [
    { max: 120, rows: journals },
    { max: 50, rows: books },
    { max: 20, rows: ict },
    { max: 30, rows: research },
    { max: 15, rows: projects2 },
    { max: 30, rows: externalProjects },
    { max: 40, rows: patents },
    { max: 10, rows: awards },
    { max: 30, rows: confs },
    { max: 10, rows: proposals },
    { max: 10, rows: products },
    { max: 10, rows: fdps },
    { max: 0, rows: training },
  ];
  const normalizedReport = normalizeEngineeringPreviousYearReport({
    form: {
      info: { ...(profile || {}), ay: academicYear },
      lectures,
      courseFile,
      innovRows,
      projects,
      quals,
      feedback,
      deptActs,
      uniActs,
      society,
      industry,
      acr,
      journals,
      books,
      ict,
      research,
      projects2,
      externalProjects,
      patents,
      awards,
      confs,
      proposals,
      products,
      fdps,
      training,
    },
    docs,
    academicYear,
    profile,
    response: { totals: storedTotals },
  });
  const calculatedPartA = clampScore(legacySectionTotal(partASections), 200);
  const calculatedPartB = clampScore(legacySectionTotal(partBSections), 375);
  const hasPartAScores = legacySectionsHaveScores(partASections);
  const hasPartBScores = legacySectionsHaveScores(partBSections);
  const facultyPartA = hasPartAScores ? calculatedPartA : clampScore(storedTotals?.partA, 200);
  const facultyPartB = hasPartBScores ? calculatedPartB : clampScore(storedTotals?.partB, 375);
  const facultyPartAMax = storedTotals?.partAMax || normalizedReport.totals?.faculty?.partAMax || normalizedReport.partA?.max || 200;
  const facultyPartBMax = storedTotals?.partBMax || normalizedReport.totals?.faculty?.partBMax || normalizedReport.partB?.max || 375;
  // Grand max must always be the sum of the two part maxes above - a separately-stored
  // grand/max field (score_summary.grandMax etc.) has been observed stale/inconsistent with the
  // record's actual part maxes (e.g. reporting 720 for a 175+345=520 record), so it's never
  // trusted here even as a fallback.
  const facultyGrandMax = facultyPartAMax + facultyPartBMax;
  const displayedFacultyPartA = storedTotals?.partA ?? facultyPartA;
  const displayedFacultyPartB = storedTotals?.partB ?? facultyPartB;
  const grandFaculty = storedTotals?.grand ?? (hasPartAScores || hasPartBScores
    ? clampScore(facultyPartA + facultyPartB, facultyGrandMax)
    : clampScore(storedTotals?.grand, facultyGrandMax));
  const hasStoredScore = [storedTotals?.partA, storedTotals?.partB, storedTotals?.grand]
    .some((value) => value !== null && value !== undefined && n(value) > 0);
  // Each reviewing authority's own score was already computed into storedTotals (hodTotal,
  // directorTotal, ...) but never actually rendered anywhere - only their remarks made it onto
  // screen. Surface whichever roles have a recorded score and/or remarks, scored against the
  // same corrected grand max faculty is measured against.
  const reviewerRows = [["hod", "HOD"], ["director", "Director"], ["dean", "Dean"], ["vc", "VC"]]
    .map(([key, label]) => ({
      key,
      label,
      total: storedTotals?.[`${key}Total`],
      remarks: storedTotals?.[`${key}Remarks`],
    }))
    .filter((row) => (row.total !== null && row.total !== undefined && n(row.total) > 0) || String(row.remarks || "").trim() !== "");
  const hasPreviousRecord = hasStoredScore ||
    legacySectionsHaveData(partASections) ||
    legacySectionsHaveData(partBSections) ||
    legacyDocsHaveFiles(docs);

  if (!hasPreviousRecord) {
    return (
      <SC title={`Previous Year Appraisal Report - ${academicYear}`} accent="#4c1d95">
        <div style={{ border: "1px solid #dbe3ef", background: "linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)", color: "#334155", borderRadius: 12, padding: "18px 20px", lineHeight: 1.5, boxShadow: "0 10px 24px rgba(15,23,42,0.04)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, background: "#f5f3ff", color: "#4c1d95", border: "1px solid #ddd6fe", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v5h5" />
                <path d="M9 14h6" />
                <path d="M9 18h3" />
              </svg>
            </span>
            <div>
              <div style={{ color: "#111827", fontSize: 16, fontWeight: 900 }}>No previous-year report available</div>
              <div style={{ marginTop: 6, color: "#4c1d95", fontSize: 12, fontWeight: 900 }}>Academic Year: {academicYear}</div>
              <div style={{ marginTop: 8, color: "#64748b", fontSize: 13, fontWeight: 700 }}>
                We could not find a submitted previous-year appraisal report for this academic year. Please contact appraisal@dypiu.ac.in.
              </div>
            </div>
          </div>
        </div>
      </SC>
    );
  }

  return (
    <SC title={`Previous Year Appraisal Report - ${academicYear}`} accent="#4c1d95">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[
          ["Part A Faculty", `${displayedFacultyPartA.toFixed(1)} / ${facultyPartAMax}`],
          ["Part B Faculty", `${displayedFacultyPartB.toFixed(1)} / ${facultyPartBMax}`],
          ["Grand Faculty", `${grandFaculty.toFixed(1)} / ${facultyGrandMax}`],
        ].map(([label, value]) => (
          <div key={label} style={legacyScoreCard}>
            <div style={{ color: "#64748b", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
            <div style={{ marginTop: 6, color: "#111827", fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>
      {reviewerRows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: "#64748b", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Higher Authority Scores</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            {reviewerRows.map((row) => (
              <div key={row.key} style={{ ...legacyScoreCard, display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "#64748b", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.4 }}>{row.label}</span>
                  <span style={{ color: "#111827", fontSize: 14, fontWeight: 900 }}>
                    {row.total !== null && row.total !== undefined ? `${n(row.total).toFixed(1)} / ${facultyGrandMax}` : "Score not recorded"}
                  </span>
                </div>
                {String(row.remarks || "").trim() !== "" && (
                  <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.55 }}>{row.remarks}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginTop: 18 }}>
        <PreviousYearReportActions report={normalizedReport} title="Previous Year Appraisal Report" showSummary={false} reviews={reviews} />
      </div>
    </SC>
  );
}
