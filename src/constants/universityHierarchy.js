export const DEAN_TRACKS = {
  ENGINEERING: "engineering",
  NON_ENGINEERING: "non_engineering",
  CISR: "cisr",
};

// The 4 recognized approval_chain step keys. "dean" resolves to the track's Dean role (one Dean
// of Engineering, one Dean of Non-Engineering - never per-school) everywhere it's consumed.
const APPROVAL_CHAIN_STEPS = new Set(["hod", "director", "dean", "vc"]);

const normalizeBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
};

// Builds the ordered approval_chain for a school entry: prefer an explicit chain (from a live
// fetch), else derive one from the has_hod/has_director flags. This derivation happens ONCE at
// data-normalization time, not at routing time - getReviewChain must always read the resulting
// `approvalChain` array as-is, never reconstruct it from the booleans itself.
const withApprovalChain = (school) => {
  if (!school.track) return school; // CISR (and anything track-less): leave untouched.
  const normalizedSchool = {
    ...school,
    hasHod: normalizeBoolean(school.hasHod ?? school.has_hod, false),
    hasDirector: normalizeBoolean(school.hasDirector ?? school.has_director, true),
  };
  if (Array.isArray(school.approvalChain) && school.approvalChain.length) {
    return { ...normalizedSchool, approvalChain: school.approvalChain.filter((step) => APPROVAL_CHAIN_STEPS.has(step)) };
  }
  const approvalChain = [
    ...(normalizedSchool.hasHod ? ["hod"] : []),
    ...(normalizedSchool.hasDirector ? ["director"] : []),
    "dean",
    "vc",
  ];
  return { ...normalizedSchool, approvalChain };
};

// School definitions are loaded from GET /schools. There is deliberately no built-in fallback
// school registry here; if the endpoint is unavailable the lists remain empty.
export let UNIVERSITY_SCHOOLS = [];

const schoolsChangeSubscribers = new Set();
export const onUniversitySchoolsChanged = (callback) => {
  schoolsChangeSubscribers.add(callback);
  return () => schoolsChangeSubscribers.delete(callback);
};

const recomputeDerivedSchoolExports = () => {
  SCHOOL_OPTIONS = UNIVERSITY_SCHOOLS.map((school) => ({ value: school.code, label: school.label }));
};

// Called by schoolsService after a successful GET /schools. The live endpoint is the authority
// for all schools/centers; missing rows are not filled from frontend fallback data.
export const replaceUniversitySchools = (rows = []) => {
  const liveRows = (Array.isArray(rows) ? rows : []).filter((row) => row?.code);
  if (!liveRows.length) return false;
  UNIVERSITY_SCHOOLS = liveRows.map(withApprovalChain);
  recomputeDerivedSchoolExports();
  schoolsChangeSubscribers.forEach((callback) => {
    try { callback(UNIVERSITY_SCHOOLS); } catch { /* a subscriber's own error must not break others */ }
  });
  return true;
};

export const getSchoolsByDeanTrack = (deanTrack) =>
  UNIVERSITY_SCHOOLS.filter((school) => school.deanTrack === deanTrack);

export const getSchoolCodesByDeanTrack = (deanTrack) =>
  getSchoolsByDeanTrack(deanTrack).map((school) => school.code);

export const getSchoolLabelsByDeanTrack = (deanTrack) =>
  getSchoolsByDeanTrack(deanTrack).map((school) => school.label);

export let SCHOOL_OPTIONS = UNIVERSITY_SCHOOLS.map((school) => ({
  value: school.code,
  label: school.label,
}));

export const normalizeHierarchyText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/-/g, " ")
    .replace(/-/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const getSchoolByValue = (value) => {
  const normalized = normalizeHierarchyText(value);
  if (!normalized) return null;

  if (normalized === "engineering") {
    return UNIVERSITY_SCHOOLS.find((school) => school.deanTrack === DEAN_TRACKS.ENGINEERING) || null;
  }
  if (normalized === "non engineering" || normalized === "nonengineering" || normalized === "non_engineering") {
    return null;
  }

  const exactOrPrefixMatch = UNIVERSITY_SCHOOLS.find((school) => {
    const candidates = [
      school.code,
      school.name,
      school.label,
      ...(school.aliases || []),
    ].map(normalizeHierarchyText);

    return candidates.some((candidate) =>
      normalized === candidate ||
      normalized.startsWith(`${candidate} `) ||
      candidate.startsWith(`${normalized} `)
    );
  });

  if (exactOrPrefixMatch) return exactOrPrefixMatch;

  // Fallback substring matching
  return UNIVERSITY_SCHOOLS.find((school) => {
    const candidates = [
      school.code,
      school.name,
      school.label,
      ...(school.aliases || []),
    ].map(normalizeHierarchyText);

    return candidates.some((candidate) =>
      candidate && candidate !== "engineering" && (normalized.includes(candidate) || candidate.includes(normalized))
    );
  }) || null;
};

export const getSchoolKey = (school) => getSchoolByValue(school)?.code || "";

export const canonicalSchoolValue = (school) => getSchoolByValue(school)?.code || "";

export const isValidSchool = (school) =>
  SCHOOL_OPTIONS.some((option) => option.value === school);

const SCHOOL_VISUAL_PALETTE = [
  { color: "#6366f1", bg: "#eef2ff" },
  { color: "#10b981", bg: "#ecfdf5" },
  { color: "#0ea5e9", bg: "#eff6ff" },
  { color: "#f59e0b", bg: "#fffbeb" },
  { color: "#14b8a6", bg: "#ecfeff" },
  { color: "#8b5cf6", bg: "#f3e8ff" },
  { color: "#ec4899", bg: "#fdf2f8" },
  { color: "#f97316", bg: "#fff7ed" },
  { color: "#0f766e", bg: "#ccfbf1" },
];

const schoolInitials = (school = {}) => {
  const code = String(school.code || "").replace(/^So/i, "").replace(/[^a-z0-9]/gi, "");
  if (code) return code.slice(0, 2).toUpperCase();
  return String(school.name || school.label || "School")
    .replace(/^School of\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SC";
};

export const schoolVisualMeta = (schoolValue, index = 0) => {
  const school = typeof schoolValue === "object" ? schoolValue : getSchoolByValue(schoolValue);
  const paletteIndex = Math.abs(Number(school?.order ?? index) || 0) % SCHOOL_VISUAL_PALETTE.length;
  const palette = SCHOOL_VISUAL_PALETTE[paletteIndex];
  return {
    icon: schoolInitials(school),
    color: school?.color || school?.themeColor || palette.color,
    bg: school?.bg || school?.themeBg || palette.bg,
  };
};

export const isCisrSchool = (school) => getSchoolKey(school) === "CISR";

export const schoolUnitLabel = (school) => {
  const config = typeof school === "object" ? school : getSchoolByValue(school);
  const value = config?.unitLabel || config?.unit_label || config?.departmentLabel || config?.department_label || config?.programLabel || config?.program_label;
  return String(value || "Program").trim() || "Program";
};

export const isDepartmentUnitSchool = (school) =>
  schoolUnitLabel(school).toLowerCase() === "department";

// Department names are now a Director-managed list per school (see departmentsService.js),
// not a fixed enum — validity is enforced at signup time against that list, so this is just
// a display/storage normalizer, not a lookup.
export const canonicalDepartmentValue = (department) => String(department || "").trim();

