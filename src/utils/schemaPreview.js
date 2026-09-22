const TYPES = new Set(['text', 'textarea', 'number', 'integer', 'date', 'dropdown', 'conditionalText', 'checkbox', 'computed', 'file', 'table']);
const active = (value) => value !== false && value !== 0 && value !== 'false';
const ordered = (items) => items.every((item) => Number.isFinite(item.order))
  ? [...items].sort((a, b) => a.order - b.order) : items;

// Presentation only: guideline text must never become a scoring formula.
export function schemaTableGuideline(field) {
  const source = field.guidelines ?? field.guideline;
  const lines = (value) => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\r?\n/) : [])
    .filter((line) => typeof line === 'string' && line.trim()).map((line) => line.trim());
  const rules = lines(source && typeof source === 'object' && !Array.isArray(source) ? source.rules : source);
  return {
    title: typeof source?.title === 'string' && source.title.trim() ? source.title : '',
    rules: rules.length ? rules : ['No guidelines were supplied for this table in the form schema.'],
  };
}

// Display-only adapter. Column names are NOT treated as verified answer keys.
export function buildSchemaPreview(records, assignment) {
  if (!Array.isArray(records)) throw new Error('Unsupported schema response: expected an array.');
  if (!records.length) return { parts: [], orderVerified: true };
  const matching = records.filter((record) => record.form_family === assignment);
  if (!matching.length) throw new Error('No schema matches the assigned identifier. The backend must provide an explicit form_family mapping.');
  let orderVerified = matching.every((record) => Number.isFinite(record.order));
  const normalize = (field, path) => {
    if (!field || typeof field !== 'object') throw new Error(`Invalid field at ${path}.`);
    const type = field.type === 'conditionaltext' ? 'conditionalText' : field.type;
    if (!TYPES.has(type)) throw new Error(`Unsupported field type "${field.type}" at ${path}.`);
    const normalized = { ...field, type, placeholder: field.placeholder || '',
      autoSerial: field.autoSerial ?? field.auto_serial ?? false,
      extraLabel: field.extraLabel ?? field.extra_label ?? '',
      triggerValue: field.triggerValue ?? field.trigger_value,
      maxMarks: field.maxMarks ?? field.max_marks ?? undefined,
    };
    if (type === 'table') {
      if (!Array.isArray(field.columns)) throw new Error(`Missing columns at ${path}.`);
      orderVerified = orderVerified && field.columns.every((column) => Number.isFinite(column.order));
      normalized.columns = ordered(field.columns.filter((column) => active(column.active))).map((column, i) => {
        if (column.type === 'table') throw new Error(`Nested tables are unsupported at ${path}.`);
        return normalize(column, `${path}, column ${i + 1}`);
      });
    }
    return normalized;
  };
  const parts = [];
  for (const record of ordered(matching.filter((record) => active(record.active)))) {
    if (!record.part || !Array.isArray(record.fields)) throw new Error('Schema record must contain part and fields.');
    let part = parts.find((item) => item.label === record.part);
    if (!part) { part = { label: record.part, fields: [], isRegistrarPart: false, isReviewerOnlyPart: false }; parts.push(part); }
    // Admin-configurable flag: a part any of whose records is marked as the
    // Registrar's part (Part D-equivalent) skips the normal HOD/Director/Dean/VC
    // chain entirely — see DynamicAuthorityReviewPanel.jsx and
    // DynamicRegistrarPartView.jsx. OR'd across every record contributing to this
    // part, since a part can be built from more than one schema record.
    if (record.registrar_part || record.registrarPart) part.isRegistrarPart = true;
    // Admin-configurable flag: a "reviewer-only" part is never filled in by
    // faculty (skipped entirely in their own form) but IS scored directly by
    // HOD/Director/Dean/VC as part of the normal chain — the opposite of
    // isRegistrarPart, which removes a part from that chain. See
    // DynamicAuthorityReviewPanel.jsx and the faculty-side table renderer.
    if (record.reviewer_only_part || record.reviewerOnlyPart) part.isReviewerOnlyPart = true;
    // Admin-written guideline text for this part's info ("i") popup — carried
    // through the same way as the flags above, dynamic-form only. Without this,
    // the part-level info button falls back to Standard's hardcoded
    // getGuidelineForTitle() title-matching (see formPrimitives.jsx), which
    // coincidentally matches a dynamic part literally named "Part A"/"Part B"/etc.
    if (record.part_guideline || record.partGuideline) part.guideline = record.part_guideline || record.partGuideline;
    orderVerified = orderVerified && record.fields.every((field) => Number.isFinite(field.order));
    for (const field of ordered(record.fields.filter((field) => active(field.active)))) {
      // Record-level guidance can be assigned unambiguously only to a single table.
      const tableCount = record.fields.filter((item) => item.type === 'table').length;
      const guidelines = field.guidelines ?? field.guideline
        ?? (field.type === 'table' && tableCount === 1 ? record.guidelines ?? record.guideline : undefined);
      part.fields.push({ ...normalize(field, record.code), guidelines, recordTitle: record.title, sectionCode: record.section_key || record.code });
    }
  }
  return { parts, orderVerified };
}
