import { SchemaFieldCell } from './SchemaSectionTable';
import { T, TH, TD } from './formPrimitiveStyles';
import { matrixRowId, matrixRowLabel, matrixColumnId } from './dynamicMatrixIds';

/**
 * Fixed-grid matrix table: admin-configured row headers (left, field.rowHeaders)
 * × admin-configured columns (top, field.columns) — a genuinely two-dimensional
 * grid, distinct from the "rows" layout (which transposes a variable number of
 * *submitted* rows into columns). The grid shape here is entirely admin-defined
 * and never edited by whoever fills the form: no SN column, no Add/Remove Row,
 * no Add Column.
 *
 * `answers` is this field's slice of the matrix answer adapter's internal model
 * — { [rowId]: { [columnId]: value } } — see dynamicMatrixAdapter.js for the
 * to/from-backend conversion. That adapter's backend shape is unverified for
 * now, so callers should pass readOnly regardless of the form's own lock state
 * until it's confirmed (see the callers in AssignedSchemaPreview.jsx and
 * DynamicAuthorityReviewPanel.jsx).
 */
export default function DynamicMatrixTable({ field, answers = {}, onCellChange, docs, setDocs, readOnly = true }) {
  const rowHeaders = field.rowHeaders || [];
  const columns = field.columns || [];
  const labelStyle = { ...TH, textAlign: 'left', width: 220 };

  if (!rowHeaders.length || !columns.length) {
    return <p style={{ color: '#64748b', fontSize: 13 }}>This matrix table has no rows/columns configured.</p>;
  }

  return <div style={{ overflowX: 'auto' }}>
    <table className="dynamic-appraisal-table" style={{ ...T, minWidth: Math.max(520, 220 + columns.length * 160) }}>
      <colgroup><col style={{ width: 220 }} />{columns.map((_, index) => <col key={index} />)}</colgroup>
      <thead>
        <tr>
          <th style={labelStyle}>{field.rowHeaderTitle || ''}</th>
          {columns.map((column, index) => <th key={matrixColumnId(column, index)} style={TH}>{column.label || column.name || column.key}{column.required ? ' *' : ''}</th>)}
        </tr>
      </thead>
      <tbody>
        {rowHeaders.map((rowHeader, rowIndex) => {
          const rowId = matrixRowId(rowHeader, rowIndex);
          const rowAnswers = answers[rowId] || {};
          return <tr key={rowId}>
            <th scope="row" style={labelStyle}>{matrixRowLabel(rowHeader)}</th>
            {columns.map((column, colIndex) => {
              const columnId = matrixColumnId(column, colIndex);
              const docId = `${field.key}-${rowId}-${columnId}`;
              return <td key={columnId} style={TD}>
                <SchemaFieldCell
                  field={{ ...column, key: columnId }}
                  value={rowAnswers[columnId]}
                  mode="self"
                  readOnly={readOnly}
                  onChange={(value) => { if (!readOnly) onCellChange?.(rowId, columnId, value); }}
                  docId={docId}
                  docs={docs}
                  setDocs={setDocs}
                  center={['number', 'integer', 'checkbox'].includes(column.type)}
                />
              </td>;
            })}
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}
