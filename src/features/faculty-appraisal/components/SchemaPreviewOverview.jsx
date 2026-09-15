import { useEffect, useState } from 'react';
import { UserRound, CalendarDays } from 'lucide-react';
import { getSessionItem, setActiveAcademicYear } from '../../../auth/session';
import AppraisalHeaderImage from '../../../components/AppraisalHeaderImage';
import { api } from '../../../services/api';
import { getSchoolByValue } from '../../../constants/universityHierarchy';
import { profileFromsessionStorage } from '../../../utils/hierarchy';
import { WorkflowStatusTracker } from '../shared/dashboardComponents';
import OverallProgress from './OverallProgress';
import '../forms/standard/appraisalHeaderDetails.css';
import './schemaPreviewOverview.css';

export default function SchemaPreviewOverview({ academicYear, school, children, progress }) {
  const [status, setStatus] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const email = sessionStorage.getItem('username') || '';
  const identity = `${email}:${school}:${academicYear}:${attempt}`;
  useEffect(() => {
    let cancelled = false;
    api.get('/appraisal/status', { params: { academic_year: academicYear } })
      .then((data) => { if (!cancelled) setStatus({ identity, data }); })
      .catch(() => { if (!cancelled) setStatus({ identity, error: 'Unable to load approval status for this year.' }); });
    return () => { cancelled = true; };
  }, [academicYear, identity]);
  const current = status?.identity === identity ? status : null;
  let storedCycles = [];
  try {
    const source = getSessionItem('availableCyclesSource') === 'backend' ? JSON.parse(getSessionItem('availableCycles') || '[]') : [];
    storedCycles = Array.isArray(source) ? source : source.cycles || source.data || [];
  } catch { /* Keep the selected year available if stored metadata is invalid. */ }
  const cycles = storedCycles.map((cycle) => {
    const rawYear = typeof cycle === 'string' ? cycle : cycle.academic_year || cycle.academicYear || cycle.year || cycle.year_label;
    const year = String(rawYear || '').replace(/^(\d{2})-(\d{2})$/, '20$1-20$2');
    return { year, open: typeof cycle === 'string' ? year === academicYear : cycle.is_open ?? cycle.isOpen ?? cycle.active ?? cycle.open ?? false };
  }).filter((cycle, index, all) => cycle.year && all.findIndex((other) => other.year === cycle.year) === index)
    .sort((a, b) => b.year.localeCompare(a.year));
  if (!cycles.some((cycle) => cycle.year === academicYear)) cycles.unshift({ year: academicYear, open: null });
  const changeYear = (year) => {
    setActiveAcademicYear(year);
    window.dispatchEvent(new CustomEvent('academicYearChanged', { detail: { academicYear: year } }));
  };
  return <div className="schema-appraisal-overview" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div className="appraisal-page-header" style={{ background: '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
      <div className="schema-appraisal-identity" style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        <AppraisalHeaderImage logo="dypiu" height={78} />
        <div>
          <h2 className="appraisal-header-title" style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#111827', letterSpacing: 0, lineHeight: 1.05 }}>My Appraisal Form</h2>
          <div style={{ marginTop: 6, color: '#4b5563', fontSize: 13, fontWeight: 800, lineHeight: 1.25 }}>{getSchoolByValue(school)?.name || school}</div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 10, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800 }}><span className="appraisal-header-person-icon" style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, border: '1px solid #c7d2fe' }}><UserRound size={15} aria-hidden="true" /></span>{sessionStorage.getItem('name') || 'Faculty'}</span>
            <span aria-hidden="true" style={{ width: 1, height: 20, background: '#cbd5e1', display: 'inline-block' }} />
            <span className="appraisal-header-year-label"><CalendarDays size={15} strokeWidth={1.8} aria-hidden="true" />Academic Year:</span>
            <select className="appraisal-year-select" aria-label="Academic year" value={academicYear} onChange={(event) => changeYear(event.target.value)} style={{ height: 36, minWidth: 240, maxWidth: '100%', border: '1px solid #d1d5db', borderRadius: 9, padding: '0 12px', fontSize: 13, fontFamily: 'inherit', fontWeight: 800, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>{cycles.map((cycle) => <option key={cycle.year} value={cycle.year}>{cycle.year}{cycle.open === null ? '' : cycle.open ? ' (Active)' : ' (Closed / Read-Only)'}</option>)}</select>
          </div>
        </div>
      </div>
      <AppraisalHeaderImage logo="iqas" height={78} />
    </div>
    <div className="appraisal-status-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 316px', gap: 12, alignItems: 'stretch' }}>
      <div className="schema-approval-content">
      {current && !current.error ? <WorkflowStatusTracker declaration={current.data?.declaration || null} reviews={current.data?.reviews || []} profile={profileFromsessionStorage()} showPartD /> : <section className="appraisal-approval-tracker" style={{ background: '#fff', padding: 24 }}><h3>Approval Status Tracker</h3><p role={current?.error ? 'alert' : 'status'}>{current?.error || 'Loading approval status…'}</p>{current?.error && <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button>}</section>}
      </div>
      <OverallProgress {...(progress || { loading: true })} />
    </div>
    {children}
  </div>;
}
