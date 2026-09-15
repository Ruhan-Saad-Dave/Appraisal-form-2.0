const hasAnswer = (value) => {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasAnswer);
  if (typeof value === 'object') return Object.values(value).some(hasAnswer);
  return true; // Both numeric zero and an explicit false are answers.
};

// Submission-only cleanup. Draft rows remain untouched, and document indices
// follow retained rows when an empty row in the middle is removed.
export function prepareSchemaTableRows(field, rows, docs) {
  const columns = field.columns || [];
  const fileColumns = columns.filter((column) => column.type === 'file');
  const prefixes = fileColumns.map((column) => `${field.key}-${column.name || column.key}-`);
  const retained = rows.map((row, index) => ({ row, index })).filter(({ row, index }) => {
    if (field.required) return true;
    if (prefixes.some((prefix) => hasAnswer(docs[`${prefix}${index}`]))) return true;
    return Object.entries(row).some(([key, value]) => {
      const column = columns.find((item) => (item.name || item.key) === key);
      if (column?.type === 'computed') return false;
      return hasAnswer(value);
    });
  });
  const nextDocs = { ...docs };
  prefixes.forEach((prefix) => {
    rows.forEach((_, index) => { delete nextDocs[`${prefix}${index}`]; });
    retained.forEach(({ index }, nextIndex) => {
      if (Object.hasOwn(docs, `${prefix}${index}`)) nextDocs[`${prefix}${nextIndex}`] = docs[`${prefix}${index}`];
    });
  });
  return { rows: retained.map(({ row }) => row), docs: nextDocs };
}
