import { ArrowLeft, ClipboardCheck, LockKeyhole } from "lucide-react";
import "./reviewerReportHeader.css";

export default function ReviewerReportHeader({ reviewerLabel, readOnly = false, onBack, children }) {
  return (
    <section className="reviewer-report-header" aria-label={`${reviewerLabel} appraisal review`}>
      <header className="reviewer-report-header__heading">
        <div className="reviewer-report-header__title">
          <span className="reviewer-report-header__icon"><ClipboardCheck size={18} aria-hidden="true" /></span>
          <h2>{reviewerLabel} review</h2>
        </div>
        {children && <div className="reviewer-report-header__content"><div className="reviewer-report-header__scores">{children}</div></div>}
        <div className="reviewer-report-header__actions">
          {readOnly && <span className="reviewer-report-header__lock"><LockKeyhole size={12} aria-hidden="true" />Read-only</span>}
          <button type="button" onClick={onBack}><ArrowLeft size={14} aria-hidden="true" />Back</button>
        </div>
      </header>
    </section>
  );
}
