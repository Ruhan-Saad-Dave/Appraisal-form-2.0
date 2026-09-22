import {
  DocCell,
  EmptySectionRow,
  RowButtons,
  SectionCard,
  ViewCell,
} from "./formPrimitives";
import {
  T,
  TD,
  TDC,
  TDS,
  TDS_DEAN,
  TDS_DIR,
  TDS_HOD,
  TH,
  TH_DEAN,
  TH_DIR,
  TH_HOD,
  TDV,
} from "./formPrimitiveStyles";
import {
  clampReviewScore,
  clampScore,
  consultancyGuidelineScore,
  courseFileRowScore,
  externalProjectGuidelineScore,
  feedbackRowScore,
  isValidDDMMYYYY,
  lectureGuidelineScore,
  maskDateDDMMYYYY,
  researchGuidanceScore,
  societyRowLocked,
  societyRowScore,
} from "../utils";
import { incompleteTableRows } from "../utils/schemaValidation";
import { n, RO, TI } from "../shared";

// Color accents for parts
const PART_ACCENTS = {
  partA: "#4f46e5",
  partB: "#7c3aed",
  partC: "#0f766e",
  partD: "#0891b2",
  partE: "#d97706",
};

/**
 * Calculates score for a single row given the section key, column definition, and row data.
 */
export function calculateRowScore(sectionKey, field, row = {}, col = {}) {
  const sKey = String(sectionKey || "").toLowerCase();
  const max = col.maxMarks ?? col.rowMax ?? field?.rowMax ?? 10;

  if (sKey === "lectures" || sKey.includes("teaching_process")) {
    return lectureGuidelineScore(row.planned, row.conducted, max);
  }
  if (sKey === "coursefile" || sKey.includes("course_file")) {
    return courseFileRowScore(row.details ?? row.compliance, max);
  }
  if (sKey === "feedback" || sKey.includes("student_feedback")) {
    return feedbackRowScore(row.fb1, row.fb2, max);
  }
  if (sKey === "projects2" || sKey === "externalprojects" || sKey.includes("external_research_project")) {
    return externalProjectGuidelineScore(row.amount, row.role, row.status);
  }
  if (sKey === "proposals" || sKey.includes("research_proposal")) {
    return consultancyGuidelineScore(row.amount, row.duration);
  }
  if (sKey === "research" || sKey.includes("research_guidance")) {
    return researchGuidanceScore(row.degree, row.status);
  }
  if (sKey === "society" || sKey.includes("social_contribution")) {
    return societyRowScore(row.label ?? row.activity, row.score, max);
  }

  // Generic numeric score
  const entered = row[col.name] ?? row[col.key] ?? row.score ?? row.selfScore;
  if (entered !== undefined && entered !== null && entered !== "") {
    const parsed = n(entered);
    return max ? clampScore(parsed, max) : parsed;
  }

  return 0;
}

/**
 * Computes section total for a list of rows
 */
export function calculateSectionTotal(section, rows = []) {
  if (!section || !Array.isArray(rows)) return 0;
  const sKey = section.section_key || section.sectionKey || section.code || "";
  const secMax = section.maxMarks ?? section.max_marks ?? 0;

  const total = rows.reduce((acc, row) => {
    if (!row || typeof row !== "object") return acc;
    if (sKey === "society" && societyRowLocked(row)) return acc;

    // Check if row has explicit score
    const explicitScore = row.score ?? row.selfScore ?? row.self_score;
    if (explicitScore !== undefined && explicitScore !== null && explicitScore !== "") {
      return acc + n(explicitScore);
    }

    // Otherwise calculate from first computed or numeric column
    const tableField = (section.fields || []).find((f) => f.type === "table");
    const scoreCol = (tableField?.columns || []).find((c) => c.type === "computed" || c.name?.toLowerCase().includes("score"));
    if (scoreCol) {
      return acc + calculateRowScore(sKey, tableField, row, scoreCol);
    }

    return acc;
  }, 0);

  return secMax > 0 ? clampScore(total, secMax) : total;
}

/**
 * Single Typed Cell Component for Schema Table
 */
function SchemaTableCell({
  column,
  value,
  onChange,
  readOnly = false,
  docKey = "",
  docs = {},
  setDocs = () => {},
  isMissing = false,
}) {
  const { type, placeholder, options = [], triggerValue, extraLabel, extraKey, maxMarks } = column;

  const inputStyle = {
    borderColor: isMissing ? "#ef4444" : undefined,
    boxShadow: isMissing ? "0 0 0 1.5px rgba(239, 68, 68, 0.25)" : undefined,
  };

  if (type === "computed") {
    return (
      <div style={{ fontWeight: 800, color: "#4f46e5", textAlign: "right", paddingRight: 6 }}>
        {value !== undefined && value !== null && value !== "" ? n(value).toFixed(1) : "0.0"}
      </div>
    );
  }

  if (type === "file") {
    if (readOnly) {
      return <ViewCell docKey={docKey} docs={docs} />;
    }
    return <DocCell docKey={docKey} docs={docs} setDocs={setDocs} readOnly={readOnly} />;
  }

  if (type === "conditionalText") {
    const choice = typeof value === "object" ? value?.choice : value;
    const extra = typeof value === "object" ? value?.extra : "";
    const isTriggered = choice === (triggerValue || "Other") || choice === "Any other" || choice === "Any other innovative method";

    if (readOnly) {
      return (
        <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 600 }}>
          {choice || "—"}
          {isTriggered && extra && (
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>({extra})</div>
          )}
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <select
          className="appraisal-select"
          style={{ ...inputStyle, width: "100%", minHeight: 34, padding: "5px 8px", fontSize: 12.5, borderRadius: 6 }}
          value={choice || ""}
          onChange={(e) => {
            const nextChoice = e.target.value;
            onChange({ choice: nextChoice, extra: nextChoice === triggerValue ? extra : "" });
          }}
        >
          <option value="">{placeholder || "Select..."}</option>
          {(options.length ? options : ["Option 1", "Other"]).map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
        {isTriggered && (
          <input
            type="text"
            className="appraisal-input"
            style={{ ...inputStyle, width: "100%", minHeight: 32, padding: "4px 8px", fontSize: 12, borderRadius: 6 }}
            placeholder={extraLabel || "Please specify"}
            value={extra || ""}
            onChange={(e) => onChange({ choice, extra: e.target.value })}
          />
        )}
      </div>
    );
  }

  if (type === "dropdown" || type === "select") {
    if (readOnly) {
      return <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 600 }}>{value || "—"}</div>;
    }
    return (
      <select
        className="appraisal-select"
        style={{ ...inputStyle, width: "100%", minHeight: 34, padding: "5px 8px", fontSize: 12.5, borderRadius: 6 }}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder || "Select..."}</option>
        {options.map((opt, i) => (
          <option key={i} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (type === "checkbox" || type === "yesNo") {
    if (readOnly) {
      return <div style={{ fontSize: 13, fontWeight: 700, color: value ? "#059669" : "#64748b" }}>{value === true || value === "Yes" || value === "true" ? "Yes" : value === false || value === "No" || value === "false" ? "No" : "—"}</div>;
    }
    return (
      <select
        className="appraisal-select"
        style={{ ...inputStyle, width: "100%", minHeight: 34, padding: "5px 8px", fontSize: 12.5, borderRadius: 6 }}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? "" : e.target.value === "true" || e.target.value === "Yes")}
      >
        <option value="">{placeholder || "Select..."}</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (type === "date") {
    if (readOnly) {
      return <div style={{ fontSize: 13, color: "#1e293b" }}>{value || "—"}</div>;
    }
    return (
      <input
        type="text"
        className="appraisal-input"
        style={{ ...inputStyle, width: "100%", minHeight: 34, padding: "5px 8px", fontSize: 12.5, borderRadius: 6 }}
        placeholder={placeholder || "DD/MM/YYYY"}
        value={value || ""}
        onChange={(e) => onChange(maskDateDDMMYYYY(e.target.value))}
      />
    );
  }

  if (type === "number" || type === "integer") {
    if (readOnly) {
      return <div style={{ fontSize: 13, textAlign: "right", fontWeight: 600, color: "#1e293b" }}>{value !== undefined && value !== null && value !== "" ? value : "—"}</div>;
    }
    return (
      <input
        type="number"
        className="appraisal-input"
        style={{ ...inputStyle, width: "100%", minHeight: 34, padding: "5px 8px", textAlign: "right", fontSize: 12.5, borderRadius: 6 }}
        placeholder={placeholder || "0"}
        value={value ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "") {
            onChange("");
          } else {
            const num = type === "integer" ? parseInt(val, 10) : parseFloat(val);
            const clamped = maxMarks ? Math.min(num, maxMarks) : num;
            onChange(isNaN(clamped) ? "" : clamped);
          }
        }}
      />
    );
  }

  if (type === "textarea") {
    if (readOnly) {
      return <div style={{ fontSize: 13, color: "#1e293b", whiteSpace: "pre-wrap" }}>{value || "—"}</div>;
    }
    return (
      <textarea
        className="appraisal-textarea"
        style={{ ...inputStyle, width: "100%", minHeight: 54, padding: "6px 8px", fontSize: 12.5, borderRadius: 6, resize: "vertical" }}
        placeholder={placeholder || ""}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // Default: text
  if (readOnly) {
    return <div style={{ fontSize: 13, color: "#1e293b" }}>{value || "—"}</div>;
  }
  return (
    <input
      type="text"
      className="appraisal-input"
      style={{ ...inputStyle, width: "100%", minHeight: 34, padding: "5px 8px", fontSize: 12.5, borderRadius: 6 }}
      placeholder={placeholder || ""}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/**
 * Main SchemaSectionTable Component
 * Drives rendering of any PBAS form section entirely by the backend schema definition.
 */
export default function SchemaSectionTable({
  section,
  mode = "self", // "self" | "review"
  form = {},
  onSectionDataChange,
  docs = {},
  setDocs = () => {},
  locked = false,
  reviewerRole = "hod",
  reviewData = {},
  onReviewDataChange,
  previousRoles = [],
  academicYear = "",
}) {
  if (!section || section.active === false) return null;

  const sectionKey = section.section_key || section.sectionKey || section.code;
  const partKey = section.part?.toLowerCase().replace(/\s+/g, "") || "parta";
  const accent = PART_ACCENTS[partKey] || "#4f46e5";

  // Find table field or default to section-level table
  const tableField = useMemo(() => {
    return (section.fields || []).find((f) => f.type === "table") || {
      key: sectionKey,
      label: section.title,
      type: "table",
      columns: section.fields || [],
      autoSerial: section.autoSerial !== false,
      requireCompleteRows: Boolean(section.requireCompleteRows || section.require_complete_rows),
    };
  }, [section, sectionKey]);

  // Extract rows from form state
  const rows = useMemo(() => {
    const raw = form[sectionKey] ?? form[section.code] ?? form[tableField.key];
    if (Array.isArray(raw)) {
      return raw.length ? raw : [{}];
    }
    if (raw && typeof raw === "object") {
      return [raw];
    }
    return [{}];
  }, [form, sectionKey, section.code, tableField.key]);

  // Client-side incomplete rows check (§2.3 constraint)
  const incompleteErrors = useMemo(() => {
    return incompleteTableRows(tableField, rows);
  }, [tableField, rows]);

  // Section score calculation
  const totalScore = useMemo(() => {
    return calculateSectionTotal(section, rows);
  }, [section, rows]);

  // Update cell handler
  const handleCellChange = (rowIndex, colKey, colName, nextVal) => {
    const updatedRows = [...rows];
    const targetKey = colName || colKey;
    updatedRows[rowIndex] = {
      ...updatedRows[rowIndex],
      [targetKey]: nextVal,
    };

    // Recompute row score if needed
    const scoreCol = (tableField.columns || []).find((c) => c.type === "computed" || c.name?.toLowerCase().includes("score"));
    if (scoreCol) {
      const computedScore = calculateRowScore(sectionKey, tableField, updatedRows[rowIndex], scoreCol);
      updatedRows[rowIndex].score = computedScore;
    }

    const calculatedTotal = calculateSectionTotal(section, updatedRows);
    onSectionDataChange?.(sectionKey, updatedRows, calculatedTotal);
  };

  // Add row handler
  const handleAddRow = () => {
    const updatedRows = [...rows, {}];
    onSectionDataChange?.(sectionKey, updatedRows, totalScore);
  };

  // Remove row handler - deletes only the last row (§3 constraint)
  const handleRemoveLastRow = () => {
    if (rows.length <= 1) return;
    const updatedRows = rows.slice(0, -1);
    const calculatedTotal = calculateSectionTotal(section, updatedRows);
    onSectionDataChange?.(sectionKey, updatedRows, calculatedTotal);
  };

  // Review score update handler
  const handleReviewScoreChange = (rowIndex, role, val) => {
    const maxScore = section.maxMarks || 50;
    const currentSectionReview = reviewData[sectionKey] || [];
    const updatedReviewRows = Array.isArray(currentSectionReview) ? [...currentSectionReview] : [];
    while (updatedReviewRows.length <= rowIndex) {
      updatedReviewRows.push({});
    }
    const clampedVal = clampReviewScore(sectionKey, rows[rowIndex] || {}, val, maxScore);
    updatedReviewRows[rowIndex] = {
      ...updatedReviewRows[rowIndex],
      [role]: clampedVal === "" ? val : clampedVal,
    };
    onReviewDataChange?.(sectionKey, updatedReviewRows);
  };

  const isReviewMode = mode === "review";
  const columns = tableField.columns || [];

  return (
    <SectionCard
      title={section.title}
      max={section.maxMarks}
      accent={accent}
      scoreBadge={totalScore > 0 ? `${totalScore.toFixed(1)} / ${section.maxMarks}` : `0 / ${section.maxMarks}`}
    >
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e2e8f0" }}>
        <table style={T}>
          <thead>
            <tr>
              {tableField.autoSerial !== false && (
                <th style={{ ...TH, width: 48, textAlign: "center" }}>Sr.</th>
              )}
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  style={{
                    ...TH,
                    minWidth: col.type === "file" ? 90 : col.type === "textarea" ? 180 : 120,
                    textAlign: col.type === "number" || col.type === "integer" || col.type === "computed" ? "right" : "left",
                  }}
                >
                  <span>{col.name || col.label || `Column ${idx + 1}`}</span>
                  {col.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
                  {col.maxMarks != null && (
                    <span style={{ fontSize: 10, opacity: 0.75, marginLeft: 4 }}>
                      (Max {col.maxMarks})
                    </span>
                  )}
                </th>
              ))}

              {/* Reviewer Headers */}
              {isReviewMode && previousRoles.includes("hod") && <th style={TH_HOD}>HOD</th>}
              {isReviewMode && previousRoles.includes("director") && <th style={TH_DIR}>Director</th>}
              {isReviewMode && previousRoles.includes("dean") && <th style={TH_DEAN}>Dean</th>}
              {isReviewMode && reviewerRole === "hod" && <th style={TH_HOD}>HOD Score</th>}
              {isReviewMode && reviewerRole === "director" && <th style={TH_DIR}>Director Score</th>}
              {isReviewMode && (reviewerRole === "dean" || reviewerRole === "non_engineering_dean") && <th style={TH_DEAN}>Dean Score</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => {
              const rowMissing = incompleteErrors.find((e) => e.row === rIdx + 1)?.missing || [];
              const docKey = `${sectionKey}-${rIdx}`;

              return (
                <tr key={rIdx} style={{ background: rIdx % 2 === 1 ? "#fbfcfd" : "#fff" }}>
                  {tableField.autoSerial !== false && (
                    <td style={{ ...TDC, fontWeight: 700, color: "#64748b" }}>{rIdx + 1}</td>
                  )}

                  {columns.map((col, cIdx) => {
                    const colKey = col.name || col.key;
                    const val = row[colKey] ?? row[col.key];
                    const isMissing = rowMissing.includes(col.name) || rowMissing.includes(col.key);

                    return (
                      <td
                        key={cIdx}
                        style={{
                          ...TD,
                          textAlign: col.type === "number" || col.type === "integer" || col.type === "computed" ? "right" : "left",
                        }}
                      >
                        <SchemaTableCell
                          column={col}
                          value={val}
                          onChange={(next) => handleCellChange(rIdx, col.key, col.name, next)}
                          readOnly={locked || isReviewMode}
                          docKey={docKey}
                          docs={docs}
                          setDocs={setDocs}
                          isMissing={isMissing}
                        />
                      </td>
                    );
                  })}

                  {/* Previous Reviewer Cells */}
                  {isReviewMode && previousRoles.includes("hod") && (
                    <td style={TDS_HOD}>{row.hodScore ?? row.hod ?? "—"}</td>
                  )}
                  {isReviewMode && previousRoles.includes("director") && (
                    <td style={TDS_DIR}>{row.directorScore ?? row.director ?? "—"}</td>
                  )}
                  {isReviewMode && previousRoles.includes("dean") && (
                    <td style={TDS_DEAN}>{row.deanScore ?? row.dean ?? "—"}</td>
                  )}

                  {/* Current Reviewer Input */}
                  {isReviewMode && reviewerRole === "hod" && (
                    <td style={TDS}>
                      <TI
                        type="number"
                        style={{ width: 68, textAlign: "right", fontWeight: 700 }}
                        value={reviewData[sectionKey]?.[rIdx]?.hod ?? row.hod ?? ""}
                        onChange={(e) => handleReviewScoreChange(rIdx, "hod", e.target.value)}
                      />
                    </td>
                  )}
                  {isReviewMode && reviewerRole === "director" && (
                    <td style={TDS}>
                      <TI
                        type="number"
                        style={{ width: 68, textAlign: "right", fontWeight: 700 }}
                        value={reviewData[sectionKey]?.[rIdx]?.director ?? row.director ?? ""}
                        onChange={(e) => handleReviewScoreChange(rIdx, "director", e.target.value)}
                      />
                    </td>
                  )}
                  {isReviewMode && (reviewerRole === "dean" || reviewerRole === "non_engineering_dean") && (
                    <td style={TDS}>
                      <TI
                        type="number"
                        style={{ width: 68, textAlign: "right", fontWeight: 700 }}
                        value={reviewData[sectionKey]?.[rIdx]?.dean ?? row.dean ?? ""}
                        onChange={(e) => handleReviewScoreChange(rIdx, "dean", e.target.value)}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Client-side incomplete rows UX notice */}
      {incompleteErrors.length > 0 && (
        <div style={{ padding: "8px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 12, fontWeight: 600 }}>
          ⚠️ Incomplete rows detected: row {incompleteErrors.map((e) => e.row).join(", ")}. Please fill all required fields before submission.
        </div>
      )}

      {/* Row Buttons in Self Mode */}
      {!isReviewMode && !locked && (
        <RowButtons
          onAdd={handleAddRow}
          onDel={handleRemoveLastRow}
          canDel={rows.length > 1}
          addLabel="+ Add Row"
          deleteLabel="- Remove Last Row"
        />
      )}
    </SectionCard>
  );
}
