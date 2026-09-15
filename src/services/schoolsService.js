import { useEffect, useState } from "react";
import { api } from "./api";
import { DEAN_TRACKS, UNIVERSITY_SCHOOLS, onUniversitySchoolsChanged, replaceUniversitySchools } from "../constants/universityHierarchy";

// Reads schools from GET /api/v1/schools - a non-admin-scoped read path (mirroring the existing
// GET /schools/{code}/departments endpoint, which is already used successfully by non-admin
// sessions). The admin panel's own CRUD lives at /admin/schools and is deliberately not called
// here: that route is admin-only and would 401/403 for every faculty/HOD/Director/Dean/VC/RO/
// Registrar session this repo actually runs as.
//
// On any failure (network error, 401 while unauthenticated e.g. on the Signup page, endpoint not
// deployed yet, empty/malformed response) this silently keeps whatever UNIVERSITY_SCHOOLS already
// holds. With no frontend fallback registry, that means school lists remain empty until /schools
// succeeds.
const ALLOWED_TRACKS = new Set([DEAN_TRACKS.ENGINEERING, DEAN_TRACKS.NON_ENGINEERING, DEAN_TRACKS.CISR]);

const normalizeTrack = (raw) => {
  const value = String(raw || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ALLOWED_TRACKS.has(value) ? value : null;
};

const normalizeBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
};

const normalizeSchoolRow = (raw = {}) => {
  const code = String(raw.code || raw.school_code || raw.schoolCode || "").trim();
  const track = normalizeTrack(raw.track);
  if (!code || !track) return null; // can't route a school with neither a code nor a known track

  const name = String(raw.full_name || raw.fullName || raw.name || code).trim();
  const label = String(raw.label || `${code} - ${name}`).trim();
  const departments = Array.isArray(raw.departments) ? raw.departments.filter(Boolean) : [];
  const approvalChain = Array.isArray(raw.approval_chain || raw.approvalChain)
    ? (raw.approval_chain || raw.approvalChain).filter((step) => typeof step === "string")
    : [];

  return {
    code,
    name,
    label,
    track,
    deanTrack: track, // back-compat alias - every existing consumer reads `deanTrack`
    hasHod: normalizeBoolean(raw.has_hod ?? raw.hasHod, false),
    hasDirector: normalizeBoolean(raw.has_director ?? raw.hasDirector, true),
    hodDepartments: departments, // back-compat alias - see `departments` below
    departments,
    approvalChain,
    active: raw.active ?? true,
    order: typeof raw.order === "number" ? raw.order : undefined,
    aliases: Array.isArray(raw.aliases) ? raw.aliases : [],
    unitLabel: raw.unit_label || raw.unitLabel || raw.department_label || raw.departmentLabel || raw.program_label || raw.programLabel || "",
    // "standard" | "creative" plus optional creative subtype. Existing and new schools both use
    // these fields for form routing; fallback rows provide the same shape when the API is absent.
    defaultForm: raw.default_form || raw.defaultForm || "",
    formVariant: raw.form_variant || raw.formVariant || raw.creative_form_variant || raw.creativeFormVariant || "",
  };
};

let inFlightFetch = null;
let hasAttemptedFetch = false;

export const getUniversitySchools = () => UNIVERSITY_SCHOOLS;

// Fetches once (subsequent calls while a fetch is in flight share the same promise) and applies
// the result. Safe to call from anywhere, any number of times - e.g. every mounting useSchools().
export const refreshSchoolsOnce = () => {
  if (inFlightFetch) return inFlightFetch;

  inFlightFetch = (async () => {
    try {
      const rows = await api.get("/schools");
      const normalized = (Array.isArray(rows) ? rows : []).map(normalizeSchoolRow).filter(Boolean);
      // Sort by `order` when the backend provides it; otherwise keep response order. Inactive
      // schools are NOT filtered out here - they must stay resolvable for existing accounts
      // already on them, per the contract ("existing faculty... keep working normally"). Hiding
      // them from NEW-assignment pickers happens at the picker (see Signup.jsx), not here.
      const ordered = normalized.some((row) => typeof row.order === "number")
        ? [...normalized].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        : normalized;
      replaceUniversitySchools(ordered);
    } catch {
      // Endpoint not deployed / 401 while unauthenticated / network error - keep current data.
    } finally {
      hasAttemptedFetch = true;
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
};

// React hook: subscribes to live updates and triggers the first fetch on mount. Call this from
// any component that reads UNIVERSITY_SCHOOLS/SCHOOL_OPTIONS/getSchoolsByDeanTrack/etc. so it
// re-renders once live data lands - those helpers already read the current data fresh on every
// call, they just need something to trigger the re-render.
export const useSchools = () => {
  const [schools, setSchools] = useState(UNIVERSITY_SCHOOLS);

  useEffect(() => {
    const unsubscribe = onUniversitySchoolsChanged(setSchools);
    if (!hasAttemptedFetch) refreshSchoolsOnce();
    return unsubscribe;
  }, []);

  return { schools, isLive: hasAttemptedFetch };
};
