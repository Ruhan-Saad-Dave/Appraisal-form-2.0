import assert from "node:assert/strict";
import {
  DEAN_TRACKS,
  SCHOOL_OPTIONS,
  SOEMR_DEPARTMENTS,
  SOEMR_SCHOOL,
  UNIVERSITY_SCHOOLS,
  getSchoolsByDeanTrack,
  getSchoolCodesByDeanTrack,
} from "../src/constants/universityHierarchy.js";
import {
  canAuthorityReviewProfile,
  getDeanTrack,
  getReviewChain,
  visiblePreviousReviewRoles,
  workflowValidationError,
} from "../src/utils/hierarchy.js";

const roles = {
  vc: { appraisal_role: "vc" },
  engineeringDean: { appraisal_role: "dean", school: "SoCSEA" },
  nonEngineeringDean: { appraisal_role: "dean", school: "SoC" },
  soemrDirector: { appraisal_role: "director", school: SOEMR_SCHOOL.label },
  cisrCenterHead: { appraisal_role: "center_head", school: "CISR" },
  registrar: { appraisal_role: "registrar" },
  reportingOfficer: { appraisal_role: "reporting_officer" },
};

assert.equal(DEAN_TRACKS.CISR, "cisr", "DEAN_TRACKS.CISR must be 'cisr'");
assert.equal(DEAN_TRACKS.ENGINEERING, "engineering", "DEAN_TRACKS.ENGINEERING must be 'engineering'");
assert.equal(DEAN_TRACKS.NON_ENGINEERING, "non_engineering", "DEAN_TRACKS.NON_ENGINEERING must be 'non_engineering'");

const cisrSchoolObj = UNIVERSITY_SCHOOLS.find((s) => s.code === "CISR");
assert.ok(cisrSchoolObj, "CISR school must exist in UNIVERSITY_SCHOOLS");
assert.equal(cisrSchoolObj.deanTrack, DEAN_TRACKS.CISR, "CISR must have deanTrack === DEAN_TRACKS.CISR ('cisr')");

assert.deepEqual(
  getSchoolCodesByDeanTrack(DEAN_TRACKS.CISR),
  ["CISR"],
  "CISR track must contain only CISR"
);
assert.equal(
  getSchoolsByDeanTrack(DEAN_TRACKS.ENGINEERING).some((s) => s.code === "CISR"),
  false,
  "CISR must not appear in Engineering track"
);
assert.equal(
  getSchoolsByDeanTrack(DEAN_TRACKS.NON_ENGINEERING).some((s) => s.code === "CISR"),
  false,
  "CISR must not appear in Non-Engineering track"
);

assert.equal(getDeanTrack({ school: "CISR" }), "cisr", "getDeanTrack(CISR) must return 'cisr'");
assert.equal(getDeanTrack({ school: "Center for Interdisciplinary Studies & Research" }), "cisr", "getDeanTrack for CISR full name must return 'cisr'");
assert.equal(getDeanTrack({ school: "cisr" }), "cisr", "getDeanTrack('cisr') must return 'cisr'");

assert.equal(SCHOOL_OPTIONS.length, 10, "Signup must expose exactly 9 schools plus CISR");
assert.deepEqual(
  SCHOOL_OPTIONS.map((school) => school.value),
  [
    "SoCSEA",
    "SoBB",
    "SoCE",
    "SoEMR",
    "SoCM",
    "SoMCS",
    "SoHSS",
    "SoD",
    "SoAA",
    "CISR",
  ],
  "School/center dropdown values must match the codes exactly"
);
assert.deepEqual(
  SCHOOL_OPTIONS.map((school) => school.label),
  [
    "SoCSEA - School of Computer Science, Engineering & Applications",
    "SoBB - School of Bio-Engineering & Bio Science",
    "SoCE - School of Continual Education",
    "SoEMR - School of Engineering Management & Research",
    "SoCM - School of Commerce & Management",
    "SoMCS - School of Media & Communication Studies",
    "SoHSS - School of Humanities and Social Sciences",
    "SoD - School of Design",
    "SoAA - School of Applied Arts",
    "CISR - Center for Interdisciplinary Studies and Research",
  ],
  "School/center dropdown labels must match the labels exactly"
);

for (const school of UNIVERSITY_SCHOOLS.filter((item) => item.code !== "SoEMR" && item.code !== "CISR")) {
  const faculty = { appraisal_role: "faculty", school: school.label, department: "" };
  assert.deepEqual(
    getReviewChain(faculty),
    ["director", "dean", "vc"],
    `${school.code} faculty must route Director -> Dean -> VC`
  );
}

const cisrFaculty = { appraisal_role: "faculty", school: "CISR", department: "" };
assert.deepEqual(
  getReviewChain(cisrFaculty),
  ["center_head", "vc"],
  "CISR faculty must route Center Head -> VC"
);
assert.deepEqual(
  visiblePreviousReviewRoles("vc", cisrFaculty),
  ["center_head"],
  "VC must see Center Head score for CISR faculty"
);
assert.deepEqual(
  getReviewChain(roles.cisrCenterHead),
  ["vc"],
  "CISR Center Head self-appraisal must route directly to VC"
);
assert.equal(canAuthorityReviewProfile(roles.vc, roles.cisrCenterHead), true, "VC must review CISR Center Head");
assert.equal(canAuthorityReviewProfile(roles.cisrCenterHead, cisrFaculty), true, "CISR Center Head must review CISR faculty");
assert.equal(canAuthorityReviewProfile(roles.engineeringDean, cisrFaculty), false, "Engineering dean must not review CISR faculty");
assert.equal(canAuthorityReviewProfile(roles.nonEngineeringDean, cisrFaculty), false, "Non-engineering dean must not review CISR faculty");

const nonTeachingStaff = { appraisal_role: "non_teaching_staff", department: "Administration", school: "" };
const reportingOfficer = { appraisal_role: "reporting_officer", department: "Administration", school: "" };
const registrar = { appraisal_role: "registrar", department: "Office of the Registrar", school: "" };
assert.deepEqual(
  getReviewChain(nonTeachingStaff),
  ["reporting_officer", "registrar", "vc"],
  "Non-teaching staff must route Reporting Officer -> Registrar -> VC"
);
assert.deepEqual(
  getReviewChain(reportingOfficer),
  ["registrar", "vc"],
  "Reporting Officer self-appraisal must route Registrar -> VC"
);
assert.deepEqual(
  getReviewChain(registrar),
  ["vc"],
  "Registrar self-appraisal must route directly to VC"
);
assert.equal(canAuthorityReviewProfile(roles.reportingOfficer, nonTeachingStaff), true, "Reporting Officer must review non-teaching staff");
assert.equal(canAuthorityReviewProfile(roles.reportingOfficer, reportingOfficer), false, "Reporting Officer must not review self-role submissions");
assert.equal(canAuthorityReviewProfile(roles.registrar, reportingOfficer), true, "Registrar must review Reporting Officer");
assert.equal(canAuthorityReviewProfile(roles.registrar, nonTeachingStaff), true, "Registrar must review staff after Reporting Officer");
assert.equal(canAuthorityReviewProfile(roles.vc, registrar), true, "VC must review Registrar");
assert.equal(workflowValidationError(nonTeachingStaff), "", "Non-teaching staff should not require a school");

for (const department of SOEMR_DEPARTMENTS) {
  const faculty = { appraisal_role: "faculty", school: SOEMR_SCHOOL.label, department };
  assert.deepEqual(
    getReviewChain(faculty),
    ["hod", "director", "dean", "vc"],
    `${department} faculty must route HOD -> Director -> Dean -> VC`
  );
  assert.deepEqual(
    visiblePreviousReviewRoles("director", faculty),
    [],
    "Director must not see HOD scores while reviewing faculty"
  );
  assert.deepEqual(
    visiblePreviousReviewRoles("dean", faculty),
    [],
    "Dean must not see HOD/Director scores while reviewing faculty"
  );
  assert.deepEqual(
    visiblePreviousReviewRoles("vc", faculty),
    ["hod", "director", "dean"],
    "VC must see HOD, Director, and Dean scores for SoEMR faculty"
  );

  const matchingHod = { appraisal_role: "hod", school: SOEMR_SCHOOL.label, department };
  assert.equal(canAuthorityReviewProfile(matchingHod, faculty), true, `${department} HOD must see own faculty`);

  for (const otherDepartment of SOEMR_DEPARTMENTS.filter((item) => item !== department)) {
    const otherHod = { appraisal_role: "hod", school: SOEMR_SCHOOL.label, department: otherDepartment };
    assert.equal(
      canAuthorityReviewProfile(otherHod, faculty),
      false,
      `${otherDepartment} HOD must not see ${department} faculty`
    );
  }
}

const socseaFaculty = { appraisal_role: "faculty", school: "SoCSEA", department: "" };
const sobbDirector = { appraisal_role: "director", school: "SoBB" };
const socseaDirector = { appraisal_role: "director", school: "SoCSEA" };
assert.equal(canAuthorityReviewProfile(socseaDirector, socseaFaculty), true, "Same-school director must review faculty");
assert.equal(canAuthorityReviewProfile(sobbDirector, socseaFaculty), false, "Other-school director must not review faculty");
assert.deepEqual(
  visiblePreviousReviewRoles("dean", socseaFaculty),
  [],
  "Dean must not see Director score while reviewing non-SoEMR faculty"
);
assert.deepEqual(
  visiblePreviousReviewRoles("vc", socseaFaculty),
  ["director", "dean"],
  "VC must see Director and Dean scores for non-SoEMR faculty"
);

const soemrHod = { appraisal_role: "hod", school: SOEMR_SCHOOL.label, department: SOEMR_DEPARTMENTS[0] };
assert.deepEqual(getReviewChain(soemrHod), ["director", "dean", "vc"], "SoEMR HOD self-appraisal must route Director -> Dean -> VC");
assert.deepEqual(visiblePreviousReviewRoles("dean", soemrHod), [], "Dean must not see Director score while reviewing an HOD");
assert.deepEqual(visiblePreviousReviewRoles("vc", soemrHod), ["director", "dean"], "VC must see Director and Dean scores for an HOD");

const socseaDirectorSelf = { appraisal_role: "director", school: "SoCSEA", department: "" };
assert.deepEqual(getReviewChain(socseaDirectorSelf), ["dean", "vc"], "Director self-appraisal must route Dean -> VC");
assert.deepEqual(visiblePreviousReviewRoles("vc", socseaDirectorSelf), ["dean"], "VC must see Dean score for a Director");

const engineeringDeanSelf = { appraisal_role: "dean", school: "SoCSEA", department: "" };
assert.deepEqual(getReviewChain(engineeringDeanSelf), ["vc"], "Dean self-appraisal must route directly to VC");
assert.deepEqual(visiblePreviousReviewRoles("vc", engineeringDeanSelf), [], "Dean self-appraisal has no previous authority score before VC");

for (const school of UNIVERSITY_SCHOOLS) {
  const faculty = { appraisal_role: "faculty", school: school.label, department: school.code === "SoEMR" ? SOEMR_DEPARTMENTS[0] : "" };
  const engineering = school.deanTrack === DEAN_TRACKS.ENGINEERING;
  const isCisr = school.deanTrack === DEAN_TRACKS.CISR;
  assert.equal(
    canAuthorityReviewProfile(roles.engineeringDean, faculty),
    engineering && !isCisr,
    `Engineering dean visibility mismatch for ${school.code}`
  );
  assert.equal(
    canAuthorityReviewProfile(roles.nonEngineeringDean, faculty),
    !engineering && !isCisr,
    `Non-engineering dean visibility mismatch for ${school.code}`
  );
  assert.equal(canAuthorityReviewProfile(roles.vc, faculty), true, `VC must review ${school.code}`);
}

// Department is now a Director-managed per-school list rather than a SoEMR-only fixed enum
// (see backend_changes_requied.md) - Faculty without a department is allowed and simply
// routes straight to Director, same as any other school with no departments configured yet.
assert.equal(
  workflowValidationError({ appraisal_role: "faculty", school: SOEMR_SCHOOL.label, department: "" }),
  "",
  "SoEMR faculty without a department must still be allowed to submit - they route to Director"
);
assert.ok(
  workflowValidationError({ appraisal_role: "hod", school: SOEMR_SCHOOL.label, department: "" }),
  "HOD without a department must always be rejected, since a department is the position itself"
);

// HOD-per-department routing is no longer SoEMR-specific - any non-CISR school with a
// department set must route Faculty through HOD the same way SoEMR always has.
const socseaFacultyWithDept = { appraisal_role: "faculty", school: "SoCSEA", department: "Computer Engineering" };
assert.deepEqual(
  getReviewChain(socseaFacultyWithDept),
  ["hod", "director", "dean", "vc"],
  "Non-SoEMR faculty with a department set must route HOD -> Director -> Dean -> VC"
);
const socseaMatchingHod = { appraisal_role: "hod", school: "SoCSEA", department: "Computer Engineering" };
const socseaOtherHod = { appraisal_role: "hod", school: "SoCSEA", department: "Electronics Engineering" };
assert.equal(canAuthorityReviewProfile(socseaMatchingHod, socseaFacultyWithDept), true, "Non-SoEMR HOD must see own-department faculty");
assert.equal(canAuthorityReviewProfile(socseaOtherHod, socseaFacultyWithDept), false, "Non-SoEMR HOD must not see other-department faculty");
assert.equal(workflowValidationError({ appraisal_role: "hod", school: "SoCSEA", department: "Computer Engineering" }), "", "Non-SoEMR HOD with a department must be allowed");

console.log("Hierarchy verification passed.");
