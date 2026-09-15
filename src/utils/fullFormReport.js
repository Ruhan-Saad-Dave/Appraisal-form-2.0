import {
  clampScore,
  researchGuidanceScore,
  reviewSectionScore,
  rowMaxForSection,
  societyRowScore,
  sumSectionScore,
  SCORE_LIMITS,
  projectGuidanceRowMax,
} from "./appraisalFormUtils";
import { createAcrRows } from "../constants/formConfig";

const n = (value) => parseFloat(value) || 0;
const percentOf = (score, max) => {
  const maximum = n(max);
  return maximum > 0 ? ((n(score) / maximum) * 100).toFixed(2) : "0.00";
};

const collapsePartBSummaryRows = (rows) => {
  if (!Array.isArray(rows)) return rows;
  const nextRows = [];
  let insidePartB = false;

  rows.forEach((row) => {
    const label = String(row?.label || "");
    if (row?.isHeader && /^part b\b/i.test(label)) {
      nextRows.push({ ...row, label: "Part B - Research & Innovation" });
      insidePartB = true;
      return;
    }
    if (insidePartB) {
      if (row?.isTotal && /^part b\b/i.test(label)) {
        nextRows.push({ id: "B", label: "Research & Innovation", max: row.max, score: row.score });
        nextRows.push(row);
        insidePartB = false;
      } else if (row?.isHeader) {
        insidePartB = false;
        nextRows.push(row);
      }
      return;
    }
    nextRows.push(row);
  });

  return nextRows;
};

export const fetchImageAsDataUrl = async (path) => {
  const url = `${window.location.origin}${path}`;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
};

export const safeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const scoreKeyForInnov = (role) =>
  ({
    hod: "innovHod",
    director: "innovDirector",
    dean: "innovDean",
    vc: "innovVc",
  })[role] || "innovScore";

export const isFilledValue = (value) => {
  if (value === undefined || value === null) return false;
  const str = String(value).trim();
  if (!str) return false;
  const lower = str.toLowerCase();
  if (lower === "null" || lower === "undefined" || lower === "n/a" || lower === "na") return false;
  return true;
};

export const displayValue = (value) => {
  if (!isFilledValue(value)) return "&nbsp;";
  return safeHtml(String(value).trim());
};

const firstFilled = (...values) =>
  values.find((value) => isFilledValue(value)) ?? "";

const displayWithOptionalYears = (value) => {
  const text = String(value ?? "").trim();
  if (!isFilledValue(text)) return "&nbsp;";
  return /year/i.test(text) ? safeHtml(text) : `${safeHtml(text)} years`;
};

const qualificationValue = (info = {}, form = {}) =>
  firstFilled(
    info.qual,
    info.qualification,
    info.educationalQualifications,
    info.educational_qualifications,
    form.qualification,
    form.educationalQualifications,
    form.educational_qualifications,
    form.profile?.qualification,
    form.submitterProfile?.qualification,
  );

const experienceValue = (info = {}, form = {}) =>
  firstFilled(
    info.experience,
    info.teaching_experience,
    info.teachingExperience,
    form.experience,
    form.teaching_experience,
    form.teachingExperience,
    form.profile?.teaching_experience,
    form.profile?.experience,
    form.submitterProfile?.teaching_experience,
    form.submitterProfile?.experience,
    info.expTotal,
  );

const splitExperienceValue = (info = {}) => {
  const parts = [
    ["DYPIU", info.expDyp],
    ["Previous", info.expPrev],
    ["Total", info.expTotal],
  ].filter(([, value]) => isFilledValue(value));
  return parts
    .map(([label, value]) => `${label}: ${String(value).trim()}`)
    .join(" / ");
};

const displayExperience = (info = {}, form = {}) => {
  const singleValue = experienceValue(info, form);
  if (singleValue) return displayWithOptionalYears(singleValue);
  const splitValue = splitExperienceValue(info);
  return splitValue ? displayWithOptionalYears(splitValue) : "&nbsp;";
};

export const PRINT_REPORT_CSS = `
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
    tfoot{display:table-footer-group}
    tr{page-break-inside:avoid;page-break-after:auto}
    th,td{border:1px solid #aeb6c2!important;padding:4.8px 6px;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere}
    th{background:#eef0f3!important;text-align:center;font-weight:700;color:#111}
    td[style*="background:#d9d9d9"]{background:#eef0f3!important;color:#111!important;text-transform:uppercase;letter-spacing:.2px}
    tr[style*="background:#bfbfbf"] td{background:#d9dde3!important;color:#111!important}
    a{color:#0645ad;text-decoration:none}
    .c{text-align:center}.b{font-weight:bold}
    .page-break,.pb{page-break-before:always}
    .tr{background:#f6f7f9!important;font-weight:bold}
    .ht{width:100%;border:none!important;border-bottom:2px solid #111!important;margin-bottom:9px;padding-bottom:5px;background:transparent}
    .ht td{border:none!important;padding:0 4px;vertical-align:middle}
    .logo{width:17mm;max-height:22mm;object-fit:contain;height:auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .ht + table{border-color:#6b7280!important;margin-bottom:11px}
    .ht + table td:first-child{background:#f6f7f9!important;font-weight:700;width:35%}
    .st{border:1.35px solid #4b5563!important}
    .st th{background:#dfe3e8!important;color:#111}
    .st .tr, .st tr[style*="background:#bfbfbf"]{background:#dfe3e8!important;font-weight:bold}
    .remarks{white-space:pre-wrap;border:1px solid #6b7280!important;padding:8px;min-height:34px;background:#fff}
    .declaration-table{border:none!important;margin-bottom:14px!important}
    .declaration-table td{border:none!important;background:#fff!important}
  `;

const PRINT_SCRIPT = `<script>
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
</script>`;

export const buildReviewRemarks = ({
  source = {},
  currentRole = "",
  currentRemarks = "",
  roleLabels = {},
} = {}) => {
  const remarkRoles = [
    {
      role: "hod",
      label: roleLabels.hod || "HOD Remarks",
      keys: [
        "hodRemarks",
        "hod_remarks",
        "centerHeadRemarks",
        "center_head_remarks",
      ],
    },
    {
      role: "director",
      label: roleLabels.director || "Director Remarks",
      keys: ["directorRemarks", "director_remarks"],
    },
    {
      role: "dean",
      label: roleLabels.dean || "Dean Remarks",
      keys: ["deanRemarks", "dean_remarks"],
    },
    {
      role: "vc",
      label: roleLabels.vc || "Vice Chancellor Remarks and Grade",
      keys: ["vcRemarks", "vc_remarks"],
    },
  ];

  return remarkRoles
    .map(({ role, label, keys }) => {
      const value = firstFilled(
        role === currentRole ||
          (role === "hod" && currentRole === "center_head")
          ? currentRemarks
          : "",
        ...keys.map((key) => source?.[key]),
      );
      return { label, remarks: value };
    })
    .filter((item) => isFilledValue(item.remarks));
};

const renderReviewRemarks = (sections = []) =>
  sections.length
    ? `
  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">REVIEW REMARKS</h3>
  ${sections
    .map(
      (section) => `
    <h3>${safeHtml(section.label)}</h3>
    <div class="remarks">${safeHtml(section.remarks || "")}</div>
  `,
    )
    .join("")}
`
    : "";

const renderSummaryOtherInfo = (value) =>
  isFilledValue(value)
    ? `<h3>Any other information not covered above</h3><div class="remarks">${safeHtml(value)}</div>`
    : "";

const summaryScoreText = (value) =>
  isFilledValue(value) && n(value) > 0 ? n(value).toFixed(1) : "&nbsp;";

const summaryMaxText = (value) =>
  isFilledValue(value) || value === 0 ? safeHtml(String(value)) : "&nbsp;";

const summaryPercentText = (score, max) =>
  isFilledValue(score) && n(score) > 0 && n(max) > 0
    ? `${percentOf(score, max)}%`
    : "&nbsp;";

export const renderReportSummary = ({
  academicYear = "",
  rows = null,
  totals = {},
  maxScores = {},
  scoreLabel = "Score",
  status = "",
} = {}) => {
  const baseRows = Array.isArray(rows) && rows.length
    ? rows
    : [
        { id: "A", label: "Part A", max: maxScores.partA, score: totals.partA, isTotal: true },
        { id: "B", label: "Part B", max: maxScores.partB, score: totals.partB, isTotal: true },
        { id: "C", label: "Part C", max: maxScores.partC, score: totals.partC, isTotal: true },
        { id: "D", label: "Part D", max: maxScores.partD, score: totals.partD, isTotal: true },
        { id: "GT", label: "Grand Total", max: maxScores.grand, score: totals.total, isGrandTotal: true },
      ];

  const hasGrandTotal = baseRows.some((row) => row?.isGrandTotal || /^grand total/i.test(String(row?.label || "")));
  const displayRows = hasGrandTotal
    ? baseRows
    : [
        ...baseRows,
        { id: "GT", label: "Grand Total", max: maxScores.grand, score: totals.total, isGrandTotal: true },
      ];

  return `
  <h3 style="text-align:center;font-size:13px">SUMMARY${academicYear ? ` - AY ${safeHtml(academicYear)}` : ""}</h3>
  <table class="st">
    <thead>
      <tr>
        <th style="width:12%">Sr.No.</th>
        <th>Section</th>
        <th style="width:17%">Maximum</th>
        <th style="width:17%">${safeHtml(scoreLabel)}</th>
        <th style="width:20%">Marks Obtained (%)</th>
      </tr>
    </thead>
    <tbody>
      ${displayRows.map((row, index) => {
        if (row?.isHeader) {
          return `<tr><td colspan="5" class="b" style="background:#d9d9d9;text-align:center">${safeHtml(row.label)}</td></tr>`;
        }
        const isGrand = row?.isGrandTotal || /^grand total/i.test(String(row?.label || ""));
        const rowClass = row?.isTotal || isGrand ? ` class="tr"` : "";
        return `<tr${rowClass}>
          <td class="c">${safeHtml(row.id || String(index + 1))}</td>
          <td>${safeHtml(row.label || "")}</td>
          <td class="c">${summaryMaxText(row.max)}</td>
          <td class="c">${summaryScoreText(row.score)}</td>
          <td class="c">${summaryPercentText(row.score, row.max)}</td>
        </tr>`;
      }).join("")}
      ${status ? `<tr><td class="c">Status</td><td colspan="4">${safeHtml(status)}</td></tr>` : ""}
    </tbody>
  </table>`;
};

export const renderCombinedPartsSummary = ({
  academicYear = "",
  parts = [],
  roles = [],
  grandTotal = null,
  status = "",
  note = "",
} = {}) => {
  const cell = (value) =>
    value === null || value === undefined || value === "" ? "&nbsp;" : n(value).toFixed(1);
  const colCount = 2 + roles.length;
  return `
  <h3 style="text-align:center;font-size:13px">SUMMARY${academicYear ? ` - AY ${safeHtml(academicYear)}` : ""}</h3>
  <table class="st">
    <thead>
      <tr>
        <th>Part</th>
        <th style="width:14%">Max</th>
        ${roles.map((role) => `<th>${safeHtml(role.label)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${parts
        .map(
          (part) => `
      <tr>
        <td>${safeHtml(part.label)}</td>
        <td class="c">${safeHtml(String(part.max ?? ""))}</td>
        ${roles.map((role) => `<td class="c">${cell(part.values?.[role.key])}</td>`).join("")}
      </tr>`,
        )
        .join("")}
      ${
        grandTotal
          ? `<tr class="tr" style="background:#bfbfbf;font-weight:bold;font-size:13px">
        <td>Grand Total</td>
        <td class="c">${safeHtml(String(grandTotal.max ?? ""))}</td>
        ${roles.map((role) => `<td class="c">${cell(grandTotal.values?.[role.key])}</td>`).join("")}
      </tr>`
          : ""
      }
      ${status ? `<tr><td class="c">Status</td><td colspan="${colCount - 1}">${safeHtml(status)}</td></tr>` : ""}
    </tbody>
  </table>
  ${note ? `<div class="remarks" style="margin-top:6px;font-size:10.5px">${safeHtml(note)}</div>` : ""}`;
};

const docsFor = (docs, key) => {
  const files = docs?.[key] || [];
  if (!files.length) return "&nbsp;";
  return files
    .map((file) => {
      const label = safeHtml(file.name || file.url || "Document");
      return file.url
        ? `<a href="${safeHtml(file.url)}" target="_blank" rel="noreferrer">${label}</a>`
        : label;
    })
    .join("<br/>");
};

const roleColumnLabel = (role, roleLabel = (value) => value) =>
  role === "score" ? "Faculty Score" : `${safeHtml(roleLabel(role))} Score`;

const rowScoreFieldForRole = (role) =>
  role === "center_head" ? "hod" : role;

const displaySectionScore = (section, row, role) => {
  const field = rowScoreFieldForRole(role);
  const val = row?.[field];
  if (!isFilledValue(val)) return "";
  if (section.key === "research" && role === "score") {
    const rgs = researchGuidanceScore(row);
    return isFilledValue(rgs) || rgs === 0 ? rgs.toFixed(1) : "";
  }
  if (role === "score") {
    const score = clampScore(val, rowMaxForSection(section.key, row, section.max));
    return isFilledValue(score) || score === 0 ? String(score) : "";
  }
  return String(val);
};

const sectionTotalScore = (section, rows, role) => {
  if (!rows || !rows.length) return "";
  const field = rowScoreFieldForRole(role);
  const hasAnyScore = rows.some((row) => isFilledValue(row?.[field]));
  if (!hasAnyScore) return "";
  if (
    section.key === "lectures" ||
    section.key === "courseFile" ||
    section.key === "feedback"
  ) {
    const score = reviewSectionScore(section.key, rows, section.max, role);
    return isFilledValue(score) || score === 0 ? score.toFixed(1) : "";
  }
  const sum = rows.reduce(
    (acc, row) => acc + n(displaySectionScore(section, row, role)),
    0,
  );
  const total = clampScore(sum, section.max);
  return isFilledValue(total) || total === 0 ? total.toFixed(1) : "";
};

const fieldValue = (section, row, key) => {
  if (key === "pctConducted") {
    if (isFilledValue(row?.pctConducted)) return row.pctConducted;
    const planned = Number(row?.planned);
    const conducted = Number(row?.conducted);
    return planned > 0 && conducted >= 0 ? `${((conducted / planned) * 100).toFixed(1)}%` : "";
  }
  if (section.key === "research" && key === "date" && (row?.status || row?.thesis) === "Ongoing") {
    return "NA";
  }
  if ((section.key === "events" || section.key === "eventRows") && (key === "fromDate" || key === "toDate")) {
    return row?.[key] || row?.date;
  }
  return row?.[key];
};

const renderSection = ({
  section,
  rows = [],
  docs = {},
  scoreRoles = ["score"],
  roleLabel,
  showTotal = false,
}) => {
  const showDocuments = Boolean(section.doc) && section.key !== "acr" && section.showDocuments !== false;
  const totalColSpan = section.fields.length + 1 + (showDocuments ? 1 : 0);
  const displayRows = section.key === "acr" ? createAcrRows(rows) : rows;

  return `
  <h3>${safeHtml(section.title)} <span>(Max ${safeHtml(section.max)})</span></h3>
  <table>
    <thead>
      <tr>
        <th>SN</th>
        ${section.fields.map(([, label]) => `<th>${safeHtml(label)}</th>`).join("")}
        ${showDocuments ? "<th>Documents</th>" : ""}
        ${scoreRoles.map((role) => `<th>${roleColumnLabel(role, roleLabel)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${(displayRows.length ? displayRows : [{}])
        .map(
          (row, index) => `
        <tr>
          <td class="center">${index + 1}</td>
          ${section.fields.map(([key]) => `<td>${displayValue(fieldValue(section, row, key))}</td>`).join("")}
          ${showDocuments ? `<td>${docsFor(docs, `${section.doc}-${index}`)}</td>` : ""}
          ${scoreRoles.map((role) => `<td class="center">${displayValue(displaySectionScore(section, row, role))}</td>`).join("")}
        </tr>
      `,
        )
        .join("")}
      ${
        showTotal
          ? `
      <tr class="tr">
        <td colspan="${totalColSpan}" class="c b">Total Score (Max ${safeHtml(section.max)})</td>
        ${scoreRoles
          .map((role) => {
            const tot = sectionTotalScore(section, rows.length ? rows : [{}], role);
            return `<td class="c b">${tot ? safeHtml(tot) : "&nbsp;"}</td>`;
          })
          .join("")}
      </tr>`
          : ""
      }
    </tbody>
  </table>`;
};

const renderLeaveManagementSection = ({ section, rows = [] }) => {
  const max = section.max;
  const row = rows?.[0] || {};
  const takenTotal = n(row.clTaken) + n(row.mlTaken) + n(row.odTaken) + n(row.coffTaken);
  const outOfTotal = n(row.clOutOf) + n(row.mlOutOf) + n(row.odOutOf) + n(row.coffOutOf);
  const hasTaken = [row.clTaken, row.mlTaken, row.odTaken, row.coffTaken].some(isFilledValue);
  const hasOutOf = [row.clOutOf, row.mlOutOf, row.odOutOf, row.coffOutOf].some(isFilledValue);

  return `
  <h3>${safeHtml(section.title)} <span>(Max ${safeHtml(max)})</span></h3>
  <table>
    <thead>
      <tr>
        <th style="text-align:left">1. No. of leaves taken in the Year</th>
        <th>CL</th>
        <th>ML</th>
        <th>OD</th>
        <th>C/Off</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>&nbsp;</td>
        <td class="c">${displayValue(row.clTaken)}</td>
        <td class="c">${displayValue(row.mlTaken)}</td>
        <td class="c">${displayValue(row.odTaken)}</td>
        <td class="c">${displayValue(row.coffTaken)}</td>
        <td class="c b">${hasTaken ? takenTotal : "&nbsp;"}</td>
      </tr>
      <tr>
        <td class="b">Out of</td>
        <td class="c">${displayValue(row.clOutOf)}</td>
        <td class="c">${displayValue(row.mlOutOf)}</td>
        <td class="c">${displayValue(row.odOutOf)}</td>
        <td class="c">${displayValue(row.coffOutOf)}</td>
        <td class="c b">${hasOutOf ? outOfTotal : "&nbsp;"}</td>
      </tr>
    </tbody>
  </table>
  <table>
    <tbody>
      <tr><td class="b">2. No. of Late Remarks in the Year</td><td class="c">${displayValue(row.lateRemarks)}</td></tr>
      <tr><td class="b">3. Total Actual Working Days for the current academic year</td><td class="c">${displayValue(row.workingDays)}</td></tr>
      <tr><td class="b">4. Management of leaves</td><td class="c">${displayValue(row.managementRating)}</td></tr>
      <tr class="tr"><td class="c b" style="text-align:right">Total Score out of (${safeHtml(max)}) =</td><td class="c b">${isFilledValue(row.score) ? displayValue(row.score) : "0"}</td></tr>
    </tbody>
  </table>`;
};

const buildSignaturePage = ({
  facultyName = "",
  submittedAt = "",
  reviewChain = [],
}) => {
  const submissionDate = submittedAt
    ? safeHtml(
        new Date(submittedAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
      )
    : "&nbsp;";
  const reviewerRows = reviewChain.length
    ? reviewChain
        .map(
          (r) => `
        <tr>
          <td style="width:30%"><strong>${safeHtml(r.label || r.role)}</strong></td>
          <td style="width:40%;border-bottom:1px solid #000">${r.name ? safeHtml(r.name) : "&nbsp;"}</td>
          <td style="width:15%;border-bottom:1px solid #000">${r.date ? safeHtml(r.date) : "&nbsp;"}</td>
          <td style="width:15%;border-bottom:1px solid #000">&nbsp;</td>
        </tr>`,
        )
        .join("")
    : "";
  return `
  <h3 style="text-align:center;font-size:16px;background:#d9d9d9;padding:8px;margin-top:18px">DECLARATION BY FACULTY</h3>
  <table class="declaration-table" style="border:none;margin-bottom:14px">
    <tr>
      <td style="border:none;vertical-align:top;width:36px;font-size:22px">&#10003;</td>
      <td style="border:none;line-height:1.75;font-size:13px">
        I, <strong>${safeHtml(facultyName) || "________________________"}</strong>, hereby declare that all the
        information furnished in this Self-Appraisal Report is true, complete, and correct to the best of my
        knowledge and belief. I understand that in the event of any information being found false or incorrect,
        I shall be solely responsible for the consequences thereof and shall be liable for any disciplinary
        action as deemed fit by the University authorities.
      </td>
    </tr>
  </table>
  <table class="declaration-table" style="border:none;margin-bottom:20px">
    <tr>
      <td style="border:none;width:50%;font-size:12px;line-height:1.45">
        <div style="border-bottom:1px solid #000;min-height:36px;margin-bottom:4px">&nbsp;</div>
        <div><strong>Signature of Faculty</strong></div>
        <div style="margin-top:6px"><strong>Name:</strong> ${safeHtml(facultyName) || "&nbsp;"}</div>
        <div style="margin-top:4px"><strong>Date of Submission:</strong> ${submissionDate}</div>
      </td>
      <td style="border:none;width:50%">&nbsp;</td>
    </tr>
  </table>
  ${
    reviewChain.length
      ? `
  <h3 style="text-align:center;font-size:13px;background:#d9d9d9;padding:4px">REVIEWERS' ACKNOWLEDGEMENT</h3>
  <p style="font-size:10px;margin:4px 0 10px">The following authorities acknowledge that they have reviewed the details submitted by the faculty and confirm the accuracy of scores assigned.</p>
  <table>
    <thead>
      <tr>
        <th style="width:30%">Reviewer Role</th>
        <th style="width:40%">Name &amp; Signature</th>
        <th style="width:15%">Date</th>
        <th style="width:15%">Stamp</th>
      </tr>
    </thead>
    <tbody>
      ${reviewerRows}
    </tbody>
  </table>`
      : ""
  }`;
};

const isSectionReportable = () => {
  return true;
};

const renderInnovativeSection = ({
  form,
  docs,
  scoreRoles,
  roleLabel,
  showTotal = false,
}) => {
  const rows = form.innovRows?.length
    ? form.innovRows
    : [{ method: form.innovDetails, details: "" }];
  const innovTotal = (role) =>
    role === "score"
      ? clampScore(
          rows.reduce(
            (acc, row) => acc + n(row.score || form.innovScore || 0),
            0,
          ),
          10,
        )
      : clampScore(n(form[scoreKeyForInnov(role)]), 10);
  return `
  <h3>A(iii). Innovative Teaching Methods <span>(Max 10)</span></h3>
  <table>
    <thead>
      <tr>
        <th>Methods Used</th>
        <th>Details</th>
        <th>Documents</th>
        ${scoreRoles.map((role) => `<th>${roleColumnLabel(role, roleLabel)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row, index) => `
        <tr>
          <td>${displayValue(row.method || form.innovDetails)}</td>
          <td>${displayValue(row.details)}</td>
          <td>${docsFor(docs, `innov-${index}`)}</td>
          ${scoreRoles.map((role) => `<td class="center">${displayValue(role === "score" ? row.score || form.innovScore : form[scoreKeyForInnov(role)])}</td>`).join("")}
        </tr>
      `,
        )
        .join("")}
      ${
        showTotal
          ? `
      <tr class="tr">
        <td colspan="3" class="c b">Total Score (Max 10)</td>
        ${scoreRoles.map((role) => `<td class="c b">${innovTotal(role).toFixed(1)}</td>`).join("")}
      </tr>`
          : ""
      }
    </tbody>
  </table>`;
};

export const openFullFormReport = async ({
  title,
  subtitle = "",
  form = {},
  docs = {},
  partASections = [],
  partBSections = [],
  partCSections = null,
  partDSections = null,
  totals = {},
  maxScores = {},
  scoreRoles = ["score"],
  roleLabel,
  status = "",
  remarksLabel = "",
  remarks = "",
  remarksSections = null,
  generatedBy = "",
  showTotal = false,
  declaration = null,
  reviewChain = [],
  hideAcr = false,
  partDLabel = "D",
  partDTitle = "Annual Confidential Report (ACR)",
  extraSectionsHtml = "",
  summaryHtml = null,
}) => {
  const win = window.open("", "_blank", "width=1000,height=800");
  if (!win) {
    alert("Please allow popups to generate the report.");
    return;
  }

  const logoSrc = await fetchImageAsDataUrl("/image.png");
  const iqacLogoSrc = await fetchImageAsDataUrl("/IQAS.png");

  const info = form.info || {};
  const displayPartAMax = n(maxScores.partA || 0);
  const displayPartA = n(totals.partA || 0);
  const displayGrandMax = n(maxScores.grand || 0);
  const displayGrand = n(totals.total || 0);
  const displayPartAPercentage = percentOf(displayPartA, displayPartAMax);
  const displayPartBPercentage = percentOf(
    n(totals.partB || 0),
    n(maxScores.partB || 0),
  );
  const displayTotalPercentage = percentOf(displayGrand, displayGrandMax);

  const sectionAllowed = (section) =>
    isSectionReportable(form, section) && !(hideAcr && section.key === "acr");

  const hasInnovativeSection = partASections.some(
    (s) => s.key === "innovative" || s.key === "innovRows" || s.key === "innovativeTeaching"
  );
  const renderPartA = () => {
    let innovativeRendered = false;
    const items = [];
    const allowed = partASections.filter((s) => sectionAllowed(s));
    for (let i = 0; i < allowed.length; i++) {
      const section = allowed[i];
      if (section.key === "innovative" || section.key === "innovRows" || section.key === "innovativeTeaching") {
        items.push(renderInnovativeSection({ form, docs, scoreRoles, roleLabel, showTotal }));
        innovativeRendered = true;
      } else {
        items.push(
          renderSection({
            section,
            rows: form[section.key],
            docs,
            scoreRoles,
            roleLabel,
            showTotal,
          })
        );
        if (!hasInnovativeSection && !innovativeRendered && (section.key === "courseFile" || i === 1)) {
          items.push(renderInnovativeSection({ form, docs, scoreRoles, roleLabel, showTotal }));
          innovativeRendered = true;
        }
      }
    }
    if (!hasInnovativeSection && !innovativeRendered) {
      items.push(renderInnovativeSection({ form, docs, scoreRoles, roleLabel, showTotal }));
    }
    return items.join("");
  };

  const html = `<!doctype html>
<html>
<head>
  <title>${safeHtml(title)}</title>
  <style>
${PRINT_REPORT_CSS}
  </style>
</head>
<body>
  <table class="ht"><tr>
    <td style="width:20%;text-align:left"><img class="logo" src="${logoSrc}" alt="DYPIU"/></td>
    <td style="text-align:center">
      <h1>D Y PATIL INTERNATIONAL UNIVERSITY, AKURDI, PUNE</h1>
      <h2>${safeHtml(title)}</h2>
      ${subtitle ? `<h2>${safeHtml(subtitle)}</h2>` : ""}
    </td>
    <td style="width:20%;text-align:right"><img class="logo" src="${iqacLogoSrc}" alt="IQAC"/></td>
  </tr></table>
  <table>
    <tr><td class="b" style="width:35%">Name of Faculty</td><td>${displayValue(info.name || form.name)}</td></tr>
    <tr><td class="b">Educational Qualifications</td><td>${displayValue(qualificationValue(info, form))}</td></tr>
    <tr><td class="b">Present Designation</td><td>${displayValue(info.desig || form.designation || form.appraisalRole)}</td></tr>
    <tr><td class="b">School / Department</td><td>${displayValue(info.school || form.schoolName || form.school)}</td></tr>
    <tr><td class="b">Experience</td><td>${displayExperience(info, form)}</td></tr>
    <tr><td class="b">Academic Year</td><td>${displayValue(info.ay || form.academicYear)}</td></tr>
    <tr><td class="b">Generated On</td><td>${safeHtml(new Date().toLocaleString())}</td></tr>
    ${generatedBy ? `<tr><td class="b">Generated By</td><td>${safeHtml(generatedBy)}</td></tr>` : ""}
  </table>

  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART A - Teaching Process &amp; Academic Activities</h3>
  ${renderPartA()}

  <div class="page-break"></div>
  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART B - Research &amp; Academic Contributions</h3>
  ${partBSections
    .filter((section) => isSectionReportable(form, section))
    .map((section) =>
      renderSection({
        section,
        rows: form[section.key],
        docs,
        scoreRoles,
        roleLabel,
        showTotal,
      }),
    )
    .join("")}

  <div class="page-break"></div>
  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART C - Administrative Role &amp; University Development Contribution</h3>
  ${(partCSections && partCSections.length ? partCSections : [
    { key: "uniActs", title: "C1. Administration at University Level", max: 50, fields: [["activity", "Activity / Responsibility"], ["durationCat", "Duration Category"], ["period", "Period"]] },
    { key: "deptActs", title: "C2. Administration at School Level", max: 30, fields: [["activity", "Activity / Responsibility"], ["durationCat", "Duration Category"], ["period", "Period"]] },
    { key: "events", title: "C3. Event Organisation & Institutional Visibility", max: 20, fields: [["event", "Event / Contribution"], ["role", "Role"], ["fromDate", "From"], ["toDate", "To"], ["level", "Level"]] },
    { key: "society", title: "C4. Contribution to Society", max: 10, fields: [["label", "Activity / Initiative"], ["details", "Details & Impact"]] },
    { key: "industry", title: "C5. Industry Connect", max: 10, fields: [["name", "Company / Industry Partner"], ["details", "Details of Engagement"]] },
    { key: "alumni", title: "C6. Alumni Engagement", max: 10, fields: [["activity", "Alumni Activity / Initiative"], ["details", "Details & Outcomes"]] },
    { key: "placements", title: "C7. Placement Mentoring & Internship Support", max: 20, fields: [["activity", "Activity / Student Mentoring"], ["details", "Outcomes / Placements Achieved"]] }
  ])
    .filter((section) => isSectionReportable(form, section))
    .map((section) =>
      renderSection({
        section,
        rows: form[section.key],
        docs,
        scoreRoles,
        roleLabel,
        showTotal,
      }),
    )
    .join("")}

  ${extraSectionsHtml}

  ${!hideAcr ? `
  <div class="page-break"></div>
  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART ${safeHtml(partDLabel)} - ${safeHtml(partDTitle)}</h3>
  ${(partDSections && partDSections.length ? partDSections : [{ key: "acr", title: `Part ${partDLabel} - ${partDTitle}`, max: 50, fields: [["label", "Attribute"]] }])
    .filter((section) => isSectionReportable(form, section))
    .map((section) =>
      renderSection({
        section,
        rows: form[section.key] || form.acr,
        docs,
        scoreRoles: scoreRoles.filter((role) => role !== "score"),
        roleLabel,
        showTotal,
      }),
    )
    .join("")}
  ` : ""}

  <div class="page-break"></div>
  ${
    summaryHtml
      ? summaryHtml
      : `
  <h3 style="text-align:center;font-size:13px">SUMMARY</h3>
  <table class="st">
    <thead><tr><th>Section</th><th>Score</th><th>Maximum</th></tr></thead>
    <tbody>
      <tr><td>Part A</td><td class="c">${displayPartA.toFixed(1)}</td><td class="c">${safeHtml(String(displayPartAMax))}</td></tr>
      <tr><td>Part A Marks Obtained (%)</td><td colspan="2" class="c">${displayPartAPercentage}%</td></tr>
      <tr><td>Part B</td><td class="c">${n(totals.partB).toFixed(1)}</td><td class="c">${safeHtml(String(maxScores.partB ?? ""))}</td></tr>
      <tr><td>Part B Marks Obtained (%)</td><td colspan="2" class="c">${displayPartBPercentage}%</td></tr>
      <tr class="tr"><td>Grand Total</td><td class="c">${displayGrand.toFixed(1)}</td><td class="c">${safeHtml(String(displayGrandMax))}</td></tr>
      <tr class="tr"><td>Marks Obtained (%)</td><td colspan="2" class="c">${displayTotalPercentage}%</td></tr>
      ${status ? `<tr><td>Status</td><td colspan="2">${safeHtml(status)}</td></tr>` : ""}
    </tbody>
  </table>`
  }
  ${renderReviewRemarks(Array.isArray(remarksSections) ? remarksSections : remarksLabel ? [{ label: remarksLabel, remarks }] : [])}
  ${renderSummaryOtherInfo(form.summaryOtherInfo)}
  ${buildSignaturePage({
    facultyName: form.info?.name || form.name || "",
    submittedAt: declaration?.submitted_at || "",
    reviewChain,
  })}
${PRINT_SCRIPT}
</body>
</html>`;

  win.document.write(html);
  win.document.close();
};

export const generateMediaCommReport = async ({
  title,
  subtitle = "",
  form = {},
  docs = {},
  partASections = [],
  partBSections = [],
  partCSections = [],
  partDSections = [],
  partDTitle = "Annual Confidential Report (ACR)",
  partDIncludesSelfScore = false,
  partESections = null,
  partETitle = "Annual Confidential Report",
  partEScoreRoles = [],
  totals = {},
  maxScores = {},
  generatedBy = "",
  detailedSummaryRows = null,
  summaryHtml = null,
  declaration = null,
  reviewChain = [],
  remarksSections = [],
  scoreRoles = ["score"],
  partDScoreRoles = null,
  roleLabel,
}) => {
  const win = window.open("", "_blank", "width=1000,height=800");
  if (!win) {
    alert("Please allow popups to generate the report.");
    return;
  }
  const logoSrc = await fetchImageAsDataUrl("/image.png");
  const iqacLogoSrc = await fetchImageAsDataUrl("/IQAS.png");

  const info = form.info || {};
  const partDRoleSource = Array.isArray(partDScoreRoles) ? partDScoreRoles : scoreRoles;
  const resolvedPartDScoreRoles = partDIncludesSelfScore
    ? partDRoleSource
    : partDRoleSource.filter((role) => role !== "score");
  const displayPartA = n(totals.partA);
  const displayPartAMax = n(maxScores.partA || 0);
  const displayPartB = n(totals.partB);
  const displayGrand = n(totals.total);
  const displayGrandMax = n(maxScores.grand || 0);
  const partAPercentage = percentOf(displayPartA, displayPartAMax);
  const partBPercentage = percentOf(displayPartB, maxScores.partB);
  const totalPercentage = percentOf(displayGrand, displayGrandMax);
  const rowsToRender = collapsePartBSummaryRows(detailedSummaryRows);

  const html = `<!doctype html>
<html>
<head>
  <title>${safeHtml(title)}</title>
  <style>
${PRINT_REPORT_CSS}
  </style>
</head>
<body>
  <table class="ht"><tr>
    <td style="width:20%;text-align:left"><img class="logo" src="${logoSrc}" alt="DYPIU"/></td>
    <td style="text-align:center">
      <h1>D Y PATIL INTERNATIONAL UNIVERSITY, AKURDI, PUNE</h1>
      <h2>${safeHtml(title)}</h2>
      ${subtitle ? `<h2>${safeHtml(subtitle)}</h2>` : ""}
    </td>
    <td style="width:20%;text-align:right"><img class="logo" src="${iqacLogoSrc}" alt="IQAC"/></td>
  </tr></table>
  <table>
    <tr><td class="b" style="width:35%">Name of Faculty</td><td>${displayValue(info.name)}</td></tr>
    <tr><td class="b">Educational Qualifications</td><td>${displayValue(qualificationValue(info, form))}</td></tr>
    <tr><td class="b">Present Designation</td><td>${displayValue(info.desig)}</td></tr>
    <tr><td class="b">School / Department</td><td>${displayValue(info.school)}</td></tr>
    <tr><td class="b">Experience</td><td>${displayExperience(info, form)}</td></tr>
    <tr><td class="b">Academic Year</td><td>${displayValue(info.ay)}</td></tr>
    <tr><td class="b">Generated On</td><td>${safeHtml(new Date().toLocaleString())}</td></tr>
    ${generatedBy ? `<tr><td class="b">Generated By</td><td>${safeHtml(generatedBy)}</td></tr>` : ""}
  </table>

  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART A - Teaching Process &amp; Academic Activities</h3>
  ${partASections
    .filter((s) => isSectionReportable(form, s))
    .map((s) => {
      if (s.key === "innovative" || s.key === "innovRows" || s.key === "innovativeTeaching") {
        return renderInnovativeSection({ form, docs, scoreRoles, roleLabel, showTotal: true });
      }
      return renderSection({
        section: s,
        rows: form[s.key],
        docs,
        scoreRoles,
        roleLabel,
        showTotal: true,
      });
    })
    .join("")}

  <div class="pb"></div>
  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART B - Research &amp; Academic Contributions</h3>
  ${partBSections
    .filter((s) => isSectionReportable(form, s))
    .map((s) =>
      renderSection({
        section: s,
        rows: form[s.key],
        docs,
        scoreRoles,
        roleLabel,
        showTotal: true,
      }),
    )
    .join("")}

  <div class="pb"></div>
  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART C - Administrative Role &amp; University Development Contribution</h3>
  ${(partCSections.length ? partCSections : [
    { key: "uniActs", title: "C1. Administration at University Level", max: 50, fields: [["activity", "Activity / Responsibility"], ["durationCat", "Duration Category"], ["period", "Period"]] },
    { key: "deptActs", title: "C2. Administration at School Level", max: 30, fields: [["activity", "Activity / Responsibility"], ["durationCat", "Duration Category"], ["period", "Period"]] },
    { key: "events", title: "C3. Event Organisation & Institutional Visibility", max: 20, fields: [["event", "Event / Contribution"], ["role", "Role"], ["fromDate", "From"], ["toDate", "To"], ["level", "Level"]] },
    { key: "society", title: "C4. Contribution to Society", max: 10, fields: [["label", "Activity / Initiative"], ["details", "Details & Impact"]] },
    { key: "industry", title: "C5. Industry Connect", max: 10, fields: [["name", "Company / Industry Partner"], ["details", "Details of Engagement"]] },
    { key: "alumni", title: "C6. Alumni Engagement", max: 10, fields: [["activity", "Alumni Activity / Initiative"], ["details", "Details & Outcomes"]] },
    { key: "placements", title: "C7. Placement Mentoring & Internship Support", max: 20, fields: [["activity", "Activity / Student Mentoring"], ["details", "Outcomes / Placements Achieved"]] }
  ])
    .filter((s) => isSectionReportable(form, s))
    .map((s) =>
      renderSection({
        section: s,
        rows: form[s.key],
        docs,
        scoreRoles,
        roleLabel,
        showTotal: true,
      }),
    )
    .join("")}

  <div class="pb"></div>
  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART D - ${safeHtml(partDTitle)}</h3>
  ${(partDSections.length ? partDSections : [{ key: "acr", title: `Part D - ${partDTitle}`, max: 50, fields: [["label", "Attribute"]] }])
    .filter((s) => isSectionReportable(form, s))
    .map((s) =>
      s.key === "leaveManagement"
        ? renderLeaveManagementSection({ section: s, rows: form[s.key] })
        : renderSection({
            section: s,
            rows: form[s.key] || form.acr,
            docs,
            scoreRoles: resolvedPartDScoreRoles,
            roleLabel,
            showTotal: true,
          }),
    )
    .join("")}

  ${partESections && partESections.length ? `
  <div class="pb"></div>
  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART E - ${safeHtml(partETitle)}</h3>
  ${!partEScoreRoles.length ? `<div class="remarks" style="margin-bottom:10px">Evaluated by HOD/Director only. This part has no faculty self-score input.</div>` : ""}
  ${partESections
    .filter((s) => isSectionReportable(form, s))
    .map((s) =>
      renderSection({
        section: s,
        rows: form[s.key] || form.acr,
        docs,
        scoreRoles: partEScoreRoles,
        roleLabel,
        showTotal: Boolean(partEScoreRoles.length),
      }),
    )
    .join("")}
  ` : ""}

  <div class="pb"></div>
  ${
    summaryHtml
      ? summaryHtml
      : rowsToRender
      ? `
  <h3 style="text-align:center;font-size:13px">SUMMARY OF SELF SCORES - AY ${safeHtml(info.ay || "")}</h3>
  <table class="st">
    <tr><th>Sr.No.</th><th>Criteria</th><th>Max Score</th><th>Faculty Score</th></tr>
    ${rowsToRender
      .map((row, i) =>
        row.isHeader
          ? `<tr><td colspan="4" class="b" style="background:#d9d9d9;text-align:center">${safeHtml(row.label)}</td></tr>`
          : row.isGrandTotal
            ? `<tr style="background:#bfbfbf;font-weight:bold;font-size:13px"><td colspan="2" class="c">${safeHtml(row.label)}</td><td class="c">${safeHtml(String(row.max))}</td><td class="c">${n(row.score).toFixed(1)}</td></tr>`
            : row.isTotal
              ? `<tr class="tr"><td colspan="2" class="c b">${safeHtml(row.label)}</td><td class="c b">${safeHtml(String(row.max))}</td><td class="c b">${n(row.score).toFixed(1)}</td></tr>${
                  /^part a/i.test(row.label)
                    ? `<tr class="tr"><td colspan="2" class="c b">Part A Marks Obtained (%)</td><td colspan="2" class="c b">${partAPercentage}%</td></tr>`
                    : /^part b/i.test(row.label)
                      ? `<tr class="tr"><td colspan="2" class="c b">Part B Marks Obtained (%)</td><td colspan="2" class="c b">${partBPercentage}%</td></tr>`
                      : ""
                }`
              : `<tr><td class="c">${safeHtml(row.id || String(i + 1))}</td><td>${safeHtml(row.label)}</td><td class="c">${safeHtml(String(row.max))}</td><td class="c">${n(row.score).toFixed(1)}</td></tr>`,
      )
      .join("")}
    <tr class="tr"><td colspan="2" class="c b">Marks Obtained (%)</td><td colspan="2" class="c b">${totalPercentage}%</td></tr>
  </table>`
      : `
  <h2>Summary</h2>
  <table class="st">
    <tr><th>Section</th><th>Score</th><th>Maximum</th></tr>
    <tr><td>Part A</td><td class="c">${displayPartA.toFixed(1)}</td><td class="c">${safeHtml(String(displayPartAMax || ""))}</td></tr>
    <tr><td>Part A Marks Obtained (%)</td><td colspan="2" class="c">${partAPercentage}%</td></tr>
    <tr><td>Part B</td><td class="c">${displayPartB.toFixed(1)}</td><td class="c">${safeHtml(String(maxScores.partB || ""))}</td></tr>
    <tr><td>Part B Marks Obtained (%)</td><td colspan="2" class="c">${partBPercentage}%</td></tr>
    <tr class="tr"><td>Grand Total</td><td class="c">${displayGrand.toFixed(1)}</td><td class="c">${safeHtml(String(displayGrandMax || ""))}</td></tr>
    <tr class="tr"><td>Marks Obtained (%)</td><td colspan="2" class="c">${totalPercentage}%</td></tr>
  </table>`
  }
  ${renderReviewRemarks(remarksSections)}
  ${renderSummaryOtherInfo(form.summaryOtherInfo)}
  ${buildSignaturePage({
    facultyName: info.name || "",
    submittedAt: declaration?.submitted_at || "",
    reviewChain,
  })}
${PRINT_SCRIPT}
</body>
</html>`;
  win.document.write(html);
  win.document.close();
};

export const generateStandardReport = async ({
  info,
  lectures,
  courseFile,
  innovRows,
  innovTotal,
  projects,
  quals,
  feedback,
  deptActs,
  uniActs,
  society,
  industry,
  acr,
  leaveManagement,
  partDTotal,
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
  totalLecScore,
  courseFileScore,
  teachingRaw,
  stuFeedbackScore,
  deptScore,
  uniScore,
  societyScore,
  industryScore,
  acrScore,
  partATotal,
  effectivePartAMax,
  journalScore,
  bookScore,
  ictScore,
  researchScore,
  projectBScore,
  externalProjectScore,
  patentScore,
  awardScore,
  confScore,
  proposalScore,
  productScore,
  fdpScore,
  trainScore,
  partBTotal,
  effectivePartBMax,
  grandTotal,
  effectiveGrandMax,
  researchGuidanceScore: rgs,
  summaryOtherInfo = "",
  declaration = null,
  reviewChain = [],
  hideAcr = false,
}) => {
  const n = (v) => parseFloat(v) || 0;
  const teachingMax = 100;
  const selfAcrExcluded = hideAcr;
  const acrSummaryMax = selfAcrExcluded ? "" : "50";
  const acrSummaryScoreStr = selfAcrExcluded || !isFilledValue(acrScore) ? "&nbsp;" : n(acrScore).toFixed(1);
  const partAPercentageStr = isFilledValue(partATotal) && n(partATotal) > 0 ? `${percentOf(partATotal, effectivePartAMax)}%` : "&nbsp;";
  const partBPercentageStr = isFilledValue(partBTotal) && n(partBTotal) > 0 ? `${percentOf(partBTotal, effectivePartBMax)}%` : "&nbsp;";
  const totalPercentageStr = isFilledValue(grandTotal) && n(grandTotal) > 0 ? `${percentOf(grandTotal, effectiveGrandMax)}%` : "&nbsp;";
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups to generate the report.");
    return;
  }
  const logoSrc = await fetchImageAsDataUrl("/image.png");
  const iqacLogoSrc = await fetchImageAsDataUrl("/IQAS.png");
  const html = `<html><head><title>Faculty Appraisal</title><style>
${PRINT_REPORT_CSS}
  </style></head><body>
  <table class="ht"><tr>
    <td style="width:20%;text-align:left"><img class="logo" src="${logoSrc}" alt="DYPIU"/></td>
    <td style="text-align:center"><h1>D Y PATIL INTERNATIONAL UNIVERSITY, AKURDI, PUNE</h1><h2>Faculty Appraisal Form - Academic Year ${displayValue(info.ay)}</h2></td>
    <td style="width:20%;text-align:right"><img class="logo" src="${iqacLogoSrc}" alt="IQAC"/></td>
  </tr></table>
  <table>
    <tr><td class="b" style="width:35%">Name of Faculty</td><td>${displayValue(info.name)}</td></tr>
    <tr><td class="b">Educational Qualifications</td><td>${displayValue(qualificationValue(info))}</td></tr>
    <tr><td class="b">Present Designation</td><td>${displayValue(info.desig)}</td></tr>
    <tr><td class="b">School / Department</td><td>${displayValue(info.school)}</td></tr>
    <tr><td class="b">Experience</td><td>${displayExperience(info)}</td></tr>
  </table>
  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART A - Teaching Process &amp; Academic Activities</h3>
  <h3>(i) Lectures / Tutorials / Practicals (Max 50)</h3>
  <table><tr><th>SN</th><th>Semester</th><th>Course Code/Name</th><th>Classes as per Course Structure</th><th>Classes Actually Conducted</th><th>Self Score</th></tr>
  ${lectures.map((l, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(l.sem)}</td><td>${displayValue(l.code)}</td><td class="c">${displayValue(l.planned)}</td><td class="c">${displayValue(l.conducted)}</td><td class="c">${displayValue(l.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="5" class="c b">Total Score (Max 50)</td><td class="c">${isFilledValue(totalLecScore) && totalLecScore > 0 ? totalLecScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3>(ii) Course File (Max 20)</h3>
  <table><tr><th>SN</th><th>Course/Paper</th><th>Program & Semester</th><th>Details</th><th>Self Score</th></tr>
  ${courseFile.map((c, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(c.course)}</td><td>${displayValue(c.title)}</td><td>${displayValue(c.details)}</td><td class="c">${displayValue(c.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="4" class="c b">Total Score (Max 20)</td><td class="c">${isFilledValue(courseFileScore) && courseFileScore > 0 ? courseFileScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3>(iii) Innovative Teaching-Learning Methodologies (Max 10)</h3>
  <table><tr><th>SN</th><th>Methods Used</th><th>Details</th><th>Self Score</th></tr>
  ${(innovRows || []).map((r, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(r.method || r.details)}</td><td>${displayValue(r.details)}</td><td class="c">${displayValue(r.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="3" class="c b">Total Score (Max 10)</td><td class="c">${isFilledValue(innovTotal) && innovTotal > 0 ? innovTotal.toFixed(1) : "&nbsp;"}</td></tr></table>
  ${`<h3>(iv) Projects (Max 10)</h3>
  <table><tr><th>SN</th><th>Project Type</th><th>Self Score</th></tr>
  ${projects.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(p.label)}</td><td class="c">${displayValue(clampScore(p.score, projectGuidanceRowMax(p)))}</td></tr>`).join("")}
  <tr class="tr"><td colspan="2" class="c b">Total Score (Max 10)</td><td class="c">${projects.reduce((a, p) => a + n(p.score), 0) > 0 ? projects.reduce((a, p) => a + n(p.score), 0).toFixed(1) : "&nbsp;"}</td></tr></table>`
  }
  <h3>(v) Qualification Enhancement (Max 10)</h3>
  <table><tr><th>SN</th><th>Qualification / Category</th><th>Awarding Body</th><th>Date</th><th>Self Score</th></tr>
  ${quals.map((q, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(q.label)}</td><td>${displayValue(q.awardingBody)}</td><td class="c">${displayValue(q.date)}</td><td class="c">${displayValue(String(q.score ?? "").trim() ? clampScore(q.score, SCORE_LIMITS.qualificationRow) : "")}</td></tr>`).join("")}
  <tr class="tr"><td colspan="4" class="c b">Total Score (Max 10)</td><td class="c">${sumSectionScore(quals, 10, "score", SCORE_LIMITS.qualificationRow) > 0 ? sumSectionScore(quals, 10, "score", SCORE_LIMITS.qualificationRow).toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3>B. Students' Feedback (Max 10)</h3>
  <table><tr><th>SN</th><th>Course Code/Name</th><th>First Feedback(%)</th><th>Second Feedback(%)</th><th>Average</th><th>Self Score</th></tr>
  ${feedback.map((f, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(f.code)}</td><td class="c">${displayValue(f.fb1)}</td><td class="c">${displayValue(f.fb2)}</td><td class="c">${isFilledValue(f.fb1) || isFilledValue(f.fb2) ? ((n(f.fb1) + n(f.fb2)) / ((isFilledValue(f.fb1) ? 1 : 0) + (isFilledValue(f.fb2) ? 1 : 0) || 1)).toFixed(2) : "&nbsp;"}</td><td class="c">${displayValue(f.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="5" class="c b">Total (Max 10)</td><td class="c">${isFilledValue(stuFeedbackScore) && stuFeedbackScore > 0 ? stuFeedbackScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART C - Administrative Role &amp; University Development Contribution</h3>
  <h3>C2. Administration at School Level (Max 20)</h3>
  <table><tr><th>SN</th><th>Activity</th><th>Nature of Activity</th><th>Self Score</th></tr>
  ${deptActs.map((d, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(d.activity)}</td><td>${displayValue(d.nature)}</td><td class="c">${displayValue(d.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="3" class="c b">Total (Max 20)</td><td class="c">${isFilledValue(deptScore) && deptScore > 0 ? deptScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3>C1. Administration at University Level (Max 30)</h3>
  <table><tr><th>SN</th><th>Activity</th><th>Nature of Activity</th><th>Self Score</th></tr>
  ${uniActs.map((u, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(u.activity)}</td><td>${displayValue(u.nature)}</td><td class="c">${displayValue(u.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="3" class="c b">Total (Max 30)</td><td class="c">${isFilledValue(uniScore) && uniScore > 0 ? uniScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3>C4. Outreach, Extension &amp; Social Responsibility (Max 10)</h3>
  ${`<table><tr><th>SN</th><th>Activity</th><th>Details</th><th>Self Score</th></tr>
  ${society.map((s, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(s.label)}</td><td>${displayValue(s.details)}</td><td class="c">${displayValue(societyRowScore(s))}</td></tr>`).join("")}
  <tr class="tr"><td colspan="3" class="c b">Total (Max 10)</td><td class="c">${isFilledValue(societyScore) && societyScore > 0 ? societyScore.toFixed(1) : "&nbsp;"}</td></tr></table>`
  }
  <h3>C5. Industry Interaction &amp; Linkages (Max 5)</h3>
  <table><tr><th>SN</th><th>Name of Industry</th><th>Details of Activity</th><th>Self Score</th></tr>
  ${industry.map((ind, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(ind.name)}</td><td>${displayValue(ind.details)}</td><td class="c">${displayValue(ind.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="3" class="c b">Total (Max 5)</td><td class="c">${isFilledValue(industryScore) && industryScore > 0 ? industryScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART D - Leave &amp; Attendance Management (Max 25)</h3>
  <h3>D1. Management of Leaves (Max 25)</h3>
  <table><tr><th>SN</th><th>Rating</th><th>Self Score</th></tr>
  ${(leaveManagement || []).map((r, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(r.managementRating)}</td><td class="c">${displayValue(r.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="2" class="c b">Total (Max 25)</td><td class="c">${isFilledValue(partDTotal) && n(partDTotal) > 0 ? n(partDTotal).toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART E - Annual Confidential Report</h3>
  <h3>E1. Annual Confidential Report (${selfAcrExcluded ? "Not counted in self score" : "Max 50"})</h3>
  <table><tr><th>SN</th><th>Parameter</th><th>Self Score</th></tr>
  ${acr.map((a, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(a.label)}</td><td class="c">${displayValue(a.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="2" class="c b">Total (${selfAcrExcluded ? "Not counted in self score" : "Max 50"})</td><td class="c">${acrSummaryScoreStr}</td></tr></table>
  <table class="st">
    <tr><th>Part A Summary</th><th>Max</th><th>Faculty Score</th></tr>
    <tr><td>Teaching Process (i+ii+iii+iv+v)</td><td class="c">${teachingMax}</td><td class="c">${teachingRaw > 0 ? teachingRaw.toFixed(1) : "&nbsp;"}</td></tr>
    <tr><td>Students' Feedback</td><td class="c">10</td><td class="c">${stuFeedbackScore > 0 ? stuFeedbackScore.toFixed(1) : "&nbsp;"}</td></tr>
    <tr class="tr"><td class="b">PART A TOTAL</td><td class="c b">${effectivePartAMax}</td><td class="c b">${partATotal > 0 ? partATotal.toFixed(1) : "&nbsp;"}</td></tr>
    <tr class="tr"><td class="b">PART A MARKS OBTAINED (%)</td><td colspan="2" class="c b">${partAPercentageStr}</td></tr>
  </table>
  <table class="st">
    <tr><th>Part C Summary</th><th>Max</th><th>Faculty Score</th></tr>
    <tr><td>Administration at University Level</td><td class="c">30</td><td class="c">${uniScore > 0 ? uniScore.toFixed(1) : "&nbsp;"}</td></tr>
    <tr><td>Administration at School Level</td><td class="c">20</td><td class="c">${deptScore > 0 ? deptScore.toFixed(1) : "&nbsp;"}</td></tr>
    <tr><td>Outreach, Extension &amp; Social Responsibility</td><td class="c">10</td><td class="c">${societyScore > 0 ? societyScore.toFixed(1) : "&nbsp;"}</td></tr>
    <tr><td>Industry Interaction &amp; Linkages</td><td class="c">5</td><td class="c">${industryScore > 0 ? industryScore.toFixed(1) : "&nbsp;"}</td></tr>
  </table>
  <table class="st">
    <tr><th>Part D Summary</th><th>Max</th><th>Faculty Score</th></tr>
    <tr><td>Annual Confidential Report</td><td class="c">${acrSummaryMax}</td><td class="c">${acrSummaryScoreStr}</td></tr>
  </table>
  <div class="pb"></div>
  <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">PART B - Research &amp; Academic Contributions</h3>
  <h3>1) Published Papers in Journals (Max 120)</h3>
  <table><tr><th>SN</th><th>Title with Page Nos.</th><th>Journal Details</th><th>DOI No.</th><th>Journal Indexing</th><th>Self Score</th></tr>
  ${journals.map((j, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(j.title)}</td><td>${displayValue(j.journal)}</td><td class="c">${displayValue(j.issn)}</td><td class="c">${displayValue(j.index)}</td><td class="c">${displayValue(j.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="5" class="c b">Total (Max 120)</td><td class="c">${journalScore > 0 ? journalScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3>2) Articles / Chapters in Books (Max 50)</h3>
  <table><tr><th>SN</th><th>Title</th><th>Book &amp; Publisher</th><th>ISBN</th><th>Type</th><th>Co-authors</th><th>First Author</th><th>Self Score</th></tr>
  ${books.map((b, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(b.title)}</td><td>${displayValue(b.book)}</td><td class="c">${displayValue(b.issn)}</td><td>${displayValue(b.pub)}</td><td>${displayValue(b.coauth)}</td><td class="c">${displayValue(b.first)}</td><td class="c">${displayValue(b.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="7" class="c b">Total (Max 50)</td><td class="c">${bookScore > 0 ? bookScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3>3) ICT Mediated Teaching Learning Pedagogy (Max 20)</h3>
  <table><tr><th>SN</th><th>Title</th><th>Short Description</th><th>Type / Link</th><th>Quadrants</th><th>Self Score</th></tr>
  ${ict.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(r.title)}</td><td>${displayValue(r.desc)}</td><td>${displayValue(r.type)}</td><td class="c">${displayValue(r.quad)}</td><td class="c">${displayValue(r.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="5" class="c b">Total (Max 20)</td><td class="c">${ictScore > 0 ? ictScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  ${`<h3>4a) Research Guidance - PhD / PG (Max 30)</h3>
  <table><tr><th>SN</th><th>Degree</th><th>Name of Student</th><th>Status</th><th>Date</th><th>Self Score</th></tr>
  ${research.map((r, i) => `<tr><td class="c">${i + 1}</td><td class="c">${displayValue(r.degree)}</td><td>${displayValue(r.name)}</td><td>${displayValue(r.status || r.thesis)}</td><td class="c">${(r.status || r.thesis) === "Ongoing" ? "NA" : displayValue(r.date)}</td><td class="c">${isFilledValue(rgs(r)) ? rgs(r).toFixed(1) : "&nbsp;"}</td></tr>`).join("")}
  <tr class="tr"><td colspan="5" class="c b">Total (Max 30)</td><td class="c">${researchScore > 0 ? researchScore.toFixed(1) : "&nbsp;"}</td></tr></table>`
  }
  <h3>4b) Internal Research Projects (Max 15)</h3>
  <table><tr><th>SN</th><th>Title</th><th>Agency</th><th>Date</th><th>Amount</th><th>Role</th><th>Status</th><th>Self Score</th></tr>
  ${projects2.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(p.title)}</td><td>${displayValue(p.agency)}</td><td class="c">${displayValue(p.date)}</td><td class="c">${displayValue(p.amount)}</td><td>${displayValue(p.role)}</td><td>${displayValue(p.status)}</td><td class="c">${displayValue(p.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="7" class="c b">Total (Max 15)</td><td class="c">${projectBScore > 0 ? projectBScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3>4c) External Research Projects (Max 30)</h3>
  <table><tr><th>SN</th><th>Title</th><th>Agency</th><th>Date</th><th>Amount</th><th>Role</th><th>Status</th><th>Self Score</th></tr>
  ${externalProjects.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(p.title)}</td><td>${displayValue(p.agency)}</td><td class="c">${displayValue(p.date)}</td><td class="c">${displayValue(p.amount)}</td><td>${displayValue(p.role)}</td><td>${displayValue(p.status)}</td><td class="c">${displayValue(p.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="7" class="c b">Total (Max 30)</td><td class="c">${externalProjectScore > 0 ? externalProjectScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3>5a) Patents (IPR) (Max 40)</h3>
  <table><tr><th>SN</th><th>Title</th><th>Nat/Intl</th><th>Date of Filing</th><th>Status</th><th>File No.</th><th>Self Score</th></tr>
  ${patents.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(p.title)}</td><td class="c">${displayValue(p.type)}</td><td class="c">${displayValue(p.date)}</td><td>${displayValue(p.status)}</td><td class="c">${displayValue(p.fileNo)}</td><td class="c">${displayValue(p.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="6" class="c b">Total (Max 40)</td><td class="c">${patentScore > 0 ? patentScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3>5b) Research Awards / Fellowships (Max 10)</h3>
  <table><tr><th>SN</th><th>Title of Award</th><th>Date</th><th>Awarding Agency</th><th>Level</th><th>Self Score</th></tr>
  ${awards.map((a, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(a.title)}</td><td class="c">${displayValue(a.date)}</td><td>${displayValue(a.agency)}</td><td>${displayValue(a.level)}</td><td class="c">${displayValue(a.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="5" class="c b">Total (Max 10)</td><td class="c">${awardScore > 0 ? awardScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3>6) Conferences / Seminars / Workshops (Max 30)</h3>
  <table><tr><th>SN</th><th>Title / Session</th><th>Type</th><th>Organization</th><th>Level</th><th>Self Score</th></tr>
  ${confs.map((c, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(c.title)}</td><td>${displayValue(c.type)}</td><td>${displayValue(c.org)}</td><td>${displayValue(c.level)}</td><td class="c">${displayValue(c.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="5" class="c b">Total (Max 30)</td><td class="c">${confScore > 0 ? confScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3>7a) Submitted Research Proposals (Max 10)</h3>
  <table><tr><th>SN</th><th>Title of Proposal</th><th>Duration</th><th>Funding Agency</th><th>Grant Amount</th><th>Self Score</th></tr>
  ${proposals.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(p.title)}</td><td class="c">${displayValue(p.duration)}</td><td>${displayValue(p.agency)}</td><td class="c">${displayValue(p.amount)}</td><td class="c">${displayValue(p.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="5" class="c b">Total (Max 10)</td><td class="c">${proposalScore > 0 ? proposalScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3>7b) Product Developed and Used by Students / Commercialized (Max 10)</h3>
  <table><tr><th>SN</th><th>Details of Product</th><th>Used / Commercialized</th><th>Self Score</th></tr>
  ${products.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(p.details)}</td><td>${displayValue(p.usage)}</td><td class="c">${displayValue(p.score)}</td></tr>`).join("")}
  <tr class="tr"><td colspan="3" class="c b">Total (Max 10)</td><td class="c">${productScore > 0 ? productScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3>8a) Attended FDP / Workshops (Max 10)</h3>
  <table><tr><th>SN</th><th>Program</th><th>From</th><th>To</th><th>Organized By</th><th>Self Score</th></tr>
  ${fdps.map((f, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(f.program)}</td><td class="c">${displayValue(f.fromDate)}</td><td class="c">${displayValue(f.toDate)}</td><td>${displayValue(f.org)}</td><td class="c">${displayValue(clampScore(f.score, SCORE_LIMITS.fdpRow))}</td></tr>`).join("")}
  <tr class="tr"><td colspan="5" class="c b">Total (Max 10)</td><td class="c">${fdpScore > 0 ? fdpScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <h3>8b) Industrial Training (Max 10)</h3>
  <table><tr><th>SN</th><th>Company / Industry</th><th>Duration</th><th>Nature of Training</th><th>Self Score</th></tr>
  ${training.map((t, i) => `<tr><td class="c">${i + 1}</td><td>${displayValue(t.company)}</td><td class="c">${displayValue(t.duration)}</td><td>${displayValue(t.nature)}</td><td class="c">${displayValue(clampScore(t.score, SCORE_LIMITS.fdpRow))}</td></tr>`).join("")}
  <tr class="tr"><td colspan="4" class="c b">Total (Max 10)</td><td class="c">${trainScore > 0 ? trainScore.toFixed(1) : "&nbsp;"}</td></tr></table>
  <div class="pb"></div>
  <h3 style="text-align:center;font-size:13px">SUMMARY OF SELF SCORES - AY ${displayValue(info.ay)}</h3>
  <table class="st">
    <tr><th>Sr.No.</th><th>Criteria</th><th>Max Score</th><th>Faculty Score</th></tr>
    <tr><td colspan="4" class="b" style="background:#d9d9d9;text-align:center">Part A - Teaching Process</td></tr>
    <tr><td class="c">A</td><td>Teaching Process (i+ii+iii+iv+v)</td><td class="c">${teachingMax}</td><td class="c">${teachingRaw > 0 ? teachingRaw.toFixed(1) : "&nbsp;"}</td></tr>
    <tr><td class="c">B</td><td>Students' Feedback</td><td class="c">10</td><td class="c">${stuFeedbackScore > 0 ? stuFeedbackScore.toFixed(1) : "&nbsp;"}</td></tr>
    <tr class="tr"><td colspan="2" class="c b">Part A Total</td><td class="c b">${effectivePartAMax}</td><td class="c b">${partATotal > 0 ? partATotal.toFixed(1) : "&nbsp;"}</td></tr>
    <tr class="tr"><td colspan="2" class="c b">Part A Marks Obtained (%)</td><td colspan="2" class="c b">${partAPercentageStr}</td></tr>
    <tr><td colspan="4" class="b" style="background:#d9d9d9;text-align:center">Part B - Research &amp; Innovation</td></tr>
    <tr><td class="c">B</td><td>Research &amp; Innovation</td><td class="c">${effectivePartBMax}</td><td class="c">${partBTotal > 0 ? partBTotal.toFixed(1) : "&nbsp;"}</td></tr>
    <tr class="tr"><td colspan="2" class="c b">Part B Total</td><td class="c b">${effectivePartBMax}</td><td class="c b">${partBTotal > 0 ? partBTotal.toFixed(1) : "&nbsp;"}</td></tr>
    <tr class="tr"><td colspan="2" class="c b">Part B Marks Obtained (%)</td><td colspan="2" class="c b">${partBPercentageStr}</td></tr>
    <tr><td colspan="4" class="b" style="background:#d9d9d9;text-align:center">Part C - Administrative Role &amp; University Development Contribution</td></tr>
    <tr><td class="c">C1</td><td>Administration at University Level</td><td class="c">30</td><td class="c">${uniScore > 0 ? uniScore.toFixed(1) : "&nbsp;"}</td></tr>
    <tr><td class="c">C2</td><td>Administration at School Level</td><td class="c">20</td><td class="c">${deptScore > 0 ? deptScore.toFixed(1) : "&nbsp;"}</td></tr>
    <tr><td class="c">C4</td><td>Outreach, Extension &amp; Social Responsibility</td><td class="c">10</td><td class="c">${societyScore > 0 ? societyScore.toFixed(1) : "&nbsp;"}</td></tr>
    <tr><td class="c">C5</td><td>Industry Interaction &amp; Linkages</td><td class="c">5</td><td class="c">${industryScore > 0 ? industryScore.toFixed(1) : "&nbsp;"}</td></tr>
    <tr><td colspan="4" class="b" style="background:#d9d9d9;text-align:center">Part D - Annual Confidential Report</td></tr>
    <tr><td class="c">D1</td><td>Annual Confidential Report</td><td class="c">${acrSummaryMax}</td><td class="c">${acrSummaryScoreStr}</td></tr>
    <tr style="background:#bfbfbf;font-weight:bold;font-size:13px"><td colspan="2" class="c">Grand Total (Part A + Part B + Part C + Part D)</td><td class="c">${effectiveGrandMax}</td><td class="c">${grandTotal > 0 ? grandTotal.toFixed(1) : "&nbsp;"}</td></tr>
    <tr style="background:#bfbfbf;font-weight:bold;font-size:13px"><td colspan="2" class="c">Marks Obtained (%)</td><td colspan="2" class="c">${totalPercentageStr}</td></tr>
  </table>
  ${renderSummaryOtherInfo(summaryOtherInfo)}
  ${buildSignaturePage({
    facultyName: info.name || "",
    submittedAt: declaration?.submitted_at || "",
    reviewChain,
  })}
  ${PRINT_SCRIPT}
  </body></html>`;
  win.document.write(html);
  win.document.close();
};
