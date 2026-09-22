import { useEffect, useRef, useState } from 'react';
import { hasActiveRejection } from '../../../utils/hierarchy';
import { ClipboardList } from 'lucide-react';
import { api } from '../../../services/api';
import { fetchDynamicFormSchema } from '../../dynamic-appraisal/services/dynamicFormSchemaCache';
import { buildSchemaPreview, schemaTableGuideline } from '../../../utils/schemaPreview';
import { schemaTableScore } from '../../../utils/schemaTableScore';
import { prepareSchemaTableRows } from '../../../utils/schemaSubmissionRows';
import { loadDynamicAppraisalSnapshot as loadAppraisalSnapshot, saveDynamicAppraisalDraft as saveAppraisalDraftSection, submitDynamicAppraisal as submitAppraisal } from '../../../services/dynamicAppraisalPersistence';
import { SectionCard, RowButtons, SectionSaveFooter, ViewCell, SectionInfoButton, AppraisalSubmitDialog } from './formPrimitives';
import { AppraisalSummaryTable, AppraisalSummaryActionButton, SUMMARY_ATTACHMENTS_DECLARATION, SUMMARY_DECLARATION_TEXT } from './summaryUi';
import { SchemaFieldCell } from './SchemaSectionTable';
import DynamicRowHeaderTable from './DynamicRowHeaderTable';
import DynamicMatrixTable from './DynamicMatrixTable';
import { matrixAnswersFromRows, matrixAnswersToRows } from './dynamicMatrixAdapter';
import { T, TH, TD, TDC, TDS } from './formPrimitiveStyles';
import SummaryOtherInfoField from '../../../components/SummaryOtherInfoField';
import { fetchImageAsDataUrl, safeHtml, displayValue, PRINT_REPORT_CSS } from '../../../utils/fullFormReport';
import { filesForDocValue } from '../../../utils/appraisalFormUtils';
import './dynamicAppraisalTable.css';

const facultyEmailFromSession = () => sessionStorage.getItem('username') || sessionStorage.getItem('email') || '';

// Cycled per part so any number of admin-configured parts gets a distinct, consistent
// color/icon pairing, matching the built-in forms' Appraisal Summary look.
const SUMMARY_PART_STYLES = [
  { color: '#4f46e5', tone: '#eef2ff', iconTone: '#eef2ff', icon: 'book' },
  { color: '#7c3aed', tone: '#f3e8ff', iconTone: '#f5f3ff', icon: 'flask' },
  { color: '#0f766e', tone: '#ccfbf1', iconTone: '#ccfbf1', icon: 'building' },
  { color: '#0891b2', tone: '#cffafe', iconTone: '#cffafe', icon: 'calendar' },
  { color: '#b45309', tone: '#fef3c7', iconTone: '#fef3c7', icon: 'document' },
];

const blankRow = (columns) => {
  const row = {};
  columns.forEach((col) => { row[col.name || col.key] = ''; });
  return row;
};

// Rule: a "file" column always gets an automatic read-only "View Docs" column
// immediately to its right, matching the built-in appraisal forms' Attachment/View
// Docs pairing. Applies to every table in the dynamic (custom-schema) form.
function withAutoViewDocsColumns(columns) {
  return columns.flatMap((column) => column.type === 'file'
    ? [column, { key: `${column.name || column.key}__viewDocs`, isAutoViewDocs: true, sourceColumn: column }]
    : [column]);
}

// Print-report renderer for one admin-configured table, matching the Standard
// Appraisal report's visual language exactly (same <h3>/<table>/.tr/.c/.b classes,
// styled by the same shared PRINT_REPORT_CSS) — but driven entirely by the
// schema's own columns instead of a hardcoded Standard-form section list, since a
// dynamic form's tables/columns are admin-defined and unknown ahead of time.
function renderDynamicTableSection(field, rows, docs) {
  const dataColumns = (field.columns || []).filter((column) => column.type !== 'file');
  const fileColumns = (field.columns || []).filter((column) => column.type === 'file');
  const safeRows = rows.length ? rows : [{}];
  const total = schemaTableScore(field.columns || [], rows);
  const colCount = 1 + dataColumns.length + (fileColumns.length ? 1 : 0);
  const docsForRow = (rowIndex) => fileColumns
    .flatMap((column) => filesForDocValue(docs?.[`${field.key}-${column.name}-${rowIndex}`]))
    .map((file) => (file.url
      ? `<a href="${safeHtml(file.url)}" target="_blank" rel="noreferrer">${safeHtml(file.name || 'Document')}</a>`
      : safeHtml(file.name || 'Document')))
    .join('<br/>') || '&nbsp;';
  return `
  <h3>${safeHtml(field.label || field.recordTitle || field.key)} <span>(Max ${safeHtml(String(field.maxMarks ?? 0))})</span></h3>
  <table>
    <thead><tr>
      <th>SN</th>
      ${dataColumns.map((column) => `<th>${safeHtml(column.label || column.name)}</th>`).join('')}
      ${fileColumns.length ? '<th>Documents</th>' : ''}
    </tr></thead>
    <tbody>
      ${safeRows.map((row, index) => `
      <tr>
        <td class="c">${index + 1}</td>
        ${dataColumns.map((column) => `<td>${displayValue(row?.[column.name])}</td>`).join('')}
        ${fileColumns.length ? `<td>${docsForRow(index)}</td>` : ''}
      </tr>`).join('')}
      ${Number(field.maxMarks) > 0 ? `
      <tr class="tr">
        <td colspan="${colCount - 1}" class="c b">Total Score (Max ${safeHtml(String(field.maxMarks))})</td>
        <td class="c b">${total.toFixed(1)}</td>
      </tr>` : ''}
    </tbody>
  </table>`;
}

// Same declaration/signature block as the Standard Appraisal report (openFullFormReport
// in src/utils/fullFormReport.js) — copied rather than imported, since that file's
// buildSignaturePage helper is private to it; this keeps the dynamic-form report
// fully self-contained without needing to export internals of the shared/Standard
// report module.
function renderDynamicSignaturePage(facultyName) {
  return `
  <h3 style="text-align:center;font-size:16px;background:#d9d9d9;padding:8px;margin-top:18px">DECLARATION BY FACULTY</h3>
  <table class="declaration-table" style="border:none;margin-bottom:14px">
    <tr>
      <td style="border:none;vertical-align:top;width:36px;font-size:22px">&#10003;</td>
      <td style="border:none;line-height:1.75;font-size:13px">
        I, <strong>${safeHtml(facultyName) || '________________________'}</strong>, hereby declare that all the
        information furnished in this Self-Appraisal Report is true, complete, and correct to the best of my
        knowledge and belief. I understand that in the event of any information being found false or incorrect,
        I shall be solely responsible for the consequences thereof and shall be liable for any disciplinary
        action as deemed fit by the University authorities.
      </td>
    </tr>
  </table>
  <table class="declaration-table" style="border:none;margin-bottom:20px">
    <tr>
      <td style="border:none;width:50%;font-size:12px;line-height:1.45">
        <div style="border-bottom:1px solid #000;min-height:36px;margin-bottom:4px">&nbsp;</div>
        <div><strong>Signature of Faculty</strong></div>
        <div style="margin-top:6px"><strong>Name:</strong> ${safeHtml(facultyName) || '&nbsp;'}</div>
      </td>
      <td style="border:none;width:50%">&nbsp;</td>
    </tr>
  </table>`;
}

// Same image-preload-then-print script as the Standard Appraisal report — copied
// (it's not exported from fullFormReport.js) rather than modifying that file.
const DYNAMIC_REPORT_PRINT_SCRIPT = `<script>
window.addEventListener('load', function(){
  const images = Array.from(document.images || []);
  Promise.all(images.map(function(img){
    if (img.complete) return Promise.resolve();
    return new Promise(function(resolve){
      img.onload = resolve;
      img.onerror = resolve;
      setTimeout(resolve, 800);
    });
  })).then(function(){
    setTimeout(function(){ window.focus(); window.print(); }, 120);
  });
});
</script>`;

function EditableTableField({ field, rows, onRowsChange, docs, setDocs, docPrefix, readOnly = false }) {
  const rawColumns = field.columns || [];
  const columns = withAutoViewDocsColumns(rawColumns);
  const safeRows = rows.length ? rows : [blankRow(rawColumns)];
  // Labels affect presentation only, never answer keys or scoring.
  const compactWidth = (column) => {
    if (column.isAutoViewDocs) return null;
    const label = String(column.label || column.name || column.key || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (label === 'sn') return 80;
    if (label === 'faculty score') return 120;
    return null;
  };
  const fixedWidth = (field.autoSerial ? 80 : 0) + columns.reduce((sum, column) => sum + (compactWidth(column) || 0), 0);
  const flexibleCount = columns.filter((column) => compactWidth(column) === null).length;
  const columnWidth = (column) => compactWidth(column) ?? `calc((100% - ${fixedWidth}px) / ${flexibleCount || 1})`;

  const setCell = (rowIndex, colKey, value) => {
    if (readOnly) return;
    onRowsChange(safeRows.map((row, i) => (i === rowIndex ? { ...row, [colKey]: value } : row)));
  };
  const addRow = () => onRowsChange([...safeRows, blankRow(rawColumns)]);
  const deleteLastRow = () => onRowsChange(safeRows.length > 1 ? safeRows.slice(0, -1) : safeRows);

  // Rule: whenever the table has a configured max marks, an automatic "Total Score"
  // footer bar appears, summing only Faculty Score / Self Score across rows.
  const showTotal = Number(field.maxMarks) > 0 && columns.length > 0;
  const totalScore = showTotal
    ? schemaTableScore(rawColumns, safeRows)
    : 0;

  switch (field.layout || 'columns') {
    case 'matrix': {
      // Matrix answers are kept as one row object per admin-configured row header
      // (tagged with a stable __rowId) — the same flat-array-of-rows shape every
      // other dynamic table already saves under form[field.sectionCode], so this
      // reuses the exact same draft-save/submit/reload path (PUT /appraisal/snapshot,
      // POST /appraisal/submit) with no separate matrix-specific persistence needed.
      // See dynamicMatrixAdapter.js for the row<->answers conversion.
      const matrixAnswers = matrixAnswersFromRows(field, safeRows);
      const handleMatrixCellChange = (rowId, columnId, value) => {
        if (readOnly) return;
        onRowsChange(matrixAnswersToRows(field, { ...matrixAnswers, [rowId]: { ...matrixAnswers[rowId], [columnId]: value } }));
      };
      return <DynamicMatrixTable field={field} answers={matrixAnswers} docs={docs} setDocs={setDocs} readOnly={readOnly} onCellChange={handleMatrixCellChange} />;
    }
    case 'rows':
      return <div>
        <DynamicRowHeaderTable field={field} rows={safeRows} docs={docs} setDocs={setDocs} docPrefix={docPrefix} readOnly={readOnly} onCellChange={setCell} />
        {!readOnly && <RowButtons onAdd={addRow} onDel={deleteLastRow} canDel={safeRows.length > 1} />}
      </div>;
    default:
      break;
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
      <table className="dynamic-appraisal-table" style={{ ...T, ...(!flexibleCount ? { width: fixedWidth, minWidth: fixedWidth } : {}) }}>
        <colgroup>{field.autoSerial && <col style={{ width: 80, minWidth: 80 }} />}{columns.map((column, index) => <col key={index} style={{ width: columnWidth(column) }} />)}</colgroup>
        <thead>
          <tr>
            {field.autoSerial && <th style={{ ...TH, width: 80, minWidth: 80, paddingInline: 6, whiteSpace: 'nowrap' }}>SN</th>}
            {columns.map((column, j) => <th key={j} style={{ ...TH, width: columnWidth(column), ...(compactWidth(column) === 80 ? { paddingInline: 6, whiteSpace: 'nowrap' } : {}) }}>{column.isAutoViewDocs ? 'View Docs' : `${column.label || column.name || column.key}${column.required ? ' *' : ''}`}</th>)}
          </tr>
        </thead>
        <tbody>
          {safeRows.map((row, rowIndex) => {
            const colKeyFor = (column) => column.name || column.key;
            return (
              <tr key={rowIndex}>
                {field.autoSerial && <td style={{ ...TDC, width: 80, minWidth: 80, paddingInline: 6, whiteSpace: 'nowrap' }}>{rowIndex + 1}</td>}
                {columns.map((column, j) => {
                  if (column.isAutoViewDocs) {
                    const sourceKey = colKeyFor(column.sourceColumn);
                    return (
                      <td key={j} style={{ ...TDC, width: columnWidth(column) }}>
                        <ViewCell id={`${docPrefix}-${sourceKey}-${rowIndex}`} docs={docs} />
                      </td>
                    );
                  }
                  const colKey = colKeyFor(column);
                  const isCentered = ['number', 'integer', 'checkbox'].includes(column.type);
                  return (
                    <td key={j} style={{ ...(isCentered ? TDC : TD), width: columnWidth(column), ...(compactWidth(column) === 80 ? { paddingInline: 6 } : {}) }}>
                      <SchemaFieldCell
                        readOnly={readOnly}
                        field={{ ...column, key: colKey }}
                        value={row[colKey]}
                        onChange={(v) => setCell(rowIndex, colKey, v)}
                        mode="self"
                        center={isCentered}
                        docId={`${docPrefix}-${colKey}-${rowIndex}`}
                        docs={docs}
                        setDocs={setDocs}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {showTotal && <tr style={{ background: '#eff6ff' }}>
            <td style={{ ...TDC, fontWeight: 'bold' }} colSpan={(field.autoSerial ? 1 : 0) + columns.length - 1}>Total Score (Max {field.maxMarks})</td>
            <td className="dynamic-total-value" style={{ ...TDS, fontWeight: 'bold', color: '#1e3a5f' }}>{totalScore.toFixed(1)}</td>
          </tr>}
        </tbody>
      </table>
      </div>
      {!readOnly && <RowButtons onAdd={addRow} onDel={deleteLastRow} canDel={safeRows.length > 1} />}
    </div>
  );
}

export default function AssignedSchemaPreview({ assignment, academicYear, school, sectionTab, onSectionTabChange, onProgressChange }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const [values, setValues] = useState({});
  const [tableRows, setTableRows] = useState({});
  const [docs, setDocs] = useState({});
  const [snapshotState, setSnapshotState] = useState(null);
  const [saveState, setSaveState] = useState({ saving: false, savedFor: null, error: '' });
  const [summaryOtherInfo, setSummaryOtherInfo] = useState('');
  const [declarationConfirmed, setDeclarationConfirmed] = useState(false);
  const [attachmentsConfirmed, setAttachmentsConfirmed] = useState(false);
  const [submitDialog, setSubmitDialog] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lockStatus, setLockStatus] = useState(null);
  const schemaLoaded = useRef(null);
  const identity = `${school}:${assignment}:${academicYear}:${attempt}`;
  const locked = submitted || lockStatus?.identity !== identity || !!lockStatus?.error || lockStatus?.locked
    || snapshotState?.identity !== identity || !!snapshotState?.error || submitting;
  useEffect(() => {
    let cancelled = false;
    api.get('/appraisal/status', { params: { academic_year: academicYear } }).then((data) => {
      if (cancelled) return;
      const declaration = data?.declaration;
      const status = String(declaration?.status || data?.workflow_status || data?.status || '').trim().toLowerCase();
      const isLocked = !hasActiveRejection(declaration, data?.reviews || [])
        && (Boolean(declaration?.submitted_at) || (!!status && !['draft', 'not submitted'].includes(status)));
      setLockStatus({ identity, locked: isLocked });
    }).catch(() => { if (!cancelled) setLockStatus({ identity, error: 'Unable to verify submission status. Reload to retry; editing is disabled for safety.' }); });
    return () => { cancelled = true; };
  }, [academicYear, identity]);
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let lastRequest = 0;
    const controller = new AbortController();
    const refresh = async () => {
      if (cancelled || inFlight || document.hidden || ((submitted || lockStatus?.locked) && schemaLoaded.current === identity) || submitting || saveState.saving) return;
      // Focus and visibility events often arrive together; coalesce them.
      if (Date.now() - lastRequest < 5000) return;
      lastRequest = Date.now();
      inFlight = true;
      try {
        const records = await fetchDynamicFormSchema({ academicYear, signal: controller.signal });
        const preview = buildSchemaPreview(records, assignment);
        if (!cancelled) schemaLoaded.current = identity;
        if (!cancelled) setResult((previous) => {
          if (previous?.identity === identity && JSON.stringify(previous.preview) === JSON.stringify(preview)) return previous;
          return { identity, preview };
        });
      } catch (error) {
        // A failed background refresh must not replace an already usable form.
        if (!cancelled) setResult((previous) => previous?.identity === identity && previous.preview
          ? previous : { identity, error: error?.message || 'Unable to load schema. Check your access and retry.' });
      } finally {
        inFlight = false;
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [assignment, academicYear, identity, submitted, submitting, saveState.saving, lockStatus?.locked]);
  const current = result?.identity === identity ? result : null;
  useEffect(() => {
    if (!current || current.error) {
      onProgressChange?.({ academicYear, assignment, loading: !current, error: current?.error || '' });
      return;
    }
    if (snapshotState?.identity !== identity || snapshotState.error) {
      onProgressChange?.({ academicYear, assignment, loading: snapshotState?.identity !== identity, error: snapshotState?.identity === identity ? snapshotState.error : '' });
      return;
    }
    // Reviewer-only parts are never filled in by faculty, so they're excluded from
    // this self-progress indicator entirely — faculty can't make "progress" on a
    // part they never see.
    const parts = current.preview.parts.filter((part) => !part.isReviewerOnlyPart).map((part) => {
      const tables = part.fields.filter((field) => field.type === 'table');
      return [part.label,
        tables.reduce((sum, field) => sum + schemaTableScore(field.columns || [], tableRows[field.key] || []), 0),
        tables.reduce((sum, field) => sum + (Number(field.maxMarks) || 0), 0)];
    });
    const total = parts.reduce((sum, part) => sum + part[1], 0);
    const max = parts.reduce((sum, part) => sum + part[2], 0);
    onProgressChange?.({ academicYear, assignment, total, max, parts, percentage: max > 0 ? Math.round(total / max * 100) : 0,
      unavailable: max > 0 ? '' : 'Overall progress needs configured table maximum marks.' });
  }, [current, tableRows, academicYear, assignment, onProgressChange, snapshotState, identity]);

  useEffect(() => {
    if (!current || current.error) return undefined;
    // Schema refreshes must never reload saved answers over in-progress edits.
    if (snapshotState?.identity === identity) return undefined;
    let cancelled = false;
    const facultyEmail = facultyEmailFromSession();
    loadAppraisalSnapshot({ facultyEmail, academicYear }).then((payload) => {
      if (cancelled) return;
      setSnapshotState({ identity });
      if (!payload?.form) return;
      const savedForm = payload.form;
      const nextValues = {};
      const nextRows = {};
      current.preview.parts.forEach((part) => part.fields.forEach((field) => {
        const savedSection = savedForm[field.sectionCode];
        if (savedSection === undefined) return;
        if (field.type === 'table') {
          if (Array.isArray(savedSection)) nextRows[field.key] = savedSection;
        } else if (savedSection && typeof savedSection === 'object' && field.key in savedSection) {
          nextValues[field.key] = savedSection[field.key];
        }
      }));
      setValues((prev) => ({ ...nextValues, ...prev }));
      setTableRows((prev) => ({ ...nextRows, ...prev }));
      if (payload.docs) setDocs((prev) => ({ ...payload.docs, ...prev }));
      if (typeof savedForm.summaryOtherInfo === 'string') setSummaryOtherInfo(savedForm.summaryOtherInfo);
      if (typeof savedForm.declarationConfirmed === 'boolean') setDeclarationConfirmed(savedForm.declarationConfirmed);
      if (typeof savedForm.attachmentsConfirmed === 'boolean') setAttachmentsConfirmed(savedForm.attachmentsConfirmed);
    }).catch(() => { if (!cancelled) setSnapshotState({ identity, error: 'Unable to load saved scores. Reload to retry.' }); });
    return () => { cancelled = true; };
  }, [current, academicYear, identity, snapshotState]);

  const isSummaryTab = sectionTab === 'Summary';
  // Reviewer-only parts are scored directly by HOD/Director/Dean/VC and never
  // shown to faculty at all — see DynamicAuthorityReviewPanel.jsx.
  const fillableParts = current && !current.error ? current.preview.parts.filter((part) => !part.isReviewerOnlyPart) : [];
  const visibleParts = current && !current.error && !isSummaryTab
    ? (sectionTab && fillableParts.some((part) => part.label === sectionTab)
        ? fillableParts.filter((part) => part.label === sectionTab)
        : fillableParts)
    : [];

  // Dynamic summary: every part's tables, scored the same way as the live progress
  // panel, plus a grand total. Rebuilt from the schema every time, so it reflects
  // whatever parts/tables the admin has configured for this custom form.
  const partSummaries = current && !current.error
    ? fillableParts.map((part) => {
        const tables = part.fields.filter((field) => field.type === 'table');
        const tableSummaries = tables.map((field) => ({
          key: field.key,
          title: field.label || field.recordTitle || field.key,
          score: schemaTableScore(field.columns || [], tableRows[field.key] || []),
          max: Number(field.maxMarks) || 0,
        }));
        return {
          label: part.label,
          tables: tableSummaries,
          score: tableSummaries.reduce((sum, table) => sum + table.score, 0),
          max: tableSummaries.reduce((sum, table) => sum + table.max, 0),
        };
      })
    : [];
  const grandScore = partSummaries.reduce((sum, part) => sum + part.score, 0);
  const grandMax = partSummaries.reduce((sum, part) => sum + part.max, 0);

  const buildFormPayload = () => {
    const form = { summaryOtherInfo, declarationConfirmed, attachmentsConfirmed };
    (current?.preview?.parts || []).forEach((part) => part.fields.forEach((field) => {
      if (field.type === 'table') {
        form[field.sectionCode] = tableRows[field.key] || [];
      } else {
        form[field.sectionCode] = { ...(form[field.sectionCode] || {}), [field.key]: values[field.key] };
      }
    }));
    return form;
  };

  const submitterProfileFromSession = () => ({
    name: sessionStorage.getItem('name') || '',
    desig: sessionStorage.getItem('designation') || '',
    school: sessionStorage.getItem('school') || '',
    qual: sessionStorage.getItem('qualification') || '',
    experience: sessionStorage.getItem('experience') || '',
    ay: academicYear,
  });

  const saveDraft = async () => {
    if (locked || !current || current.error) return;
    setSaveState({ saving: true, savedFor: null, error: '' });
    const form = buildFormPayload();
    try {
      await saveAppraisalDraftSection({
        facultyEmail: facultyEmailFromSession(),
        academicYear,
        form,
        docs,
        totals: {},
      });
      setSaveState({ saving: false, savedFor: sectionTab, error: '' });
    } catch (error) {
      setSaveState({ saving: false, savedFor: null, error: error?.message || 'Could not save draft.' });
    }
  };

  const handleSaveNext = async () => {
    if (locked) return;
    await saveDraft();
    const parts = current?.preview?.parts || [];
    const index = parts.findIndex((part) => part.label === sectionTab);
    if (index === -1) {
      if (parts[0]) onSectionTabChange?.(parts[0].label);
      return;
    }
    // Past the last part, land on the dynamic Summary page instead of doing nothing.
    const nextPart = parts[index + 1];
    onSectionTabChange?.(nextPart ? nextPart.label : 'Summary');
  };

  // Matches the Standard Appraisal report's exact visual template (logo header,
  // faculty-info table, PRINT_REPORT_CSS, declaration/signature block, print
  // script) — see src/utils/fullFormReport.js's openFullFormReport for the
  // reference this mirrors. The only real difference is that every section table
  // here is generated from the admin-configured schema (current.preview.parts /
  // field.columns) instead of a hardcoded Standard-form section list, since a
  // dynamic form's parts/tables/columns aren't known until the schema loads.
  const handleGenerateReport = async () => {
    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) { alert('Please allow popups to generate the report.'); return; }

    const logoSrc = await fetchImageAsDataUrl('/image.png');
    const iqacLogoSrc = await fetchImageAsDataUrl('/IQAS.png');
    const info = submitterProfileFromSession();

    const partsHtml = (current?.preview?.parts || []).map((part, index) => `
      ${index > 0 ? '<div class="page-break"></div>' : ''}
      <h3 style="background:#d9d9d9;padding:4px;text-align:center;font-size:13px">${safeHtml(part.label)}</h3>
      ${part.fields.map((field) => field.type === 'table'
        ? renderDynamicTableSection(field, tableRows[field.key] || [], docs)
        : `<h3>${safeHtml(field.label || field.key)}</h3><div class="remarks">${displayValue(values[field.key])}</div>`).join('')}
    `).join('');

    const summaryRowsHtml = partSummaries.map((part) => `
      <tr><td>${safeHtml(part.label)}</td><td class="c">${safeHtml(String(part.max))}</td><td class="c">${part.score.toFixed(1)}</td>
        <td class="c">${part.max > 0 ? ((part.score / part.max) * 100).toFixed(2) : '0.00'}%</td></tr>`).join('');

    const html = `<!doctype html>
<html>
<head>
  <title>Faculty Appraisal</title>
  <style>${PRINT_REPORT_CSS}</style>
</head>
<body>
  <table class="ht"><tr>
    <td style="width:20%;text-align:left"><img class="logo" src="${logoSrc}" alt="DYPIU"/></td>
    <td style="text-align:center">
      <h1>D Y PATIL INTERNATIONAL UNIVERSITY, AKURDI, PUNE</h1>
      <h2>Faculty Appraisal Form - Academic Year ${safeHtml(academicYear)}</h2>
    </td>
    <td style="width:20%;text-align:right"><img class="logo" src="${iqacLogoSrc}" alt="IQAC"/></td>
  </tr></table>
  <table>
    <tr><td class="b" style="width:35%">Name of Faculty</td><td>${displayValue(info.name)}</td></tr>
    <tr><td class="b">Educational Qualifications</td><td>${displayValue(info.qual)}</td></tr>
    <tr><td class="b">Present Designation</td><td>${displayValue(info.desig)}</td></tr>
    <tr><td class="b">School / Department</td><td>${displayValue(info.school)}</td></tr>
    <tr><td class="b">Experience</td><td>${displayValue(info.experience)}</td></tr>
    <tr><td class="b">Academic Year</td><td>${displayValue(academicYear)}</td></tr>
    <tr><td class="b">Generated On</td><td>${safeHtml(new Date().toLocaleString())}</td></tr>
  </table>

  ${partsHtml}

  <div class="page-break"></div>
  <h3 style="text-align:center;font-size:13px">SUMMARY${academicYear ? ` - AY ${safeHtml(academicYear)}` : ''}</h3>
  <table class="st">
    <thead><tr><th>Part</th><th style="width:17%">Maximum</th><th style="width:17%">Faculty Score</th><th style="width:20%">Marks Obtained (%)</th></tr></thead>
    <tbody>
      ${summaryRowsHtml}
      <tr class="tr"><td>Grand Total</td><td class="c">${safeHtml(String(grandMax))}</td><td class="c">${grandScore.toFixed(1)}</td>
        <td class="c">${grandMax > 0 ? ((grandScore / grandMax) * 100).toFixed(2) : '0.00'}%</td></tr>
    </tbody>
  </table>
  ${summaryOtherInfo.trim() ? `<h3>Any other information not covered above</h3><div class="remarks">${displayValue(summaryOtherInfo)}</div>` : ''}

  ${renderDynamicSignaturePage(info.name)}
${DYNAMIC_REPORT_PRINT_SCRIPT}
</body>
</html>`;

    win.document.write(html);
    win.document.close();
  };

  const requestSubmit = () => { if (!locked) setSubmitDialog({ type: 'confirm' }); };

  const doSubmit = async () => {
    if (locked) return;
    setSubmitDialog(null);
    setSubmitting(true);
    try {
      const form = buildFormPayload();
      let submissionDocs = { ...docs };
      (current?.preview?.parts || []).forEach((part) => part.fields.forEach((field) => {
        if (field.type !== 'table') return;
        const prepared = prepareSchemaTableRows(field, tableRows[field.key] || [], submissionDocs);
        form[field.sectionCode] = prepared.rows;
        submissionDocs = prepared.docs;
      }));
      await submitAppraisal({
        facultyEmail: facultyEmailFromSession(),
        academicYear,
        form,
        totals: {},
        docs: submissionDocs,
        submitterProfile: submitterProfileFromSession(),
      });
      setSubmitted(true);
      setSubmitDialog({ type: 'success', message: 'Your appraisal has been submitted for review.' });
    } catch (error) {
      setSubmitDialog({ type: 'error', message: error?.message || 'Submission failed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="appraisal-form-shell" style={{ display: 'grid', gap: 16 }}>
    {!current ? <p role="status">Loading assigned form…</p> : current.error ? <div role="alert"><p>{current.error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button></div> : <>
      {lockStatus?.error ? <p role="alert">{lockStatus.error}</p> : (submitted || lockStatus?.locked) && <p role="status" className="appraisal-lock-notice">Submitted and locked for review. Your answers and documents are read-only.</p>}
      {isSummaryTab ? (
        <SectionCard title="Appraisal Summary & Submission" accent="#10b981">
          {partSummaries.length > 0 ? <AppraisalSummaryTable rows={[
            ...partSummaries.map((part, index) => ({
              label: part.label,
              score: part.score,
              max: part.max,
              ...SUMMARY_PART_STYLES[index % SUMMARY_PART_STYLES.length],
            })),
            { label: 'Grand Total', score: grandScore, max: grandMax, color: '#e11d48', tone: '#ffe4e6', iconTone: '#f1f5f9', icon: 'sigma' },
          ]} /> : <p>No active fields are configured for this form.</p>}

          <SummaryOtherInfoField value={summaryOtherInfo} onChange={setSummaryOtherInfo} rows={5} readOnly={locked} />

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0', color: '#334155', fontSize: 13, lineHeight: 1.5, cursor: 'pointer' }}>
            <input type="checkbox" disabled={locked} checked={declarationConfirmed} onChange={(e) => setDeclarationConfirmed(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: '#2563eb', flexShrink: 0 }} />
            <span>{SUMMARY_DECLARATION_TEXT}</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0', color: '#334155', fontSize: 13, lineHeight: 1.5, cursor: 'pointer' }}>
            <input type="checkbox" disabled={locked} checked={attachmentsConfirmed} onChange={(e) => setAttachmentsConfirmed(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: '#2563eb', flexShrink: 0 }} />
            <span>{SUMMARY_ATTACHMENTS_DECLARATION}</span>
          </label>

          {saveState.error && <p role="alert" style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{saveState.error}</p>}
          {saveState.savedFor === 'Summary' && !saveState.saving && <p style={{ margin: 0, color: '#047857', fontSize: 12.5, fontWeight: 700 }}>Draft saved.</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
            {!locked && <AppraisalSummaryActionButton onClick={saveDraft} disabled={saveState.saving} loading={saveState.saving}>
              {saveState.saving ? 'Saving...' : 'Save Draft'}
            </AppraisalSummaryActionButton>}
            <AppraisalSummaryActionButton onClick={handleGenerateReport}>
              Generate Report
            </AppraisalSummaryActionButton>
            <AppraisalSummaryActionButton
              variant="submit"
              onClick={requestSubmit}
              disabled={locked || !declarationConfirmed || !attachmentsConfirmed}
              locked={submitted || lockStatus?.locked}
              loading={submitting}
            >
              {submitted || lockStatus?.locked ? 'Submitted & Locked' : submitting ? 'Submitting...' : 'Submit Appraisal'}
            </AppraisalSummaryActionButton>
          </div>
          {submitDialog && (
            <AppraisalSubmitDialog
              lightBackdrop
              type={submitDialog.type}
              message={submitDialog.message || 'Your information will be sent for review and the form will be locked after submission.'}
              onConfirm={doSubmit}
              onClose={() => setSubmitDialog(null)}
            />
          )}
        </SectionCard>
      ) : <>
      {!visibleParts.length && <p>No active fields are configured for this form.</p>}
      {visibleParts.map((part) => <SectionCard key={part.label} title={part.label} subtitle="Fill in your responses for this section." accent="#5b5ceb" guideline={part.guideline}>
        {part.fields.map((field, i) => <div key={field.key || i} style={{ marginBottom: 16 }}>
          <div className="appraisal-subsection-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#4338ca', fontWeight: 800 }}>
            <span className="appraisal-subsection-icon" aria-hidden="true"><ClipboardList size={18} strokeWidth={2} /></span>
            <span>{field.label || field.recordTitle || field.key}{field.required ? ' *' : ''}</span>
            <SectionInfoButton titleText={field.label || field.recordTitle || field.key} customGuideline={schemaTableGuideline(field)} popoverWidth={460} popoverClassName="dynamic-table-guidelines" />
          </div>
          {field.type === 'table'
            ? <EditableTableField
                readOnly={locked}
                field={field}
                rows={tableRows[field.key] || []}
                onRowsChange={(rows) => setTableRows((prev) => ({ ...prev, [field.key]: rows }))}
                docs={docs}
                setDocs={setDocs}
                docPrefix={field.key}
              />
            : <SchemaFieldCell
                readOnly={locked}
                field={field}
                value={values[field.key]}
                onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
                mode="self"
                docId={field.key}
                docs={docs}
                setDocs={setDocs}
              />}
        </div>)}
        {saveState.error && <p role="alert" style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{saveState.error}</p>}
        {!locked && <SectionSaveFooter
          label={part.label}
          saved={saveState.savedFor === part.label}
          saving={saveState.saving}
          onSaveDraft={saveDraft}
          onSaveNext={handleSaveNext}
        />}
      </SectionCard>)}
      </>}
    </>}
  </div>;
}
