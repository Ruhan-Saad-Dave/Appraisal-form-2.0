// Data-integrity + hierarchy-traversal auditor for the appraisal backend (FastAPI + Postgres).
//
// This talks to the SAME REST API the frontend uses (there is no Firestore/Firebase anywhere in
// this project — see src/services/api.js, which is a plain axios client against /api/v2). It
// deliberately does NOT import src/services/api.js (or anything that imports it, e.g.
// schoolsService.js, appraisalPersistence.js) because those modules read `import.meta.env` at
// module load time, which only exists under Vite and throws immediately under plain Node — the
// same reason the existing scripts/verify*.mjs files only ever import pure-logic modules
// (src/utils/hierarchy.js, dynamicAppraisalData.js, schemaTableScore.js, schemaPreview.js). This
// script follows that same convention and ships its own minimal HTTP client instead.
//
// USAGE
//   set API_BASE_URL=https://your-backend/api/v2   (or export on mac/linux)
//   set API_TOKEN=<a VC or admin account's Bearer access token>
//   set ACADEMIC_YEAR=2026-2027                     (optional — defaults to the open cycle)
//   node scripts/checkAppraisalIntegrity.mjs [--json report.json] [--email a@b.com,c@d.com]
//
// WHAT IT CHECKS, per submission it can reach:
//   - Hierarchy completeness: recomputes the expected review chain from the subject's own
//     role/school/department (getReviewChain — the exact function every dashboard uses to route
//     reviews) and diffs it against the reviews actually present, flagging stages that are
//     missing, duplicated, or present-but-not-expected (school/department config drift).
//   - Cross-record consistency: school/department resolve against live GET /schools data,
//     academic_year resolves against a live GET /appraisal/cycles cycle, and structural rules from
//     workflowValidationError (e.g. "an HOD account must have a department") hold.
//   - Schema conformance + score correctness for admin-built dynamic-schema forms: refetches the
//     assigned schema (GET /appraisal/form-schema) and recomputes every table's score with the
//     exact same schemaTableScore() function the live form uses, flagging any table whose stored
//     rows score above the schema's own configured max marks.
//   - Basic score-range sanity for legacy (Standard/Creative) forms: scans every row-like object
//     in the submission for the familiar self/hod/director/dean/vc score fields and flags
//     negative, non-numeric, or NaN values (a full formula-by-formula reproduction of every
//     legacy scoring rule was out of scope — see REPORT LIMITATIONS below).
//
// REPORT LIMITATIONS (read before trusting a "clean" run):
//   - There is no confirmed "list every faculty member" endpoint in this codebase. This script
//     enumerates subjects via GET /dashboard/subordinates as the VC/admin account's token allows;
//     if the backend refuses an unfiltered query it falls back to unioning every role's
//     currently-pending queue, which WILL NOT include fully VC-approved-and-archived submissions
//     or nobody-has-touched-yet drafts. The console output states which enumeration mode ran.
//   - The reviews array shape returned by GET /dashboard/faculty/{email} is read defensively but
//     is a smaller subset of the frontend's own reviewsFromAppraisalResponse() (which cannot be
//     imported here for the same import.meta.env reason above) — if your backend uses a review
//     shape this script doesn't recognize, hierarchy findings for that subject will under-report.

import {
  getReviewChain,
  workflowValidationError,
  pendingStatusFor,
  reviewedStatusFor,
  rejectedStatusFor,
  isPendingReviewStatusFor,
  isRejectedStatus,
  normalizeRoleForWorkflow,
  roleLabel,
} from "../src/utils/hierarchy.js";
import { getSchoolKey, replaceUniversitySchools, UNIVERSITY_SCHOOLS } from "../src/constants/universityHierarchy.js";
import { isDynamicAppraisalForm, submittedDynamicForm } from "../src/utils/dynamicAppraisalData.js";
import { buildSchemaPreview } from "../src/utils/schemaPreview.js";
import { schemaTableScore } from "../src/utils/schemaTableScore.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const API_BASE_URL = (process.env.API_BASE_URL || flag("--base-url") || "").replace(/\/$/, "");
let API_TOKEN = process.env.API_TOKEN || flag("--token");
// Login-and-fetch-a-token path, as an alternative to pasting a Bearer token directly. Read from
// env vars only — never accept these as CLI flags, so a real password can't end up in shell
// history or a process list. Uses the same POST /auth/login the app's own Login page calls.
const LOGIN_EMAIL = process.env.API_EMAIL;
const LOGIN_PASSWORD = process.env.API_PASSWORD;
const REQUESTED_YEAR = process.env.ACADEMIC_YEAR || flag("--year");
const JSON_OUT = flag("--json");
const ONLY_EMAILS = (flag("--email") || "").split(",").map((s) => s.trim()).filter(Boolean);

if (!API_BASE_URL || (!API_TOKEN && !(LOGIN_EMAIL && LOGIN_PASSWORD))) {
  console.error(
    "Missing config. Set API_BASE_URL, plus EITHER API_TOKEN (a Bearer access token) OR both " +
      "API_EMAIL and API_PASSWORD (env vars only, never CLI flags, so credentials don't land in " +
      "shell history).\n" +
      "Examples:\n" +
      "  API_BASE_URL=https://host/api/v2 API_TOKEN=eyJ... node scripts/checkAppraisalIntegrity.mjs\n" +
      "  API_BASE_URL=https://host/api/v2 API_EMAIL=you@x.edu API_PASSWORD=... node scripts/checkAppraisalIntegrity.mjs"
  );
  process.exit(1);
}

async function ensureToken() {
  if (API_TOKEN) return;
  const res = await fetch(new URL(API_BASE_URL + "/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.token) {
    throw new Error(`Login failed: ${res.status} ${res.statusText}${body?.message ? ` — ${body.message}` : ""}`);
  }
  API_TOKEN = body.token;
  console.log(`Logged in as ${LOGIN_EMAIL} (role: ${body.profile?.appraisal_role || "unknown"}).`);
}

// ---------------------------------------------------------------------------
// Minimal HTTP client (deliberately not axios/api.js — see header comment)
// ---------------------------------------------------------------------------

async function apiGet(path, params = {}) {
  const url = new URL(API_BASE_URL + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_TOKEN}`, Accept: "application/json" } });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = new Error(`GET ${path} -> ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// ---------------------------------------------------------------------------
// Minimal shape normalizers (duplicated from schoolsService.js / academicYearCycles.js —
// those files can't be imported here because they import src/services/api.js)
// ---------------------------------------------------------------------------

const normalizeBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
};

function normalizeSchoolRow(raw = {}) {
  const code = String(raw.code || raw.school_code || raw.schoolCode || "").trim();
  const track = String(raw.track || raw.deanTrack || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!code || !track) return null;
  const name = String(raw.full_name || raw.fullName || raw.name || code).trim();
  return {
    code,
    name,
    label: String(raw.label || `${code} - ${name}`).trim(),
    track,
    deanTrack: track,
    hasHod: normalizeBoolean(raw.has_hod ?? raw.hasHod, false),
    hasDirector: normalizeBoolean(raw.has_director ?? raw.hasDirector, true),
    departments: Array.isArray(raw.departments) ? raw.departments.filter(Boolean) : [],
    approvalChain: Array.isArray(raw.approval_chain || raw.approvalChain)
      ? (raw.approval_chain || raw.approvalChain).filter((step) => typeof step === "string")
      : [],
    active: raw.active ?? true,
    aliases: Array.isArray(raw.aliases) ? raw.aliases : [],
  };
}

function normalizeCycles(cyclesData) {
  const list = Array.isArray(cyclesData)
    ? cyclesData
    : Array.isArray(cyclesData?.cycles)
      ? cyclesData.cycles
      : Array.isArray(cyclesData?.data)
        ? cyclesData.data
        : [];
  return list
    .map((cycle) => {
      if (typeof cycle === "string") return { academic_year: cycle, is_open: false };
      const academic_year = String(cycle.academic_year || cycle.academicYear || cycle.year || "").trim();
      if (!academic_year) return null;
      return { academic_year, is_open: Boolean(cycle.is_open ?? cycle.isOpen ?? cycle.active ?? cycle.open) };
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Best-effort subject enumeration
// ---------------------------------------------------------------------------

const REVIEWER_ROLES = ["hod", "director", "dean", "center_head", "reporting_officer", "registrar", "vc"];

async function enumerateSubjects(academicYear) {
  try {
    const everyone = await apiGet("/dashboard/subordinates", { academic_year: academicYear, reviewer_role: "vc" });
    if (Array.isArray(everyone) && everyone.length) {
      console.log(`Enumeration: unfiltered VC roster returned ${everyone.length} subject(s).`);
      return everyone;
    }
  } catch {
    // Fall through to the best-effort union below.
  }

  console.log("Enumeration: unfiltered VC roster unavailable — falling back to a union of every role's pending queue.");
  console.log("  (This WILL under-report fully-approved or not-yet-started submissions. Treat a clean run cautiously.)");
  const seen = new Map();
  for (const role of REVIEWER_ROLES) {
    try {
      const items = await apiGet("/dashboard/subordinates", {
        academic_year: academicYear,
        reviewer_role: role,
        pending_status: pendingStatusFor(role),
      });
      for (const item of Array.isArray(items) ? items : []) {
        const email = item.email || item.staff_email || item.faculty_email;
        if (email && !seen.has(email)) seen.set(email, item);
      }
    } catch {
      // Reviewer role not reachable with this token — skip it, note nothing further.
    }
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// Reviews extraction (defensive subset of appraisalPersistence.js's reviewsFromAppraisalResponse)
// ---------------------------------------------------------------------------

function extractReviews(data = {}) {
  const arrays = [data.reviews, data.review_history, data.appraisal_reviews, data.payload?.reviews]
    .filter(Array.isArray);
  const rows = arrays.flat().filter((row) => row && typeof row === "object");
  return rows.map((row) => ({
    role: normalizeRoleForWorkflow(row.reviewer_role || row.role),
    status: String(row.status || row.decision || "").trim(),
    reviewedAt: row.reviewed_at || row.reviewedAt || null,
  }));
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

const findings = [];
const flagIssue = (email, academicYear, severity, code, message) => {
  findings.push({ email, academicYear, severity, code, message });
};

function checkHierarchy(email, academicYear, profile, reviews, declarationStatus) {
  const expectedChain = getReviewChain(profile);
  const roleCounts = new Map();
  for (const review of reviews) {
    if (!review.role) continue;
    roleCounts.set(review.role, (roleCounts.get(review.role) || 0) + 1);
  }

  for (const role of expectedChain) {
    const count = roleCounts.get(role) || 0;
    if (count > 1) {
      flagIssue(email, academicYear, "warning", "hierarchy_duplicate_stage", `${roleLabel(role)} has ${count} review records (expected at most 1).`);
    }
  }

  for (const [role, count] of roleCounts.entries()) {
    if (count > 0 && !expectedChain.includes(role)) {
      flagIssue(
        email,
        academicYear,
        "warning",
        "hierarchy_unexpected_stage",
        `A ${roleLabel(role)} review exists, but the current school/department config's review chain (${expectedChain.join(" -> ") || "none"}) does not include ${role}. Likely stale data from a school reconfiguration.`
      );
    }
  }

  // A stage is "missing" only when the process has clearly moved past it (a later stage in the
  // chain has completed, or the subject is marked fully reviewed) but this stage has no record.
  const completedIndexes = expectedChain
    .map((role, i) => (roleCounts.get(role) ? i : -1))
    .filter((i) => i >= 0);
  const furthestCompleted = completedIndexes.length ? Math.max(...completedIndexes) : -1;
  const finalizedByVc = isPendingReviewStatusFor(declarationStatus, "vc") === false &&
    String(declarationStatus || "").toLowerCase().includes("vc") &&
    String(declarationStatus || "").toLowerCase().includes("review");

  expectedChain.forEach((role, i) => {
    const done = (roleCounts.get(role) || 0) > 0;
    const shouldHaveHappenedByNow = i < furthestCompleted || (finalizedByVc && role !== "vc");
    if (!done && shouldHaveHappenedByNow) {
      flagIssue(email, academicYear, "error", "hierarchy_missing_stage", `${roleLabel(role)} stage has no review record, but a later stage in the same chain already does — this stage was skipped.`);
    }
  });

  const knownStatusVocabulary = new Set([
    "",
    "pending review",
    ...["hod", "director", "dean", "vc", "center_head", "reporting_officer", "registrar"].flatMap((role) => [
      pendingStatusFor(role).toLowerCase(),
      reviewedStatusFor(role).toLowerCase(),
      rejectedStatusFor(role).toLowerCase(),
    ]),
  ]);
  const normalizedStatus = String(declarationStatus || "").trim().toLowerCase();
  if (normalizedStatus && !knownStatusVocabulary.has(normalizedStatus) && !isRejectedStatus(normalizedStatus)) {
    flagIssue(email, academicYear, "warning", "hierarchy_unknown_status", `declaration status "${declarationStatus}" doesn't match the expected "Pending X Review" / "X Reviewed" / "X Rejected" vocabulary.`);
  }

  const workflowError = workflowValidationError(profile);
  if (workflowError) {
    flagIssue(email, academicYear, "error", "hierarchy_invalid_profile", workflowError);
  }
}

function checkCrossReferences(email, academicYear, profile, validYears) {
  const role = normalizeRoleForWorkflow(profile.appraisal_role);
  const needsSchool = role !== "vc" && role !== "non_teaching_staff" && role !== "reporting_officer" && role !== "registrar";
  if (needsSchool && profile.school && !getSchoolKey(profile.school)) {
    flagIssue(email, academicYear, "error", "cross_ref_unknown_school", `School "${profile.school}" does not match any school returned by GET /schools.`);
  }
  if (academicYear && validYears.length && !validYears.includes(academicYear)) {
    flagIssue(email, academicYear, "warning", "cross_ref_unknown_year", `Academic year "${academicYear}" is not present in GET /appraisal/cycles.`);
  }
}

const schemaCache = new Map();
async function getSchemaRecords(schemaId, academicYear) {
  const key = `${schemaId}:${academicYear}`;
  if (schemaCache.has(key)) return schemaCache.get(key);
  // NOTE: despite its name, the value passed in here is the schema id embedded in each dynamic
  // field's key (custom_<schemaId>_s_...), not a "form_family" value — this backend's
  // /appraisal/form-schema only filters correctly on schema_id; form_family returns [].
  const promise = apiGet("/appraisal/form-schema", { academic_year: academicYear, schema_id: schemaId }).catch(() => null);
  schemaCache.set(key, promise);
  return promise;
}

async function checkDynamicSchemaAndScores(email, academicYear, form, assignment) {
  const records = await getSchemaRecords(assignment, academicYear);
  if (!Array.isArray(records)) {
    flagIssue(email, academicYear, "warning", "schema_unavailable", `Could not load the assigned schema ("${assignment}") from /appraisal/form-schema to verify column conformance and scores.`);
    return;
  }

  // Records fetched via schema_id already belong to the assigned schema, but buildSchemaPreview
  // filters by each record's own form_family value (e.g. "all_teaching") — not the schema id used
  // to fetch them — so resolve that real value from the records rather than reusing the id.
  const realFormFamily = records[0]?.form_family || assignment;
  let preview;
  try {
    preview = buildSchemaPreview(records, realFormFamily);
  } catch (err) {
    flagIssue(email, academicYear, "error", "schema_invalid", `Assigned schema failed to build: ${err.message}`);
    return;
  }

  let recomputedTotal = 0;
  for (const part of preview.parts) {
    for (const field of part.fields) {
      if (field.type !== "table") continue;
      const rows = Array.isArray(form[field.sectionCode]) ? form[field.sectionCode] : [];
      const score = schemaTableScore(field.columns || [], rows);
      recomputedTotal += score;
      const max = Number(field.maxMarks) || 0;
      if (max > 0 && score > max + 0.001) {
        flagIssue(
          email,
          academicYear,
          "error",
          "score_exceeds_max",
          `Table "${field.label || field.key}" (part ${part.label}) scores ${score}, above its configured max of ${max}.`
        );
      }
      if (!Array.isArray(form[field.sectionCode])) {
        flagIssue(email, academicYear, "info", "schema_section_missing", `No stored rows found under "${field.sectionCode}" for table "${field.label || field.key}" — either untouched or the schema/submission section-code mapping has drifted.`);
      }
    }
  }

  console.log(`  [dynamic] ${email} (${academicYear}): recomputed table-score total = ${recomputedTotal}`);
}

function checkLegacyScoreRanges(email, academicYear, form) {
  const scoreKeys = ["score", "hod", "director", "dean", "vc", "hodScore", "directorScore", "deanScore", "vcScore"];
  const visit = (value, path) => {
    if (Array.isArray(value)) {
      value.forEach((item, i) => visit(item, `${path}[${i}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const key of scoreKeys) {
      if (!(key in value)) continue;
      const raw = value[key];
      if (raw === "" || raw === null || raw === undefined) continue;
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        flagIssue(email, academicYear, "error", "legacy_score_nan", `${path}.${key} = ${JSON.stringify(raw)} is not a valid number.`);
      } else if (num < 0) {
        flagIssue(email, academicYear, "error", "legacy_score_negative", `${path}.${key} = ${num} is negative.`);
      } else {
        const max = Number(value.max ?? value.maxMarks ?? value.max_marks);
        if (Number.isFinite(max) && max > 0 && num > max + 0.001) {
          flagIssue(email, academicYear, "error", "legacy_score_exceeds_max", `${path}.${key} = ${num} exceeds this row's own max of ${max}.`);
        }
      }
    }
    for (const [key, nested] of Object.entries(value)) visit(nested, `${path}.${key}`);
  };
  visit(form, "form");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Base URL: ${API_BASE_URL}`);
  await ensureToken();

  const [schoolsRaw, cyclesRaw] = await Promise.all([
    apiGet("/schools").catch((err) => {
      console.warn(`Could not load /schools (${err.message}) — school cross-reference checks will be skipped.`);
      return [];
    }),
    apiGet("/appraisal/cycles").catch((err) => {
      console.warn(`Could not load /appraisal/cycles (${err.message}) — academic-year cross-reference checks will be skipped.`);
      return [];
    }),
  ]);

  const schools = (Array.isArray(schoolsRaw) ? schoolsRaw : []).map(normalizeSchoolRow).filter(Boolean);
  if (schools.length) replaceUniversitySchools(schools);
  console.log(`Loaded ${UNIVERSITY_SCHOOLS.length} school(s) from /schools.`);

  const cycles = normalizeCycles(cyclesRaw);
  const validYears = cycles.map((c) => c.academic_year);
  const academicYear = REQUESTED_YEAR || cycles.find((c) => c.is_open)?.academic_year || cycles[0]?.academic_year;
  if (!academicYear) {
    console.error("Could not determine an academic year — pass --year YYYY-YYYY or set ACADEMIC_YEAR.");
    process.exit(1);
  }
  console.log(`Auditing academic year: ${academicYear}`);

  const subjects = ONLY_EMAILS.length
    ? ONLY_EMAILS.map((email) => ({ email }))
    : await enumerateSubjects(academicYear);

  console.log(`Subjects to audit: ${subjects.length}`);

  let audited = 0;
  for (const subject of subjects) {
    const email = subject.email || subject.staff_email || subject.faculty_email;
    if (!email) continue;

    let data;
    try {
      data = await apiGet(`/dashboard/faculty/${encodeURIComponent(email)}`, { academic_year: academicYear });
    } catch (err) {
      flagIssue(email, academicYear, "error", "fetch_failed", `Could not load submission: ${err.message}`);
      continue;
    }

    const submitterProfile = data.payload?.submitter_profile || data.submitter_profile || {};
    const profile = {
      appraisal_role:
        data.appraisal_role || data.role || submitterProfile.appraisal_role || submitterProfile.role ||
        subject.appraisal_role || subject.role || "faculty",
      school: data.school || submitterProfile.school || subject.school || "",
      department: data.department || submitterProfile.department || subject.department || "",
      reports_to_registrar: data.reports_to_registrar ?? submitterProfile.reports_to_registrar ?? subject.reports_to_registrar,
    };
    const declarationStatus = data.declaration?.status || data.status || data.payload?.status || data.workflow_status || data.payload?.workflow_status || "";
    const reviews = extractReviews(data);

    checkHierarchy(email, academicYear, profile, reviews, declarationStatus);
    checkCrossReferences(email, academicYear, profile, validYears);

    const form = submittedDynamicForm(data) || data.form || {};
    // No backend field carries the schema id directly — it's embedded in each dynamic field's own
    // key, e.g. "custom_<schemaId>_s_<...>". Pull it from there when the usual assignment fields
    // (which don't exist on this backend's /dashboard/faculty response) are absent.
    const customKeyMatch = Object.keys(form).find((key) => /^custom_([^_]+)_s_/.test(key));
    const schemaIdFromForm = customKeyMatch ? customKeyMatch.match(/^custom_([^_]+)_s_/)[1] : null;
    const assignment =
      data.assigned_form || data.assignedForm || data.form_family || data.formFamily || schemaIdFromForm;
    if (isDynamicAppraisalForm(form) && assignment) {
      await checkDynamicSchemaAndScores(email, academicYear, form, assignment);
    } else if (form && typeof form === "object" && Object.keys(form).length) {
      checkLegacyScoreRanges(email, academicYear, form);
    }

    audited += 1;
  }

  console.log(`\nAudited ${audited} submission(s). Findings: ${findings.length}.`);
  const bySeverity = { error: 0, warning: 0, info: 0 };
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  console.log(`  errors=${bySeverity.error} warnings=${bySeverity.warning} info=${bySeverity.info}`);

  for (const f of findings) {
    const tag = f.severity.toUpperCase().padEnd(7);
    console.log(`[${tag}] ${f.email} (${f.academicYear}) ${f.code}: ${f.message}`);
  }

  if (JSON_OUT) {
    const fs = await import("node:fs/promises");
    await fs.writeFile(JSON_OUT, JSON.stringify({ academicYear, audited, findings }, null, 2));
    console.log(`\nWrote JSON report to ${JSON_OUT}`);
  }

  process.exit(bySeverity.error > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
