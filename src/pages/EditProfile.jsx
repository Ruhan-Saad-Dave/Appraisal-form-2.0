/* eslint-disable no-unused-vars */
import { cloneElement, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { profilePhotoCrop } from "../utils/profilePhotoCrop";
import { BadgeCheck, BriefcaseBusiness, GraduationCap, IdCard, Minus, Plus, Move, RotateCcw, Mail, Building2, Camera, UserRound, Trash2, SlidersHorizontal } from "lucide-react";
import { APP_INFO } from "../constants/formConfig";
import {
  SCHOOL_OPTIONS,
  canonicalDepartmentValue,
  canonicalSchoolValue,
  isCisrSchool,
  isValidSchool,
  schoolUnitLabel,
} from "../constants/universityHierarchy";
import { isNonTeachingRole } from "../constants/nonTeachingHierarchy";
import { buildProfilePayload, normalizeRole, storeUserSession } from "../auth/session";
import { getMe, updateProfile } from "../services/authService";
import { listSchoolDepartments } from "../services/departmentsService";
import { useSchools } from "../services/schoolsService";
import {
  isValidPhone, isValidName, isValidEmployeeId, isValidExperience,
  sanitizeText, filterNumeric, filterPhone,
} from "../utils/validation";

// - Pseudo-class styles (hover / focus) injected once on mount -
const EP_CSS = `
  .ep-page { box-sizing: border-box; }
  .ep-page > main { padding: 12px 24px 16px !important; }
  .ep-hero { box-sizing: border-box; min-height: 200px; padding: 26px 20px !important; margin-bottom: 16px !important; gap: 16px !important; }
  .ep-profile-cards { gap: 16px !important; }
  .ep-profile-cards > div { padding: 16px 20px !important; min-width: 0; }
  .ep-profile-cards > div > div:first-child { margin-bottom: 14px !important; }
  .ep-profile-cards .ep-grid { gap: 12px 16px !important; }
  .ep-hero-details { display: grid !important; grid-template-columns: minmax(0, 1fr); gap: 10px !important; }
  .ep-photo-actions { margin-top: 10px !important; }
  .ep-avatar-actions { position: absolute; right: -4px; bottom: -5px; flex-wrap: nowrap !important; justify-content: center; gap: 3px !important; margin-top: 0 !important; padding: 3px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 3px 10px rgb(15 23 42 / 12%); }
  .ep-avatar-actions button { display: inline-flex !important; align-items: center; justify-content: center; width: 32px; height: 32px !important; padding: 0 !important; }
  .ep-avatar-actions .ep-photo-btn { color: #2563eb !important; background: #eff6ff !important; border-color: #dbeafe !important; }
  .ep-avatar-actions svg { width: 18px; height: 18px; stroke-width: 1.8; }
  .ep-avatar-actions button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .ep-inp { transition: border-color .15s, box-shadow .15s; }
  .ep-inp:hover:not(:disabled) { border-color: #93c5fd; }
  .ep-inp:focus { outline: none; border-color: #2563eb !important; box-shadow: 0 0 0 3px rgba(37,99,235,.10) !important; }
  .ep-input-shell { transition: border-color .15s, box-shadow .15s; }
  .ep-input-shell:hover { border-color: #93c5fd !important; }
  .ep-input-shell:focus-within { border-color: #2563eb !important; box-shadow: 0 0 0 3px rgba(37,99,235,.10) !important; }
  .ep-cancel:hover { background: #f8fafc !important; border-color: #94a3b8 !important; color: #0f172a !important; }
  .ep-save:hover:not(:disabled) { background: #1d4ed8 !important; box-shadow: 0 4px 14px rgba(37,99,235,.35) !important; }
  .ep-save:active:not(:disabled) { transform: translateY(1px); }
  .ep-back:hover { color: #2563eb !important; }
  .ep-photo-btn:hover { border-color: #2563eb !important; color: #2563eb !important; background: #eff6ff !important; }
  .ep-edit-hero:hover { background: #eff6ff !important; border-color: #93c5fd !important; }
  @media (max-width: 980px) {
    .ep-hero { grid-template-columns: 1fr !important; }
    .ep-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; border-left: none !important; padding-left: 0 !important; }
    .ep-profile-cards { grid-template-columns: 1fr !important; }
    .ep-page { height: auto !important; overflow-y: auto !important; }
  }
  @media (max-width: 620px) {
    .ep-grid, .ep-stat-grid { grid-template-columns: 1fr !important; }
    .ep-hero-left { flex-direction: column !important; align-items: flex-start !important; }
  }
`;

function CssInjector() {
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = EP_CSS;
    el.setAttribute("data-ep", "1");
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
  return null;
}

// - Constants -
const ROLE_LABEL = {
  faculty: "Faculty",
  hod: "Head of Department",
  center_head: "Center Head",
  non_teaching_staff: "Non-Teaching Staff",
  reporting_officer: "Reporting Officer",
  registrar: "Registrar",
  director: "Director",
  dean: "Dean",
  vc: "Vice Chancellor",
};

const BASE_ROLE_OPTIONS = [
  { value: "faculty", label: "Faculty" },
  { value: "hod", label: "HOD" },
  { value: "center_head", label: "Center Head" },
  { value: "dean", label: "Dean" },
  { value: "director", label: "Director" },
  { value: "vc", label: "Vice Chancellor" },
  { value: "registrar", label: "Registrar" },
  { value: "reporting_officer", label: "Reporting Officer" },
  { value: "non_teaching_staff", label: "Non-Teaching Staff" },
];

const STAFF_TYPE_LABEL = { teaching: "Teaching", non_teaching: "Non-Teaching" };

const initialsFromName = (name = "") =>
  String(name || "U").trim().split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "U";

// - Sub-components -
const ICONS = {
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  user: ["M20 21a8 8 0 0 0-16 0", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"],
  id: ["M4 5h16v14H4z", "M8 9h4", "M8 13h8", "M8 17h5", "M15 9h1"],
  cap: ["M22 10 12 5 2 10l10 5 10-5Z", "M6 12v5c3 2 9 2 12 0v-5"],
  briefcase: ["M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1", "M3 7h18v12H3z", "M3 12h18"],
  clock: ["M12 8v5l3 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"],
  calendar: ["M8 2v4", "M16 2v4", "M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "m9 12 2 2 4-4"],
  phone: ["M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.7a16 16 0 0 0 6.3 6.3l1.24-1.23a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z"],
  building: ["M3 21h18", "M6 21V7l8-4v18", "M18 21V9l-4-2", "M9 9h1", "M9 13h1", "M9 17h1"],
  edit: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"],
};

function IconGlyph({ name, size = 18, strokeWidth = 2.2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(ICONS[name] || ICONS.user).map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

function SoftIcon({ name, color = "#2563eb", bg = "#eff6ff", size = 46 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 6, background: bg, color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "inset 0 0 0 1px rgba(37,99,235,0.08)" }}>
      <IconGlyph name={name} size={Math.round(size * 0.45)} />
    </span>
  );
}

const PROFILE_SUMMARY_ICONS = { id: IdCard, cap: GraduationCap, briefcase: BriefcaseBusiness, shield: BadgeCheck };

function HeroStat({ icon, label, value, color = "#2563eb", bg = "#eef2ff" }) {
  const SummaryIcon = PROFILE_SUMMARY_ICONS[icon] || IdCard;
  return (
    <div style={{ minWidth: 0, minHeight: 72, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 10, textAlign: "center", padding: "8px 10px" }}>
      <span aria-hidden="true" style={{ width: 42, height: 42, boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: 6, color, background: `linear-gradient(145deg, #ffffff, ${bg})`, border: `1px solid ${color}28`, boxShadow: "0 2px 5px rgba(15,23,42,0.04), inset 0 1px 0 #fff" }}>
        <SummaryIcon size={23} strokeWidth={1.8} />
      </span>
      <div style={{ display: "grid", gap: 5, minWidth: 0, width: "100%" }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
        <div style={{ color: label === "Account Status" ? "#22c55e" : "#111827", fontSize: 14, fontWeight: 900, whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.5 }}>{value || "-"}</div>
      </div>
    </div>
  );
}

function SectionHead({ title, badge, badgeColor = "#64748b", badgeBack = "#f1f5f9", icon = "user", iconColor = "#2563eb", iconBg = "#eff6ff", actions }) {
  const SectionIcon = icon === "users" ? IdCard : UserRound;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, flexShrink: 0, borderRadius: 6, color: iconColor, background: `linear-gradient(145deg, #fff, ${iconBg})`, border: `1px solid ${iconColor}25`, boxShadow: "0 2px 5px rgba(15,23,42,0.04)" }}><SectionIcon size={22} strokeWidth={1.8} /></span>
        <span style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", letterSpacing: 0 }}>{title}</span>
      </div>
      {actions || (
        <span style={{ fontSize: 10, fontWeight: 700, background: badgeBack, color: badgeColor, borderRadius: 20, padding: "3px 10px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {badge}
        </span>
      )}
    </div>
  );
}

function IconInput({ icon, children }) {
  const input = cloneElement(children, {
    style: {
      ...children.props.style,
      height: 42,
      border: "none",
      borderRadius: 0,
      padding: "0 12px",
      background: "transparent",
      boxShadow: "none",
      outline: "none",
    },
  });

  return (
    <div className="ep-input-shell" style={{ height: 42, display: "flex", alignItems: "center", border: "1.5px solid #dbe3ef", borderRadius: 5, background: "#fff", overflow: "hidden" }}>
      <span style={{ width: 42, height: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#64748b", background: "#f8fafc", borderRight: "1px solid #e5e7eb", flexShrink: 0 }}>
        <IconGlyph name={icon} size={17} />
      </span>
      {input}
    </div>
  );
}

function FrozenField({ label, value, wide }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, ...(wide ? { gridColumn: "1 / -1" } : {}) }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <div style={{ minHeight: 40, display: "flex", alignItems: "center", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 5, padding: "0 13px", fontSize: 13, color: value ? "#4b5563" : "#c4c9d4" }}>
        {value || "-"}
      </div>
    </div>
  );
}

function createAdjustedProfileImage(src, { zoom, x, y }, outputSize = 480) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Unable to prepare the profile image."));
        return;
      }

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, outputSize, outputSize);

      const crop = profilePhotoCrop(image.naturalWidth, image.naturalHeight, { zoom, x, y }, outputSize);
      ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    image.onerror = () => reject(new Error("Unable to load the selected image."));
    image.src = src;
  });
}

function PhotoAdjustModal({ src, adjust, setAdjust, onCancel, onApply }) {
  const drag = useRef(null);
  const [dimensions, setDimensions] = useState(null);
  const ready = dimensions?.src === src;
  const crop = profilePhotoCrop(ready ? dimensions.width : 1, ready ? dimensions.height : 1, adjust);
  const clampPosition = (value) => Math.max(-100, Math.min(100, value));
  const changeZoom = (delta) => setAdjust((prev) => ({ ...prev, zoom: Math.max(1, Math.min(3, Math.round((prev.zoom + delta) * 100) / 100)) }));
  const startDrag = (event) => {
    if (!ready || !event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    drag.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: adjust.x, y: adjust.y, width: event.currentTarget.clientWidth, height: event.currentTarget.clientHeight };
  };
  const moveDrag = (event) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const overflowX = (crop.width - 1) * start.width / 2;
    const overflowY = (crop.height - 1) * start.height / 2;
    setAdjust((prev) => ({ ...prev,
      x: overflowX > 0 ? clampPosition(start.x + (event.clientX - start.clientX) / overflowX * 100) : 0,
      y: overflowY > 0 ? clampPosition(start.y + (event.clientY - start.clientY) / overflowY * 100) : 0,
    }));
  };
  const moveWithKeyboard = (event) => {
    const directions = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] };
    const delta = directions[event.key];
    if (!delta) return;
    event.preventDefault();
    setAdjust((prev) => ({ ...prev, x: clampPosition(prev.x + delta[0]), y: clampPosition(prev.y + delta[1]) }));
  };
  const setValue = (field) => (event) => {
    const value = Number(event.target.value);
    setAdjust((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,23,42,0.62)", display: "grid", placeItems: "center", padding: 24 }} onClick={onCancel}>
      <div style={{ width: "min(520px, 94vw)", background: "#fff", borderRadius: 18, border: "1px solid #e5e7eb", boxShadow: "0 24px 80px rgba(15,23,42,0.28)", padding: 22 }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ color: "#0f172a", fontSize: 18, fontWeight: 900 }}>Adjust Profile Photo</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>Position your photo inside the circle before saving.</div>
          </div>
          <button type="button" onClick={onCancel} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer", fontWeight: 900, fontFamily: "inherit" }}>X</button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
            <div tabIndex={0} role="group" aria-label="Photo position. Drag to move, or use arrow keys. Zoom in for more movement."
              onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={moveWithKeyboard}
              style={{ position: "relative", width: 170, height: 170, cursor: "grab", touchAction: "none", userSelect: "none", borderRadius: "50%", overflow: "hidden", background: "#e2e8f0", border: "5px solid #fff", boxShadow: "0 12px 32px rgba(15,23,42,0.16), 0 0 0 1px #e2e8f0" }}>
              <img
                src={src}
                alt="Profile preview"
                draggable={false}
                onLoad={(event) => setDimensions({ src, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
                style={{
                  position: "absolute",
                  width: `${crop.width * 100}%`,
                  height: `${crop.height * 100}%`,
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  maxWidth: "none",
                  maxHeight: "none",
                  visibility: ready ? "visible" : "hidden",
                  display: "block",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 11, fontWeight: 700 }}><Move size={14} aria-hidden="true" />Drag photo to reposition</div>
          </div>

          <div style={{ display: "grid", gap: 14, flex: "1 1 200px", minWidth: 0, padding: 16, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#334155", fontSize: 12, fontWeight: 800 }}>
              <span>Zoom</span><span style={{ color: "#2563eb", fontVariantNumeric: "tabular-nums" }}>{Math.round(adjust.zoom * 100)}%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button type="button" aria-label="Zoom out" disabled={adjust.zoom <= 1} onClick={() => changeZoom(-0.1)} style={{ width: 32, height: 32, flexShrink: 0, display: "grid", placeItems: "center", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#475569", cursor: "pointer", opacity: adjust.zoom <= 1 ? 0.4 : 1 }}><Minus size={16} /></button>
              <input aria-label="Photo zoom" type="range" min={1} max={3} step={0.05} value={adjust.zoom} onChange={setValue("zoom")} style={{ width: "100%", minWidth: 0, accentColor: "#2563eb" }} />
              <button type="button" aria-label="Zoom in" disabled={adjust.zoom >= 3} onClick={() => changeZoom(0.1)} style={{ width: 32, height: 32, flexShrink: 0, display: "grid", placeItems: "center", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#475569", cursor: "pointer", opacity: adjust.zoom >= 3 ? 0.4 : 1 }}><Plus size={16} /></button>
            </div>
            <p style={{ margin: 0, color: "#64748b", fontSize: 11, lineHeight: 1.6 }}>Drag inside the circle to position your photo. Zoom in for more room to move. You can also focus the preview and use arrow keys.</p>
            <button type="button" onClick={() => setAdjust({ zoom: 1, x: 0, y: 0 })} style={{ justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#475569", padding: "8px 12px", font: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><RotateCcw size={14} aria-hidden="true" />Reset</button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22, paddingTop: 16, borderTop: "1px solid #eef2f7" }}>
          <button type="button" onClick={onCancel} style={{ height: 38, border: "1px solid #dbe3ef", background: "#fff", color: "#475569", borderRadius: 9, padding: "0 16px", cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}>Cancel</button>
          <button type="button" onClick={onApply} style={{ height: 38, border: "none", background: "#2563eb", color: "#fff", borderRadius: 9, padding: "0 18px", cursor: "pointer", fontFamily: "inherit", fontWeight: 900 }}>Use Photo</button>
        </div>
      </div>
    </div>
  );
}

function InputField({ label, required, hint, wide, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, ...(wide ? { gridColumn: "1 / -1" } : {}) }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
        {required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: 10, color: "#9ca3af" }}>{hint}</span>}
    </label>
  );
}

// - Shared style tokens -
const CARD = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: "20px 24px 16px",
  boxShadow: "0 12px 34px rgba(15,23,42,.06)",
};

const INP = {
  width: "100%",
  boxSizing: "border-box",
  height: 40,
  border: "1.5px solid #d1d5db",
  borderRadius: 5,
  padding: "0 13px",
  fontSize: 13,
  color: "#0f172a",
  fontFamily: "inherit",
  background: "#fff",
};

// - Main Component -
export default function EditProfile() {
  useSchools(); // Re-render when the asynchronously loaded school registry changes.
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const editableCardRef = useRef(null);
  const initialRole = normalizeRole(sessionStorage.getItem("role"), "faculty");
  const storedSchool = sessionStorage.getItem("school") || "";
  const initialSchool = canonicalSchoolValue(storedSchool) || storedSchool;
  const initialDepartment = isNonTeachingRole(initialRole)
    ? sessionStorage.getItem("department") || ""
    : canonicalDepartmentValue(sessionStorage.getItem("department"));
  const initialDepartments = (() => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem("departments") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const [formData, setFormData] = useState({
    staffType: isNonTeachingRole(initialRole) ? "non_teaching" : "teaching",
    email: sessionStorage.getItem("username") || "",
    name: sessionStorage.getItem("name") || "",
    employeeId: sessionStorage.getItem("employeeId") || "",
    designation: sessionStorage.getItem("designation") || "",
    qualification: sessionStorage.getItem("qualification") || "",
    experience: sessionStorage.getItem("experience") || "",
    phone: sessionStorage.getItem("phone") || "",
    profilePictureUrl: sessionStorage.getItem("profilePictureUrl") || sessionStorage.getItem("profile_picture_url") || sessionStorage.getItem("avatarUrl") || "",
    school: initialSchool,
    department: initialDepartment,
    // HOD can be assigned multiple departments/programs (see New_backend.md); every other
    // teaching role keeps using the single `department` field above.
    departments: initialDepartments,
    role: initialRole,
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingPhotoSrc, setPendingPhotoSrc] = useState("");
  const [photoAdjust, setPhotoAdjust] = useState({ zoom: 1, x: 0, y: 0 });
  const [schoolDepartments, setSchoolDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  const selectedSchool = canonicalSchoolValue(formData.school);
  const selectedRole = normalizeRole(formData.role, "");
  const isNonTeaching = formData.staffType === "non_teaching";
  const requiresSchool = !isNonTeaching && selectedRole !== "vc";
  const isCisr = isCisrSchool(selectedSchool);
  const schoolHasDepartments = schoolDepartments.length > 0;
  const unitLabel = schoolUnitLabel(selectedSchool);
  const needsDepartment = !isNonTeaching && !isCisr && schoolHasDepartments;

  useEffect(() => {
    let active = true;
    const load = () => {
      if (isNonTeaching || isCisr || !selectedSchool) {
        setSchoolDepartments([]);
        return;
      }
      setDepartmentsLoading(true);
      listSchoolDepartments(selectedSchool)
        .then((departments) => { if (active) setSchoolDepartments(departments || []); })
        .catch(() => { if (active) setSchoolDepartments([]); })
        .finally(() => { if (active) setDepartmentsLoading(false); });
    };
    const timer = setTimeout(load, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [selectedSchool, isNonTeaching, isCisr]);

  // Faculty/HOD's department (or program) is Director-assigned now, from a separate page
  // (Manage Programs), not this form - so sessionStorage's copy can go stale the moment a
  // Director assigns/changes it while this person is already logged in. A plain page refresh
  // doesn't help either, since sessionStorage survives a refresh unchanged - only a fresh
  // logout/login previously re-synced it. Re-fetch the live profile once on mount and refresh
  // both sessionStorage and the on-screen value, so the current assignment shows up without
  // requiring the user to log out.
  useEffect(() => {
    let active = true;
    getMe()
      .then((freshProfile) => {
        if (!active || !freshProfile) return;
        const freshSession = storeUserSession({ profile: freshProfile, fallbackEmail: formData.email });
        const freshRole = normalizeRole(freshProfile.appraisal_role || freshProfile.role, initialRole);
        const freshDepartment = isNonTeachingRole(freshRole)
          ? String(freshProfile.department || "")
          : canonicalDepartmentValue(freshProfile.department);
        const freshDepartments = Array.isArray(freshProfile.departments) ? freshProfile.departments : [];
        setFormData((prev) => ({ ...prev, school: freshSession.school, department: freshDepartment, departments: freshDepartments }));
      })
      .catch(() => {
        // Keep whatever sessionStorage already had - a failed refresh shouldn't block editing
        // the rest of the profile.
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleOptions = BASE_ROLE_OPTIONS.filter((role) => {
    const optionIsNonTeaching = isNonTeachingRole(role.value);
    if (isNonTeaching) return optionIsNonTeaching;
    if (optionIsNonTeaching) return false;
    if (role.value === "hod") return schoolHasDepartments;
    if (role.value === "center_head") return isCisr;
    if (isCisr && (role.value === "director" || role.value === "dean")) return false;
    return true;
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => {
      if (name === "school") return { ...prev, school: value, role: "", department: "", departments: [] };
      if (name === "role") return { ...prev, role: value, department: "", departments: [] };
      if (name === "experience") return { ...prev, experience: filterNumeric(value) };
      if (name === "phone") return { ...prev, phone: filterPhone(value) };
      return { ...prev, [name]: value };
    });
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file for the profile picture.");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Profile picture must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setError("");
      setPhotoAdjust({ zoom: 1, x: 0, y: 0 });
      setPendingPhotoSrc(String(reader.result || ""));
    };
    reader.onerror = () => {
      setError("Unable to read the selected image. Please try another file.");
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setFormData((prev) => ({ ...prev, profilePictureUrl: "" }));
    setPendingPhotoSrc("");
    setPhotoAdjust({ zoom: 1, x: 0, y: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cancelPhotoAdjustment = () => {
    setPendingPhotoSrc("");
    setPhotoAdjust({ zoom: 1, x: 0, y: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const applyPhotoAdjustment = async () => {
    try {
      const adjustedUrl = await createAdjustedProfileImage(pendingPhotoSrc, photoAdjust);
      setFormData((prev) => ({ ...prev, profilePictureUrl: adjustedUrl }));
      setPendingPhotoSrc("");
      setPhotoAdjust({ zoom: 1, x: 0, y: 0 });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err?.message || "Unable to adjust the selected image. Please try another file.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!formData.employeeId.trim()) { setError("Employee ID is required."); return; }
    if (!isValidEmployeeId(formData.employeeId)) { setError("Employee ID must be 2-30 characters and contain only letters, numbers, /, - or _."); return; }
    if (!formData.designation.trim()) { setError("Designation is required."); return; }
    if (formData.experience && !isValidExperience(formData.experience)) { setError("Experience must be a number between 0 and 80."); return; }
    if (formData.phone && !isValidPhone(formData.phone)) { setError("Please enter a valid phone number."); return; }

    setSaving(true);
    try {
      const email = String(formData.email || "").trim().toLowerCase();
      const role = normalizeRole(formData.role, "");
      const nonTeaching = formData.staffType === "non_teaching";
      const school = canonicalSchoolValue(formData.school);
      // Faculty and HOD program/department assignment is Director-controlled (via "Manage
      // Programs" -> Assign Faculty / Assign Program), not something either edits on their own
      // profile - this form never sends `department`/`departments` for those roles, so it can't
      // race with or overwrite a Director's assignment.
      const department = nonTeaching
        ? String(formData.department || "").trim()
        : role === "hod" || role === "faculty" || isCisr ? "" : canonicalDepartmentValue(formData.department);

      const cleanFormData = {
        ...formData,
        email,
        name: sanitizeText(formData.name),
        employeeId: sanitizeText(formData.employeeId),
        designation: sanitizeText(formData.designation),
        qualification: sanitizeText(formData.qualification),
        experience: sanitizeText(formData.experience),
        phone: sanitizeText(formData.phone),
        profilePictureUrl: formData.profilePictureUrl,
        role,
        school: nonTeaching ? "" : school,
        department,
        departments: undefined,
      };
      const profilePayload = buildProfilePayload(cleanFormData, APP_INFO.DEFAULT_AY);
      const savedProfile = await updateProfile(profilePayload);
      const sessionProfile = { ...profilePayload, ...(savedProfile || {}) };
      if (!cleanFormData.profilePictureUrl) {
        sessionProfile.profile_picture_url = null;
        sessionProfile.profilePictureUrl = null;
        sessionProfile.avatar_url = null;
        sessionProfile.avatarUrl = null;
        sessionProfile.photo_url = null;
        sessionProfile.photoUrl = null;
        sessionProfile.picture_url = null;
        sessionProfile.pictureUrl = null;
      }
      storeUserSession({ profile: sessionProfile, fallbackEmail: email });
      setMessage("Profile updated successfully.");
      setTimeout(() => navigate("/dashboard", { replace: true }), 450);
    } catch (err) {
      setError(err?.message || "Unable to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const initials = initialsFromName(formData.name);
  const roleLabel = ROLE_LABEL[formData.role] || "User";
  const schoolLabel = isNonTeaching
    ? formData.department || "Department / Office"
    : formData.department || formData.school || "-";
  const experienceLabel = formData.experience ? `${formData.experience} Years` : "-";

  return (
    <div className="ep-page" style={{ height: "100vh", overflowY: "auto", background: "#f8fafc", fontFamily: "inherit", color: "#0f172a" }}>
      <CssInjector />

      {/* - Sticky white navbar - */}
      <nav style={{ position: "sticky", top: 0, zIndex: 40, background: "#fff", borderBottom: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(15,23,42,.06)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#6366f1,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 13, letterSpacing: 0.5, boxShadow: "0 10px 24px rgba(37,99,235,.22)" }}>FA</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a", lineHeight: 1.1 }}>{APP_INFO.PORTAL_NAME}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{APP_INFO.UNIVERSITY_NAME}</div>
            </div>
          </div>
          {/* Back link */}
          <button
            className="ep-back"
            onClick={() => navigate("/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", color: "#2563eb", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: "6px 0", transition: "color .15s" }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            Back to Dashboard
          </button>
        </div>
      </nav>

      {/* - Main content - */}
      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "18px 32px 22px" }}>

        {/* - Profile hero - */}
        <div className="ep-hero" style={{ display: "grid", gridTemplateColumns: "minmax(340px, 1fr) minmax(520px, 1.12fr)", alignItems: "center", gap: 22, marginBottom: 16, position: "relative", overflow: "hidden", background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", padding: "20px 28px", boxShadow: "0 14px 42px rgba(15,23,42,.06)" }}>
          <div style={{ position: "absolute", right: -44, top: -60, width: 210, height: 210, borderRadius: "50%", background: "linear-gradient(135deg,rgba(99,102,241,.08),rgba(124,58,237,.16))" }} />
          <div className="ep-hero-left" style={{ display: "flex", alignItems: "center", gap: 20, minWidth: 0, position: "relative", zIndex: 1 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ width: 96, height: 96, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 32, letterSpacing: 1, boxShadow: "0 12px 28px rgba(37,99,235,.25)", overflow: "hidden", border: "4px solid #fff" }}>
                {formData.profilePictureUrl ? (
                  <img src={formData.profilePictureUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  initials
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
              <div className="ep-photo-actions ep-avatar-actions" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="ep-photo-btn"
                  title={formData.profilePictureUrl ? "Change photo" : "Upload photo"}
                  aria-label={formData.profilePictureUrl ? "Change profile photo" : "Upload profile photo"}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                >
                  <Camera size={15} aria-hidden="true" />
                  
                </button>
                {formData.profilePictureUrl && (
                  <button
                    type="button"
                    aria-label="Remove profile photo"
                    title="Remove photo"
                    onClick={removePhoto}
                    style={{ height: 34, padding: "0 12px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff5f5", color: "#b91c1c", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}
                {formData.profilePictureUrl?.startsWith("data:image/") && (
                  <button
                    type="button"
                    aria-label="Adjust profile photo"
                    title="Adjust photo"
                    onClick={() => {
                      setPhotoAdjust({ zoom: 1, x: 0, y: 0 });
                      setPendingPhotoSrc(formData.profilePictureUrl);
                    }}
                    style={{ height: 34, padding: "0 12px", borderRadius: 6, border: "1px solid #dbe3ef", background: "#f8fafc", color: "#475569", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <SlidersHorizontal size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            <div style={{ minWidth: 0, paddingRight: 20 }}>
              <h1 style={{ margin: "0 0 10px", fontSize: 25, fontWeight: 900, color: "#0f172a", lineHeight: 1.08, whiteSpace: "normal", overflowWrap: "anywhere" }}>
                {formData.name || "Your Profile"}
              </h1>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "5px 9px" }}>
                  <UserRound size={13} aria-hidden="true" />
                  {roleLabel}
                </span>
                {formData.school && !isNonTeaching && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "5px 9px" }}>
                    <GraduationCap size={14} aria-hidden="true" />
                    {formData.school}
                  </span>
                )}
              </div>
              <div className="ep-hero-details" style={{ display: "grid", gap: 9 }}>
                {formData.email && <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.5, color: "#64748b" }}><Mail size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} /><span style={{ overflowWrap: "anywhere", minWidth: 0 }}>{formData.email}</span></div>}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "#475569", fontSize: 12, lineHeight: 1.5, fontWeight: 600 }}>
                  <Building2 size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: "#64748b" }} />
                  <span style={{ overflowWrap: "anywhere", minWidth: 0 }}>{schoolLabel}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="ep-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(100px, 1fr))", alignItems: "stretch", paddingLeft: 6, position: "relative", zIndex: 1 }}>
            <HeroStat icon="id" label="Employee ID" value={formData.employeeId} color="#2563eb" bg="#eef2ff" />
            <HeroStat icon="cap" label="Qualification" value={formData.qualification} color="#4f46e5" bg="#eef2ff" />
            <HeroStat icon="briefcase" label="Experience" value={experienceLabel} color="#2563eb" bg="#eef2ff" />
            <HeroStat icon="shield" label="Account Status" value="Active" color="#16a34a" bg="#dcfce7" />
          </div>
        </div>

        <form onSubmit={handleSubmit}>

          {/* - Alerts - */}
          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#fff5f5", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 10, padding: "13px 16px", marginBottom: 22, fontSize: 13, lineHeight: 1.5 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              {error}
            </div>
          )}
          {message && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 10, padding: "13px 16px", marginBottom: 22, fontSize: 13, lineHeight: 1.5 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M20 6L9 17l-5-5" /></svg>
              {message}
            </div>
          )}

          <div className="ep-profile-cards" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "stretch" }}>
            {/* - Card 1: Account Information (read-only) - */}
            <div style={{ ...CARD, height: "100%", boxSizing: "border-box" }}>
              <SectionHead title="Account Information" badge="Read-only" badgeColor="#2563eb" badgeBack="#eff6ff" icon="users" iconColor="#2563eb" iconBg="#eff6ff" />
              <div className="ep-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 }}>
                <FrozenField label="Staff Type" value={STAFF_TYPE_LABEL[formData.staffType]} />
                <FrozenField label="Role" value={ROLE_LABEL[formData.role] || formData.role} />
                {!isNonTeaching && (
                  <FrozenField label="School" value={formData.school} wide />
                )}
                {isNonTeaching && (
                  <FrozenField label="Department / Office" value={formData.department} />
                )}

                {needsDepartment && selectedRole === "faculty" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: "1 / -1" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{unitLabel}</span>
                    <div style={{ minHeight: 40, display: "flex", alignItems: "center", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 5, padding: "0 13px", fontSize: 13, color: formData.department ? "#374151" : "#c4c9d4", fontWeight: formData.department ? 700 : 400 }}>
                      {formData.department || `Not yet assigned - your Director assigns your ${unitLabel.toLowerCase()} from "Manage ${unitLabel}s".`}
                    </div>
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>Only your Director can change which {unitLabel.toLowerCase()} you're assigned to.</span>
                  </div>
                )}

                {needsDepartment && selectedRole === "hod" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: "1 / -1" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{unitLabel}s Assigned</span>
                    {(formData.departments || []).length === 0 ? (
                      <div style={{ minHeight: 40, display: "flex", alignItems: "center", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 5, padding: "0 13px", fontSize: 13, color: "#c4c9d4" }}>
                        None yet - your Director assigns {unitLabel.toLowerCase()}s from "Manage {unitLabel}s".
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 5, padding: "10px 12px" }}>
                        {formData.departments.map((name) => (
                          <span key={name} style={{ fontSize: 12.5, fontWeight: 700, color: "#4b5563", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 999, padding: "5px 12px" }}>
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>Only your Director can change which {unitLabel.toLowerCase()}s you're assigned to.</span>
                  </div>
                )}

                <FrozenField label="Email Address" value={formData.email} />
                <FrozenField label="Full Name" value={formData.name} />
              </div>
            </div>

            {/* - Card 2: Editable Details - */}
            <div ref={editableCardRef} style={{ ...CARD, height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
              <SectionHead
                title="Personal Details"
                badge="Editable"
                badgeColor="#7c3aed"
                badgeBack="#f3e8ff"
                icon="user"
                iconColor="#7c3aed"
                iconBg="#f3e8ff"
              />
              <div className="ep-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 }}>
                <InputField label="Employee ID" required hint="e.g. EMP001 - letters, numbers, / - _">
                  <IconInput icon="id">
                    <input
                      name="employeeId"
                      value={formData.employeeId}
                      onChange={handleChange}
                      required
                      maxLength={30}
                      placeholder="EMP001"
                    />
                  </IconInput>
                </InputField>

                <InputField label="Designation" required hint="e.g. Assistant Professor">
                  <IconInput icon="briefcase">
                    <input
                      name="designation"
                      value={formData.designation}
                      onChange={handleChange}
                      required
                      maxLength={100}
                      placeholder="Assistant Professor"
                    />
                  </IconInput>
                </InputField>

                <InputField label="Qualification" hint="e.g. Ph.D, M.Tech">
                  <IconInput icon="cap">
                    <input
                      name="qualification"
                      value={formData.qualification}
                      onChange={handleChange}
                      maxLength={100}
                      placeholder="Ph.D, M.Tech"
                    />
                  </IconInput>
                </InputField>

                <InputField label="Experience (years)" hint="0 to 80 years">
                  <IconInput icon="clock">
                    <input
                      name="experience"
                      value={formData.experience}
                      onChange={handleChange}
                      inputMode="decimal"
                      maxLength={4}
                      placeholder="e.g. 10"
                    />
                  </IconInput>
                </InputField>

                <InputField label="Phone" hint="+91 98765 43210" wide>
                  <IconInput icon="phone">
                    <input
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      inputMode="tel"
                      maxLength={20}
                      placeholder="+91 98765 43210"
                    />
                  </IconInput>
                </InputField>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 10, paddingTop: 8, borderTop: "1px solid #eef2f7" }}>
                <button
                  type="button"
                  className="ep-cancel"
                  onClick={() => navigate("/dashboard")}
                  style={{ border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", borderRadius: 9, padding: "0 18px", height: 38, cursor: "pointer", fontWeight: 700, fontFamily: "inherit", fontSize: 12, transition: "all .15s" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="ep-save"
                  style={{ display: "flex", alignItems: "center", gap: 7, border: "none", background: saving ? "#93c5fd" : "#2563eb", color: "#fff", borderRadius: 9, padding: "0 20px", height: 38, cursor: saving ? "wait" : "pointer", fontWeight: 800, fontFamily: "inherit", fontSize: 12, transition: "all .18s", boxShadow: saving ? "none" : "0 2px 8px rgba(37,99,235,.25)", whiteSpace: "nowrap" }}
                >
                  {saving ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      Save Profile
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        </form>

        {/* Spinner keyframe (for save button loading state) */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
      {pendingPhotoSrc && (
        <PhotoAdjustModal
          src={pendingPhotoSrc}
          adjust={photoAdjust}
          setAdjust={setPhotoAdjust}
          onCancel={cancelPhotoAdjustment}
          onApply={applyPhotoAdjustment}
        />
      )}
    </div>
  );
}

