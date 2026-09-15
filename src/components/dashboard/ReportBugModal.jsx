import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Bug, CircleHelp, Lightbulb, MessageSquare, Ellipsis, X, Send, CheckCircle2, Paperclip, FileText, LoaderCircle, Tag, AlignLeft } from "lucide-react";
import "./ReportBugModal.css";
import { submitFeedback } from "../../services/feedbackService";

// Each category gets its own accent color, applied to the chip's icon, border
// and tinted background when selected — makes the category list scannable at
// a glance instead of every option looking the same until clicked.
const CATEGORY_OPTIONS = [
  ["bug", "Bug", Bug, "#e11d48"], ["query", "Question", CircleHelp, "#2563eb"], ["suggestion", "Idea", Lightbulb, "#d97706"],
  ["feedback", "Feedback", MessageSquare, "#7c3aed"], ["other", "Other", Ellipsis, "#475569"],
];

export function ReportBugButton({ style, iconOnly = false, className, plainIcon = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label="Report a bug or send feedback"
        onClick={() => setOpen(true)}
        title="Report a bug or send feedback"
        style={style || { minHeight: 34, borderRadius: 12, padding: "6px 8px", color: "#c7d2fe", background: "rgba(99,102,241,0.10)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%", fontFamily: "inherit" }}
      >
        {plainIcon ? <Bug size={19} aria-hidden="true" /> : iconOnly ? (
          <span style={{ width: 27, height: 27, borderRadius: 9, background: "linear-gradient(135deg,#a78bfa,#7c3aed)", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(124,58,237,0.4)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="8" y="6" width="8" height="12" rx="4" /><path d="M8 10H4M8 14H4M16 10h4M16 14h4M12 6V3M9.5 5l-1-2M14.5 5l1-2" />
            </svg>
          </span>
        ) : (
          <>
            <span style={{ width: 24, height: 24, borderRadius: 9, background: "rgba(99,102,241,0.18)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="6" width="8" height="12" rx="4" /><path d="M8 10H4M8 14H4M16 10h4M16 14h4M12 6V3M9.5 5l-1-2M14.5 5l1-2" />
              </svg>
            </span>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 800, fontSize: 11 }}>Report a Bug</span>
          </>
        )}
      </button>
      {open && <ReportBugModal onClose={() => setOpen(false)} />}
    </>
  );
}

export default function ReportBugModal({ onClose }) {
  const [category, setCategory] = useState("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [preview, setPreview] = useState("");
  const fileRef = useRef(null);
  const previewUrlRef = useRef("");

  const clearAttachment = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreview("");
    setAttachment(null);
  };

  const selectAttachment = (file) => {
    if (!file) return;
    if (!/\.(png|jpe?g|webp|pdf|txt|log)$/i.test(file.name) || file.size > 5 * 1024 * 1024 || file.size === 0) {
      setError("Choose a non-empty PNG, JPG, WebP, PDF, TXT or LOG file up to 5 MB.");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
    setPreview(previewUrlRef.current);
    setAttachment(file);
    setError("");
  };

  const email = sessionStorage.getItem("email") || sessionStorage.getItem("username") || "";
  const name = sessionStorage.getItem("name") || "";

  // Plays a short exit animation before actually unmounting (see .feedback-dialog.is-closing
  // in the CSS) instead of vanishing instantly — mirrors the smooth entrance animation.
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef(null);
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);
  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    closeTimerRef.current = setTimeout(() => onClose?.(), 140);
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      setError("Please fill in both subject and message.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await submitFeedback({ name, email, category, subject, message, attachment });
      setDone(true);
    } catch (err) {
      setError(attachment
        ? "The report with its attachment could not be sent. File uploads require backend support. Try again, or remove the file to send a text-only report."
        : err.message || "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  return createPortal(
    <dialog ref={dialogRef} className={`feedback-dialog${closing ? " is-closing" : ""}`} aria-label="Report a Bug"
      onCancel={(event) => { event.preventDefault(); requestClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) requestClose();
      }}>
      <header className="feedback-header">
        <span className="feedback-symbol"><Bug size={24} aria-hidden="true" /></span>
        <div><h2>Report a Bug</h2><p>Sent directly to the admin team</p></div>
        <button type="button" className="feedback-close" onClick={requestClose} aria-label="Close" title="Close"><X size={20} /></button>
      </header>
      {done ? (
        <div className="feedback-success">
          <CheckCircle2 size={44} color="#059669" aria-hidden="true" />
          <h3>Report sent</h3>
          <p>Your report has been sent to the admin team. We'll follow up by email if needed.</p>
          <button type="button" className="feedback-submit" onClick={requestClose}>Close</button>
        </div>
      ) : (
        <form className="feedback-form" onSubmit={(event) => { event.preventDefault(); if (!submitting) handleSubmit(); }}>
          <fieldset disabled={submitting}>
            <legend>Category</legend>
            <div className="feedback-categories">
              {CATEGORY_OPTIONS.map(([value, label, Glyph, accent]) => (
                <label key={value} className={category === value ? "is-selected" : ""}
                  style={category === value ? { "--accent": accent, borderColor: accent, background: `${accent}14`, color: accent } : { "--accent": accent }}>
                  <input type="radio" name="feedback-category" value={value} checked={category === value} onChange={() => setCategory(value)} />
                  <Glyph size={18} aria-hidden="true" /><span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="feedback-field"><span className="feedback-field-label"><Tag size={13} aria-hidden="true" />Subject</span>
            <input type="text" required value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={120} placeholder="Short summary" disabled={submitting} />
          </label>
          <label className="feedback-field"><span className="feedback-field-label"><AlignLeft size={13} aria-hidden="true" />Message</span>
            <textarea required value={message} onChange={(event) => setMessage(event.target.value)} maxLength={5000} rows={4} placeholder="What happened? Steps to reproduce, if it's a bug." disabled={submitting} />
          </label>
          <section className="feedback-attachment" aria-label="Optional attachment">
            <div className="feedback-attachment__heading"><span><Paperclip size={13} aria-hidden="true" />Attachment <small>Optional</small></span><span>Up to 5 MB</span></div>
            <input ref={fileRef} type="file" hidden accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.log" disabled={submitting}
              onChange={(event) => { selectAttachment(event.target.files?.[0]); event.target.value = ""; }} />
            {attachment ? (
              <div className="feedback-file">
                {preview ? <img src={preview} alt="Attached screenshot preview" /> : <FileText size={28} aria-hidden="true" />}
                <div><strong>{attachment.name}</strong><span>{Math.max(1, Math.round(attachment.size / 1024))} KB</span></div>
                <button type="button" disabled={submitting} onClick={clearAttachment} title="Remove attachment" aria-label="Remove attachment"><X size={18} /></button>
              </div>
            ) : (
              <button type="button" className="feedback-upload" disabled={submitting} onClick={() => fileRef.current?.click()}>
                <Paperclip size={22} aria-hidden="true" /><span><strong>Attach screenshot or file</strong><small>PNG, JPG, WebP, PDF, TXT, LOG</small></span>
              </button>
            )}
          </section>
          {error && <div role="alert" className="feedback-error">{error}</div>}
          <footer className="feedback-footer"><span className={message.length > 4500 ? "is-near-limit" : ""}>{message.length} / 5000</span>
            <button type="submit" className="feedback-submit" disabled={submitting}>{submitting ? <LoaderCircle className="feedback-spinner" size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}{submitting ? "Sending..." : "Send Report"}</button>
          </footer>
        </form>
      )}
    </dialog>, document.body
  );
}
