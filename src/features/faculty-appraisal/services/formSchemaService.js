import React from "react";
import { api, apiClient } from "../../../services/api";

const SCHEMA_CACHE = new Map();

// Helper to sanitize schema section & field keys
export function normalizeSectionKey(key) {
  if (!key) return "";
  return String(key).trim();
}

// Extract Part letter ('A', 'B', 'C', 'D', 'E') or tab key ('partA', 'partB', etc.)
export function normalizePartKey(part) {
  if (!part) return "partA";
  const str = String(part).trim().toUpperCase();
  if (str.includes("PART A") || str === "A" || str === "PARTA") return "partA";
  if (str.includes("PART B") || str === "B" || str === "PARTB") return "partB";
  if (str.includes("PART C") || str === "C" || str === "PARTC") return "partC";
  if (str.includes("PART D") || str === "D" || str === "PARTD") return "partD";
  if (str.includes("PART E") || str === "E" || str === "PARTE") return "partE";
  return `part${str.replace(/[^A-Z0-9]/g, "")}`;
}

export function groupSectionsByPart(sections = []) {
  const grouped = {
    partA: [],
    partB: [],
    partC: [],
    partD: [],
    partE: [],
  };

  (sections || []).forEach((sec) => {
    if (!sec || sec.active === false) return;
    const partKey = normalizePartKey(sec.part);
    if (!grouped[partKey]) {
      grouped[partKey] = [];
    }
    grouped[partKey].push(sec);
  });

  return grouped;
}

/**
 * Normalizes field definitions from the backend schema
 */
export function normalizeSchemaField(f) {
  if (!f) return null;
  const key = f.key || f.id || f.name || "field";
  const label = f.label || f.name || key;
  const type = f.type || "text";
  const rawMax = f.maxMarks ?? f.max_marks ?? f.rowMax ?? f.row_max ?? null;
  const maxMarks = rawMax !== null && rawMax !== "" && !isNaN(Number(rawMax)) ? Number(rawMax) : null;
  const rowMax = f.rowMax ?? f.row_max ?? maxMarks;

  let options = [];
  if (Array.isArray(f.options)) {
    options = f.options;
  } else if (typeof f.options === "string" && f.options.trim()) {
    options = f.options.split("\n").map((o) => o.trim()).filter(Boolean);
  }

  let columns = [];
  if (Array.isArray(f.columns)) {
    columns = f.columns.map((col) => {
      const colName = col.name || col.label || col.key || "";
      const colKey = col.key || col.id || colName;
      const colType = col.type || "text";
      const colRawMax = col.maxMarks ?? col.max_marks ?? null;
      const colMaxMarks = colRawMax !== null && colRawMax !== "" && !isNaN(Number(colRawMax)) ? Number(colRawMax) : null;
      let colOptions = [];
      if (Array.isArray(col.options)) {
        colOptions = col.options;
      } else if (typeof col.options === "string" && col.options.trim()) {
        colOptions = col.options.split("\n").map((o) => o.trim()).filter(Boolean);
      }
      return {
        ...col,
        name: colName,
        key: colKey,
        type: colType,
        maxMarks: colMaxMarks,
        max_marks: colMaxMarks,
        required: Boolean(col.required),
        active: col.active !== false,
        options: colOptions,
        triggerValue: col.triggerValue || col.trigger_value || "Other",
        extraLabel: col.extraLabel || col.extra_label || "Please specify",
        extraKey: col.extraKey || col.extra_key || (colKey ? `${colKey}_other` : "other_text"),
      };
    }).filter((c) => c.active !== false);
  }

  const rawRowHeaders = f.rowHeaders || f.row_headers || [];
  const rowHeaders = Array.isArray(rawRowHeaders)
    ? rawRowHeaders.map((rh, idx) => {
        if (typeof rh === "string") return { id: rh, label: rh };
        if (rh && typeof rh === "object") {
          return {
            id: String(rh.id || rh.key || `row_${idx + 1}`).trim(),
            label: rh.label !== undefined && rh.label !== null ? String(rh.label) : "",
          };
        }
        return { id: `row_${idx + 1}`, label: String(rh || "") };
      })
    : [];

  return {
    ...f,
    id: f.id || key,
    key,
    label,
    type,
    layout: f.layout || "rows",
    rowHeaderTitle: f.rowHeaderTitle ?? f.row_header_title ?? "",
    row_header_title: f.rowHeaderTitle ?? f.row_header_title ?? "",
    rowHeaders,
    row_headers: rowHeaders,
    required: Boolean(f.required),
    active: f.active !== false,
    isCustom: Boolean(f.isCustom || f.is_custom),
    is_custom: Boolean(f.isCustom || f.is_custom),
    autoSerial: f.autoSerial !== false && f.auto_serial !== false,
    requireCompleteRows: Boolean(f.requireCompleteRows || f.require_complete_rows),
    require_complete_rows: Boolean(f.requireCompleteRows || f.require_complete_rows),
    maxMarks,
    max_marks: maxMarks,
    rowMax: rowMax !== null && rowMax !== "" && !isNaN(Number(rowMax)) ? Number(rowMax) : null,
    options,
    triggerValue: f.triggerValue || f.trigger_value || "Other",
    extraLabel: f.extraLabel || f.extra_label || "Please specify",
    extraKey: f.extraKey || f.extra_key || (key ? `${key}_other` : "other_text"),
    columns,
  };
}

/**
 * Normalizes section objects from the backend schema
 */
export function normalizeSchemaSection(sec) {
  if (!sec) return null;
  const rawFields = Array.isArray(sec.fields) ? sec.fields : Array.isArray(sec.fieldSchema) ? sec.fieldSchema : [];
  const fields = rawFields.map(normalizeSchemaField).filter((f) => f && f.active !== false);

  const rawMax = sec.maxMarks ?? sec.max_marks ?? 0;
  const maxMarks = Number(rawMax) || 0;

  return {
    ...sec,
    code: sec.code || `${sec.form_family || sec.formFamily || "standard"}__${sec.section_key || sec.sectionKey}`,
    form_family: sec.form_family || sec.formFamily || "standard",
    formFamily: sec.form_family || sec.formFamily || "standard",
    part: sec.part || "Part A",
    part_guideline: sec.part_guideline ?? sec.partGuideline ?? null,
    partGuideline: sec.part_guideline ?? sec.partGuideline ?? null,
    section_key: sec.section_key || sec.sectionKey || sec.code,
    sectionKey: sec.section_key || sec.sectionKey || sec.code,
    title: sec.title || "Section",
    maxMarks,
    max_marks: maxMarks,
    storage_table: sec.storage_table || sec.storageTable || null,
    storageTable: sec.storage_table || sec.storageTable || null,
    order: Number(sec.order) || 0,
    active: sec.active !== false,
    fields,
  };
}

/**
 * Fetches form schema from backend, caching with ETag / Hash in localStorage
 * and in-memory Map for zero-latency lookups.
 */
export async function fetchFormSchema({ formFamily = "standard", academicYear = "" } = {}) {
  const cacheKey = `${formFamily || "standard"}__${academicYear || "current"}`;
  const storageKey = `appraisal_schema_${cacheKey}`;
  const etagKey = `appraisal_etag_${cacheKey}`;
  
  if (SCHEMA_CACHE.has(cacheKey)) {
    return SCHEMA_CACHE.get(cacheKey);
  }

  // 1. Read from localStorage if available
  let cachedLocalSchema = null;
  let cachedEtag = null;
  try {
    const cachedStr = localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
    cachedEtag = localStorage.getItem(etagKey) || sessionStorage.getItem(etagKey);
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedLocalSchema = parsed.map(normalizeSchemaSection).filter(Boolean);
      }
    }
  } catch {
    // ignore storage read errors
  }

  try {
    const params = {};
    if (formFamily) params.form_family = formFamily;
    if (academicYear) params.academic_year = academicYear;

    const headers = {};
    if (cachedEtag && cachedLocalSchema && cachedLocalSchema.length > 0) {
      headers["If-None-Match"] = cachedEtag;
    }

    const response = await apiClient.get("/appraisal/form-schema", {
      params,
      headers,
      validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
    });

    // 2. HTTP 304 Not Modified -> Hash matched, backend confirms cached schema is 100% current
    if (response.status === 304 && cachedLocalSchema && cachedLocalSchema.length > 0) {
      SCHEMA_CACHE.set(cacheKey, cachedLocalSchema);
      return cachedLocalSchema;
    }

    // 3. HTTP 200 OK -> New or updated schema received from server
    if (response.status === 200 && Array.isArray(response.data) && response.data.length > 0) {
      const normalized = response.data.map(normalizeSchemaSection).filter(Boolean);
      const newEtag = response.headers?.etag || response.headers?.ETag;

      SCHEMA_CACHE.set(cacheKey, normalized);
      try {
        localStorage.setItem(storageKey, JSON.stringify(normalized));
        if (newEtag) localStorage.setItem(etagKey, newEtag);
      } catch {
        // ignore localStorage quota errors
      }
      return normalized;
    }
  } catch (err) {
    console.warn(`[formSchemaService] Failed to load schema for ${cacheKey}, falling back to cache:`, err);
    if (cachedLocalSchema && cachedLocalSchema.length > 0) {
      SCHEMA_CACHE.set(cacheKey, cachedLocalSchema);
      return cachedLocalSchema;
    }
  }

  if (cachedLocalSchema && cachedLocalSchema.length > 0) {
    SCHEMA_CACHE.set(cacheKey, cachedLocalSchema);
    return cachedLocalSchema;
  }

  return [];
}

export function clearFormSchemaCache() {
  SCHEMA_CACHE.clear();
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("appraisal_schema_") || key.startsWith("appraisal_etag_")) {
        localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith("appraisal_schema_") || key.startsWith("appraisal_etag_")) {
        sessionStorage.removeItem(key);
      }
    });
  } catch {
    // ignore storage clear errors
  }
}

/**
 * React hook to fetch and provide active form schema and grouped sections.
 */
export function useFormSchema({ formFamily = "standard", academicYear = "" } = {}) {
  const [sections, setSections] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchFormSchema({ formFamily, academicYear })
      .then((data) => {
        if (!isMounted) return;
        setSections(data || []);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [formFamily, academicYear]);

  const groupedSections = React.useMemo(() => groupSectionsByPart(sections), [sections]);

  return { sections, groupedSections, loading, error };
}

