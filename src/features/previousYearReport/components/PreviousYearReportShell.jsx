import { useState } from "react";
import { Archive, LockKeyhole } from "lucide-react";
import "./previousYearReport.css";
import PreviousYearReportActions from "./PreviousYearReportActions";
import PreviousYearScoreSummary from "./PreviousYearScoreSummary";
import PreviousYearSectionTable from "./PreviousYearSectionTable";
import { SectionCard as SC } from "../../faculty-appraisal/components";

export default function PreviousYearReportShell({ report, title, reviews = [], showTables = false, visibleLevels }) {
  if (!report?.academicYear) {
    return <EmptyNotice title="Select an academic year">Choose an academic year from the header to view its previous-year appraisal report.</EmptyNotice>;
  }

  const hasReport = report.partA.sections.some((section) => section.rows.length || section.attachments.length) ||
    report.partB.sections.some((section) => section.rows.length || section.attachments.length) ||
    (report.totals?.faculty?.grand || 0) > 0;

  if (!hasReport) {
    return (
      <EmptyNotice title="No previous-year report available" academicYear={report.academicYear}>
        We could not find a submitted previous-year appraisal report for this academic year. Please contact appraisal@dypiu.ac.in.
      </EmptyNotice>
    );
  }

  return (
    <section className="previous-report" aria-label={`${title} - ${report.academicYear}`}>
      <header className="previous-report__header">
        <span className="previous-report__icon"><Archive size={22} aria-hidden="true" /></span>
        <div><span className="previous-report__eyebrow">Previous academic year</span><h2>{title}</h2><p>View the recorded appraisal, supporting documents, and review summary.</p></div>
        <div className="previous-report__badges"><span>AY {report.academicYear}</span><span><LockKeyhole size={12} aria-hidden="true" />Read-only</span></div>
      </header>
      <div className="previous-report__content">
      {showTables ? (
        <PreviousYearTableView report={report} reviews={reviews} visibleLevels={visibleLevels} />
      ) : (
        <PreviousYearReportActions report={report} title={title} reviews={reviews} />
      )}
      </div>
    </section>
  );
}

function PreviousYearTableView({ report, reviews = [], visibleLevels }) {
  const isLegacyTwoPartReport = (academicYear = "") => {
    const value = String(academicYear || "").replace(/\s+/g, "");
    return value === "2025-2026" || value === "2025-26" || value === "25-26";
  };
  const levels = visibleLevels?.length ? visibleLevels : (report.reviewLevels || ["faculty", "hod", "director", "dean"]);
  const pages = [
    { key: "partA", label: "Part A" },
    { key: "partB", label: "Part B" },
    { key: "summary", label: "Summary" },
  ];
  const [legacyPage, setLegacyPage] = useState("partA");
  const legacyPageIndex = pages.findIndex((page) => page.key === legacyPage);
  const previousPage = pages[Math.max(legacyPageIndex - 1, 0)];
  const nextPage = pages[Math.min(legacyPageIndex + 1, pages.length - 1)];

  if (isLegacyTwoPartReport(report.academicYear)) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <PreviousYearFacultyInfo report={report} />
        <LegacyPageNav pages={pages} activePage={legacyPage} onChange={setLegacyPage} />
        {legacyPage === "partA" && (
          <>
            <PartBand title="Part A - Teaching & Academic Activities" />
            {report.partA.sections.map((section) => (
              <PreviousYearSectionTable key={section.key || section.label} section={section} levels={levels} />
            ))}
          </>
        )}
        {legacyPage === "partB" && (
          <>
            <PartBand title="Part B - Research & Academic Contributions" tone="#ede9fe" />
            {report.partB.sections.map((section) => (
              <PreviousYearSectionTable key={section.key || section.label} section={section} levels={levels} />
            ))}
          </>
        )}
        {legacyPage === "summary" && (
          <>
            <PartBand title="Summary" tone="#ecfdf5" />
            <PreviousYearScoreSummary report={report} visibleLevels={levels} variant="table" />
            <AuthorityRemarks reviews={reviews} levels={levels} />
          </>
        )}
        <LegacyPager
          activePage={legacyPage}
          previousPage={previousPage}
          nextPage={nextPage}
          isFirst={legacyPageIndex <= 0}
          isLast={legacyPageIndex >= pages.length - 1}
          onChange={setLegacyPage}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PreviousYearFacultyInfo report={report} />
      <PreviousYearScoreSummary report={report} visibleLevels={levels} variant="table" />
      <PartBand title="Part A - Teaching & Academic Activities" />
      {report.partA.sections.map((section) => (
        <PreviousYearSectionTable key={section.key || section.label} section={section} levels={levels} />
      ))}
      <PartBand title="Part B - Research & Academic Contributions" tone="#ede9fe" />
      {report.partB.sections.map((section) => (
        <PreviousYearSectionTable key={section.key || section.label} section={section} levels={levels} />
      ))}
    </div>
  );
}

const firstFilled = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== "") || "";

const hasPositiveScore = (value) => String(value ?? "").trim() !== "" && (parseFloat(value) || 0) > 0;

const reviewerLabels = {
  faculty: "Faculty",
  hod: "HOD / Center Head",
  center_head: "Center Head",
  director: "Director",
  dean: "Dean",
  vc: "VC",
};

const reviewerOrder = {
  faculty: 0,
  hod: 1,
  center_head: 1,
  director: 2,
  dean: 3,
  vc: 4,
};

const reviewRemarks = (review = {}) =>
  firstFilled(review.remarks, review.remark, review.comments, review.comment, review.review_remarks, review.reviewRemarks, review.reviewer_remarks, review.reviewerRemarks, review.reason, review.rejection_reason, review.rejectionReason);

const reviewRole = (review = {}) =>
  firstFilled(review.reviewer_role, review.reviewerRole, review.role, review.authority_role, review.authorityRole);

const normalizedReviewRole = (role = "") => {
  const value = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (value === "center_head" || value === "centre_head") return "center_head";
  if (value.includes("hod") || value.includes("head_of_department")) return "hod";
  if (value.includes("director")) return "director";
  if (value.includes("dean")) return "dean";
  if (value === "vc" || value.includes("vice_chancellor")) return "vc";
  if (value.includes("faculty")) return "faculty";
  return value;
};

const reviewName = (review = {}) =>
  firstFilled(review.reviewer_name, review.reviewerName, review.name, review.authority_name, review.authorityName);

const reviewDate = (review = {}) =>
  firstFilled(review.reviewed_at, review.reviewedAt, review.updated_at, review.updatedAt, review.created_at, review.createdAt);

const reviewScore = (review = {}) => {
  const totals = typeof review.totals === "string"
    ? (() => {
      try { return JSON.parse(review.totals) || {}; } catch { return {}; }
    })()
    : (review.totals || {});
  const direct = firstFilled(
    review.total_score,
    review.totalScore,
    review.total,
    review.grand_total,
    review.grandTotal,
    totals.total,
    totals.total_score,
    totals.grand_total,
    totals.grandTotal,
  );
  const partKeys = ["part_a_score", "partAScore", "part_b_score", "partBScore", "part_c_score", "partCScore", "part_d_score", "partDScore"];
  const partsPresent = partKeys.some((key) => String(review[key] ?? "").trim() !== "");
  const partsSum = partsPresent ? partKeys.reduce((sum, key) => sum + (parseFloat(review[key]) || 0), 0) : "";
  return [direct, partsSum].find(hasPositiveScore) ?? direct ?? partsSum;
};

function AuthorityRemarks({ reviews = [], levels }) {
  const rows = (Array.isArray(reviews) ? reviews : [])
    .map((review) => ({
      role: normalizedReviewRole(reviewRole(review)),
      name: reviewName(review),
      date: reviewDate(review),
      score: reviewScore(review),
      remarks: reviewRemarks(review),
    }))
    .filter((review) => String(review.remarks || "").trim() || hasPositiveScore(review.score))
    .filter((review) => !levels?.length || levels.includes(review.role))
    .sort((a, b) => {
      const roleDiff = (reviewerOrder[a.role] ?? 99) - (reviewerOrder[b.role] ?? 99);
      if (roleDiff !== 0) return roleDiff;
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
    });

  if (!rows.length) return null;

  return (
    <div style={{ border: "1px solid #dbe3ef", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
      <div style={{ background: "#f8fafc", borderBottom: "1px solid #dbe3ef", padding: "10px 12px", color: "#172033", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>
        Higher Authority Remarks
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr style={{ background: "#fff" }}>
            <th style={{ ...summaryTh, width: "16%" }}>Authority</th>
            <th style={{ ...summaryTh, width: "18%" }}>Reviewer</th>
            <th style={{ ...summaryTh, width: "14%" }}>Date</th>
            <th style={{ ...summaryTh, width: "12%" }}>Score</th>
            <th style={summaryTh}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((review, index) => {
            const date = review.date ? new Date(review.date) : null;
            const displayDate = date && Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-IN") : review.date;
            return (
              <tr key={`${review.role || "authority"}-${index}`}>
                <td style={summaryTdLabel}>{reviewerLabels[review.role] || review.role || "Authority"}</td>
                <td style={summaryTd}>{review.name || "-"}</td>
                <td style={summaryTd}>{displayDate || "-"}</td>
                <td style={summaryTd}>{hasPositiveScore(review.score) ? (parseFloat(review.score) || 0).toFixed(1) : "-"}</td>
                <td style={{ ...summaryTd, textAlign: "left", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{review.remarks || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LegacyPageNav({ pages, activePage, onChange }) {
  return (
    <nav className="previous-report__nav" aria-label="Previous-year report sections">
      {pages.map((page) => {
        const active = page.key === activePage;
        return (
          <button
            key={page.key}
            type="button"
            onClick={() => onChange(page.key)}
            className={active ? "is-active" : undefined}
            aria-current={active ? "page" : undefined}
          >
            {page.label}
          </button>
        );
      })}
    </nav>
  );
}

function LegacyPager({ previousPage, nextPage, isFirst, isLast, onChange }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
      <button type="button" disabled={isFirst} onClick={() => onChange(previousPage.key)} style={pagerButton(isFirst)}>
        Previous
      </button>
      <button type="button" disabled={isLast} onClick={() => onChange(nextPage.key)} style={pagerButton(isLast, true)}>
        Next
      </button>
    </div>
  );
}

const pagerButton = (disabled, primary = false) => ({
  minHeight: 38,
  border: primary ? "none" : "1px solid #cbd5e1",
  background: disabled ? "#f1f5f9" : primary ? "#4c1d95" : "#fff",
  color: disabled ? "#94a3b8" : primary ? "#fff" : "#334155",
  borderRadius: 7,
  padding: "8px 16px",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 900,
  cursor: disabled ? "not-allowed" : "pointer",
  boxShadow: disabled || !primary ? "none" : "0 8px 18px rgba(76,29,149,0.16)",
});

const summaryTh = {
  border: "1px solid #dbe3ef",
  padding: "10px 12px",
  color: "#172033",
  fontSize: 12,
  fontWeight: 900,
  textAlign: "center",
};

const summaryTd = {
  border: "1px solid #e5e7eb",
  padding: "10px 12px",
  color: "#111827",
  fontSize: 13,
  fontWeight: 800,
  textAlign: "center",
  overflowWrap: "anywhere",
};

const summaryTdLabel = {
  ...summaryTd,
  color: "#475569",
  fontSize: 12,
  textAlign: "left",
  textTransform: "uppercase",
};

function PreviousYearFacultyInfo({ report }) {
  const profile = report.profile || {};
  const infoRows = [
    ["Academic Year", report.academicYear],
    ["Name", profile.name || profile.full_name || profile.fullName],
    ["Qualification", profile.qual || profile.qualification],
    ["Designation", profile.desig || profile.designation || profile.present_designation],
    ["School", profile.school || profile.school_name || profile.department],
    ["Experience", profile.exp || profile.experience || profile.teaching_experience],
    ["Email", profile.email || profile.faculty_email],
  ].filter(([, value]) => String(value ?? "").trim() !== "");

  return (
    <dl className="previous-report__profile" aria-label="Faculty details">
      {infoRows.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

function PartBand({ title, tone = "#dbeafe" }) {
  return (
    <div className="previous-report__part-heading" style={{ "--part-tone": tone }}>
      {title}
    </div>
  );
}

function EmptyNotice({ title, academicYear, children }) {
  return (
    <SC title="Previous Year Appraisal Report" accent="#4c1d95">
      <div style={{ border: "1px solid #dbe3ef", background: "linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)", color: "#334155", borderRadius: 12, padding: "18px 20px", lineHeight: 1.5, boxShadow: "0 10px 24px rgba(15,23,42,0.04)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ width: 38, height: 38, borderRadius: 12, background: "#f5f3ff", color: "#4c1d95", border: "1px solid #ddd6fe", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <NoticeIcon />
          </span>
          <div>
            <div style={{ color: "#111827", fontSize: 16, fontWeight: 900 }}>{title}</div>
            {academicYear && <div style={{ marginTop: 6, color: "#4c1d95", fontSize: 12, fontWeight: 900 }}>Academic Year: {academicYear}</div>}
            <div style={{ marginTop: 8, color: "#64748b", fontSize: 13, fontWeight: 700 }}>{children}</div>
          </div>
        </div>
      </div>
    </SC>
  );
}

function NoticeIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v5h5" />
      <path d="M9 14h6" />
      <path d="M9 18h3" />
    </svg>
  );
}
