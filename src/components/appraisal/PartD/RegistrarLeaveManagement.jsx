import { EmptySectionRow, isSectionEmpty, SectionCard as SC, T, TH, TD, TDC } from "../../../features/faculty-appraisal";

const PART_D_MAX = 25;

// Registrar-only editable scoring for Part D (Leave & Attendance Management). This is the one
// place Part D is ever scored - it never routes to HOD/Director/Dean for scoring, only for
// read-only visibility (see LeaveManagementReadOnly.jsx).
export default function RegistrarLeaveManagement({
  ctx,
  score,
  remarks,
  onScoreChange,
  onRemarksChange,
  onLeaveManagementChange,
  disabled,
}) {
  const rows = Array.isArray(ctx.leaveManagement) && ctx.leaveManagement.length
    ? ctx.leaveManagement
    : [{}];
  const sectionEmpty = isSectionEmpty("leaveManagement", rows);

  const handleCellChange = (index, field, value) => {
    if (!onLeaveManagementChange) return;
    const updated = rows.map((r, i) => (i === index ? { ...r, [field]: value } : r));
    onLeaveManagementChange(updated);
  };

  const isEditable = !disabled && Boolean(onLeaveManagementChange);

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    textAlign: "center",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "5px 6px",
    fontSize: 12,
    fontFamily: "inherit",
    fontWeight: 700,
    background: "#fff",
    color: "#0f172a",
    outline: "none",
  };

  const textInputStyle = {
    ...inputStyle,
    textAlign: "left",
  };

  return (
    <div className="review-part-stack">
      <div className="review-part-stack__title">PART D - Leave &amp; Attendance Management</div>
      <SC title={`Part D - Leave & Attendance Management (Max ${PART_D_MAX})`} accent="#0891b2">
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
          {isEditable
            ? "Registrar editable view: You can adjust faculty leave and attendance data, score, and remarks below."
            : "Faculty-submitted data - view only. Score and remarks below are entered by the Registrar."}
        </div>
        {sectionEmpty && !isEditable ? (
          <table style={{ ...T, minWidth: 0, tableLayout: "fixed" }}>
            <tbody>
              <EmptySectionRow colSpan={5} />
            </tbody>
          </table>
        ) : rows.map((r = {}, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                  <td style={TDC}>
                    {isEditable ? (
                      <input
                        type="text"
                        style={inputStyle}
                        value={r.clTaken ?? ""}
                        onChange={(e) => handleCellChange(i, "clTaken", e.target.value)}
                      />
                    ) : (
                      r.clTaken || "-"
                    )}
                  </td>
                  <td style={TDC}>
                    {isEditable ? (
                      <input
                        type="text"
                        style={inputStyle}
                        value={r.mlTaken ?? ""}
                        onChange={(e) => handleCellChange(i, "mlTaken", e.target.value)}
                      />
                    ) : (
                      r.mlTaken || "-"
                    )}
                  </td>
                  <td style={TDC}>
                    {isEditable ? (
                      <input
                        type="text"
                        style={inputStyle}
                        value={r.odTaken ?? ""}
                        onChange={(e) => handleCellChange(i, "odTaken", e.target.value)}
                      />
                    ) : (
                      r.odTaken || "-"
                    )}
                  </td>
                  <td style={TDC}>
                    {isEditable ? (
                      <input
                        type="text"
                        style={inputStyle}
                        value={r.coffTaken ?? ""}
                        onChange={(e) => handleCellChange(i, "coffTaken", e.target.value)}
                      />
                    ) : (
                      r.coffTaken || "-"
                    )}
                  </td>
                </tr>
                <tr style={{ background: "#f8fafc" }}>
                  <td style={{ ...TD, fontWeight: 700 }}>Out of</td>
                  <td style={TDC}>
                    {isEditable ? (
                      <input
                        type="text"
                        style={inputStyle}
                        value={r.clOutOf ?? ""}
                        onChange={(e) => handleCellChange(i, "clOutOf", e.target.value)}
                      />
                    ) : (
                      r.clOutOf || "-"
                    )}
                  </td>
                  <td style={TDC}>
                    {isEditable ? (
                      <input
                        type="text"
                        style={inputStyle}
                        value={r.mlOutOf ?? ""}
                        onChange={(e) => handleCellChange(i, "mlOutOf", e.target.value)}
                      />
                    ) : (
                      r.mlOutOf || "-"
                    )}
                  </td>
                  <td style={TDC}>
                    {isEditable ? (
                      <input
                        type="text"
                        style={inputStyle}
                        value={r.odOutOf ?? ""}
                        onChange={(e) => handleCellChange(i, "odOutOf", e.target.value)}
                      />
                    ) : (
                      r.odOutOf || "-"
                    )}
                  </td>
                  <td style={TDC}>
                    {isEditable ? (
                      <input
                        type="text"
                        style={inputStyle}
                        value={r.coffOutOf ?? ""}
                        onChange={(e) => handleCellChange(i, "coffOutOf", e.target.value)}
                      />
                    ) : (
                      r.coffOutOf || "-"
                    )}
                  </td>
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
                  <td style={TD}>
                    {isEditable ? (
                      <input
                        type="text"
                        style={textInputStyle}
                        value={r.lateRemarks ?? ""}
                        onChange={(e) => handleCellChange(i, "lateRemarks", e.target.value)}
                      />
                    ) : (
                      r.lateRemarks || "-"
                    )}
                  </td>
                </tr>
                <tr style={{ background: "#f8fafc" }}>
                  <td style={{ ...TD, fontWeight: 700 }}>3. Total Actual Working Days</td>
                  <td style={TD}>
                    {isEditable ? (
                      <input
                        type="text"
                        style={textInputStyle}
                        value={r.workingDays ?? ""}
                        onChange={(e) => handleCellChange(i, "workingDays", e.target.value)}
                      />
                    ) : (
                      r.workingDays || "-"
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...TD, fontWeight: 700 }}>4. Management of leaves</td>
                  <td style={TD}>
                    {isEditable ? (
                      <input
                        type="text"
                        style={textInputStyle}
                        value={r.managementRating ?? ""}
                        onChange={(e) => handleCellChange(i, "managementRating", e.target.value)}
                      />
                    ) : (
                      r.managementRating || "-"
                    )}
                  </td>
                </tr>
                <tr style={{ background: "#f8fafc" }}>
                  <td style={{ ...TD, fontWeight: 700 }}>Faculty self-declared score (out of {PART_D_MAX})</td>
                  <td style={TD}>{r.score || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        <div style={{ display: "grid", gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Registrar Score (out of {PART_D_MAX}) *
            </span>
            <input
              type="number"
              min={0}
              max={PART_D_MAX}
              step="0.5"
              value={score ?? ""}
              disabled={disabled}
              onChange={(e) => onScoreChange?.(e.target.value)}
              style={{ width: 140, padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}
            />
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
              style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
            />
          </label>
        </div>
      </SC>
    </div>
  );
}
