/**
 * Schema-driven validation utilities for PBAS Faculty Appraisal Forms.
 * Mirrors the exact server-side validation rules in backend form_schema_utils.py
 * and admin preview in tableRowValidation.js.
 */

export function hasCellValue(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !isNaN(value);
  if (typeof value === "boolean") return true;
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.length > 0;
    return Object.values(value).some(hasCellValue);
  }
  return true;
}

/**
 * Checks a table field for incomplete rows.
 * Rules:
 * 1. Fully-empty rows are ignored (skipped).
 * 2. Active, non-computed columns are checked.
 * 3. 0 and false count as answered.
 * 4. Whitespace-only counts as empty.
 * 5. A conditionalText choice matching triggerValue requires its extra text.
 */
export function incompleteTableRows(field = {}, rows = []) {
  const requireComplete = Boolean(field.requireCompleteRows || field.require_complete_rows);
  const columns = (field.columns || []).filter((c) => c.type !== "computed" && c.active !== false);

  const hasRequiredColumns = columns.some((c) => c.required);
  if (!requireComplete && !hasRequiredColumns) {
    return [];
  }

  const rowList = Array.isArray(rows) ? rows : [];

  return rowList.flatMap((row, index) => {
    if (!row || typeof row !== "object") return [];

    // Check if row has any non-empty cell across columns
    const hasAnyCell = columns.some((c) => {
      const v = row[c.name] ?? row[c.key];
      return hasCellValue(v);
    });

    if (!hasAnyCell) return []; // Fully empty row: skip

    // If row has any data, check for missing fields
    const missing = columns.filter((c) => {
      // If table is requireComplete, all active non-computed columns are required.
      // Otherwise only columns explicitly flagged required: true are checked.
      if (!requireComplete && !c.required) return false;

      const val = row[c.name] ?? row[c.key];

      if (c.type === "conditionalText") {
        const choice = typeof val === "object" ? val?.choice : val;
        const extra = typeof val === "object" ? val?.extra : (row[c.extraKey] ?? row[`${c.key}_other`]);
        if (!hasCellValue(choice)) return true;
        const trigger = c.triggerValue || "Other";
        if (String(choice).trim() === trigger && !hasCellValue(extra)) {
          return true;
        }
        return false;
      }

      return !hasCellValue(val);
    }).map((c) => c.name || c.key);

    return missing.length ? [{ row: index + 1, missing }] : [];
  });
}

/**
 * Validates an entire form against active schema sections.
 */
export function validateSchemaForm(sections = [], formData = {}, docs = {}) {
  const errors = [];

  sections.forEach((sec) => {
    if (!sec || sec.active === false) return;
    const secKey = sec.section_key || sec.sectionKey || sec.code;
    const secTitle = sec.title || secKey;
    const secData = formData[secKey] ?? formData[sec.code] ?? [];

    (sec.fields || []).forEach((field) => {
      if (!field || field.active === false) return;
      const fKey = field.key || field.id || secKey;
      const fLabel = field.label || fKey;

      if (field.type === "table") {
        const tableRows = Array.isArray(secData) ? secData : (secData?.[fKey] || []);
        const incomplete = incompleteTableRows(field, tableRows);
        incomplete.forEach((inc) => {
          errors.push({
            section: secTitle,
            sectionKey: secKey,
            field: fLabel,
            fieldKey: fKey,
            row: inc.row,
            missing: inc.missing,
            message: `Row ${inc.row} in "${secTitle}" is incomplete. Missing: ${inc.missing.join(", ")}.`,
          });
        });
      } else {
        // Scalar field validation
        const val = typeof secData === "object" && !Array.isArray(secData) ? secData[fKey] : secData;
        if (field.required && !hasCellValue(val)) {
          errors.push({
            section: secTitle,
            sectionKey: secKey,
            field: fLabel,
            fieldKey: fKey,
            message: `"${fLabel}" in "${secTitle}" is required.`,
          });
        }
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
