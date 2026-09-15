/* eslint-disable react-refresh/only-export-components */
import { FileDown, Send, LockKeyhole } from "lucide-react";
export const SUMMARY_DECLARATION_TEXT =
  "I hereby declare that the information furnished above is true and correct to the best of my knowledge and belief, and is supported by documentary evidence enclosed with this form. I understand that any false claim, if detected at any stage, may render this appraisal liable to cancellation and may attract disciplinary action as per university policy.";

export const SUMMARY_ATTACHMENTS_DECLARATION = (
  <>
    I confirm that <strong>all required supporting documents and attachments have been uploaded</strong> against the respective entries. I understand that any <strong>missing or false attachment is my sole responsibility</strong> and may result in the rejection or revision of my appraisal.
  </>
);

export function InlineSvgIcon({ paths, size = 16, strokeWidth = 2.2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((path) => <path key={path} d={path} />)}
    </svg>
  );
}

export const SUMMARY_ICONS = {
  book: ["M4 19.5V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-1.5Z", "M8 7h6M8 11h8M8 15h5"],
  flask: ["M9 3h6", "M10 3v6l-4 8a3 3 0 0 0 2.7 4.3h6.6A3 3 0 0 0 18 17l-4-8V3", "M8 16h8"],
  building: ["M4 21V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14", "M20 21v-9a2 2 0 0 0-2-2h-2", "M8 9h4M8 13h4M8 17h4"],
  calendar: ["M8 2v4M16 2v4", "M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"],
  document: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z", "M14 2v6h6", "M8 13h8M8 17h6"],
  report: ["M6 2h9l5 5v15H6z", "M14 2v6h6", "M9 13h6M9 17h6"],
  sigma: ["M18 4H7l6 8-6 8h11"],
  send: ["M22 2 11 13", "M22 2 15 22l-4-9-9-4 20-7Z"],
  user: ["M20 21a8 8 0 0 0-16 0", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"],
};

export function ScoreBadge({ score, max, color, tone = "#eef2ff" }) {
  return (
    <span style={{ display: "inline-flex", justifyContent: "center", minWidth: 92, borderRadius: 999, padding: "6px 12px", background: tone, color, fontSize: 13, fontWeight: 900, lineHeight: 1, whiteSpace: "nowrap" }}>
      {Number(score || 0).toFixed(1)}/{max}
    </span>
  );
}

export function AppraisalSummaryRow({ label, score, max, color, tone, iconTone, icon }) {
  return (
    <tr className="appraisal-summary-row">
      <td style={{ padding: 0, border: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 52, padding: "10px 12px" }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: iconTone, color, border: `1px solid ${color}20`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <InlineSvgIcon paths={SUMMARY_ICONS[icon]} size={17} />
          </span>
          <span style={{ color: "#1f2937", fontSize: 13, fontWeight: 800, lineHeight: 1.35 }}>{label}</span>
        </div>
      </td>
      <td style={{ width: 150, padding: "10px 12px", border: 0, textAlign: "right", verticalAlign: "middle" }}>
        <ScoreBadge score={score} max={max} color={color} tone={tone} />
      </td>
    </tr>
  );
}

export function AppraisalSummaryTable({ rows }) {
  return (
    <table className="appraisal-summary-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, marginBottom: 0, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 12px 26px rgba(15,23,42,0.04)" }}>
      <tbody>
        {rows.filter(Boolean).map((row) => (
          <AppraisalSummaryRow key={row.label} {...row} />
        ))}
      </tbody>
    </table>
  );
}

export function AppraisalSummaryActionButton({
  type = "button",
  variant = "report",
  disabled = false,
  loading = false,
  locked = false,
  onClick,
  children,
}) {
  const isSubmit = variant === "submit";
  const Glyph = locked ? LockKeyhole : isSubmit ? Send : FileDown;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`summary-action ${isSubmit ? "appraisal-submit-button" : "appraisal-report-button"}${locked ? " is-locked" : ""}`}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="appraisal-button-spinner" aria-hidden="true" /> : <Glyph size={17} aria-hidden="true" />}
      {children}
    </button>
  );
}
