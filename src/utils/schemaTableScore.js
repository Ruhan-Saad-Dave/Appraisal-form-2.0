// Only explicitly named faculty/self score columns contribute to the table total.
// Keep answer lookup identical to the dynamic renderer; do not rename stored keys.
export function schemaTableScore(columns, rows) {
  const scoreColumns = columns.filter((column) => {
    const label = String(column.label || column.name || column.key || '')
      .trim().toLowerCase().replace(/\s+/g, ' ');
    return ['faculty score', 'self score'].includes(label)
      && ['number', 'integer', 'text', 'computed'].includes(column.type);
  });
  return rows.reduce((total, row) => total + scoreColumns.reduce((sum, column) => {
    const answer = row[column.name || column.key];
    if (typeof answer !== 'number' && typeof answer !== 'string') return sum;
    const value = Number(answer);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0), 0);
}
