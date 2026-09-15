import { useState, useEffect, useCallback } from "react";
import { listSchoolDepartments, addSchoolDepartment, removeSchoolDepartment } from "../../services/departmentsService";
import { fetchSchoolHods, transferRole, removeRoleAssignment, deactivateHodAccount } from "../../services/roleAssignmentsService";
import { fetchSchoolFaculty, assignFacultyToProgram } from "../../services/facultyAssignmentService";
import { schoolUnitLabel } from "../../constants/universityHierarchy";
import CreateHodForm from "./CreateHodForm";
import AppraisalHeaderImage from "../AppraisalHeaderImage";
import { Layers, ShieldCheck, Users, Check, Plus, Trash2 } from "lucide-react";
import "./ManageDepartmentsPanel.css";

const initialsFor = (value = "") => {
  const trimmed = String(value).trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
};

const hodPrograms = (hod = {}) => (Array.isArray(hod.departments) ? hod.departments.filter(Boolean) : []);

const selectStyle = { padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 12.5, fontFamily: "inherit", outline: "none", background: "#fff", color: "#0f172a" };

// - Modal shell (reused for "Create HOD") -
function Modal({ title, subtitle, onClose, children, width = 520, icon, accent = "#7c3aed" }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 24, boxSizing: "border-box", overflow: "hidden", animation: "mdp-fade 0.16s ease" }}
      onClick={onClose}
    >
      <div
        style={{ width: `min(${width}px, 94vw)`, maxWidth: "100%", boxSizing: "border-box", maxHeight: "90vh", overflowY: "auto", overflowX: "hidden", background: "#fff", borderRadius: 20, border: "1px solid #eef2f7", boxShadow: "0 30px 80px rgba(15,23,42,0.30)", padding: 32, animation: "mdp-pop 0.18s cubic-bezier(0.2,0.9,0.3,1.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, minWidth: 0 }}>
            {icon && (
              <span style={{ width: 46, height: 46, borderRadius: 13, background: `${accent}14`, color: accent, border: `1px solid ${accent}2A`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {icon}
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 900, color: "#0f172a", letterSpacing: -0.3 }}>{title}</div>
              {subtitle && <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 5, lineHeight: 1.55 }}>{subtitle}</div>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mdp-modal-close"
            style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background .15s, color .15s" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
      <style>{`
        @keyframes mdp-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mdp-pop { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .mdp-modal-close:hover { background: #fee2e2 !important; color: #dc2626 !important; }
      `}</style>
    </div>
  );
}

// - Step indicator bar shared by all 3 steps - each step gets its own icon (not just a number)
// so the bar reads at a glance instead of requiring the label text to explain what it is.
function StepBar({ step, onStepChange, unitLabel }) {
  const steps = [
    { id: 1, label: `Create ${unitLabel}`, icon: ["m12 2 9 5-9 5-9-5 9-5Z", "m3 12 9 5 9-5", "m3 17 9 5 9-5"] },
    { id: 2, label: "Create HOD", icon: ["M12 3.2 19 6v5.2c0 4.4-2.9 7.6-7 8.6-4.1-1-7-4.2-7-8.6V6l7-2.8Z", "m9.3 12 1.8 1.8 3.6-3.8"] },
    { id: 3, label: "Assign Faculty", icon: ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M23 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"] },
  ];
  return (
    <div className="program-management__steps" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "#fff", borderRadius: 16, padding: "16px 24px", boxShadow: "0 12px 32px rgba(15,23,42,0.06)", border: "1px solid #e5e7eb", flexWrap: "wrap" }}>
      {steps.map((s, idx) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, flex: idx < steps.length - 1 ? "1 1 0%" : "0 0 auto" }}>
          <button
            type="button"
            onClick={() => onStepChange(s.id)}
            aria-current={step === s.id ? "step" : undefined}
            style={{ display: "flex", alignItems: "center", gap: 11, border: "none", background: step === s.id ? "#f5f3ff" : "transparent", cursor: "pointer", fontFamily: "inherit", padding: "8px 14px 8px 8px", borderRadius: 12, transition: "background .15s", whiteSpace: "nowrap" }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: step === s.id ? "linear-gradient(135deg,#a78bfa,#7c3aed)" : step > s.id ? "#dcfce7" : "#f1f5f9",
                color: step === s.id ? "#fff" : step > s.id ? "#16a34a" : "#94a3b8",
                boxShadow: step === s.id ? "0 6px 14px rgba(124,58,237,0.32)" : "none",
                transition: "background .15s, color .15s, box-shadow .15s",
              }}
            >
              {step > s.id ? <Check size={17} /> : s.id === 1 ? <Layers size={17} /> : s.id === 2 ? <ShieldCheck size={17} /> : <Users size={17} />}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: step === s.id ? "#0f172a" : "#64748b" }}>{s.label}</span>
          </button>
          {idx < steps.length - 1 && <span style={{ flex: "1 1 auto", minWidth: 24, height: 2, background: step > s.id ? "#bbf7d0" : "#e2e8f0", borderRadius: 2 }} />}
        </div>
      ))}
    </div>
  );
}

// ============================== STEP 1: Create Program ==============================
function StepPrograms({ school, unitLabel, unitLabelLower, isDepartmentSchool, departments, loading, error, onRefresh, onNext }) {
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setLocalError("");
    try {
      await addSchoolDepartment(school, newName.trim());
      setNewName("");
      await onRefresh();
    } catch (err) {
      setLocalError(err?.message || `Could not add ${unitLabelLower}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (department) => {
    if (!window.confirm(`Remove "${department.name}"? Faculty/HOD already assigned to it will be affected.`)) return;
    setLocalError("");
    try {
      await removeSchoolDepartment(school, department.id);
      await onRefresh();
    } catch (err) {
      setLocalError(err?.message || `Could not remove ${unitLabelLower}.`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 12px 30px rgba(15,23,42,0.05)", border: "1px solid #e2e8f0", padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", marginBottom: 2 }}>Step 1 · Create {unitLabel}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
          {isDepartmentSchool ? "Add every department this school is organized into." : "Add every program this school offers - one HOD can later be assigned to several of them."}
        </div>
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={isDepartmentSchool ? "e.g. Computer Science" : "e.g. B.Tech Computer Science"}
            maxLength={100}
            style={{ flex: "1 1 260px", padding: "11px 13px", border: "1.5px solid #dbe3ef", borderRadius: 10, fontSize: 13.5, fontFamily: "inherit", outline: "none" }}
          />
          <button
            type="submit"
            disabled={saving || !newName.trim()}
            style={{ padding: "10px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: saving || !newName.trim() ? "not-allowed" : "pointer", opacity: saving || !newName.trim() ? 0.6 : 1, fontFamily: "inherit" }}
          >
            <Plus size={16} aria-hidden="true" /> {saving ? "Adding..." : `Add ${unitLabel}`}
          </button>
        </form>
        {(localError || error) && (
          <div style={{ marginTop: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700 }}>{localError || error}</div>
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 12px 30px rgba(15,23,42,0.05)", border: "1px solid #e2e8f0" }}>
        {loading ? (
          <div style={{ padding: "26px 16px", fontSize: 13, color: "#64748b", fontWeight: 700, textAlign: "center" }}>Loading {unitLabelLower}s...</div>
        ) : departments.length === 0 ? (
          <div style={{ padding: "30px 16px", fontSize: 13, color: "#94a3b8", fontWeight: 700, textAlign: "center" }}>No {unitLabelLower}s added yet - use the form above.</div>
        ) : (
          departments.map((dept, idx) => (
            <div key={dept.id || dept.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "13px 16px", borderBottom: idx < departments.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: "#ecfeff", color: "#0891b2", border: "1px solid #cffafe", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, flexShrink: 0 }}>{dept.name.slice(0, 1).toUpperCase()}</span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a", overflowWrap: "anywhere" }}>{dept.name}</span>
              </div>
              <button type="button" title={`Remove ${dept.name}`} aria-label={`Remove ${dept.name}`} onClick={() => handleRemove(dept)} style={{ border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", borderRadius: 8, padding: "7px 10px", fontWeight: 800, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={onNext} disabled={departments.length === 0} style={{ padding: "11px 22px", background: departments.length === 0 ? "#cbd5e1" : "#7c3aed", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: departments.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          Next: Create HOD →
        </button>
      </div>
    </div>
  );
}

// ============================== STEP 2: Create HOD ==============================
// - Modal for one HOD: view/remove their current programs, and assign new ones. Opened from
// either the "View Details" action (assigned HODs) or "Assign Program" action (unassigned) in
// the roster table below - both actions land on the same modal since assigning-more and
// reviewing-current are really the same screen. -
function HodDetailModal({ hod, availableDepts, onAssignProgram, onRemoveProgram, onClose }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const programs = hodPrograms(hod);
  const filtered = availableDepts.filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase()));

  const handleAssign = async (deptName) => {
    setBusy(true);
    setError("");
    try {
      await onAssignProgram(hod, deptName);
    } catch (err) {
      setError(err?.message || "Could not assign program.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (deptName) => {
    setBusy(true);
    setError("");
    try {
      await onRemoveProgram(hod, deptName);
    } catch (err) {
      setError(err?.message || "Could not remove program.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={hod.fullName || hod.email}
      subtitle={hod.email}
      onClose={onClose}
      accent="#7c3aed"
      width={480}
      icon={<span style={{ fontSize: 15, fontWeight: 900 }}>{initialsFor(hod.fullName || hod.email)}</span>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Current programs
          </div>
          {programs.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#94a3b8", fontWeight: 700, background: "#f8fafc", border: "1px dashed #e2e8f0", borderRadius: 10, padding: "12px", textAlign: "center" }}>
              Not assigned to any program yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {programs.map((p) => (
                <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 800, color: "#065f46", background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 999, padding: "5px 8px 5px 12px" }}>
                  {p}
                  <button type="button" onClick={() => handleRemove(p)} disabled={busy} title="Remove this program" style={{ border: "none", background: "rgba(6,95,70,0.12)", color: "#065f46", cursor: busy ? "wait" : "pointer", fontWeight: 900, fontSize: 11, width: 17, height: 17, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "inherit", lineHeight: 1, flexShrink: 0 }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {availableDepts.length > 0 && (
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Assign another program
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search programs..."
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 12.5, fontFamily: "inherit", outline: "none", marginBottom: 8 }}
            />
            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, border: "1px solid #f1f5f9", borderRadius: 10, padding: 6 }}>
              {filtered.length === 0 ? (
                <div style={{ fontSize: 12, color: "#94a3b8", padding: "10px 6px", textAlign: "center" }}>No match.</div>
              ) : (
                filtered.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    disabled={busy}
                    onClick={() => handleAssign(d.name)}
                    style={{ textAlign: "left", border: "none", background: "transparent", borderRadius: 8, padding: "9px 10px", cursor: busy ? "wait" : "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "#1e293b" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f3ff"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    + {d.name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: "#991b1b", fontWeight: 700 }}>{error}</div>}
      </div>
    </Modal>
  );
}

const HOD_PAGE_SIZE = 6;

function StepHods({ school, departments, existingHods, loading, unitLabelLower, onRefresh, onBack, onNext }) {
  const [createHodOpen, setCreateHodOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [detailHod, setDetailHod] = useState(null);
  const [removingEmail, setRemovingEmail] = useState("");
  const assigned = existingHods.filter((h) => hodPrograms(h).length > 0);
  const unassigned = existingHods.filter((h) => hodPrograms(h).length === 0);
  const q = query.trim().toLowerCase();
  const filteredHods = (filter === "assigned" ? assigned : filter === "unassigned" ? unassigned : existingHods)
    .filter((h) => !q || (h.fullName || "").toLowerCase().includes(q) || h.email.toLowerCase().includes(q));
  const totalPages = Math.max(1, Math.ceil(filteredHods.length / HOD_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const shown = filteredHods.slice((safePage - 1) * HOD_PAGE_SIZE, safePage * HOD_PAGE_SIZE);

  const handleAssignProgram = async (hod, deptName) => {
    const dept = departments.find((d) => d.name === deptName);
    if (!dept) throw new Error("Program not found.");
    await transferRole({ roleType: "HOD", scopeId: dept.id, incomingEmail: hod.email });
    const refreshed = await onRefresh();
    return refreshed;
  };

  const handleRemoveProgram = async (hod, deptName) => {
    const dept = departments.find((d) => d.name === deptName);
    if (!dept) throw new Error("Program not found.");
    if (!window.confirm(`Remove ${hod.fullName || hod.email} from ${deptName}?`)) return;
    await removeRoleAssignment({ roleType: "HOD", scopeId: dept.id });
    await onRefresh();
  };

  // Clears every program this HOD currently holds, then deactivates the account itself.
  const handleRemoveHod = async (hod) => {
    if (!window.confirm(`Remove ${hod.fullName || hod.email}'s HOD account entirely? This clears all their program assignments and deactivates the account.`)) return;
    setRemovingEmail(hod.email);
    try {
      const programs = hodPrograms(hod);
      for (const programName of programs) {
        const dept = departments.find((d) => d.name === programName);
        if (dept) await removeRoleAssignment({ roleType: "HOD", scopeId: dept.id });
      }
      await deactivateHodAccount({ schoolCode: school, email: hod.email });
      await onRefresh();
    } catch (err) {
      alert(err?.message || "Could not remove HOD account.");
    } finally {
      setRemovingEmail("");
    }
  };

  // The detail modal holds its own reference to the HOD - keep it in sync with the latest
  // fetched data (e.g. after assigning/removing a program) instead of going stale.
  const liveDetailHod = detailHod ? existingHods.find((h) => h.email === detailHod.email) || detailHod : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", boxShadow: "0 12px 30px rgba(15,23,42,0.05)", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 42, height: 42, borderRadius: 13, background: "linear-gradient(135deg,#ede9fe,#ddd6fe)", border: "1px solid #c4b5fd", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#7c3aed" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="11" r="4" /><path d="M22 21v-1a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </span>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 900, color: "#0f172a" }}>Step 2 · Create HOD</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Create HOD accounts, then assign each one to one or more {unitLabelLower}s.</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCreateHodOpen(true)}
          style={{ border: "none", background: "#7c3aed", color: "#fff", borderRadius: 10, padding: "11px 18px", fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 10px 22px rgba(124,58,237,0.25)" }}
        >
          + Create HOD
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 12px 30px rgba(15,23,42,0.05)", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 18, borderBottom: "1px solid #f1f5f9", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, background: "#f1f3f9", borderRadius: 10, padding: 3, width: "fit-content" }}>
            {[
              ["all", `All (${existingHods.length})`],
              ["assigned", `Assigned (${assigned.length})`],
              ["unassigned", `Unassigned (${unassigned.length})`],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => { setFilter(value); setPage(1); }}
                style={{ border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", background: filter === value ? "#7c3aed" : "transparent", color: filter === value ? "#fff" : "#64748b", whiteSpace: "nowrap", transition: "background .15s, color .15s" }}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search HODs..."
            style={{ flex: "1 1 200px", minWidth: 160, padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 12.5, fontFamily: "inherit", outline: "none" }}
          />
        </div>

        {loading ? (
          <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 700, textAlign: "center", padding: "26px 0" }}>Loading HODs...</div>
        ) : existingHods.length === 0 ? (
          <div style={{ textAlign: "center", padding: "26px 0" }}>
            <div style={{ fontSize: 12.5, color: "#94a3b8", fontWeight: 700, marginBottom: 10 }}>No HOD accounts created for this school yet.</div>
            <button type="button" onClick={() => setCreateHodOpen(true)} style={{ border: "1px solid #c4b5fd", background: "#f5f3ff", color: "#7c3aed", borderRadius: 9, padding: "8px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              + Create your first HOD
            </button>
          </div>
        ) : filteredHods.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#94a3b8", fontWeight: 700, textAlign: "center", padding: "26px 0" }}>No HODs match this search/filter.</div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr>
                    {["HOD Details", "Email Address", "Assignment Status", "Programs Assigned", "Actions"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 18px", fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((hod, idx) => {
                    const programs = hodPrograms(hod);
                    const isAssigned = programs.length > 0;
                    return (
                      <tr key={hod.email} className="mdp-hod-row" style={{ borderBottom: idx < shown.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <span style={{ borderRadius: 999, padding: 2, background: isAssigned ? "linear-gradient(135deg,#c4b5fd,#7c3aed)" : "linear-gradient(135deg,#e2e8f0,#94a3b8)", flexShrink: 0, display: "inline-flex" }}>
                              <span style={{ width: 34, height: 34, borderRadius: 999, background: isAssigned ? "#7c3aed" : "#94a3b8", color: "#fff", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>{initialsFor(hod.fullName || hod.email)}</span>
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap" }}>{hod.fullName || hod.email}</div>
                              {programs[0] && (
                                <div style={{ fontSize: 10.5, color: "#7c3aed", fontWeight: 700, marginTop: 2, whiteSpace: "nowrap" }}>
                                  🎓 {programs[0]}{programs.length > 1 ? ` +${programs.length - 1}` : ""}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "14px 18px", fontSize: 12.5, color: "#475569", whiteSpace: "nowrap" }}>{hod.email}</td>
                        <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                          {isAssigned ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: "#7c3aed" }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 5-5" /></svg>
                              Assigned
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: "#dc2626" }}>
                              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#dc2626", flexShrink: 0 }} />
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "14px 18px", fontSize: 12.5, color: "#475569", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {programs.length > 0 ? `${programs.length} Program${programs.length > 1 ? "s" : ""}` : "–"}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => setDetailHod(hod)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #ddd6fe", background: "#f5f3ff", color: "#7c3aed", borderRadius: 8, padding: "7px 12px", fontWeight: 800, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                            >
                              {isAssigned ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                              ) : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6" /><path d="M22 11h-6" /></svg>
                              )}
                              {isAssigned ? "View Details" : "Assign Program"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveHod(hod)}
                              disabled={removingEmail === hod.email}
                              title="Remove this HOD account"
                              style={{ width: 30, height: 30, flexShrink: 0, border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", borderRadius: 8, cursor: removingEmail === hod.email ? "wait" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderTop: "1px solid #f1f5f9", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 700 }}>
                Showing {(safePage - 1) * HOD_PAGE_SIZE + 1} to {Math.min(safePage * HOD_PAGE_SIZE, filteredHods.length)} of {filteredHods.length} HODs
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} style={{ width: 30, height: 30, border: "1px solid #e2e8f0", background: "#fff", color: safePage <= 1 ? "#cbd5e1" : "#475569", borderRadius: 8, cursor: safePage <= 1 ? "not-allowed" : "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} type="button" onClick={() => setPage(p)} style={{ width: 30, height: 30, border: `1px solid ${p === safePage ? "#7c3aed" : "#e2e8f0"}`, background: p === safePage ? "#7c3aed" : "#fff", color: p === safePage ? "#fff" : "#475569", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 12.5 }}>{p}</button>
                ))}
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} style={{ width: 30, height: 30, border: "1px solid #e2e8f0", background: "#fff", color: safePage >= totalPages ? "#cbd5e1" : "#475569", borderRadius: 8, cursor: safePage >= totalPages ? "not-allowed" : "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>›</button>
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button type="button" onClick={onBack} style={{ padding: "11px 22px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          ← Back
        </button>
        <button type="button" onClick={onNext} disabled={existingHods.length === 0} style={{ padding: "11px 22px", background: existingHods.length === 0 ? "#cbd5e1" : "#7c3aed", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: existingHods.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          Next: Assign Faculty →
        </button>
      </div>

      {createHodOpen && (
        <Modal
          title="Create HOD Account"
          subtitle={`Pick any number of ${unitLabelLower}s to assign right away, or skip and assign later from the HOD's row.`}
          onClose={() => setCreateHodOpen(false)}
          accent="#7c3aed"
          width={620}
          icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.2 19 6v5.2c0 4.4-2.9 7.6-7 8.6-4.1-1-7-4.2-7-8.6V6l7-2.8Z" /><path d="m9.3 12 1.8 1.8 3.6-3.8" /></svg>}
        >
          <CreateHodForm
            school={school}
            departments={departments}
            accent="#7c3aed"
            onCreated={async () => {
              setCreateHodOpen(false);
              await onRefresh();
            }}
          />
        </Modal>
      )}

      {liveDetailHod && (
        <HodDetailModal
          hod={liveDetailHod}
          availableDepts={departments.filter((d) => !hodPrograms(liveDetailHod).includes(d.name))}
          onAssignProgram={handleAssignProgram}
          onRemoveProgram={handleRemoveProgram}
          onClose={() => setDetailHod(null)}
        />
      )}
    </div>
  );
}

// ============================== STEP 3: Assign Faculty ==============================
function StepFaculty({ school, existingHods, unitLabelLower, onBack }) {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const refreshFaculty = useCallback(async () => {
    if (!school) return;
    setLoading(true);
    setError("");
    try {
      setFaculty(await fetchSchoolFaculty(school));
    } catch (err) {
      setError(err?.message || "Could not load faculty.");
    } finally {
      setLoading(false);
    }
  }, [school]);

  useEffect(() => {
    const t = setTimeout(refreshFaculty, 0);
    return () => clearTimeout(t);
  }, [refreshFaculty]);

  // Flatten every HOD's programs into individually pickable "HOD - Program" options, since one
  // HOD covering several programs still needs a single unambiguous choice per faculty member.
  const hodProgramOptions = existingHods.flatMap((hod) =>
    hodPrograms(hod).map((programName) => ({
      key: `${hod.email}::${programName}`,
      hodEmail: hod.email,
      hodName: hod.fullName || hod.email,
      programName,
    }))
  );

  const assignedCount = faculty.filter((f) => f.department).length;
  const unassignedCount = faculty.length - assignedCount;
  const q = query.trim().toLowerCase();
  const shown = faculty
    .filter((f) => (filter === "assigned" ? f.department : filter === "unassigned" ? !f.department : true))
    .filter((f) => !q || (f.fullName || "").toLowerCase().includes(q) || f.email.toLowerCase().includes(q));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        .mdp-faculty-row { transition: background .15s ease; }
        .mdp-faculty-row:hover { background: #fafcfc; }
      `}</style>
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 12px 30px rgba(15,23,42,0.05)", border: "1px solid #e2e8f0", padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>Step 3 · Assign Faculty</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Pick which HOD each faculty member reports to. This sets their {unitLabelLower} to match that HOD's.</div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 999, padding: "6px 14px", whiteSpace: "nowrap" }}>
          {assignedCount} / {faculty.length} assigned
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700 }}>{error}</div>
      )}

      {hodProgramOptions.length === 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", padding: "10px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700 }}>
          No HOD is assigned to a {unitLabelLower} yet - go back to Step 2 and assign at least one before you can assign faculty here.
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 12px 30px rgba(15,23,42,0.05)", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 16, borderBottom: "1px solid #f1f5f9", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, background: "#f1f3f9", borderRadius: 10, padding: 3, width: "fit-content" }}>
            {[
              ["all", `All (${faculty.length})`],
              ["assigned", `Assigned (${assignedCount})`],
              ["unassigned", `Unassigned (${unassignedCount})`],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                style={{ border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", background: filter === value ? "#fff" : "transparent", color: filter === value ? "#0f172a" : "#64748b", boxShadow: filter === value ? "0 2px 8px rgba(15,23,42,0.10)" : "none", whiteSpace: "nowrap", transition: "background .15s, box-shadow .15s" }}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search faculty by name or email..."
            style={{ flex: "1 1 220px", minWidth: 180, padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 12.5, fontFamily: "inherit", outline: "none" }}
          />
        </div>

        {loading ? (
          <div style={{ padding: "26px 16px", fontSize: 13, color: "#64748b", fontWeight: 700, textAlign: "center" }}>Loading faculty...</div>
        ) : faculty.length === 0 ? (
          <div style={{ padding: "30px 16px", fontSize: 13, color: "#94a3b8", fontWeight: 700, textAlign: "center" }}>No faculty accounts found for this school yet.</div>
        ) : shown.length === 0 ? (
          <div style={{ padding: "30px 16px", fontSize: 13, color: "#94a3b8", fontWeight: 700, textAlign: "center" }}>No faculty match this search/filter.</div>
        ) : (
          shown.map((person, idx) => (
            <FacultyRow key={person.email} person={person} isLast={idx === shown.length - 1} options={hodProgramOptions} school={school} onAssigned={refreshFaculty} />
          ))
        )}
      </div>

      <div>
        <button type="button" onClick={onBack} style={{ padding: "11px 22px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          ← Back
        </button>
      </div>
    </div>
  );
}

function FacultyRow({ person, isLast, options, school, onAssigned }) {
  const currentOption = options.find((o) => o.programName === person.department);
  const [picked, setPicked] = useState(currentOption?.key || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isAssigned = Boolean(person.department);
  const dirty = picked && picked !== (currentOption?.key || "");

  const handleAssign = async () => {
    const option = options.find((o) => o.key === picked);
    if (!option) return;
    setBusy(true);
    setError("");
    try {
      await assignFacultyToProgram({ schoolCode: school, facultyEmail: person.email, departmentName: option.programName });
      await onAssigned?.();
    } catch (err) {
      setError(err?.message || "Could not assign faculty.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mdp-faculty-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "14px 16px", borderBottom: isLast ? "none" : "1px solid #f1f5f9", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 240px" }}>
        <span style={{ borderRadius: 999, padding: 2, background: isAssigned ? "linear-gradient(135deg,#c4b5fd,#7c3aed)" : "linear-gradient(135deg,#e2e8f0,#94a3b8)", flexShrink: 0, display: "inline-flex" }}>
          <span style={{ width: 34, height: 34, borderRadius: 999, background: isAssigned ? "#7c3aed" : "#94a3b8", color: "#fff", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>{initialsFor(person.fullName || person.email)}</span>
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.fullName || person.email}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{person.email}</div>
          <div style={{ marginTop: 5 }}>
            {isAssigned ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 800, color: "#065f46", background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 999, padding: "2px 8px" }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: "#16a34a", flexShrink: 0 }} />
                {person.department}
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 800, color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 999, padding: "2px 8px" }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: "#dc2626", flexShrink: 0 }} />
                Unassigned
              </span>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select value={picked} onChange={(e) => setPicked(e.target.value)} disabled={options.length === 0} style={{ ...selectStyle, minWidth: 240, height: 38, background: "#f8fafc", border: "1.5px solid #e2e8f0" }}>
          <option value="">Select HOD...</option>
          {options.map((o) => (
            <option key={o.key} value={o.key}>{o.hodName} — {o.programName}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAssign}
          disabled={!dirty || busy}
          style={{ border: "none", background: !dirty || busy ? "#e2e8f0" : "#7c3aed", color: !dirty || busy ? "#94a3b8" : "#fff", borderRadius: 8, padding: "0 16px", height: 38, fontWeight: 800, fontSize: 11.5, cursor: !dirty || busy ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: !dirty || busy ? "none" : "0 6px 14px rgba(124,58,237,0.25)", whiteSpace: "nowrap" }}
        >
          {busy ? "Assigning..." : "Assign"}
        </button>
      </div>
      {error && <div style={{ width: "100%", fontSize: 11.5, color: "#991b1b", fontWeight: 700 }}>{error}</div>}
    </div>
  );
}

// Director-only panel for managing the department/program list of their own school, which HOD
// (if any) owns each one, and which faculty individually report to which HOD. The unit label is
// read from live school config so schools can choose departments or programs dynamically.
export default function ManageDepartmentsPanel({ school, headerControls = null }) {
  const unitLabel = schoolUnitLabel(school);
  const unitLabelLower = unitLabel.toLowerCase();
  const isDepartmentSchool = unitLabelLower === "department";

  const [step, setStep] = useState(1);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [existingHods, setExistingHods] = useState([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!school) return;
    setLoading(true);
    try {
      let [departmentList, hodList] = await Promise.all([listSchoolDepartments(school), fetchSchoolHods(school)]);
      setDepartments(departmentList);
      setExistingHods(hodList);
    } catch (err) {
      setError(err?.message || `Could not load ${unitLabelLower}s.`);
    } finally {
      setLoading(false);
    }
  }, [school, unitLabelLower]);

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const assignedHodCount = existingHods.filter((h) => hodPrograms(h).length > 0).length;

  return (
    <div className="program-management" style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", boxSizing: "border-box" }}>
      <style>{`
        .mdp-hod-row { transition: background .15s ease; }
        .mdp-hod-row:hover { background: #fafcfc; }
      `}</style>
      <div className="program-management__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 18, background: "#fff", borderRadius: 14, padding: "16px 24px", boxShadow: "0 10px 28px rgba(17,24,39,0.06)", border: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <AppraisalHeaderImage logo="dypiu" height={68} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#ede9fe,#ddd6fe)", color: "#7c3aed", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="M5 10.5V16c0 1.5 3.13 3 7 3s7-1.5 7-3v-5.5" /><path d="M21 9v6.5" /></svg>
            </span>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: -0.5 }}>{unitLabel}s & HODs</h1>
              <div style={{ marginTop: 5, fontSize: 12.5, color: "#64748b" }}>
                {departments.length} {unitLabelLower}{departments.length === 1 ? "" : "s"} · {existingHods.length} HOD{existingHods.length === 1 ? "" : "s"} · {assignedHodCount} assigned
              </div>
            </div>
          </div>
        </div>
        <AppraisalHeaderImage logo="iqas" height={68} />
      </div>

      {headerControls}

      <StepBar step={step} onStepChange={setStep} unitLabel={unitLabel} />

      {step === 1 && (
        <StepPrograms
          school={school}
          unitLabel={unitLabel}
          unitLabelLower={unitLabelLower}
          isDepartmentSchool={isDepartmentSchool}
          departments={departments}
          loading={loading}
          error={error}
          onRefresh={refresh}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <StepHods
          school={school}
          departments={departments}
          existingHods={existingHods}
          loading={loading}
          unitLabelLower={unitLabelLower}
          onRefresh={refresh}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepFaculty
          school={school}
          existingHods={existingHods}
          unitLabelLower={unitLabelLower}
          onBack={() => setStep(2)}
        />
      )}
    </div>
  );
}
