import { SchemaFieldCell } from './SchemaSectionTable';
import { ViewCell } from './formPrimitives';
import { T, TH, TD, TDC } from './formPrimitiveStyles';
import { schemaTableScore } from '../../../utils/schemaTableScore';

// Transpose presentation only. Answer keys and document row indices stay intact.
export default function DynamicRowHeaderTable({ field, rows, docs, setDocs, docPrefix = field.key, readOnly = true, onCellChange }) {
  const columns = (field.columns || []).flatMap((column) => column.type === 'file'
    ? [column, { isView: true, source: column }] : [column]);
  const labelStyle = { ...TH, textAlign: 'left', width: 220 };
  return <div style={{ overflowX: 'auto' }}><table className="dynamic-appraisal-table" style={{ ...T, minWidth: Math.max(520, 220 + rows.length * 220) }}>
    <colgroup><col style={{ width: 220 }} />{rows.map((_, index) => <col key={index} />)}</colgroup>
    <tbody>
      {field.autoSerial && <tr><th scope="row" style={labelStyle}>SN</th>{rows.map((_, index) => <td key={index} style={TDC}>{index + 1}</td>)}{!rows.length && <td style={TD}>No submitted entries</td>}</tr>}
      {columns.map((column, index) => {
        const source = column.source || column;
        const key = source.name || source.key;
        return <tr key={index}><th scope="row" style={labelStyle}>{column.isView ? 'View Docs' : `${source.label || key}${source.required ? ' *' : ''}`}</th>
          {rows.map((row, rowIndex) => <td key={rowIndex} style={TD}>{column.isView
            ? <ViewCell id={`${docPrefix}-${key}-${rowIndex}`} docs={docs} />
            : <SchemaFieldCell field={{ ...source, key }} value={row[key]} mode="self" readOnly={readOnly} onChange={(value) => { if (!readOnly) onCellChange?.(rowIndex, key, value); }} docId={`${docPrefix}-${key}-${rowIndex}`} docs={docs} setDocs={setDocs} />}</td>)}
          {!rows.length && <td style={TD}>—</td>}
        </tr>;
      })}
      {Number(field.maxMarks) > 0 && <tr><th scope="row" style={labelStyle}>Total Score (Max {field.maxMarks})</th><td className="dynamic-total-value" colSpan={Math.max(1, rows.length)} style={{ ...TDC, background: '#f0f2ff', fontWeight: 800 }}>{schemaTableScore(field.columns || [], rows).toFixed(1)}</td></tr>}
    </tbody>
  </table></div>;
}
