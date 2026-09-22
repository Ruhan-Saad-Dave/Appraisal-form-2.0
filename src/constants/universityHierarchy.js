export const DEAN_TRACKS = {
  ENGINEERING: "engineering",
  NON_ENGINEERING: "non_engineering",
  CISR: "cisr",
};

export const SOEMR_DEPARTMENTS = [
  "Mechanical Engineering",
  "Civil Engineering",
  "Chemical Engineering",
  "Semiconductor Engineering",
];

export const UNIVERSITY_SCHOOLS = [
  {
    code: "SoCSEA",
    name: "School of Computer Science, Engineering & Applications",
    label: "SoCSEA - School of Computer Science, Engineering & Applications",
    deanTrack: DEAN_TRACKS.ENGINEERING,
    hodDepartments: [],
    aliases: [
      "socsea",
      "computer science",
      "school of computer science",
      "school of computer science engineering applications",
      "school of computer science, engineering and applications",
      "school of computer science & engineering",
      "computer science & engineering",
      "computer science and engineering",
      "cse",
      "cs",
    ],
  },
  {
    code: "SoBB",
    name: "School of Bio-Engineering & Bio Science",
    label: "SoBB - School of Bio-Engineering & Bio Science",
    deanTrack: DEAN_TRACKS.ENGINEERING,
    hodDepartments: [],
    aliases: [
      "sobb",
      "bio-engineering",
      "bio engineering",
      "bio science",
      "bioscience",
      "biotechnology",
      "school of bio engineering and bio science",
      "school of bio engineering & bio science",
    ],
  },
  {
    code: "SoCE",
    name: "School of Continual Education",
    label: "SoCE - School of Continual Education",
    deanTrack: DEAN_TRACKS.ENGINEERING,
    hodDepartments: [],
    aliases: ["soce", "continual education", "continual", "school of continual education"],
  },
  {
    code: "SoEMR",
    name: "School of Engineering Management & Research",
    label: "SoEMR - School of Engineering Management & Research",
    deanTrack: DEAN_TRACKS.ENGINEERING,
    hodDepartments: SOEMR_DEPARTMENTS,
    aliases: [
      "soemr",
      "engineering management",
      "engineering management research",
      "school of engineering management & research",
      "school of engineering management and research",
      "engineering",
    ],
  },
  {
    code: "SoCM",
    name: "School of Commerce & Management",
    label: "SoCM - School of Commerce & Management",
    deanTrack: DEAN_TRACKS.NON_ENGINEERING,
    hodDepartments: [],
    aliases: [
      "socm",
      "soc",
      "commerce",
      "commerce management",
      "management",
      "school of commerce & management",
      "school of commerce and management",
      "school of commerce",
      "business",
    ],
  },
  {
    code: "SoMCS",
    name: "School of Media & Communication Studies",
    label: "SoMCS - School of Media & Communication Studies",
    deanTrack: DEAN_TRACKS.NON_ENGINEERING,
    hodDepartments: [],
    aliases: [
      "somcs",
      "media",
      "communication studies",
      "media & communication",
      "media and communication",
      "school of media & communication studies",
      "school of media and communication studies",
    ],
  },
  {
    code: "SoHSS",
    name: "School of Humanities and Social Sciences",
    label: "SoHSS - School of Humanities and Social Sciences",
    deanTrack: DEAN_TRACKS.NON_ENGINEERING,
    hodDepartments: [],
    aliases: [
      "sohss",
      "hss",
      "humanities",
      "social sciences",
      "humanities and social sciences",
      "humanities & social sciences",
      "school of humanities and social sciences",
      "school of humanities & social sciences",
    ],
  },
  {
    code: "SoD",
    name: "School of Design",
    label: "SoD - School of Design",
    deanTrack: DEAN_TRACKS.NON_ENGINEERING,
    hodDepartments: [],
    aliases: ["sod", "ciod", "school of design", "design"],
  },
  {
    code: "SoAA",
    name: "School of Applied Arts",
    label: "SoAA - School of Applied Arts",
    deanTrack: DEAN_TRACKS.NON_ENGINEERING,
    hodDepartments: [],
    aliases: ["soaa", "applied arts", "school of applied arts", "arts"],
  },
  {
    code: "CISR",
    name: "Center for Interdisciplinary Studies and Research",
    label: "CISR - Center for Interdisciplinary Studies and Research",
    deanTrack: DEAN_TRACKS.CISR,
    hodDepartments: [],
    aliases: [
      "cisr",
      "center for interdisciplinary studies and research",
      "centre for interdisciplinary studies and research",
      "center for interdisciplinary studies & research",
      "centre for interdisciplinary studies & research",
      "interdisciplinary studies and research",
      "interdisciplinary studies",
    ],
  },
];

export const getSchoolsByDeanTrack = (deanTrack) =>
  UNIVERSITY_SCHOOLS.filter((school) => school.deanTrack === deanTrack);

export const getSchoolCodesByDeanTrack = (deanTrack) =>
  getSchoolsByDeanTrack(deanTrack).map((school) => school.code);

export const getSchoolLabelsByDeanTrack = (deanTrack) =>
  getSchoolsByDeanTrack(deanTrack).map((school) => school.label);

export const SCHOOL_OPTIONS = UNIVERSITY_SCHOOLS.map((school) => ({
  value: school.code,
  label: school.label,
}));

export const SOEMR_SCHOOL = UNIVERSITY_SCHOOLS.find((school) => school.code === "SoEMR");

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

export const isSoemrSchool = (school) => getSchoolKey(school) === "SoEMR";

export const isCisrSchool = (school) => getSchoolKey(school) === "CISR";

// Department names are now a Director-managed list per school (see departmentsService.js),
// not a fixed enum — validity is enforced at signup time against that list, so this is just
// a display/storage normalizer, not a lookup.
export const canonicalDepartmentValue = (department) => String(department || "").trim();

// Retained only as backend migration seed data for SoEMR's pre-existing departments
// (see backend_changes_requied.md) - no longer used by routing logic.
export const isValidSoemrDepartment = (department) =>
  SOEMR_DEPARTMENTS.includes(department);

