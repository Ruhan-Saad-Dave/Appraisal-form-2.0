export const toNumber = (value) =>{
 const parsed = parseFloat(value);
 return Number.isFinite(parsed) ? parsed : 0;
};

export const clampScore = (value, maxScore) =>{
 const max = toNumber(maxScore);
 const score = Math.max(0, toNumber(value));
 return max >0 ? Math.min(score, max) : score;
};

export const scoreRemaining = (earned, maxScore) =>
 Math.max(0, toNumber(maxScore) - clampScore(earned, maxScore));

export const stripMaxMarksFromTitle = (title) =>
 String(title ?? "")
 .replace(/\s*[-–—]\s*Max\s+\d+(?:\/\d+)?\s*marks?(?:\s*\([^)]*\))?/gi, "")
 .replace(/\s*\((?:Max\s+\d+(?:\/\d+)?|Max\s+\d+\s*marks?)(?:,\s*Max\s+\d+\s*per\s*row)?\)/gi, "")
 .replace(/\s*\(Max\s+\d+\s*per\s*row\)/gi, "")
 .replace(/\s{2,}/g, " ")
 .trim();

export const SCORE_LIMITS = {
 courseFileRow: 20,
 innovativeRow: 2,
 qualificationRow: 10,
 acrRow: 10,
 feedbackAverage: 100,
 societyRow: 5,
 fdpRow: 10,
 projectGuidanceDefaultRow: 5,
 researchPhd: 20,
 researchPg: 10,
 researchInternalProjects: 15,
 researchExternalProjects: 30,
};

export const INNOVATIVE_METHODS = [
 "Blended Learning",
 "Virtual Lab",
 "LMS",
 "Project Based Learning",
 "Flip Classroom",
 "Any Other",
];

export const COURSE_FILE_DETAIL_OPTIONS = [
 "1.Available",
 "2.Partially Available",
 "3.Not Available",
];

const normalizedText = (value) =>
 String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export const normalizeCourseFileDetails = (value) =>{
 const text = String(value ?? "").trim();
 if (!text) return "";
 const key = normalizedText(text).replace(/\s+/g, "");
 if (["yes", "available", "1.available", "1available"].includes(key)) return COURSE_FILE_DETAIL_OPTIONS[0];
 if (["partial", "partiallyavailable", "2.partiallyavailable", "2partiallyavailable"].includes(key)) return COURSE_FILE_DETAIL_OPTIONS[1];
 if (["no", "notavailable", "3.notavailable", "3notavailable"].includes(key)) return COURSE_FILE_DETAIL_OPTIONS[2];
 return text;
};

const splitListText = (value) =>
 String(value ?? "")
 .split(",")
 .map((item) =>item.trim())
 .filter(Boolean);

const rowMaxValue = (rowMax, row, index) =>
 typeof rowMax === "function" ? rowMax(row, index) : rowMax;

export const innovativeSelectionsFromDetails = (details = "") =>{
 const selected = splitListText(details);
 return INNOVATIVE_METHODS.filter((method) =>
 selected.some((item) =>normalizedText(item) === normalizedText(method)),
 );
};

export const innovativeTeachingScore = (details = "", storedScore = "", maxScore = 10) =>{
 const selectedCount = innovativeSelectionsFromDetails(details).length;
 const calculated = selectedCount * SCORE_LIMITS.innovativeRow;
 return clampScore(selectedCount ? calculated : storedScore, maxScore);
};

export const toggleInnovativeMethod = (details = "", method) =>{
 const selected = splitListText(details);
 const methodKey = normalizedText(method);
 const exists = selected.some((item) =>normalizedText(item) === methodKey);
 return exists
 ? selected.filter((item) =>normalizedText(item) !== methodKey).join(", ")
 : [...selected, method].join(", ");
};

export const courseFileRowScore = (row = {}) =>
 clampScore(row.score, SCORE_LIMITS.courseFileRow);

export const courseFileAverageScore = (rows = [], maxScore = 20) =>{
 const filled = rows.filter((row) =>String(row?.score ?? "").trim() !== "");
 if (!filled.length) return 0;
 const avg = filled.reduce((total, row) =>total + clampScore(row.score, SCORE_LIMITS.courseFileRow), 0) / filled.length;
 return clampScore(avg, maxScore);
};

export const projectGuidanceRowMax = (row = {}) =>{
 const label = normalizedText(row.label);
 if (label.includes("3/batch")) return 3;
 if (label.includes("max 5") || label.includes("award") || label.includes("sponsorship") || label.includes("outcome")) return 5;
 return SCORE_LIMITS.projectGuidanceDefaultRow;
};

export const researchGuidanceRowMax = (row = {}) =>{
 const degree = normalizedText(row.degree);
 if (degree.includes("pg") || degree.includes("post graduate") || degree.includes("postgraduate") || degree.includes("m.tech") || degree.includes("mtech") || degree.includes("master")) {
 return SCORE_LIMITS.researchPg;
 }
 if (degree.includes("phd") || degree.includes("ph.d") || degree.includes("doctor")) {
 return SCORE_LIMITS.researchPhd;
 }
 return 0;
};

export const researchGuidanceScore = (row = {}) =>{
 const rowMax = researchGuidanceRowMax(row);
 if (!rowMax) return 0;
 const storedScore = String(row.score ?? "").trim();
 if (storedScore !== "") return clampScore(storedScore, rowMax);
 return rowHasAnyValue(row, ["name", "thesis"])
 ? rowMax
 : clampScore(row.score, rowMax);
};

export const societySelectionForRow = (row = {}) =>{
 const selected = row.participated ?? row.completed ?? row.yesNo ?? row.yes_no ?? "";
 if (selected) return selected;
 return toNumber(row.score) >0 ? "Yes" : "";
};

export const societyRowLocked = () =>
 false;

export const societyRowScore = (row = {}) =>
 clampScore(toNumber(row.score), row.max || SCORE_LIMITS.societyRow);

export const effectiveMaxScore = (baseMax) =>
 toNumber(baseMax);

export const selfEffectivePartAMax = (baseMax = 150) =>
 effectiveMaxScore(baseMax);

export const sumSectionScore = (rows = [], maxScore, scoreKey = "score", rowMax) =>
 clampScore(
 rows.reduce((total, row, index) =>{
 const rawScore = toNumber(row?.[scoreKey]);
 const maxForRow = rowMaxValue(rowMax, row, index);
 return total + (maxForRow ? clampScore(rawScore, maxForRow) : rawScore);
 }, 0),
 maxScore,
 );

export const sumCalculatedSectionScore = (rows = [], maxScore, rowScore) =>
 clampScore(
 rows.reduce((total, row, index) =>total + clampScore(rowScore(row, index), maxScore), 0),
 maxScore,
 );

export const averageSectionScore = (rows = [], maxScore, scoreKey = "score") =>{
 const filled = rows.filter((row) =>String(row?.[scoreKey] ?? "").trim() !== "");
 if (!filled.length) return 0;
 return clampScore(
 filled.reduce((total, row) =>total + toNumber(row?.[scoreKey]), 0) / filled.length,
 maxScore,
 );
};

export const feedbackAverage = (row = {}) =>{
 const values = [row.fb1, row.fb2]
 .map((value) =>clampScore(value, SCORE_LIMITS.feedbackAverage))
 .filter((value) =>value >0);
 if (!values.length) return 0;
 return values.reduce((total, value) =>total + value, 0) / values.length;
};

export const feedbackRowScore = (row = {}, maxScore = 10) =>
 clampScore(feedbackAverage(row) / 10, maxScore);

// A4 Student Feedback Score guideline (Max 10): maps the 0-5 average of the two
// feedback rounds to a fixed score band, per the published rubric.
export const feedbackGuidelineScore = (average) =>{
 const avg = toNumber(average);
 if (avg >= 4.60) return 10;
 if (avg >= 4.30) return 9;
 if (avg >= 4.00) return 7;
 if (avg >= 3.70) return 5;
 if (avg >= 3.40) return 3;
 if (avg >= 3.00) return 1;
 return 0;
};

const A1_LECTURE_SCORE_RULES = [
 { min: 100, score: 10 },
 { min: 91, score: 9 },
 { min: 81, score: 8 },
 { min: 70, score: 7 },
];

export const lectureEffectivePct = (row = {}) =>{
 const explicitPct = parseFloat(row.pctConducted);
 if (Number.isFinite(explicitPct)) return explicitPct;
 const planned = toNumber(row.planned);
 const conducted = toNumber(row.conducted);
 return planned >0 && conducted >=0 ? (conducted / planned) * 100 : NaN;
};

// A1 Course Delivery & Classroom Engagement guideline (10 marks per course, max 4 courses):
// 100% conducted -> 10, 91-99% -> 9, 81-90% -> 8, 70-80% -> 7, below 70% -> 0.
export const lectureGuidelineScore = (row = {}) =>{
 const pct = lectureEffectivePct(row);
 if (!Number.isFinite(pct)) return "";
 const rule = A1_LECTURE_SCORE_RULES.find((r) =>pct >= r.min);
 return rule ? rule.score : 0;
};

const LAKH = 100000;
const currencyAmount = (value) =>{
 const parsed = parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
 return Number.isFinite(parsed) ? parsed : 0;
};

// B4 External Funded Research Projects guideline (Max 40, marks per row):
// Completed: >10L -> 15, 5-10L -> 10, <5L -> 6.
// Ongoing / Sanctioned: >10L -> 10, 5-10L -> 8, <5L -> 5.
// Submitted (proposal): >20L -> 10, <=20L -> 5.
export const externalProjectGuidelineScore = (row = {}) =>{
 const amount = toNumber(row.amount);
 const status = String(row.status || "").trim().toLowerCase();
 if (!status || amount <=0) return "";
 if (status === "completed") {
 if (amount >10 * LAKH) return 15;
 if (amount >=5 * LAKH) return 10;
 return 6;
 }
 if (status === "submitted") {
 return amount >20 * LAKH ? 10 : 5;
 }
 // Ongoing and Sanctioned share the same band.
 if (amount >10 * LAKH) return 10;
 if (amount >=5 * LAKH) return 8;
 return 5;
};

// B6 Consultancy, Testing & Training guideline (Max 20, marks per row):
// up to 50K -> 3, 50K-2L -> 5, 2L-5L -> 10, 5L-10L -> 15, above 10L -> 20.
export const consultancyGuidelineScore = (row = {}) =>{
 const amount = currencyAmount(row.amount || row.revenue);
 if (amount <=0) return "";
 if (amount >10 * LAKH) return 20;
 if (amount >5 * LAKH) return 15;
 if (amount >2 * LAKH) return 10;
 if (amount >50000) return 5;
 return 3;
};

export const feedbackSectionScore = (rows = [], maxScore = 10) =>{
 const filled = rows.filter((row) =>String(row?.score ?? "").trim() !== "");
 if (!filled.length) return 0;
 return clampScore(
 filled.reduce((total, row) =>total + clampScore(row?.score, maxScore), 0),
 maxScore,
 );
};

export const rowMaxForSection = (sectionKey, row = {}, sectionMax = 0) =>{
 if (sectionKey === "courseFile") return SCORE_LIMITS.courseFileRow;
 if (sectionKey === "obeRows" || sectionKey === "mentoringRows") return row.max || sectionMax;
 if (sectionKey === "projects") return projectGuidanceRowMax(row);
 if (sectionKey === "quals") return SCORE_LIMITS.qualificationRow;
 if (sectionKey === "feedback") return 10;
 if (sectionKey === "society") return row.max || SCORE_LIMITS.societyRow;
 if (sectionKey === "acr") return SCORE_LIMITS.acrRow;
 if (sectionKey === "research") return researchGuidanceRowMax(row);
 if (sectionKey === "projects2" || sectionKey === "internalProjects") return row.max || SCORE_LIMITS.researchInternalProjects;
 if (sectionKey === "externalProjects") return row.max || SCORE_LIMITS.researchExternalProjects;
 if (sectionKey === "fdps" || sectionKey === "training") return SCORE_LIMITS.fdpRow;
 return sectionMax;
};

export const scoreSectionRows = (sectionKey, rows = [], maxScore, scoreKey = "score", options = {}) =>{
 if (sectionKey === "feedback") {
 return scoreKey === "score"
 ? feedbackSectionScore(rows, maxScore)
 : averageSectionScore(rows, maxScore, scoreKey);
 }
 if (sectionKey === "lectures" || sectionKey === "courseFile") {
 return reviewSectionScore(sectionKey, rows, maxScore, scoreKey);
 }
 if (sectionKey === "research" && scoreKey === "score") {
 const autoFill = options.autoFillResearchScore !== false;
 return sumCalculatedSectionScore(rows, maxScore, (row) =>{
 const stored = String(row?.score ?? "").trim();
 if (stored !== "") return clampScore(stored, researchGuidanceRowMax(row));
 return autoFill ? researchGuidanceScore(row) : 0;
 });
 }
 if (sectionKey === "society") {
 return sumCalculatedSectionScore(rows, maxScore, (row) =>
 societyRowLocked(row) ? 0 : clampScore(row?.[scoreKey], row.max || SCORE_LIMITS.societyRow),
 );
 }
 return sumSectionScore(rows, maxScore, scoreKey, (row) =>rowMaxForSection(sectionKey, row, maxScore));
};

const hasScoreValue = (row = {}, key = "score") =>
 String(row?.[key] ?? "").trim() !== "";

const innovRowsScore = (rows = []) =>{
 const hasAnyScore = rows.some((row) =>hasScoreValue(row));
 if (!hasAnyScore) return "";
 const explicitSectionMax = rows
 .map((row) =>toNumber(row?.sectionMax || row?.section_max))
 .find((value) =>value >0);
 const effectiveMax = rows.some((row) =>row?.max)
 ? (explicitSectionMax || clampScore(rows.reduce((total, row) =>total + toNumber(row?.max), 0), 20))
 : 10;
 return String(clampScore(rows.reduce((total, row) =>total + clampScore(row?.score, row?.max || SCORE_LIMITS.innovativeRow), 0), effectiveMax));
};

export const normalizeAutoScores = (form = {}) =>({
 ...form,
 innovScore: Array.isArray(form.innovRows) && form.innovRows.length
 ? innovRowsScore(form.innovRows)
 : (String(form.innovDetails ?? "").trim() || String(form.innovScore ?? "").trim()
 ? String(innovativeTeachingScore(form.innovDetails, form.innovScore, 10))
 : ""),
 courseFile: (form.courseFile || []).map((row) =>({
 ...row,
 score: courseFileRowScore(row) ? String(courseFileRowScore(row)) : "",
 })),
 feedback: (form.feedback || []).map((row) =>({
 ...row,
 score: String(row.score ?? "").trim() ? String(clampScore(row.score, 10)) : "",
 })),
 society: (form.society || []).map((row) =>{
 return {
 ...row,
 score: String(clampScore(toNumber(row.score), row.max || SCORE_LIMITS.societyRow) || ""),
 };
 }),
 research: (form.research || []).map((row) =>{
 const stored = String(row?.score ?? "").trim();
 const rowMax = researchGuidanceRowMax(row);
 const fallback = researchGuidanceScore(row);
 return {
 ...row,
 score: stored !== "" ? String(clampScore(stored, rowMax)) : (fallback ? String(fallback) : ""),
 };
 }),
 projects: (form.projects || []).map((row) =>({
 ...row,
 score: String(clampScore(row.score, projectGuidanceRowMax(row)) || ""),
 })),
 projects2: (form.projects2 || []).map((row) =>({
 ...row,
 score: String(clampScore(row.score, row.max || SCORE_LIMITS.researchInternalProjects) || ""),
 })),
 internalProjects: (form.internalProjects || []).map((row) =>({
 ...row,
 score: String(clampScore(row.score, SCORE_LIMITS.researchInternalProjects) || ""),
 })),
 externalProjects: (form.externalProjects || []).map((row) =>({
 ...row,
 score: String(clampScore(row.score, row.max || SCORE_LIMITS.researchExternalProjects) || ""),
 })),
 proposals: (form.proposals || []).map((row) =>({
 ...row,
 score: String(consultancyGuidelineScore(row) || ""),
 })),
 consultancy: (form.consultancy || []).map((row) =>({
 ...row,
 score: String(consultancyGuidelineScore(row) || ""),
 })),
 quals: (form.quals || []).map((row) =>({
 ...row,
 score: String(clampScore(row.score, SCORE_LIMITS.qualificationRow) || ""),
 })),
 fdps: (form.fdps || []).map((row) =>({
 ...row,
 score: String(clampScore(row.score, SCORE_LIMITS.fdpRow) || ""),
 })),
 training: (form.training || []).map((row) =>({
 ...row,
 score: String(clampScore(row.score, SCORE_LIMITS.fdpRow) || ""),
 })),
});

export const isFilled = (value) =>String(value ?? "").trim() !== "";

export const rowHasAnyValue = (row = {}, keys = []) =>
 keys.some((key) =>isFilled(row?.[key]));

export const qualificationRowDescription = (row = {}) => {
 const primary =
 row.label ||
 row.title ||
 row.qualification_title ||
 row.qualificationTitle ||
 row.qualification ||
 row.certification_title ||
 row.certificationTitle ||
 row.certification ||
 row.name ||
 "";
 const details = [row.awardingBody || row.awarding_body || row.body, row.date].filter(isFilled);
 if (!isFilled(primary)) return details.join(" - ");
 return details.length ? `${primary} (${details.join(", ")})` : String(primary);
};

export const REVIEW_ROW_VALUE_KEYS = {
  lectures: ["sem", "code", "planned", "conducted"],
  courseFile: ["course", "title", "details"],
  obeRows: ["component", "evidence"],
  projects: ["studentsCount", "industryCollab", "awardReceived", "studentPub", "details"],
  mentoringRows: ["activity", "evidence"],
  quals: [
    "title",
    "qualification_title",
    "qualificationTitle",
    "qualification",
    "certification_title",
    "certificationTitle",
    "certification",
    "awarding_body",
    "awardingBody",
    "body",
    "date",
    "score",
  ],
  feedback: ["fb1", "fb2"],
  deptActs: ["activity", "nature", "period", "durationCat"],
  uniActs: ["activity", "nature", "period", "durationCat"],
  eventRows: ["event", "role", "fromDate", "toDate", "level"],
  events: ["event", "role", "fromDate", "toDate", "level"],
  society: ["activity", "details", "date", "participated", "completed", "yesNo", "yes_no"],
  industry: ["name", "details", "activity", "partner", "date"],
  alumniRows: ["activity", "details", "date"],
  alumni: ["activity", "details", "date"],
  placementRows: ["activityType", "type", "name", "date"],
  placements: ["activityType", "type", "name", "date"],
  acr: ["score", "details", "evidence"],
  journals: ["title", "journal", "issn", "index", "doi", "impact", "coAuthors", "firstAuthor"],
  popularWritings: ["title", "pubName", "type", "circulation", "media", "film"],
  books: ["title", "book", "issn", "pub", "publisher", "coauth", "coAuthors", "first", "type", "level"],
  ipr: ["title", "scope", "status", "fileNo", "type", "date"],
  ict: ["title", "desc", "type", "quad", "platform", "reach"],
  research: ["degree", "name", "thesis", "status", "date"],
  projects2: ["title", "agency", "date", "amount", "role", "status"],
  internalProjects: ["title", "agency", "date", "amount", "role", "status"],
  externalProjects: ["title", "agency", "date", "amount", "role", "status"],
  patents: ["title", "type", "date", "status", "fileNo"],
  consultancy: ["client", "nature", "amount", "agency", "duration"],
  awards: ["title", "date", "agency", "level"],
  confs: ["title", "type", "org", "level", "role", "date"],
  proposals: ["title", "duration", "agency", "amount"],
  products: ["details", "usage", "used", "title", "role", "status"],
  innovation: ["details", "usage", "used", "title", "role", "status"],
  fdps: ["program", "duration", "org"],
  training: ["company", "duration", "nature"],
  innovRows: ["method", "details"],
  exhibitions: ["title", "type", "venueLevel", "date"],
};

const IGNORED_METADATA_KEYS = new Set([
  "_id", "id", "hod", "director", "dir", "dean", "vc", "ro", "reg", "status", "workflowStatus", "workflow_status",
  "label", "code", "isStatic", "defaultLabel", "max"
]);

const INNOVATIVE_METHOD_PLACEHOLDER = "innovative / participatory teaching methods used";

const isPlaceholderInnovativeMethod = (value) =>
  String(value || "").trim().toLowerCase() === INNOVATIVE_METHOD_PLACEHOLDER;

export const rowHasFacultyData = (sectionKey, row = {}) => {
  if (!row || typeof row !== "object") return false;
  if (sectionKey === "acr") return true;

  if (
    isFilled(row.score) ||
    isFilled(row.marks) ||
    isFilled(row.claimedScore) ||
    isFilled(row.selfScore) ||
    isFilled(row.facultyScore)
  ) {
    return true;
  }

  if (
    isFilled(row.evidence) ||
    isFilled(row.doc) ||
    isFilled(row.document) ||
    isFilled(row.attachment) ||
    isFilled(row.file) ||
    isFilled(row.proof) ||
    isFilled(row.proofAttached) ||
    isFilled(row.filePath) ||
    isFilled(row.evidenceUrl)
  ) {
    return true;
  }

  if (sectionKey === "lectures") {
    return isFilled(row.planned) || isFilled(row.conducted);
  }
  if (sectionKey === "obeRows") {
    return isFilled(row.evidence) || isFilled(row.attainment);
  }
  if (sectionKey === "mentoringRows") {
    return isFilled(row.studentsCount) || isFilled(row.evidence);
  }
  if (sectionKey === "projects") {
    return isFilled(row.details) || isFilled(row.studentsCount);
  }
  if (sectionKey === "innovRows") {
    if (isFilled(row.methodOther) || isFilled(row.details)) return true;
    return isFilled(row.method) && !isPlaceholderInnovativeMethod(row.method);
  }

  return Object.entries(row).some(([key, value]) => !IGNORED_METADATA_KEYS.has(key) && isFilled(value));
};

export const rowHasReviewableData = (sectionKey, row = {}, docs = null, docKey = null) => {
  if (!row || typeof row !== "object") return false;
  if (sectionKey === "acr" && isFilled(row.label)) return true;

  if (docs && docKey) {
    const keysToCheck = Array.isArray(docKey) ? docKey : [docKey];
    const hasDoc = keysToCheck.some((k) => {
      if (!k) return false;
      const file = docs[k];
      return Boolean(file && (typeof file === "string" ? file.trim() : file.name || file.url || file.path));
    });
    if (hasDoc) return true;
  }

  return rowHasFacultyData(sectionKey, row);
};

export const isSectionEmpty = (sectionKey, rows, docs = null) => {
  if (sectionKey === "acr") return false; // ACR is evaluator-only, never considered empty
  const arr = Array.isArray(rows) ? rows : [];
  if (arr.length === 0) return true;
  return !arr.some(row => rowHasReviewableData(sectionKey, row, docs));
};



export const reviewRowMaxForSection = (sectionKey, row = {}, sectionMax = 0) =>
 sectionKey === "innovRows"
 ? row.max || SCORE_LIMITS.innovativeRow
 : rowMaxForSection(sectionKey, row, sectionMax);

export const clampReviewScore = (sectionKey, row = {}, value, sectionMax = 0) =>{
 if (sectionKey !== "acr" && !rowHasReviewableData(sectionKey, row)) return "";
 if (!isFilled(value)) return "";
 const maxForRow = reviewRowMaxForSection(sectionKey, row, sectionMax);
 return String(maxForRow ? clampScore(value, maxForRow) : clampScore(value, sectionMax));
};

export const reviewSectionScore = (sectionKey, rows = [], maxScore = 0, scoreKey = "score") =>{
 const reviewableRows = rows.filter((row) =>rowHasReviewableData(sectionKey, row));
 if (!reviewableRows.length) return 0;
 const explicitSectionMax = sectionKey === "innovRows"
 ? reviewableRows.map((row) =>toNumber(row?.sectionMax || row?.section_max)).find((value) =>value >0)
 : 0;
 const effectiveMaxScore = sectionKey === "innovRows" && explicitSectionMax
 ? explicitSectionMax
 : sectionKey === "innovRows" && toNumber(maxScore) >= 20 && reviewableRows.some((row) =>row?.max)
 ? Math.max(toNumber(maxScore), clampScore(reviewableRows.reduce((total, row) =>total + toNumber(row.max), 0), 20))
 : maxScore;

 if (sectionKey === "feedback") {
 const scoredRows = reviewableRows.filter((row) => isFilled(row?.[scoreKey]));
 if (!scoredRows.length) return 0;
 const total = scoredRows.reduce((sum, row) => {
 const rowMax = reviewRowMaxForSection(sectionKey, row, maxScore);
 return sum + (rowMax ? clampScore(row?.[scoreKey], rowMax) : toNumber(row?.[scoreKey]));
 }, 0);
 return clampScore(total / scoredRows.length, effectiveMaxScore);
 }

 return clampScore(
 reviewableRows.reduce((sum, row) =>{
 const rowMax = reviewRowMaxForSection(sectionKey, row, maxScore);
 return sum + (rowMax ? clampScore(row?.[scoreKey], rowMax) : toNumber(row?.[scoreKey]));
 }, 0),
 effectiveMaxScore,
 );
};

const FIELD_ALIASES = {
  index: ["index", "indexing", "impact", "impactFactor", "issn"],
  impact: ["impact", "impactFactor", "index", "indexing"],
  impactFactor: ["impactFactor", "impact", "index", "indexing"],
  issn: ["issn", "doi"],
  position: ["position", "authorPosition", "firstAuthor", "first", "coauth", "coAuthors"],
  authorPosition: ["authorPosition", "position", "firstAuthor", "first", "coauth", "coAuthors"],
  first: ["first", "firstAuthor", "authorPosition", "position", "coauth", "coAuthors"],
  coauth: ["coauth", "coAuthors", "authorPosition", "position", "firstAuthor"],
  book: ["book", "publisherIsbn", "publisher"],
  pub: ["pub", "type", "publisher"],
  fileNo: ["fileNo", "date"],
  fromDate: ["fromDate", "date"],
  toDate: ["toDate", "date"],
};

export const rowMissingFields = (row = {}, keys = []) =>
  keys.filter((key) => {
    const aliases = FIELD_ALIASES[key] || [key];
    return !aliases.some((alias) => isFilled(row?.[alias]));
  });

const YES_NO_FIELD_NAMES = new Set([
 "evidence",
 "details",
 "first",
 "used",
 "usage",
 "industryCollab",
 "awardReceived",
 "studentPub",
 "participated",
 "completed",
 "yesNo",
 "yes_no",
]);

const isNoValue = (value) =>
 ["no", "n", "false", "not available", "3 not available"].includes(normalizedText(value));

const rowHasActiveClaim = (row = {}, keys = []) =>
 keys.some((key) => {
 const value = row?.[key];
 if (!isFilled(value)) return false;
 return !(YES_NO_FIELD_NAMES.has(key) && isNoValue(value));
 });

const rowDeclinesEvidence = (row = {}, keys = []) =>
 keys.some((key) =>YES_NO_FIELD_NAMES.has(key) && isNoValue(row?.[key]));

export const ATTACHMENT_REQUIREMENT_TEXT = "";

export const isAllowedAttachmentFile = () => true;

const docFileIdentity = (file) =>{
 if (!file) return "";
 if (typeof file === "string") return file.trim();
 const url = file.url || file.file_url || file.fileUrl || file.document_url || file.documentUrl || file.path || file.location;
 if (url) return String(url).trim();
 return [file.name || file.file_name || file.fileName || "", file.size || "", file.type || file.file_type || file.fileType || ""].join("|");
};

export const filesForDocValue = (value) =>{
 const seen = new Set();
 return (Array.isArray(value) ? value : value ? [value] : []).filter((file) =>{
 if (!file) return false;
 const identity = docFileIdentity(file);
 if (!identity) return true;
 if (seen.has(identity)) return false;
 seen.add(identity);
 return true;
 });
};

export const docsForRow = (docs = {}, docPrefix = "", index = 0, docKey) =>{
 if (Array.isArray(docKey)) return filesForDocValue(docKey.flatMap((key) =>filesForDocValue(docs?.[key])));
 if (docKey) return filesForDocValue(docs?.[docKey]);
 if (!docPrefix) return [];
 return filesForDocValue(docs?.[`${docPrefix}-${index}`]);
};

const docPrefixForSectionLabel = (label = "") =>{
  const text = normalizedText(label);
  
  // Direct section code matches
  if (text.includes("a(i)") || text.includes("a1")) return "lec";
  if (text.includes("a(ii)") || text.includes("a2") || text.includes("course file") || text.includes("coursefile")) return "courseFile";
  if (text.includes("a(iii)") || text.includes("a3") || text.includes("innovative")) return "innov";
  if (text.includes("a5") || text.includes("learning outcome") || text.includes("obe")) return "obe";
  if (text.includes("a6") || text.includes("project guidance") || text.includes("student project")) return "proj";
  if (text.includes("a7") || text.includes("mentoring")) return "mentor";
  if (text.includes("a8") || text.includes("qualification") || text.includes("professional development")) return "qual";
  if (text.includes("c1") || text.includes("administration at university") || text.includes("university level")) return "uni";
  if (text.includes("c2") || text.includes("administration at school") || text.includes("school level")) return "dept";
  if (text.includes("c3") || text.includes("event organisation") || text.includes("event organization")) return "event";
  if (text.includes("c4") || text.includes("society") || text.includes("outreach")) return "soc";
  if (text.includes("c5") || text.includes("industry interaction") || text.includes("industry connect")) return "ind";
  if (text.includes("c6") || text.includes("alumni")) return "alumni";
  if (text.includes("c7") || text.includes("placement")) return "placement";
  if (text.includes("b1") || text.includes("journal")) return "jour";
  if (text.includes("b2") || text.includes("book")) return "book";
  if (text.includes("b3") || text.includes("patent") || text.includes("ipr")) return "pat";
  if (text.includes("b4") || text.includes("funded research project")) return "project2";
  if (text.includes("b5") || text.includes("research guidance")) return "res";
  if (text.includes("b6") || text.includes("consultancy")) return "prop";
  if (text.includes("b7") || (text.includes("conference") && text.includes("organised"))) return "conf";
  if (text.includes("b8") && text.includes("industrial training")) return "train";
  if (text.includes("b8") || (text.includes("conference") && text.includes("attended"))) return "fdp";
  if (text.includes("b9") || text.includes("award")) return "awd";
  if (text.includes("b10") || text.includes("product")) return "prod";
  if (text.includes("b11") || text.includes("ict")) return "ict";

  // Fallbacks
  if (text.includes("lectures")) return "lec";
  if (text.includes("innovative")) return "innov";
  if (text.includes("project") && text.includes("external")) return "externalProject";
  if (text.includes("project") && (text.includes("internal") || text.includes("b4(b)"))) return "project2";
  if (text.includes("a(iv)") || text === "projects") return "proj";
  if (text.includes("qualification")) return "qual";
  if (text.includes("department")) return "dept";
  if (text.includes("university")) return "uni";
  if (text.includes("society")) return "soc";
  if (text.includes("industry connect")) return "ind";
  if (text.includes("journal")) return "jour";
  if (text.includes("book")) return "book";
  if (text.includes("ict")) return "ict";
  if (text.includes("research guidance")) return "res";
  if (text.includes("patent") || text.includes("ipr")) return "pat";
  if (text.includes("award")) return "awd";
  if (text.includes("conference")) return "conf";
  if (text.includes("proposal")) return "prop";
  if (text.includes("product")) return "prod";
  if (text.includes("fdp") || text.includes("workshop")) return "fdp";
  if (text.includes("industrial training")) return "train";
  return "";
};

const isAverageScoredSectionLabel = () => false;

export const validateCompleteRows = (sections = [], defaultDocs) =>{
 const errors = [];

 sections.forEach(({ label, rows = [], fields = [], skip = false, rowMax, maxScore, scoreField = "score", docs = defaultDocs, docPrefix, docKey, requireAttachment, isRowActive, fieldsForRow, capSectionTotal = false }) =>{
 if (skip) return;
 const labelText = normalizedText(label);
 const isB8Section = /^b8(?:\(|\.)/.test(labelText);
 const inferredRowMax = rowMax ?? (labelText.includes("fdp") || labelText.includes("industrial training") ? SCORE_LIMITS.fdpRow : undefined);
 const resolvedDocPrefix = docPrefix ?? (docs ? docPrefixForSectionLabel(label) : "");
 const shouldRequireAttachment = requireAttachment ?? Boolean(resolvedDocPrefix || docKey);

 rows.forEach((row, index) =>{
 const rowFields = typeof fieldsForRow === "function" ? fieldsForRow(row, index) : fields;
 const rowIsActive = typeof isRowActive === "function" ? isRowActive(row, index) : rowHasActiveClaim(row, rowFields);
 if (!rowIsActive) return;

 const rowDeclinesSupportingEvidence = rowDeclinesEvidence(row, rowFields);
 const missing = rowDeclinesSupportingEvidence ? [] : rowMissingFields(row, rowFields);
 if (missing.length) {
 errors.push(`${label}, row ${index + 1}: fill all fields or clear the row.`);
 }

 const requireAttachmentForRow = typeof shouldRequireAttachment === "function"
 ? shouldRequireAttachment(row, index)
 : shouldRequireAttachment;

 if (requireAttachmentForRow && !rowDeclinesSupportingEvidence) {
 const files = docsForRow(docs, resolvedDocPrefix, index, typeof docKey === "function" ? docKey(row, index) : docKey);
 if (!files.length) {
 errors.push(`${label}, row ${index + 1}: attach an image or PDF.`);
 } else if (files.some((file) =>!isAllowedAttachmentFile(file))) {
 errors.push(`${label}, row ${index + 1}: attachment must be an image or PDF up to 10 MB.`);
 }
 }

 const maxForRow = rowMaxValue(inferredRowMax, row, index);
 if (maxForRow && isFilled(row?.[scoreField]) && toNumber(row?.[scoreField]) >maxForRow) {
 errors.push(`${label}, row ${index + 1}: score cannot exceed ${maxForRow}.`);
 }
 });

 if (maxScore && rows.length && !isB8Section && !capSectionTotal) {
 const total = isAverageScoredSectionLabel(labelText)
 ? averageSectionScore(rows, maxScore, scoreField)
 : rows.reduce((sum, row, index) =>{
 const maxForRow = rowMaxValue(inferredRowMax, row, index);
 const score = maxForRow ? clampScore(row?.[scoreField], maxForRow) : toNumber(row?.[scoreField]);
 return sum + score;
 }, 0);
 if (total >toNumber(maxScore)) {
 errors.push(`${label}: total score cannot exceed ${maxScore}.`);
 }
 }
 });

 return errors;
};

export const maskDateDDMMYYYY = (value) =>{
 const digits = String(value ?? "").replace(/\D/g, "").slice(0, 8);
 if (digits.length<= 2) return digits;
 if (digits.length<= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
 return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

// Some rows were saved under an older schema where a field now split into two (or renamed)
// still carried real data under its old key. Copy that old value into the new key ONCE (only
// when the new key is empty) and drop the old key, so a live edit that clears the new field
// can never have it "revert" back to the stale legacy value on the next keystroke.
export const migrateLegacyRowFields = (rows, fieldPairs) =>{
 if (!Array.isArray(rows)) return rows;
 return rows.map((row) =>{
 if (!row || typeof row !== "object") return row;
 const next = { ...row };
 const legacyKeys = new Set();
 fieldPairs.forEach(([primary, legacy]) =>{
 if (!String(next[primary] ?? "").trim() && String(row[legacy] ?? "").trim()) {
 next[primary] = row[legacy];
 }
 legacyKeys.add(legacy);
 });
 legacyKeys.forEach((legacyKey) =>delete next[legacyKey]);
 return next;
 });
};

export const isValidDDMMYYYY = (value) =>{
 const text = String(value ?? "").trim();
 const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
 if (!match) return false;

 const day = Number(match[1]);
 const month = Number(match[2]);
 const year = Number(match[3]);
 const date = new Date(year, month - 1, day);

 return (
 date.getFullYear() === year &&
 date.getMonth() === month - 1 &&
 date.getDate() === day
 );
};

export const normalizeSingleFileDocs = (docs = {}) =>
 Object.fromEntries(
 Object.entries(docs || {}).map(([key, files]) =>[
 key,
 filesForDocValue(files),
 ]),
 );

export const scoreSummaryText = (earned, maxScore) =>({
 earned: clampScore(earned, maxScore),
 max: toNumber(maxScore),
 remaining: scoreRemaining(earned, maxScore),
});
