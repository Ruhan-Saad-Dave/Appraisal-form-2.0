import { EmptySectionRow, isSectionEmpty, T, TH, TD, TDC } from "../../../features/faculty-appraisal";
import "./RegistrarLeaveManagement.css";

const PART_D_MAX = 25;

// Registrar-only editable scoring for Part D (Leave & Attendance Management). This is the one
// place Part D is ever scored - it never routes to HOD/Director/Dean for scoring, only for
// read-only visibility (see LeaveManagementReadOnly.jsx).
export default function RegistrarLeaveManagement({ ctx, score, remarks, onScoreChange, onRemarksChange, disabled, editing = false, onRowsChange }) {
  const rows = Array.isArray(ctx.leaveManagement) ? ctx.leaveManagement : [];
  const sectionEmpty = isSectionEmpty("leaveManagement", rows);
  const field = (row, index, key, label) => editing ? (
    <input aria-label={`${label}, row ${index + 1}`} type={key === "managementRating" ? "text" : "number"} min={0}
      value={row[key] ?? ""} disabled={disabled}
      onChange={(event) => onRowsChange?.(rows.map((item, position) => position === index ? { ...item, [key]: event.target.value } : item))}
      style={{ width: "100%", minWidth: 0, boxSizing: "border-box", padding: 8, border: "1px solid #dbe3ef", borderRadius: 6, font: "inherit" }} />
  ) : (row[key] ?? "-");

  return (
    <section className="registrar-part-d">
      <h3>Part D - Leave &amp; Attendance Management</h3>
      <div>
        {sectionEmpty && !editing ? (
          <table style={{ ...T, minWidth: 0, tableLayout: "fixed" }}>
            <tbody>
              <EmptySectionRow colSpan={5} />
            </tbody>
          </table>
        ) : rows.map((r = {}, i) => (
          <div key={i} className="registrar-part-d__tables">
            <table style={{ ...T, minWidth: 0, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "32%" }} /><col style={{ width: "17%" }} /><col style={{ width: "17%" }} /><col style={{ width: "17%" }} /><col style={{ width: "17%" }} />
              </colgroup>
              <thead><tr>
                <th style={{ ...TH, textAlign: "left" }}>1. No. of leaves taken in the Year</th>
                <th style={TH}>CL</th>
                <th style={TH}>ML</th>
                <th style={TH}>OD</th>
                <th style={TH}>C/Off</th>
              </tr></thead>
              <tbody>
                <tr>
                  <td style={TD} />
                  <td style={TDC}>{field(r, i, "clTaken", "CL taken")}</td>
                  <td style={TDC}>{field(r, i, "mlTaken", "ML taken")}</td>
                  <td style={TDC}>{field(r, i, "odTaken", "OD taken")}</td>
                  <td style={TDC}>{field(r, i, "coffTaken", "C/Off taken")}</td>
                </tr>
                <tr style={{ background: "#f8fafc" }}>
                  <td style={{ ...TD, fontWeight: 700 }}>Out of</td>
                  <td style={TDC}>{field(r, i, "clOutOf", "CL allowance")}</td>
                  <td style={TDC}>{field(r, i, "mlOutOf", "ML allowance")}</td>
                  <td style={TDC}>{field(r, i, "odOutOf", "OD allowance")}</td>
                  <td style={TDC}>{field(r, i, "coffOutOf", "C/Off allowance")}</td>
                </tr>
              </tbody>
            </table>
            <table style={{ ...T, minWidth: 0, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "58%" }} /><col style={{ width: "42%" }} />
              </colgroup>
              <tbody>
                <tr>
                  <td style={{ ...TD, fontWeight: 700 }}>2. No. of Late Remarks in the Year</td>
                  <td style={TD}>{field(r, i, "lateRemarks", "Late remarks")}</td>
                </tr>
                <tr style={{ background: "#f8fafc" }}>
                  <td style={{ ...TD, fontWeight: 700 }}>3. Total Actual Working Days</td>
                  <td style={TD}>{field(r, i, "workingDays", "Working days")}</td>
                </tr>
                <tr>
                  <td style={{ ...TD, fontWeight: 700 }}>4. Management of leaves</td>
                  <td style={TD}>{field(r, i, "managementRating", "Management of leaves")}</td>
                </tr>
                <tr style={{ background: "#f8fafc" }}>
                  <td style={{ ...TD, fontWeight: 700 }}>Faculty self-declared score (out of {PART_D_MAX})</td>
                  <td style={TD}>{r.score || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        <div className="registrar-part-d__assessment">
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Registrar Score <span style={{ color: "#dc2626" }}>*</span>
            </span>
            <input
              type="number"
              min={0}
              max={PART_D_MAX}
              step="0.5"
              value={score ?? ""}
              disabled={disabled}
              onChange={(e) => onScoreChange?.(e.target.value)}
              aria-label={`Registrar score out of ${PART_D_MAX}`}
              placeholder={`0 – ${PART_D_MAX}`}
              className="registrar-assessment-input"
            />
            <small className="registrar-assessment-hint">Out of {PART_D_MAX} marks · increments of 0.5</small>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Registrar Remarks
            </span>
            <textarea
              value={remarks ?? ""}
              disabled={disabled}
              onChange={(e) => onRemarksChange?.(e.target.value)}
              rows={3}
              placeholder="Add your observations on leave and attendance…"
              className="registrar-assessment-input"
            />
          </label>
        </div>
      </div>
    </section>
  );
}
