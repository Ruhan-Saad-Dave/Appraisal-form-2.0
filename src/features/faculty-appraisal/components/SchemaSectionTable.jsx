import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import {
  T,
  TH,
  TH_HOD,
  TH_DIR,
  TH_DEAN,
  TH_VC,
  TD,
  TDC,
  TDS,
  TDS_HOD,
  TDS_DIR,
  TDS_DEAN,
  TDS_VC,
} from "./formPrimitiveStyles";
import { SectionCard as SC, RowButtons, DocCell, ViewCell, EmptySectionRow } from "./formPrimitives";
import { n, RO, TI } from "../shared";

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

const DROPDOWN_TRANSITION_MS = 160;

function SchemaDropdown({ value, options, onChange, disabled, placeholder }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [menuRect, setMenuRect] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const closeTimerRef = useRef(null);

  const openMenu = () => {
    clearTimeout(closeTimerRef.current);
    setMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  };

  const closeMenu = () => {
    setOpen(false);
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setMounted(false), DROPDOWN_TRANSITION_MS);
  };

  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  useLayoutEffect(() => {
    if (!mounted) return undefined;

    const reposition = () => {
      const trigger = rootRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? 0;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < Math.min(menuHeight + 12, 260) && rect.top > spaceBelow;
      const width = Math.max(rect.width, 200);
      setMenuRect({
        left: Math.min(rect.left, window.innerWidth - width - 8),
        width,
        top: openUpward ? undefined : rect.bottom + 4,
        bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
      });
    };

    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return undefined;
    const handleClickOutside = (e) => {
      if (rootRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      closeMenu();
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mounted]);

  const normalized = (options || []).map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : { value: opt.value, label: opt.label ?? opt.value }
  );
  const selected = normalized.find((opt) => opt.value === value);
  const highlighted = open || focused;

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: "100%",
          height: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          border: `1px solid ${disabled ? "#e2e8f0" : highlighted ? "#6366f1" : hover ? "#a5b4fc" : "#cbd5e1"}`,
          borderRadius: 8,
          background: disabled ? "#fafafa" : "#fff",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 500,
          padding: "0 12px",
          boxSizing: "border-box",
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: highlighted && !disabled ? "0 0 0 3px rgba(99, 102, 241, 0.14)" : "none",
          transition: "border-color 150ms ease, box-shadow 150ms ease, background 150ms ease",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: disabled ? "#94a3b8" : selected ? "#1e293b" : "#94a3b8",
            fontWeight: selected ? 600 : 500,
          }}
        >
          {selected ? selected.label : placeholder || "Select"}
        </span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }}
        >
          <path
            d="M1 1l4 4 4-4"
            stroke={disabled ? "#94a3b8" : "#6366f1"}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {mounted &&
        !disabled &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: menuRect?.left ?? 0,
              top: menuRect?.top,
              bottom: menuRect?.bottom,
              width: menuRect?.width,
              visibility: menuRect ? "visible" : "hidden",
              zIndex: 1000,
              boxSizing: "border-box",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              boxShadow: "0 20px 40px -8px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(15, 23, 42, 0.06)",
              padding: 8,
              maxHeight: 260,
              overflowY: "auto",
              textAlign: "left",
              fontFamily: "inherit",
              opacity: open ? 1 : 0,
              transform: `translateY(${open ? 0 : menuRect?.bottom !== undefined ? 4 : -4}px) scale(${open ? 1 : 0.97})`,
              transformOrigin: menuRect?.bottom !== undefined ? "bottom" : "top",
              pointerEvents: open ? "auto" : "none",
              transition: `opacity ${DROPDOWN_TRANSITION_MS}ms ease, transform ${DROPDOWN_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
            }}
          >
            <div style={{ paddingBottom: 6, marginBottom: 6, borderBottom: "1px solid #f1f5f9" }}>
              <SchemaDropdownOption
                label={placeholder || "Select"}
                muted
                onClick={() => {
                  onChange?.("");
                  closeMenu();
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {normalized.map((opt) => (
                <SchemaDropdownOption
                  key={opt.value}
                  label={opt.label}
                  selected={opt.value === value}
                  onClick={() => {
                    onChange?.(opt.value);
                    closeMenu();
                  }}
                />
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function SchemaDropdownOption({ label, selected, muted, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "9px 12px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: selected ? 600 : 500,
        color: selected ? "#4338ca" : muted ? "#94a3b8" : "#1e293b",
        fontStyle: muted ? "italic" : "normal",
        background: selected ? "#eef2ff" : hover ? "#f8fafc" : "transparent",
        cursor: "pointer",
        transition: "background 120ms ease",
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {selected && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <path d="M2.5 7.2l3 3 6-6.4" stroke="#4338ca" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

const conditionalTextStyle = {
  width: "100%",
  height: 30,
  border: "1px solid #cbd5e1",
  borderRadius: 4,
  background: "#fff",
  fontFamily: "inherit",
  fontSize: 11,
  marginTop: 6,
  padding: "0 8px",
  boxSizing: "border-box",
};

function SchemaCheckbox({ checked, onChange, disabled, accent = "#2563eb" }) {
  return (
    <input
      type="checkbox"
      checked={!!checked}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.checked)}
      style={{ width: 18, height: 18, accentColor: accent, cursor: disabled ? "not-allowed" : "pointer" }}
    />
  );
}

const REVIEW_ROLE_STYLE = {
  hod: { border: "#6366f1", shadow: "rgba(99,102,241,0.08)", th: TH_HOD, tds: TDS_HOD },
  center_head: { border: "#6366f1", shadow: "rgba(99,102,241,0.08)", th: TH_HOD, tds: TDS_HOD },
  director: { border: "#0ea5e9", shadow: "rgba(14,165,233,0.08)", th: TH_DIR, tds: TDS_DIR },
  dean: { border: "#7c3aed", shadow: "rgba(124,58,237,0.08)", th: TH_DEAN, tds: TDS_DEAN },
  vc: { border: "#d97706", shadow: "rgba(217,119,6,0.08)", th: TH_VC, tds: TDS_VC },
  registrar: { border: "#0891b2", shadow: "rgba(8,145,178,0.08)", th: TH_DIR, tds: TDS_DIR },
};

function ReviewScoreInput({ val, onChange, max, disabled = false, role = "director" }) {
  const roleStyle = REVIEW_ROLE_STYLE[role] || REVIEW_ROLE_STYLE.director;
  return (
    <input
      type="number"
      min="0"
      step="0.5"
      value={val ?? ""}
      max={max}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === "" || max === undefined ? e.target.value : String(clampScore(e.target.value, max)))}
      style={{
        width: 74,
        height: 34,
        boxSizing: "border-box",
        textAlign: "center",
        border: disabled ? "1px solid #cbd5e1" : `1.5px solid ${roleStyle.border}`,
        borderRadius: 9,
        padding: "6px 8px",
        fontSize: 13,
        fontFamily: "inherit",
        fontWeight: 800,
        color: disabled ? "#94a3b8" : "#111827",
        outline: "none",
        background: disabled ? "#f8fafc" : "#ffffff",
        cursor: disabled ? "not-allowed" : "text",
        boxShadow: disabled ? "none" : `0 0 0 3px ${roleStyle.shadow}, 0 8px 18px ${roleStyle.shadow}`,
        transition: "border-color 180ms ease, box-shadow 180ms ease, background 180ms ease",
      }}
    />
  );
}

/**
 * Renders one field's value according to its schema `type`. Used both for
 * singular section-level fields and for one column inside a table row.
 */
export function SchemaFieldCell({ field, value, onChange, mode = "self", readOnly = false, center = false, docId, docs, setDocs }) {
  const isReview = mode === "review";
  const disabled = readOnly || isReview;
  const type = field?.type;

  if (type === "computed") {
    return <RO val={value} center={center} />;
  }

  if (isReview) {
    if (type === "file") return <ViewCell id={docId} docs={docs} />;
    if (type === "checkbox") return <SchemaCheckbox checked={value} disabled />;
    return <RO val={value} center={center} />;
  }

  switch (type) {
    case "number":
      return <TI val={value} onChange={onChange} numeric center={center} readOnly={disabled} max={field?.maxMarks} />;
    case "integer":
      return <TI val={value} onChange={onChange} integer center={center} readOnly={disabled} />;
    case "date":
      return (
        <TI
          val={value}
          onChange={(v) => onChange?.(maskDateDDMMYYYY(v))}
          placeholder="DD/MM/YYYY"
          readOnly={disabled}
        />
      );
    case "dropdown":
      return (
        <SchemaDropdown
          value={value}
          options={field?.options}
          onChange={onChange}
          disabled={disabled}
          placeholder={field?.label ? `Select ${field.label}` : "Select"}
        />
      );
    case "conditionalText":
      return (
        <>
          <SchemaDropdown
            value={value?.selected ?? (typeof value === "string" ? value : "")}
            options={field?.options}
            onChange={(v) => onChange?.(typeof value === "object" ? { ...value, selected: v } : { selected: v, extra: "" })}
            disabled={disabled}
            placeholder={field?.label ? `Select ${field.label}` : "Select"}
          />
          {(value?.selected === field?.triggerValue || value === field?.triggerValue) && (
            <input
              type="text"
              value={value?.extra || ""}
              disabled={disabled}
              onChange={(e) => onChange?.(typeof value === "object" ? { ...value, extra: e.target.value } : { selected: value, extra: e.target.value })}
              placeholder={field?.extraLabel || ""}
              style={conditionalTextStyle}
            />
          )}
        </>
      );
    case "checkbox":
      return <SchemaCheckbox checked={value} onChange={onChange} disabled={disabled} />;
    case "file":
      return <DocCell id={docId} docs={docs} setDocs={setDocs} readOnly={disabled} compact />;
    case "textarea":
      return <TI val={value} onChange={onChange} readOnly={disabled} placeholder={field?.label} />;
    case "text":
    default:
      return <TI val={value} onChange={onChange} readOnly={disabled} center={center} placeholder={field?.label} textOnly />;
  }
}

/**
 * Renders the per-row grid for a section's single `type: "table"` field.
 */
export function SchemaTableField({
  field,
  rows,
  onRowsChange,
  mode = "self",
  reviewerRole,
  reviewerLabel,
  reviewMax,
  rowDisabled,
  docs,
  setDocs,
  locked,
  previousReviewers = [],
}) {
  const rawColumns = field?.columns || [];
  const isReview = mode === "review";
  const columns = rawColumns.flatMap((col) => col.type === "file"
    ? (isReview ? [{ name: `${col.name || col.key}__viewDocs`, isAutoViewDocs: true, sourceColumn: col }]
      : [col, { name: `${col.name || col.key}__viewDocs`, isAutoViewDocs: true, sourceColumn: col }])
    : [col]);
  const safeRows = Array.isArray(rows) ? rows : [];

  const blankRow = () => {
    const row = {};
    rawColumns.forEach((col) => {
      row[col.name || col.key] = col.type === "checkbox" ? false : "";
    });
    return row;
  };

  const setCell = (rowIndex, colName, value) => {
    const next = safeRows.map((r, i) => (i === rowIndex ? { ...r, [colName]: value } : r));
    onRowsChange?.(next);
  };

  const setReview = (rowIndex, value) => {
    const next = safeRows.map((r, i) => (i === rowIndex ? { ...r, [`review_${reviewerRole}`]: value } : r));
    onRowsChange?.(next);
  };

  const addRow = () => onRowsChange?.([...safeRows, blankRow()]);
  const deleteLastRow = () => onRowsChange?.(safeRows.length > 1 ? safeRows.slice(0, -1) : safeRows);

  const scoreColumn = columns.find((c) => c.type === "computed" || c.type === "number");
  const roleStyle = REVIEW_ROLE_STYLE[reviewerRole] || REVIEW_ROLE_STYLE.director;
  const snWidth = field?.autoSerial ? 30 : 0;
  const dataColWidth = columns.length ? `calc((100% - ${snWidth}px) / ${columns.length})` : undefined;

  const showTotal = !isReview && Number(field?.maxMarks) > 0 && columns.length > 0;
  const totalScore = showTotal
    ? safeRows.reduce((rowSum, row) => rowSum + rawColumns.reduce((sum, col) => {
        if (!["number", "integer"].includes(col.type)) return sum;
        const value = Number(row[col.name || col.key]);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0), 0)
    : 0;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={T}>
        <thead>
          <tr>
            {field?.autoSerial && <th style={{ ...TH, width: 30, minWidth: 30, maxWidth: 30 }}>SN</th>}
            {columns.map((col) => (
              <th key={col.name || col.key} style={{ ...TH, width: dataColWidth }}>
                {col.isAutoViewDocs ? "View Docs" : (col.label || col.name || col.key)}
              </th>
            ))}
            {isReview && previousReviewers.map((reviewer) => {
              const prevStyle = REVIEW_ROLE_STYLE[reviewer.role] || REVIEW_ROLE_STYLE.director;
              return <th key={reviewer.role} style={prevStyle.th}>{reviewer.label} Score</th>;
            })}
            {isReview && <th style={roleStyle.th}>{reviewerLabel ? `${reviewerLabel} Score` : reviewerRole ? `${reviewerRole[0].toUpperCase()}${reviewerRole.slice(1)} Score` : "Review Score"}</th>}
          </tr>
        </thead>
        <tbody>
          {safeRows.length === 0 ? (
            <EmptySectionRow colSpan={columns.length + (field?.autoSerial ? 1 : 0) + (isReview ? previousReviewers.length + 1 : 0)} />
          ) : (
            safeRows.map((row, i) => (
              <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                {field?.autoSerial && <td style={{ ...TDC, width: 30, minWidth: 30, maxWidth: 30 }}>{i + 1}</td>}
                {columns.map((col) => {
                  const colKey = col.name || col.key;
                  if (col.isAutoViewDocs) {
                    return (
                      <td key={colKey} style={{ ...TDC, width: dataColWidth }}>
                        <ViewCell id={`${field.key || field.id}-${col.sourceColumn.name || col.sourceColumn.key}-${i}`} docs={docs} />
                      </td>
                    );
                  }
                  const isScoreCol = col === scoreColumn;
                  return (
                    <td key={colKey} style={{ ...(isScoreCol ? TDS : col.type === "number" || col.type === "computed" ? TDC : TD), width: dataColWidth }}>
                      <SchemaFieldCell
                        field={{ ...col, key: colKey, maxMarks: col.maxMarks }}
                        value={row[colKey]}
                        onChange={(v) => setCell(i, colKey, v)}
                        mode={mode}
                        readOnly={locked}
                        center={isScoreCol || col.type === "number" || col.type === "computed"}
                        docId={`${field.key || field.id}-${colKey}-${i}`}
                        docs={docs}
                        setDocs={setDocs}
                      />
                    </td>
                  );
                })}
                {isReview && previousReviewers.map((reviewer) => {
                  const prevStyle = REVIEW_ROLE_STYLE[reviewer.role] || REVIEW_ROLE_STYLE.director;
                  const rowScores = reviewer.sectionScores?.[field?.sectionCode || field?.key];
                  const value = Array.isArray(rowScores) ? rowScores[i] : undefined;
                  return <td key={reviewer.role} style={prevStyle.tds}>{value === undefined || value === null || value === '' ? '—' : value}</td>;
                })}
                {isReview && (
                  <td style={roleStyle.tds}>
                    <ReviewScoreInput
                      val={row[`review_${reviewerRole}`]}
                      onChange={(v) => setReview(i, v)}
                      max={reviewMax ?? scoreColumn?.maxMarks}
                      role={reviewerRole}
                      disabled={locked || (rowDisabled ? rowDisabled(row, i) : false)}
                    />
                  </td>
                )}
              </tr>
            ))
          )}
          {showTotal && (
            <tr style={{ background: "#eff6ff" }}>
              <td style={{ ...TDC, fontWeight: "bold" }} colSpan={(field?.autoSerial ? 1 : 0) + columns.length - 1}>Total Score (Max {field.maxMarks})</td>
              <td style={{ ...TDS, fontWeight: "bold", color: "#1e3a5f" }}>{totalScore.toFixed(1)}</td>
            </tr>
          )}
        </tbody>
      </table>
      {!isReview && (
        <RowButtons onAdd={addRow} onDel={deleteLastRow} canAdd={!locked} canDel={!locked && safeRows.length > 1} />
      )}
    </div>
  );
}

/**
 * Main SchemaSectionTable Component
 * Drives rendering of any PBAS form section entirely by the backend schema definition.
 */
export default function SchemaSectionTable({
  section,
  mode = "self",
  form = {},
  onSectionDataChange,
  values = {},
  onValuesChange,
  rows: rowsProp,
  onRowsChange: onRowsChangeProp,
  sectionScore,
  reviewerRole = "hod",
  reviewerLabel,
  reviewMax,
  rowDisabled,
  docs = {},
  setDocs = () => {},
  locked = false,
  accent = "#4f46e5",
  previousReviewers = [],
  previousRoles = [],
  reviewData = {},
  onReviewDataChange,
  academicYear = "",
}) {
  if (!section || section.active === false) return null;

  const sectionKey = section.section_key || section.sectionKey || section.code || "";
  const partKey = section.part?.toLowerCase().replace(/\s+/g, "") || "parta";
  const sectionAccent = accent || PART_ACCENTS[partKey] || "#4f46e5";

  const fields = section.fields || [];
  const tableField = fields.find((f) => f.type === "table") || {
    key: sectionKey,
    id: sectionKey,
    label: section.title,
    type: "table",
    columns: fields,
    autoSerial: section.autoSerial !== false,
    requireCompleteRows: Boolean(section.requireCompleteRows || section.require_complete_rows),
  };
  const scalarFields = fields.filter((f) => f.type !== "table");

  // Determine rows based on either direct prop or from `form` object
  const rows = useMemo(() => {
    if (Array.isArray(rowsProp)) return rowsProp;
    const raw = form[sectionKey] ?? form[section.code] ?? form[tableField.key];
    if (Array.isArray(raw)) return raw.length ? raw : [{}];
    if (raw && typeof raw === "object") return [raw];
    return [{}];
  }, [rowsProp, form, sectionKey, section.code, tableField.key]);

  const handleRowsChange = (nextRows) => {
    if (onRowsChangeProp) {
      onRowsChangeProp(nextRows);
    }
    if (onSectionDataChange) {
      const calculatedTotal = calculateSectionTotal(section, nextRows);
      onSectionDataChange(sectionKey, nextRows, calculatedTotal);
    }
  };

  const calculatedScore = sectionScore !== undefined ? sectionScore : calculateSectionTotal(section, rows);
  const sectionMax = section.maxMarks ?? section.max_marks;

  return (
    <SC
      title={section.title || section.label}
      accent={sectionAccent}
      scoreBadge={calculatedScore !== undefined ? `${calculatedScore}${sectionMax !== undefined ? ` / ${sectionMax}` : ""}` : undefined}
    >
      {scalarFields.map((field) => (
        <div key={field.id || field.key} style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
            {field.label}
            {field.required && <span style={{ color: "#dc2626" }}> *</span>}
          </label>
          <SchemaFieldCell
            field={field}
            value={values[field.key] ?? form[field.key]}
            onChange={(v) => {
              onValuesChange?.({ ...values, [field.key]: v });
              onSectionDataChange?.(field.key, v, calculatedScore);
            }}
            mode={mode}
            readOnly={locked}
            docId={`${section.code}-${field.key}`}
            docs={docs}
            setDocs={setDocs}
          />
        </div>
      ))}

      {tableField && (
        <SchemaTableField
          field={tableField}
          rows={rows}
          onRowsChange={handleRowsChange}
          mode={mode}
          reviewerRole={reviewerRole}
          reviewerLabel={reviewerLabel}
          reviewMax={reviewMax ?? sectionMax}
          rowDisabled={rowDisabled}
          docs={docs}
          setDocs={setDocs}
          locked={locked}
          previousReviewers={previousReviewers.length ? previousReviewers : previousRoles.map((r) => ({ role: r, label: r, sectionScores: reviewData }))}
        />
      )}
    </SC>
  );
}
