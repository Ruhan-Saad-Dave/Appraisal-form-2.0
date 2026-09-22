import {
  DEAN_TRACKS,
  UNIVERSITY_SCHOOLS,
  canonicalDepartmentValue,
  getSchoolKey as getConfiguredSchoolKey,
  isCisrSchool,
  normalizeHierarchyText,
} from "../constants/universityHierarchy.js";
import { isNonTeachingRole, normalizeNonTeachingRole, readReportsToRegistrarFlag, roReportsToRegistrar } from "../constants/nonTeachingHierarchy.js";

const ENGINEERING = DEAN_TRACKS.ENGINEERING;
const NON_ENGINEERING = DEAN_TRACKS.NON_ENGINEERING;
const CISR = DEAN_TRACKS.CISR;

export const SCHOOL_HIERARCHY = Object.fromEntries(
  UNIVERSITY_SCHOOLS.map((school) => [
    school.code,
    {
      name: school.name,
      label: school.label,
      deanTrack: school.deanTrack,
      directorLayer: true,
      hodDepartments: school.hodDepartments,
      aliases: school.aliases,
    },
  ])
);

const normalizeText = normalizeHierarchyText;

export const normalizeRoleForWorkflow = (role) => {
  const value = normalizeText(role);
  if (value === "admin" || value === "administrator") return "admin";
  if (value === "vice chancellor" || value === "vice chancelor" || value === "vc") return "vc";
  const nonTeachingRole = normalizeNonTeachingRole(value, "");
  if (nonTeachingRole) return nonTeachingRole;
  if (value === "center head" || value === "centre head" || value === "center_head" || value === "centre_head" || value === "centerhead" || value === "centrehead" || value.includes("cisr center head") || value.includes("cisr centre head") || value.includes("cisr_center_head") || value.includes("cisrcenterhead") || value.includes("cisrcentrehead")) return "center_head";
  if (value.includes("dean")) return "dean";
  if (value.includes("director")) return "director";
  if (value === "hod" || value.includes("head of department")) return "hod";
  return "faculty";
};

export const getSchoolKey = getConfiguredSchoolKey;

export const getSchoolHierarchy = (school) => SCHOOL_HIERARCHY[getSchoolKey(school)] || null;

export const getDeanTrack = (profile = {}) => {
  const rawSchool = normalizeText(profile.school);
  if (rawSchool === "non engineering" || rawSchool === "nonengineering" || rawSchool === "non_engineering") {
    return NON_ENGINEERING;
  }
  if (rawSchool === "engineering") {
    return ENGINEERING;
  }
  if (rawSchool === "cisr" || isCisrSchool(profile.school)) {
    return CISR;
  }

  const schoolConfig = getSchoolHierarchy(profile.school);
  if (schoolConfig?.deanTrack) return schoolConfig.deanTrack;

  const combined = normalizeText(`${profile.school || ""} ${profile.department || ""} ${profile.designation || ""} ${profile.email || ""}`);

  if (combined.includes("cisr") || combined.includes("interdisciplinary studies and research") || combined.includes("center head") || combined.includes("centre head")) {
    return CISR;
  }

  if (combined.includes("non engineering") || combined.includes("nonengineering") || combined.includes("commerce") || combined.includes("media") || combined.includes("humanities") || combined.includes("social sciences") || combined.includes("design") || combined.includes("applied arts") || combined.includes("socm") || combined.includes("somcs") || combined.includes("sohss") || combined.includes("sod") || combined.includes("soaa") || combined.includes("soa")) {
    return NON_ENGINEERING;
  }

  return ENGINEERING;
};

// Any non-CISR school with a department assigned has an HOD for that department.
// Department names come from the Director-managed per-school list (departmentsService.js) -
// validity is enforced there at signup time, not re-checked here.
export const departmentHasHod = (school, department) =>
  !isCisrSchool(school) && Boolean(canonicalDepartmentValue(department));

export const getReviewChain = (profile = {}) => {
  const role = normalizeRoleForWorkflow(profile.appraisal_role || profile.appraisalRole || profile.role);
  const reportsToRegistrar = profile.reports_to_registrar === true ||
    profile.reportsToRegistrar === true ||
    String(profile.reports_to_registrar || profile.reportsToRegistrar || "").trim().toLowerCase() === "true";

  if (role === "vc") return [];
  if (role === "registrar") return ["vc"];
  // A Reporting Officer's own appraisal: honour reports_to_registrar (unknown => keep Registrar).
  if (role === "reporting_officer")
    return roReportsToRegistrar(profile) ? ["registrar", "vc"] : ["vc"];
  if (role === "non_teaching_staff") {
    if (reportsToRegistrar) return ["registrar", "vc"];
    const explicitRegistrarFlag = readReportsToRegistrarFlag(profile);
    if (explicitRegistrarFlag === false) return ["reporting_officer", "vc"];
    return ["reporting_officer", "registrar", "vc"];
  }
  if (role === "center_head") return ["vc"];
  if (role === "dean") return ["vc"];
  if (role === "director") return ["dean", "vc"];
  if (role === "hod") return ["director", "dean", "vc"];

  const schoolKey = getSchoolKey(profile.school);
  const deanTrack = getDeanTrack(profile);
  if (schoolKey === "CISR" || isCisrSchool(profile.school) || deanTrack === CISR || deanTrack === "cisr") {
    return ["center_head", "vc"];
  }

  return departmentHasHod(profile.school, profile.department)
    ? ["hod", "director", "dean", "vc"]
    : ["director", "dean", "vc"];
};

// Part D (Leave & Attendance) always goes to the Registrar, bypassing the review chain above -
// but its release to VC is gated on the chain's final pre-VC stage (Dean/Center Head) approving
// Parts A/B/C/E, unless the originator *is* that final stage (a Dean/Center Head's own form),
// in which case there's nothing to wait for.
export const PART_D_STATUSES = {
  PENDING_REGISTRAR: "pending_registrar",
  REGISTRAR_APPROVED_PENDING_RELEASE: "registrar_approved_pending_release",
  RELEASED_TO_VC: "released_to_vc",
};

export const partDReleaseGateApplies = (subjectProfile = {}) => getReviewChain(subjectProfile).length > 1;

export const visiblePreviousReviewRoles = (reviewerRole, subjectProfile = {}) => {
  const role = normalizeRoleForWorkflow(reviewerRole);
  if (role === "admin") {
    return getSchoolKey(subjectProfile.school) === "CISR"
      ? ["center_head"]
      : ["hod", "director", "dean"];
  }
  if (role !== "vc") return [];

  const chain = getReviewChain(subjectProfile);
  const reviewerIndex = chain.indexOf(role);
  if (reviewerIndex < 0) return [];

  return chain.slice(0, reviewerIndex);
};

export const roleLabel = (role) => ({
  hod: "HOD",
  director: "Director",
  center_head: "Center Head",
  reporting_officer: "Reporting Officer",
  registrar: "Registrar",
  dean: "Dean",
  vc: "VC",
  non_teaching_staff: "Non-Teaching Staff",
  faculty: "Faculty",
}[role] || role);

export const pendingStatusFor = (role) => `Pending ${roleLabel(role)} Review`;
export const reviewedStatusFor = (role) => `${roleLabel(role)} Reviewed`;
export const rejectedStatusFor = (role) => `${roleLabel(role)} Rejected`;
export const isPendingReviewStatusFor = (status, role) => {
  const reviewerRole = normalizeRoleForWorkflow(role);
  const reviewerLabel = normalizeText(roleLabel(reviewerRole));
  const reviewerKey = normalizeText(reviewerRole);

  if (!reviewerRole) return false;
  const values = (Array.isArray(status) ? status : [status]).map(normalizeText).filter(Boolean);
  const pendingValues = [
    normalizeText(pendingStatusFor(reviewerRole)),
    `pending ${reviewerLabel}`,
    `pending ${reviewerKey}`,
    reviewerRole === "reporting_officer" ? "pending ro" : "",
    reviewerRole === "vc" ? "pending vice chancellor" : "",
    "pending review",
  ].filter(Boolean);
  return values.some((value) => pendingValues.includes(value));
};
export const isRejectedStatus = (status) => normalizeText(status).includes("rejected");
const timestampMs = (value) => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
};
export const reviewListFrom = (reviews = []) => {
  if (Array.isArray(reviews)) return reviews;
  if (!reviews || typeof reviews !== "object") return [];
  return Object.values(reviews).filter((review) => review && typeof review === "object");
};
const reviewTimestampMs = (review = {}) =>
  timestampMs(review?.reviewed_at || review?.reviewedAt || review?.updated_at || review?.updatedAt || review?.created_at || review?.createdAt);
const declarationTimestampMs = (declaration = {}) =>
  timestampMs(declaration?.submitted_at || declaration?.submittedAt || declaration?.updated_at || declaration?.updatedAt || declaration?.created_at || declaration?.createdAt);
export const hasRejectedReview = (reviews = [], { since } = {}) => {
  const sinceMs = timestampMs(since);
  return reviewListFrom(reviews).some((review) => [
    review?.status,
    review?.review_status,
    review?.reviewStatus,
    review?.workflow_status,
    review?.workflowStatus,
    review?.decision,
  ].some(isRejectedStatus) && (!sinceMs || !reviewTimestampMs(review) || reviewTimestampMs(review) >= sinceMs));
};
export const hasActiveRejection = (declaration, reviews = []) =>
  isRejectedStatus(declaration?.status || declaration?.workflow_status || declaration?.workflowStatus) ||
  hasRejectedReview(reviews, { since: declarationTimestampMs(declaration) });
export const isAppraisalFinalisedByVc = (item = {}) => {
  const statuses = [
    item?.declaration?.status,
    item?.declarationStatus,
    item?.declaration_status,
    item?.workflowStatus,
    item?.workflow_status,
    item?.status,
  ].map(normalizeText);
  return statuses.some((status) => status === "reviewed" || status === "vc reviewed");
};
export const reviewStatusForDecision = (role, decision = "approved") =>
  decision === "rejected" ? rejectedStatusFor(role) : reviewedStatusFor(role);

export const canReviewerRejectProfile = (reviewerRole, subjectProfile = {}) => {
  const role = normalizeRoleForWorkflow(reviewerRole);
  if (!role || role === "faculty") return false;

  const chain = getReviewChain(subjectProfile);
  if (chain.length > 0) {
    return role === chain[0];
  }
  return false;
};

export const workflowValidationError = (profile = {}) => {
  const role = normalizeRoleForWorkflow(profile.appraisal_role || profile.appraisalRole || profile.role);
  const schoolKey = getSchoolKey(profile.school);

  if (isNonTeachingRole(role)) {
    return "";
  }

  if (role !== "vc" && role !== "dean" && !schoolKey) {
    return "Please select one of the approved schools or centers before submitting.";
  }

  if (role === "hod" && schoolKey === "CISR") {
    return "HOD submissions are not applicable for CISR.";
  }

  if (role === "center_head" && schoolKey !== "CISR") {
    return "Center Head submissions are allowed only for CISR.";
  }

  // HOD accounts always need a department (that's the position they hold). Faculty may or
  // may not have one yet - if unset they simply route straight to Director, same as before
  // departments existed for their school.
  if (schoolKey && schoolKey !== "CISR" && role === "hod" && !canonicalDepartmentValue(profile.department)) {
    return "Please select a valid department before submitting.";
  }

  return "";
};

export const canAuthorityReviewProfile = (reviewerProfile = {}, subjectProfile = {}) => {
  const reviewerRole = normalizeRoleForWorkflow(reviewerProfile.appraisal_role || reviewerProfile.role);
  const subjectRole = normalizeRoleForWorkflow(subjectProfile.appraisal_role || subjectProfile.role);

  if (reviewerRole === "vc") return subjectRole !== "vc";

  if (reviewerRole === "registrar") {
    const chain = getReviewChain(subjectProfile);
    return chain.includes("registrar");
  }

  if (reviewerRole === "reporting_officer") {
    const chain = getReviewChain(subjectProfile);
    return chain.includes("reporting_officer") && subjectRole !== "reporting_officer";
  }

  if (isNonTeachingRole(reviewerRole) || isNonTeachingRole(subjectRole)) {
    return false;
  }

  if (reviewerRole === "dean") {
    const track = getDeanTrack(subjectProfile);
    return subjectRole !== "dean" &&
      track !== CISR &&
      getDeanTrack(reviewerProfile) === track;
  }

  if (reviewerRole === "director") {
    return getSchoolKey(reviewerProfile.school) !== "CISR" &&
      getSchoolKey(reviewerProfile.school) === getSchoolKey(subjectProfile.school) &&
      (subjectRole === "faculty" || subjectRole === "hod");
  }

  if (reviewerRole === "hod") {
    // An HOD can be assigned several programs/departments at once (see New_backend.md), all
    // within their own school - reviewerProfile.departments (array) is the source of truth once
    // populated; reviewerProfile.department (single) is the fallback for an HOD who's only ever
    // had one assignment. Same-school-only is still enforced by the getSchoolKey check below,
    // independent of how many entries reviewerDepartments has.
    const reviewerDepartments = Array.isArray(reviewerProfile.departments) && reviewerProfile.departments.length
      ? reviewerProfile.departments
      : [reviewerProfile.department];
    return subjectRole === "faculty" &&
      departmentHasHod(subjectProfile.school, subjectProfile.department) &&
      getSchoolKey(reviewerProfile.school) === getSchoolKey(subjectProfile.school) &&
      reviewerDepartments.some((department) => normalizeText(department) === normalizeText(subjectProfile.department));
  }

  if (reviewerRole === "center_head") {
    return subjectRole === "faculty" &&
      getSchoolKey(reviewerProfile.school) === "CISR" &&
      getSchoolKey(subjectProfile.school) === "CISR";
  }

  return false;
};

const getItem = (k) => (typeof window !== "undefined" ? sessionStorage.getItem(k) || localStorage.getItem(k) || "" : "");

export const profileFromsessionStorage = () => ({
  email: getItem("username") || getItem("email") || getItem("userEmail") || "",
  full_name: getItem("name") || "",
  appraisal_role: getItem("role") || "",
  school: getItem("school") || "",
  department: getItem("department") || "",
  departments: (() => {
    try {
      const parsed = JSON.parse(getItem("departments") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })(),
  designation: getItem("designation") || "",
  qualification: getItem("qualification") || "",
  teaching_experience: getItem("experience") || "",
  experience: getItem("experience") || "",
  employee_id: getItem("employeeId") || "",
  profile_picture_url: getItem("profilePictureUrl") || getItem("profile_picture_url") || getItem("avatarUrl") || "",
  profilePictureUrl: getItem("profilePictureUrl") || getItem("profile_picture_url") || getItem("avatarUrl") || "",
  avatar_url: getItem("profilePictureUrl") || getItem("profile_picture_url") || getItem("avatarUrl") || "",
  avatarUrl: getItem("profilePictureUrl") || getItem("profile_picture_url") || getItem("avatarUrl") || "",
  reports_to_registrar: getItem("reports_to_registrar") === "true" || getItem("reportsToRegistrar") === "true",
  reportsToRegistrar: getItem("reports_to_registrar") === "true" || getItem("reportsToRegistrar") === "true",
  registrar_email: getItem("registrar_email") || getItem("registrarEmail") || "",
  registrarEmail: getItem("registrar_email") || getItem("registrarEmail") || "",
});
