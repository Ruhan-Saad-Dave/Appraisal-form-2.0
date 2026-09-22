import { normalizeCourseFileDetails } from '../../../../utils/appraisalFormUtils';

// Standard-only read adapter. Never infer aliases from labels or overwrite a
// present value (including an intentionally cleared string, zero or false).
const fieldsBySetter = {
  setLectures: { sem: ['semester'], code: ['course_code'], planned: ['planned_classes'], conducted: ['conducted_classes'], pctConducted: [] },
  setCourseFile: { course: [], title: [], details: [] },
  setInnovRows: { method: [], methodOther: [], details: [] },
  setProjects: { label: [], studentsCount: [], industryCollab: [], awardReceived: [], studentPub: [] },
  setQuals: {
    label: ['title', 'qualification', 'qualificationTitle', 'certification', 'certificationTitle', 'name'],
    awardingBody: ['awarding_body', 'body', 'details', 'agency', 'institution', 'institute', 'university'],
    date: ['completionDate', 'completion_date', 'awardDate', 'award_date'],
  },
  setFeedback: { code: ['course_code'], fb1: ['feedback_1'], fb2: ['feedback_2'] },
  setObeRows: { component: [], evidence: [] },
  setMentoringRows: { activity: [], evidence: [] },
  setDeptActs: { activity: [], nature: [], period: [] },
  setUniActs: { activity: [], nature: [], period: [] },
  setEventRows: { event: [], role: [], fromDate: [], toDate: [], level: [] },
  setSociety: { label: [], details: [], date: [] },
  setIndustry: { activity: [], partner: [], date: [] },
  setAlumniRows: { activity: [], details: [], date: [] },
  setPlacementRows: { activityType: [], name: [], date: [] },
  setJournals: { title: [], journal: [], issn: [], impactFactor: [], authorPosition: [] },
  setBooks: { title: [], book: [], pub: ['publisher'], level: [], coauth: ['coauthor'] },
  setIct: { title: [], type: [], quad: ['quadrant'] },
  setResearch: { degree: [], name: ['student_name'], status: ['thesis'], date: [] },
  setProjects2: { title: [], agency: [], date: ['sanction_date'], amount: [], role: [], status: ['project_status'] },
  setExternalProjects: { title: [], agency: [], date: ['sanction_date'], amount: [], role: [], status: ['project_status'] },
  setPatents: { title: [], type: [], status: ['patent_status'], fileNo: ['file_no'] },
  setAwards: { title: [], agency: [], level: [], date: ['award_date'] },
  setConfs: { title: [], role: [], date: [], level: [] },
  setProposals: { agency: [], duration: [], amount: [] },
  setProducts: { details: [], role: [], status: [] },
  setFdps: { program: [], fromDate: [], toDate: [], org: ['organization'] },
  setTraining: { company: [], duration: [], nature: [] },
};

export function standardReadRows(setterName, rows) {
  const fields = fieldsBySetter[setterName];
  if (!fields || !Array.isArray(rows)) return rows;
  return rows.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
    const extra = row.custom_fields;
    const stored = extra && typeof extra === 'object' && !Array.isArray(extra) ? extra : {};
    const result = { ...row };
    for (const [canonical, aliases] of Object.entries(fields)) {
      if (result[canonical] != null) continue;
      // Only known display fields can be unpacked. Never promote identity,
      // authorization, review scores or workflow metadata from custom_fields.
      const candidates = [stored[canonical], ...aliases.map(key => row[key]), ...aliases.map(key => stored[key])];
      const value = candidates.find(candidate => candidate != null);
      if (value !== undefined) result[canonical] = setterName === 'setCourseFile' && canonical === 'details'
        ? normalizeCourseFileDetails(value)
        : value;
    }
    return result;
  });
}

export function standardReadSetters(setters) {
  return Object.fromEntries(Object.entries(setters).map(([name, setter]) => [name,
    fieldsBySetter[name] ? value => setter(typeof value === 'function'
      ? current => standardReadRows(name, value(current))
      : standardReadRows(name, value)) : setter,
  ]));
}
