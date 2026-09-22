// Row/column identity for matrix tables must be stable — never derived from label
// text or array position, since an admin can rename a row/column label or reorder
// rows/columns without invalidating previously saved answers. Prefer an explicit
// id/key on the schema record; fall back to a positional id only when absent.
// Split out from DynamicMatrixTable.jsx so that file can stay component-only
// (react-refresh/only-export-components) while dynamicMatrixAdapter.js can still
// share these exact same id functions.
export const matrixRowId = (rowHeader, index) =>
  (rowHeader && typeof rowHeader === 'object')
    ? String(rowHeader.id ?? rowHeader.key ?? rowHeader.name ?? `row_${index}`)
    : `row_${index}`;

export const matrixRowLabel = (rowHeader) =>
  typeof rowHeader === 'string' ? rowHeader : String(rowHeader?.label ?? rowHeader?.name ?? '');

export const matrixColumnId = (column, index) =>
  String(column?.name ?? column?.key ?? `col_${index}`);
