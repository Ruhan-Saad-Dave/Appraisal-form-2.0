// Converts between DynamicMatrixTable's internal UI state — keyed by stable IDs,
// answers[fieldId][rowId][columnId] = value — and whatever shape the backend
// actually saves/reloads a matrix field as.
//
// STATUS: the production payload and reload response for matrix fields have not
// been confirmed yet (backend work in progress). The functions below are a
// best-effort placeholder guess (one saved-row object per rowHeader, shaped like
// every other dynamic table's rows, plus a __rowId tag) — they are NOT wired into
// any real save/submit call. DynamicMatrixTable is always rendered readOnly until
// this adapter is verified against the real backend contract; do not remove that
// readOnly gate when wiring this up, just verify + update the conversions below.
import { matrixRowId, matrixColumnId, matrixRowLabel } from './dynamicMatrixIds';

// Best-effort: reload saved answers from an array of row objects (the same shape
// every other dynamic table already saves), matched back to admin-configured row
// headers by a stable id, falling back to positional order only if no saved row
// carries a __rowId tag.
export function matrixAnswersFromRows(field, rows) {
  const answers = {};
  if (!Array.isArray(rows) || !rows.length) return answers;
  const rowHeaders = field.rowHeaders || [];
  const columns = field.columns || [];
  rowHeaders.forEach((rowHeader, rowIndex) => {
    const rowId = matrixRowId(rowHeader, rowIndex);
    const savedRow = rows.find((row) => row && row.__rowId === rowId) || rows[rowIndex];
    if (!savedRow || typeof savedRow !== 'object') return;
    const cell = {};
    columns.forEach((column, colIndex) => {
      const columnId = matrixColumnId(column, colIndex);
      const sourceKey = column.name || column.key;
      if (Object.prototype.hasOwnProperty.call(savedRow, sourceKey)) cell[columnId] = savedRow[sourceKey];
    });
    if (Object.keys(cell).length) answers[rowId] = cell;
  });
  return answers;
}

// Best-effort: flatten the internal { rowId: { columnId: value } } model back into
// one row object per admin-configured row header, same field-naming convention as
// every other dynamic table (row[columnKey] = value), tagged with __rowId so a
// reload can match it back to the correct row even if row order/labels changed.
export function matrixAnswersToRows(field, answers = {}) {
  const rowHeaders = field.rowHeaders || [];
  const columns = field.columns || [];
  return rowHeaders.map((rowHeader, rowIndex) => {
    const rowId = matrixRowId(rowHeader, rowIndex);
    const cell = answers[rowId] || {};
    const row = { __rowId: rowId };
    columns.forEach((column, colIndex) => {
      const columnId = matrixColumnId(column, colIndex);
      row[column.name || column.key] = cell[columnId] ?? '';
    });
    return row;
  });
}

const isBlank = (value) => value === undefined || value === null || value === '';

// Allow incomplete drafts: a row that hasn't been touched at all is skipped
// entirely (never flagged as missing required fields). A row counts as "started"
// the moment ANY of its cells holds a non-blank value — 0 and false both count as
// filled, not blank. Once started, every required column in that row must be
// filled. Computed-type columns are never validated (nothing for the user to
// fill in). Returns a flat list of cell-specific errors, never a single blob.
export function validateMatrixAnswers(field, answers = {}) {
  const rowHeaders = field.rowHeaders || [];
  const columns = (field.columns || []).filter((column) => column.type !== 'computed');
  const errors = [];
  rowHeaders.forEach((rowHeader, rowIndex) => {
    const rowId = matrixRowId(rowHeader, rowIndex);
    const cell = answers[rowId] || {};
    const started = columns.some((column, colIndex) => !isBlank(cell[matrixColumnId(column, colIndex)]));
    if (!started) return;
    columns.forEach((column, colIndex) => {
      if (!column.required) return;
      const columnId = matrixColumnId(column, colIndex);
      if (isBlank(cell[columnId])) {
        errors.push({
          rowId,
          columnId,
          message: `${matrixRowLabel(rowHeader)} — ${column.label || column.name || column.key} is required.`,
        });
      }
    });
  });
  return errors;
}
