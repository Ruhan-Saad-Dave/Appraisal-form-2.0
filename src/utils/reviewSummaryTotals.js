const clean = (value) => String(value ?? "").trim();
const n = (value) => parseFloat(value) || 0;

const firstPresent = (...values) =>
  values.find((value) => value !== undefined && value !== null && clean(value) !== "");

const valueFrom = (sources, keys) =>
  firstPresent(...sources.flatMap((source = {}) => keys.map((key) => source?.[key])));

const numericFrom = (sources, keys, fallback = 0) => {
  const value = valueFrom(sources, keys);
  return value === undefined ? n(fallback) : n(value);
};

const clampScore = (value, maxScore) => {
  const max = n(maxScore);
  const score = Math.max(0, n(value));
  return max > 0 ? Math.min(score, max) : score;
};

const arrayValueFrom = (source = {}, keys = []) => {
  for (const key of keys) {
    const value = parseMaybeJson(source?.[key]);
    if (Array.isArray(value)) return value;
  }
  return null;
};

const rowScoreValue = (row = {}) =>
  firstPresent(
    row.score,
    row.selfScore,
    row.self_score,
    row.facultyScore,
    row.faculty_score,
  );

const rowMaxValue = (row = {}, fallbackMax = 0) =>
  n(firstPresent(row.max, row.maxScore, row.max_score, row.maximum, row.maximum_score)) || fallbackMax;

const scoreRowsFromSources = (sources, keys, sectionMax, rowMax = sectionMax) =>
  sources.reduce((bestScore, source) => {
    const rows = arrayValueFrom(source, keys);
    if (!rows) return bestScore;
    const sectionScore = clampScore(
      rows.reduce((total, row) => total + clampScore(rowScoreValue(row), rowMaxValue(row, rowMax)), 0),
      sectionMax,
    );
    return Math.max(bestScore, sectionScore);
  }, 0);

const effectiveMaxFromApplicability = (baseMax) => n(baseMax);
// "partD" below now means the NEW faculty-filled Leave & Attendance section (25 marks).
// "partE" is the section that used to be called Part D (the ACR, 50 marks) - its wire
// fields (part_d_score / part_d_total etc, read in standardReviewSummary below) were
// deliberately left unrenamed to avoid any backend contract change; only the UI label
// changed from "Part D" to "Part E".
const CURRENT_FORM_MAX = {
  partA: 150,
  partB: 350,
  partC: 150,
  partD: 25,
  partE: 50,
  grand: 725,
};

const parseMaybeJson = (value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !["{", "["].includes(trimmed[0])) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const partCScoreFromRows = (sources, partCMax) =>
  clampScore(
    scoreRowsFromSources(sources, ["uniActs", "university_activities", "universityActivities", "uni_acts"], 50) +
    scoreRowsFromSources(sources, ["deptActs", "departmental_activities", "departmentalActivities", "department_activities", "departmentActivities", "dept_acts"], 30) +
    scoreRowsFromSources(sources, ["eventRows", "events", "event_rows", "eventOrganisation", "event_organisation"], 20) +
    scoreRowsFromSources(sources, ["society", "social_contributions", "socialContributions", "contribution_to_society", "contributionToSociety"], 10) +
    scoreRowsFromSources(sources, ["industry", "industry_connect", "industryConnect"], 10) +
    scoreRowsFromSources(sources, ["alumniRows", "alumni", "alumni_rows"], 10) +
    scoreRowsFromSources(sources, ["placementRows", "placements", "placement_rows"], 20),
    partCMax,
  );

// Part D (Leave & Attendance Management, 25 marks, faculty-filled) has no dedicated
// part_d_total/partDTotal field on some queue payloads (only part_a/part_b are guaranteed) -
// recompute it from the raw leaveManagement row(s) the same way partCScoreFromRows recovers
// Part C, instead of silently showing 0 when the pre-aggregated total is missing.
const partDScoreFromRows = (sources, partDMax) =>
  scoreRowsFromSources(sources, ["leaveManagement", "leave_management"], partDMax, partDMax);

const normalizeReviewRole = (value) => {
  const role = clean(value).toLowerCase().replace(/[-\s]+/g, "_");
  if (role === "centerhead" || role === "centre_head" || role === "centrehead") return "center_head";
  return role;
};

const reviewArrayFrom = (value) => {
  const parsed = parseMaybeJson(value);
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed.map(parseMaybeJson);
  if (typeof parsed !== "object") return [];

  return Object.entries(parsed).map(([role, review]) => {
    const parsedReview = parseMaybeJson(review);
    if (parsedReview && typeof parsedReview === "object" && !Array.isArray(parsedReview)) {
      return { reviewer_role: parsedReview.reviewer_role || parsedReview.reviewerRole || role, ...parsedReview };
    }
    return { reviewer_role: role, total_score: parsedReview };
  });
};

const reviewsFromSources = (sources) =>
  sources.flatMap((source = {}) => [
    ...reviewArrayFrom(source.reviews),
    ...reviewArrayFrom(source.review_history),
    ...reviewArrayFrom(source.reviewHistory),
    ...reviewArrayFrom(source.appraisal_reviews),
    ...reviewArrayFrom(source.appraisalReviews),
    ...reviewArrayFrom(source.payload?.reviews),
    ...reviewArrayFrom(source.payload?.review_history),
    ...reviewArrayFrom(source.payload?.reviewHistory),
    ...reviewArrayFrom(source.payload?.appraisal_reviews),
    ...reviewArrayFrom(source.payload?.appraisalReviews),
    ...reviewArrayFrom(source.form?.reviews),
    ...reviewArrayFrom(source.form?.review_history),
    ...reviewArrayFrom(source.form?.reviewHistory),
  ]);

// Some previous-year records (fetched via GET /dashboard/faculty/{email} for a closed/past
// academic year) carry a review with no total_score/part_*_score fields at all - only a
// section_scores map of per-section score arrays (e.g. { lectures: [40, 35], courseFile: [16] }).
// Summing every number in that map recovers the reviewer's actual total when nothing else is
// present, instead of silently showing no score.
const sectionScoresTotal = (review = {}) => {
  const sectionScores = parseMaybeJson(review.section_scores) || parseMaybeJson(review.sectionScores);
  if (!sectionScores || typeof sectionScores !== "object") return undefined;
  let sum = 0;
  let found = false;
  Object.values(sectionScores).forEach((value) => {
    const parsedValue = parseMaybeJson(value);
    const values = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
    values.forEach((entry) => {
      const num = parseFloat(entry);
      if (Number.isFinite(num)) {
        sum += num;
        found = true;
      }
    });
  });
  return found ? sum : undefined;
};

const reviewSummaryForRole = (review = {}) => {
  const nestedTotals = parseMaybeJson(review.totals) || {};
  const partA = firstPresent(
    review.part_a_score,
    review.partAScore,
    review.part_a_total,
    review.partATotal,
    nestedTotals.partA,
    nestedTotals.part_a_score,
    nestedTotals.part_a_total,
  );
  const partB = firstPresent(
    review.part_b_score,
    review.partBScore,
    review.part_b_total,
    review.partBTotal,
    nestedTotals.partB,
    nestedTotals.part_b_score,
    nestedTotals.part_b_total,
  );
  const partC = firstPresent(
    review.part_c_score,
    review.partCScore,
    review.part_c_total,
    review.partCTotal,
    nestedTotals.partC,
    nestedTotals.part_c_score,
    nestedTotals.part_c_total,
  );
  const partD = firstPresent(
    review.part_d_score,
    review.partDScore,
    review.part_d_total,
    review.partDTotal,
    nestedTotals.partD,
    nestedTotals.part_d_score,
    nestedTotals.part_d_total,
  );
  const directTotal = firstPresent(
    review.total_score,
    review.totalScore,
    review.total,
    review.grand_total,
    review.grandTotal,
    nestedTotals.total,
    nestedTotals.total_score,
    nestedTotals.grand_total,
    nestedTotals.grandTotal,
  );
  const partsPresent = [partA, partB, partC, partD].some((value) => value !== undefined);
  const partsSum = partsPresent ? n(partA) + n(partB) + n(partC) + n(partD) : undefined;
  const sectionSum = sectionScoresTotal(review);
  // total_score is a NOT-NULL backend column defaulting to 0, so "present" alone doesn't mean
  // "actually recorded" - some historical reviews only ever had their per-section scores sent at
  // submission time, leaving total_score genuinely at its 0 default forever. Prefer whichever
  // candidate is actually positive; only fall back to a literal 0/undefined when every source
  // (direct total, summed parts, summed section_scores) agrees there's really nothing recorded.
  const total = [directTotal, partsSum, sectionSum].find((value) => value !== undefined && n(value) > 0)
    ?? directTotal ?? partsSum ?? sectionSum;
  return {
    partA,
    partB,
    partC,
    partD,
    total,
    remarks: firstPresent(review.remarks, review.comment, review.comments, review.review_remarks, review.reviewRemarks),
  };
};

export const standardReviewSummary = (...sourceInputs) => {
  const sources = sourceInputs.filter(Boolean);
  const summary = {};
  const assign = (target, keys) => {
    const value = valueFrom(sources, keys);
    if (value !== undefined) summary[target] = value;
  };

  assign("hodTotal", ["centerHeadTotal", "center_head_total", "centerHeadScore", "center_head_score", "centerHeadTotalScore", "center_head_total_score", "centerHeadGrandTotal", "center_head_grand_total", "centerHeadGrandTotalScore", "center_head_grand_total_score", "hodTotal", "hod_total", "hodScore", "hod_score", "hodTotalScore", "hod_total_score"]);
  assign("hodPartA", ["centerHeadPartA", "center_head_part_a", "centerHeadPartAScore", "center_head_part_a_score", "centerHeadPartATotal", "center_head_part_a_total", "hodPartA", "hod_part_a", "hodPartAScore", "hod_part_a_score", "hodPartATotal", "hod_part_a_total"]);
  assign("hodPartB", ["centerHeadPartB", "center_head_part_b", "centerHeadPartBScore", "center_head_part_b_score", "centerHeadPartBTotal", "center_head_part_b_total", "hodPartB", "hod_part_b", "hodPartBScore", "hod_part_b_score", "hodPartBTotal", "hod_part_b_total"]);
  assign("hodPartC", ["centerHeadPartC", "center_head_part_c", "centerHeadPartCScore", "center_head_part_c_score", "centerHeadPartCTotal", "center_head_part_c_total", "hodPartC", "hod_part_c", "hodPartCScore", "hod_part_c_score", "hodPartCTotal", "hod_part_c_total"]);
  assign("hodPartD", ["centerHeadPartD", "center_head_part_d", "centerHeadPartDScore", "center_head_part_d_score", "centerHeadPartDTotal", "center_head_part_d_total", "hodPartD", "hod_part_d", "hodPartDScore", "hod_part_d_score", "hodPartDTotal", "hod_part_d_total"]);
  assign("hodRemarks", ["hodRemarks", "hod_remarks", "centerHeadRemarks", "center_head_remarks"]);
  assign("directorTotal", ["directorTotal", "director_total", "directorScore", "director_score", "directorTotalScore", "director_total_score"]);
  assign("directorPartA", ["directorPartA", "director_part_a", "directorPartAScore", "director_part_a_score", "directorPartATotal", "director_part_a_total"]);
  assign("directorPartB", ["directorPartB", "director_part_b", "directorPartBScore", "director_part_b_score", "directorPartBTotal", "director_part_b_total"]);
  assign("directorPartC", ["directorPartC", "director_part_c", "directorPartCScore", "director_part_c_score", "directorPartCTotal", "director_part_c_total"]);
  assign("directorPartD", ["directorPartD", "director_part_d", "directorPartDScore", "director_part_d_score", "directorPartDTotal", "director_part_d_total"]);
  assign("directorRemarks", ["directorRemarks", "director_remarks"]);
  assign("deanTotal", ["deanTotal", "dean_total", "deanScore", "dean_score", "deanTotalScore", "dean_total_score"]);
  assign("deanPartA", ["deanPartA", "dean_part_a", "deanPartAScore", "dean_part_a_score", "deanPartATotal", "dean_part_a_total"]);
  assign("deanPartB", ["deanPartB", "dean_part_b", "deanPartBScore", "dean_part_b_score", "deanPartBTotal", "dean_part_b_total"]);
  assign("deanPartC", ["deanPartC", "dean_part_c", "deanPartCScore", "dean_part_c_score", "deanPartCTotal", "dean_part_c_total"]);
  assign("deanPartD", ["deanPartD", "dean_part_d", "deanPartDScore", "dean_part_d_score", "deanPartDTotal", "dean_part_d_total"]);
  assign("deanRemarks", ["deanRemarks", "dean_remarks"]);
  assign("vcTotal", ["vcTotal", "vc_total", "vcScore", "vc_score", "vcTotalScore", "vc_total_score"]);
  assign("vcPartA", ["vcPartA", "vc_part_a", "vcPartAScore", "vc_part_a_score", "vcPartATotal", "vc_part_a_total"]);
  assign("vcPartB", ["vcPartB", "vc_part_b", "vcPartBScore", "vc_part_b_score", "vcPartBTotal", "vc_part_b_total"]);
  assign("vcPartC", ["vcPartC", "vc_part_c", "vcPartCScore", "vc_part_c_score", "vcPartCTotal", "vc_part_c_total"]);
  assign("vcPartD", ["vcPartD", "vc_part_d", "vcPartDScore", "vc_part_d_score", "vcPartDTotal", "vc_part_d_total"]);
  assign("vcRemarks", ["vcRemarks", "vc_remarks"]);
  assign("registrarTotal", ["registrarTotal", "registrar_total", "registrarScore", "registrar_score"]);
  assign("registrarPartD", ["registrarPartD", "registrar_part_d", "registrarPartDScore", "registrar_part_d_score"]);
  assign("registrarPartDScore", ["registrarPartDScore", "registrar_part_d_score", "registrarPartD", "registrar_part_d"]);
  assign("registrarRemarks", ["registrarRemarks", "registrar_remarks", "registrarPartDRemarks", "registrar_part_d_remarks"]);
  assign("registrarPartDRemarks", ["registrarPartDRemarks", "registrar_part_d_remarks", "registrarRemarks", "registrar_remarks"]);
  assign("registrarPartDLeaveManagement", ["registrarPartDLeaveManagement", "registrar_part_d_leave_management"]);

  reviewsFromSources(sources).forEach((review) => {
    const role = normalizeReviewRole(review.reviewer_role || review.reviewerRole || review.role);
    if (role === "registrar") {
      const reviewSummary = reviewSummaryForRole(review);
      const incomingScore = firstPresent(reviewSummary.partD, reviewSummary.total, review.registrar_part_d_score, review.registrarPartDScore);
      if (incomingScore !== undefined) {
        summary.registrarPartD = incomingScore;
        summary.registrarPartDScore = incomingScore;
        summary.registrarTotal = incomingScore;
      }
      if (reviewSummary.remarks !== undefined) {
        summary.registrarRemarks = reviewSummary.remarks;
        summary.registrarPartDRemarks = reviewSummary.remarks;
      }
      const sectionScores = parseMaybeJson(review.section_scores) || parseMaybeJson(review.sectionScores);
      if (sectionScores && typeof sectionScores === "object" && sectionScores.registrar_part_d_leave_management) {
        summary.registrarPartDLeaveManagement = sectionScores.registrar_part_d_leave_management;
      }
      return;
    }

    const prefix = role === "center_head" || role === "hod"
      ? "hod"
      : ["director", "dean", "vc"].includes(role)
      ? role
      : "";
    if (!prefix) return;

    const reviewSummary = reviewSummaryForRole(review);
    const targets = {
      total: `${prefix}Total`,
      partA: `${prefix}PartA`,
      partB: `${prefix}PartB`,
      partC: `${prefix}PartC`,
      partD: `${prefix}PartD`,
      remarks: `${prefix}Remarks`,
    };
    Object.entries(targets).forEach(([key, target]) => {
      const current = summary[target];
      const incoming = reviewSummary[key];
      const shouldUseIncoming = incoming !== undefined && (
        current === undefined ||
        current === null ||
        clean(current) === "" ||
        (key !== "remarks" && n(current) === 0 && n(incoming) > 0)
      );
      if (shouldUseIncoming) {
        summary[target] = incoming;
      }
    });
  });

  return summary;
};

export const standardSubmittedScoreSummary = (subject = {}, fallback = {}) => {
  const sources = [
    subject,
    subject.declaration,
    subject.totals,
    subject.payload,
    subject.payload?.totals,
    subject.payload?.form,
    subject.form,
    subject.info,
  ].filter(Boolean);

  const inferredSelfPartAMax = effectiveMaxFromApplicability(CURRENT_FORM_MAX.partA);
  const fallbackPartAMax = n(fallback.partAMax ?? fallback.effectivePartAMax);
  const inferredPartAMax = fallbackPartAMax ? Math.min(fallbackPartAMax, inferredSelfPartAMax) : inferredSelfPartAMax;
  const inferredPartBMax = n(fallback.partBMax ?? fallback.effectivePartBMax) ||
    effectiveMaxFromApplicability(CURRENT_FORM_MAX.partB);
  const inferredPartCMax = n(fallback.partCMax ?? fallback.effectivePartCMax) ||
    effectiveMaxFromApplicability(CURRENT_FORM_MAX.partC);
  const inferredPartDMax = n(fallback.partDMax ?? fallback.effectivePartDMax) ||
    effectiveMaxFromApplicability(CURRENT_FORM_MAX.partD);

  const getSessionRole = () => {
    if (typeof sessionStorage !== "undefined" && sessionStorage) {
      return sessionStorage.getItem("role");
    }
    return null;
  };
  const isFacultyUser = getSessionRole() === "faculty";

  const storedPartAMax = numericFrom(sources, [
    "partAMax", "part_a_max", "effectivePartAMax", "effective_part_a_max", "maxPartA", "faculty_part_a_max",
  ], inferredPartAMax);
  const partAMax = Math.min(storedPartAMax || inferredPartAMax, CURRENT_FORM_MAX.partA);
  const partBMax = numericFrom(sources, [
    "partBMax", "part_b_max", "effectivePartBMax", "effective_part_b_max", "maxPartB", "faculty_part_b_max",
  ], inferredPartBMax);
  const cappedPartBMax = Math.min(partBMax || inferredPartBMax, CURRENT_FORM_MAX.partB);
  const partCMax = numericFrom(sources, [
    "partCMax", "part_c_max", "effectivePartCMax", "effective_part_c_max", "maxPartC", "faculty_part_c_max",
  ], inferredPartCMax);
  const cappedPartCMax = Math.min(partCMax || inferredPartCMax, CURRENT_FORM_MAX.partC);
  const partDMax = numericFrom(sources, [
    "partDMax", "part_d_max", "effectivePartDMax", "effective_part_d_max", "maxPartD", "faculty_part_d_max",
  ], inferredPartDMax);
  // Part D (new) is faculty-filled, so - unlike the old ACR Part D - it is NOT zeroed
  // out for faculty viewers; only Part E/ACR (handled separately via standardReviewSummary)
  // stays reviewer-only.
  const cappedPartDMax = Math.min(partDMax || inferredPartDMax, CURRENT_FORM_MAX.partD);
  const grandMax = numericFrom(sources, [
    "grandMax", "grand_max", "effectiveGrandMax", "effective_grand_max", "maxGrand", "totalMax", "faculty_total_max",
  ], partAMax + cappedPartBMax + cappedPartCMax + cappedPartDMax);
  const cappedGrandMax = isFacultyUser
    ? (partAMax + cappedPartBMax + cappedPartCMax + cappedPartDMax)
    : Math.min(grandMax || CURRENT_FORM_MAX.grand, CURRENT_FORM_MAX.grand);

  const rawPartA = numericFrom(sources, [
    "partATotal", "partA", "part_a_total", "part_a_score", "selfPartA", "self_part_a",
    "facultyPartA", "faculty_part_a", "facultyPartAScore", "faculty_part_a_score",
  ], fallback.partA);
  const partA = Math.min(rawPartA, partAMax);
  const rawPartB = numericFrom(sources, [
    "partBTotal", "partB", "part_b_total", "part_b_score", "selfPartB", "self_part_b",
    "facultyPartB", "faculty_part_b", "facultyPartBScore", "faculty_part_b_score",
  ], fallback.partB);
  const partB = Math.min(rawPartB, cappedPartBMax);
  const rawPartC = numericFrom(sources, [
    "partCTotal", "partC", "part_c_total", "part_c_score", "selfPartC", "self_part_c",
    "facultyPartC", "faculty_part_c", "facultyPartCScore", "faculty_part_c_score",
  ], fallback.partC);
  const inferredPartCFromRows = partCScoreFromRows(sources, cappedPartCMax);
  const partC = Math.min(Math.max(rawPartC, inferredPartCFromRows), cappedPartCMax);
  const rawPartD = numericFrom(sources, [
    "partDTotal", "partD", "part_d_total", "part_d_score", "selfPartD", "self_part_d",
    "facultyPartD", "faculty_part_d", "facultyPartDScore", "faculty_part_d_score",
  ], fallback.partD);
  const inferredPartDFromRows = partDScoreFromRows(sources, cappedPartDMax);
  const partD = Math.min(Math.max(rawPartD, inferredPartDFromRows), cappedPartDMax);
  const computedTotal = partA + partB + partC + partD;
  const rawTotal = numericFrom(sources, [
    "grandTotal", "grand_total", "totalScore", "total_score", "total", "selfTotal",
    "self_total", "facultyTotal", "faculty_total", "facultyScore", "faculty_score",
  ], fallback.total ?? computedTotal);
  const total = Math.min(computedTotal > 0 ? computedTotal : rawTotal, cappedGrandMax);

  return { partA, partB, partC, partD, total, partAMax, partBMax: cappedPartBMax, partCMax: cappedPartCMax, partDMax: cappedPartDMax, grandMax: cappedGrandMax };
};

export const attachSubmittedScoreSummary = (target = {}, ...sources) => {
  const summary = standardSubmittedScoreSummary(Object.assign({}, ...sources, target));
  return {
    ...target,
    partATotal: summary.partA,
    partBTotal: summary.partB,
    partCTotal: summary.partC,
    partDTotal: summary.partD,
    grandTotal: summary.total,
    effectivePartAMax: summary.partAMax,
    effectivePartBMax: summary.partBMax,
    effectivePartCMax: summary.partCMax,
    effectivePartDMax: summary.partDMax,
    effectiveGrandMax: summary.grandMax,
  };
};
