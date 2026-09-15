import assert from "node:assert/strict";
import {
  DEAN_TRACKS,
  SCHOOL_OPTIONS,
  UNIVERSITY_SCHOOLS,
  replaceUniversitySchools,
} from "../src/constants/universityHierarchy.js";
import {
  canAuthorityReviewProfile,
  getReviewChain,
  isPendingReviewStatusFor,
  visiblePreviousReviewRoles,
  workflowValidationError,
} from "../src/utils/hierarchy.js";

const HOD_DEPARTMENTS = ["Mechanical Engineering", "Civil Engineering"];

const schools = {
  engineeringDirector: {
    code: "ENG_DIR",
    name: "Dynamic Engineering Director School",
    label: "ENG_DIR - Dynamic Engineering Director School",
    track: DEAN_TRACKS.ENGINEERING,
    deanTrack: DEAN_TRACKS.ENGINEERING,
    hasHod: false,
    hasDirector: true,
    departments: [],
    defaultForm: "standard",
    formVariant: "standard",
    active: true,
  },
  engineeringHod: {
    code: "ENG_HOD",
    name: "Dynamic Engineering HOD School",
    label: "ENG_HOD - Dynamic Engineering HOD School",
    track: DEAN_TRACKS.ENGINEERING,
    deanTrack: DEAN_TRACKS.ENGINEERING,
    hasHod: true,
    hasDirector: true,
    departments: HOD_DEPARTMENTS,
    hodDepartments: HOD_DEPARTMENTS,
    defaultForm: "standard",
    formVariant: "standard",
    active: true,
  },
  nonEngineeringDirector: {
    code: "NENG_DIR",
    name: "Dynamic Non-Engineering Director School",
    label: "NENG_DIR - Dynamic Non-Engineering Director School",
    track: DEAN_TRACKS.NON_ENGINEERING,
    deanTrack: DEAN_TRACKS.NON_ENGINEERING,
    hasHod: false,
    hasDirector: true,
    departments: [],
    defaultForm: "creative",
    formVariant: "mediaCommunication",
    active: true,
  },
  nonEngineeringHod: {
    code: "NENG_HOD",
    name: "Dynamic Non-Engineering HOD School",
    label: "NENG_HOD - Dynamic Non-Engineering HOD School",
    track: DEAN_TRACKS.NON_ENGINEERING,
    deanTrack: DEAN_TRACKS.NON_ENGINEERING,
    hasHod: "true",
    hasDirector: "false",
    departments: ["Creative Program"],
    hodDepartments: ["Creative Program"],
    defaultForm: "creative",
    formVariant: "designArts",
    active: true,
    aliases: ["dynamic non engineering"],
  },
  deanOnly: {
    code: "NENG_DEAN",
    name: "Dynamic Dean Direct School",
    label: "NENG_DEAN - Dynamic Dean Direct School",
    track: DEAN_TRACKS.NON_ENGINEERING,
    deanTrack: DEAN_TRACKS.NON_ENGINEERING,
    hasHod: false,
    hasDirector: false,
    departments: [],
    defaultForm: "standard",
    formVariant: "standard",
    active: true,
  },
  cisr: {
    code: "CISR",
    name: "Center for Interdisciplinary Studies and Research",
    label: "CISR - Center for Interdisciplinary Studies and Research",
    track: DEAN_TRACKS.CISR,
    deanTrack: DEAN_TRACKS.CISR,
    hasHod: false,
    hasDirector: false,
    departments: [],
    defaultForm: "standard",
    formVariant: "standard",
    active: true,
  },
};

replaceUniversitySchools(Object.values(schools));

const roles = {
  vc: { appraisal_role: "vc" },
  engineeringDean: { appraisal_role: "dean", school: schools.engineeringDirector.code },
  nonEngineeringDean: { appraisal_role: "dean", school: "non_engineering" },
  cisrCenterHead: { appraisal_role: "center_head", school: "CISR" },
  registrar: { appraisal_role: "registrar" },
  reportingOfficer: { appraisal_role: "reporting_officer" },
};

assert.equal(SCHOOL_OPTIONS.length, Object.keys(schools).length, "School options must mirror the current dynamic school rows");
assert.deepEqual(
  SCHOOL_OPTIONS.map((school) => school.value),
  Object.values(schools).map((school) => school.code),
  "School dropdown values must come from dynamic school rows"
);

const engineeringDirectorFaculty = { appraisal_role: "faculty", school: schools.engineeringDirector.label, department: "" };
assert.deepEqual(getReviewChain(engineeringDirectorFaculty), ["director", "dean", "vc"], "Dynamic director school must route Director -> Dean -> VC");

for (const department of HOD_DEPARTMENTS) {
  const faculty = { appraisal_role: "faculty", school: schools.engineeringHod.label, department };
  assert.deepEqual(getReviewChain(faculty), ["hod", "director", "dean", "vc"], "Dynamic HOD school must route HOD -> Director -> Dean -> VC");
  assert.deepEqual(visiblePreviousReviewRoles("director", faculty), [], "Director must not see HOD scores while reviewing faculty");
  assert.deepEqual(visiblePreviousReviewRoles("dean", faculty), [], "Dean must not see HOD/Director scores while reviewing faculty");
  assert.deepEqual(visiblePreviousReviewRoles("vc", faculty), ["hod", "director", "dean"], "VC must see previous authority scores");

  const matchingHod = { appraisal_role: "hod", school: schools.engineeringHod.label, department };
  assert.equal(canAuthorityReviewProfile(matchingHod, faculty), true, "Assigned HOD must see own department faculty");

  for (const otherDepartment of HOD_DEPARTMENTS.filter((item) => item !== department)) {
    const otherHod = { appraisal_role: "hod", school: schools.engineeringHod.label, department: otherDepartment };
    assert.equal(canAuthorityReviewProfile(otherHod, faculty), false, "Other department HOD must not see this faculty");
  }
}

const nonEngineeringDirectorFaculty = { appraisal_role: "faculty", school: schools.nonEngineeringDirector.code, department: "" };
assert.deepEqual(getReviewChain(nonEngineeringDirectorFaculty), ["director", "dean", "vc"], "Dynamic non-engineering director school must route Director -> Dean -> VC");
assert.equal(canAuthorityReviewProfile({ appraisal_role: "director", school: schools.nonEngineeringDirector.code }, nonEngineeringDirectorFaculty), true, "Same-school director must review faculty");
assert.equal(canAuthorityReviewProfile({ appraisal_role: "director", school: schools.engineeringDirector.code }, nonEngineeringDirectorFaculty), false, "Other-school director must not review faculty");

const dynamicFaculty = { appraisal_role: "faculty", school: schools.nonEngineeringHod.code, department: "Creative Program" };
assert.deepEqual(getReviewChain(dynamicFaculty), ["hod", "dean", "vc"], "Dynamic school must derive approval chain from hasHod/hasDirector");
assert.deepEqual(getReviewChain({ appraisal_role: "hod", school: schools.nonEngineeringHod.code, department: "Creative Program" }), ["dean", "vc"], "Dynamic HOD self-appraisal must continue after the HOD step");
assert.equal(canAuthorityReviewProfile({ appraisal_role: "director", school: schools.nonEngineeringHod.code }, dynamicFaculty), false, "Director must not review when the chain omits Director");
assert.equal(canAuthorityReviewProfile({ appraisal_role: "hod", school: schools.nonEngineeringHod.code, department: "Creative Program" }, dynamicFaculty), true, "Dynamic HOD must review when chain includes HOD");
assert.equal(canAuthorityReviewProfile(roles.nonEngineeringDean, { ...dynamicFaculty, status: "HOD Reviewed", hodTotal: 100 }), true, "Dean must review HOD-approved dynamic schools with no Director");
assert.equal(isPendingReviewStatusFor("Pending Director Review", "dean"), false, "Pending Director status must not be treated as a Dean status");

const deanDirectFaculty = { appraisal_role: "faculty", school: schools.deanOnly.code, department: "" };
assert.deepEqual(getReviewChain(deanDirectFaculty), ["dean", "vc"], "Dynamic school without HOD/Director must route Dean -> VC");
assert.equal(canAuthorityReviewProfile({ appraisal_role: "director", school: schools.deanOnly.code }, deanDirectFaculty), false, "Director must not review dean-direct schools");
assert.equal(canAuthorityReviewProfile(roles.nonEngineeringDean, deanDirectFaculty), true, "Dean must review dean-direct schools first");

const cisrFaculty = { appraisal_role: "faculty", school: "CISR", department: "" };
assert.deepEqual(getReviewChain(cisrFaculty), ["center_head", "vc"], "CISR faculty must route Center Head -> VC");
assert.deepEqual(visiblePreviousReviewRoles("vc", cisrFaculty), ["center_head"], "VC must see Center Head score for CISR faculty");
assert.deepEqual(getReviewChain(roles.cisrCenterHead), ["vc"], "CISR Center Head self-appraisal must route directly to VC");
assert.equal(canAuthorityReviewProfile(roles.vc, roles.cisrCenterHead), true, "VC must review CISR Center Head");
assert.equal(canAuthorityReviewProfile(roles.cisrCenterHead, cisrFaculty), true, "CISR Center Head must review CISR faculty");
assert.equal(canAuthorityReviewProfile(roles.engineeringDean, cisrFaculty), false, "Engineering dean must not review CISR faculty");
assert.equal(canAuthorityReviewProfile(roles.nonEngineeringDean, cisrFaculty), false, "Non-engineering dean must not review CISR faculty");

const nonTeachingStaff = { appraisal_role: "non_teaching_staff", department: "Administration", school: "" };
const reportingOfficer = { appraisal_role: "reporting_officer", department: "Administration", school: "" };
const registrar = { appraisal_role: "registrar", department: "Office of the Registrar", school: "" };
assert.deepEqual(getReviewChain(nonTeachingStaff), ["reporting_officer", "registrar", "vc"], "Non-teaching staff must route Reporting Officer -> Registrar -> VC");
assert.deepEqual(getReviewChain(reportingOfficer), ["registrar", "vc"], "Reporting Officer self-appraisal must route Registrar -> VC");
assert.deepEqual(getReviewChain(registrar), ["vc"], "Registrar self-appraisal must route directly to VC");
assert.equal(canAuthorityReviewProfile(roles.reportingOfficer, nonTeachingStaff), true, "Reporting Officer must review non-teaching staff");
assert.equal(canAuthorityReviewProfile(roles.reportingOfficer, reportingOfficer), false, "Reporting Officer must not review self-role submissions");
assert.equal(canAuthorityReviewProfile(roles.registrar, reportingOfficer), true, "Registrar must review Reporting Officer");
assert.equal(canAuthorityReviewProfile(roles.registrar, nonTeachingStaff), true, "Registrar must review staff after Reporting Officer");
assert.equal(canAuthorityReviewProfile(roles.vc, registrar), true, "VC must review Registrar");
assert.equal(workflowValidationError(nonTeachingStaff), "", "Non-teaching staff should not require a school");

const directorSelf = { appraisal_role: "director", school: schools.engineeringDirector.code, department: "" };
assert.deepEqual(getReviewChain(directorSelf), ["dean", "vc"], "Director self-appraisal must route Dean -> VC");
assert.deepEqual(visiblePreviousReviewRoles("vc", directorSelf), ["dean"], "VC must see Dean score for a Director");

const deanSelf = { appraisal_role: "dean", school: schools.engineeringDirector.code, department: "" };
assert.deepEqual(getReviewChain(deanSelf), ["vc"], "Dean self-appraisal must route directly to VC");
assert.deepEqual(visiblePreviousReviewRoles("vc", deanSelf), [], "Dean self-appraisal has no previous authority score before VC");

for (const school of UNIVERSITY_SCHOOLS) {
  const faculty = { appraisal_role: "faculty", school: school.label, department: school.departments?.[0] || "" };
  const engineering = school.deanTrack === DEAN_TRACKS.ENGINEERING;
  const directVc = school.deanTrack === DEAN_TRACKS.CISR;
  assert.equal(canAuthorityReviewProfile(roles.engineeringDean, faculty), engineering && !directVc, `Engineering dean visibility mismatch for ${school.code}`);
  assert.equal(canAuthorityReviewProfile(roles.nonEngineeringDean, faculty), !engineering && !directVc, `Non-engineering dean visibility mismatch for ${school.code}`);
  assert.equal(canAuthorityReviewProfile(roles.vc, faculty), true, `VC must review ${school.code}`);
}

assert.equal(
  workflowValidationError({ appraisal_role: "faculty", school: schools.engineeringHod.label, department: "" }),
  "",
  "Faculty without a department must still be allowed; backend assignment decides the final queue"
);
assert.ok(
  workflowValidationError({ appraisal_role: "hod", school: schools.engineeringHod.label, department: "" }),
  "HOD without a department must always be rejected, since a department/program is the position itself"
);

const facultyWithDeptNoHod = { appraisal_role: "faculty", school: schools.engineeringDirector.code, department: "Computer Engineering" };
assert.deepEqual(getReviewChain(facultyWithDeptNoHod), ["director", "dean", "vc"], "A department value alone must not add HOD when the school chain omits HOD");
assert.equal(canAuthorityReviewProfile({ appraisal_role: "hod", school: schools.engineeringDirector.code, department: "Computer Engineering" }, facultyWithDeptNoHod), false, "HOD must not see faculty when HOD is absent from the configured chain");
assert.equal(workflowValidationError({ appraisal_role: "hod", school: schools.engineeringDirector.code, department: "Computer Engineering" }), "", "HOD account with a department is allowed; review authority still depends on the school chain");

console.log("Hierarchy verification passed.");
