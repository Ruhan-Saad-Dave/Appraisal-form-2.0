import { useState } from "react";
import { SCHOOL_OPTIONS, DEAN_TRACKS } from "../../constants/universityHierarchy";
import { useSchools } from "../../services/schoolsService";
import RoleTransferForm from "./RoleTransferForm";

const DEAN_TRACK_OPTIONS = [
  { value: DEAN_TRACKS.ENGINEERING, label: "Dean of Engineering" },
  { value: DEAN_TRACKS.NON_ENGINEERING, label: "Dean of Non-Engineering" },
];

const selectStyle = {
  padding: "7px 10px",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#fff",
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "inherit",
  outline: "none",
  cursor: "pointer",
};

function TransferIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 3h5v5" />
      <path d="M21 3 13 11" />
      <path d="M8 21H3v-5" />
      <path d="M3 21l8-8" />
    </svg>
  );
}

function TransferCard({ title, subtitle, accent, options, value, onChange, roleType, roleLabel }) {
  return (
    <div className="fa-fade-up" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
      <div style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "#fbfcfd", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}1A`, color: accent, border: `1px solid ${accent}2A`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <TransferIcon />
          </span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>{title}</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>{subtitle}</div>
          </div>
        </div>
        <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div style={{ padding: "18px 24px 22px" }}>
        <RoleTransferForm roleType={roleType} scopeId={value} roleLabel={roleLabel} accent={accent} />
      </div>
    </div>
  );
}

// VC-only: transfer Director or Dean ownership to a newly appointed person. HOD transfer
// lives on the Director dashboard instead, next to each department (Director owns that scope).
export default function RoleTransferPanel() {
  useSchools(); // subscribes to live schools data so SCHOOL_OPTIONS below re-renders fresh
  const directorSchools = SCHOOL_OPTIONS.filter((school) => school.value !== "CISR");
  const [directorSchool, setDirectorSchool] = useState(directorSchools[0]?.value || "");
  const [deanTrack, setDeanTrack] = useState(DEAN_TRACK_OPTIONS[0].value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <div className="fa-slide-top" style={{ display: "flex", alignItems: "center", gap: 16, background: "#fff", borderRadius: 14, padding: "16px 24px", boxShadow: "0 10px 28px rgba(17,24,39,0.06)", border: "1px solid #e5e7eb", flexWrap: "wrap" }}>
        <div style={{ width: 48, height: 48, borderRadius: 13, background: "linear-gradient(135deg,#ede9fe,#ddd6fe)", color: "#6d28d9", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <TransferIcon />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a", letterSpacing: -0.4 }}>Role Transfers</h1>
          <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: 12.5, lineHeight: 1.5, maxWidth: 900 }}>
            Transfer Director or Dean ownership to a newly appointed person. The outgoing person
            reverts to Faculty and keeps permanent read-only access to their own past appraisal
            history - nothing else changes, and any in-progress forms in their queue move to the
            incoming person automatically.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 16 }}>
        <TransferCard
          title="Transfer Director"
          subtitle="Pick a school, then hand off its Director position."
          accent="#059669"
          options={directorSchools}
          value={directorSchool}
          onChange={setDirectorSchool}
          roleType="Director"
          roleLabel="Director"
        />

        <TransferCard
          title="Transfer Dean"
          subtitle="Pick a track, then hand off that Dean position."
          accent="#7c3aed"
          options={DEAN_TRACK_OPTIONS}
          value={deanTrack}
          onChange={setDeanTrack}
          roleType="Dean"
          roleLabel="Dean"
        />
      </div>
    </div>
  );
}
