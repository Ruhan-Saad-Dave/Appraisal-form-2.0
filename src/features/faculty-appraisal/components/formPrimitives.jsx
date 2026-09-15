/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from "react";
import GuidelinePopover from "./GuidelinePopover";
import { api } from "../../../services/api";
import { filesForDocValue, stripMaxMarksFromTitle } from "../../../utils/appraisalFormUtils";

const documentRawUrl = (file) =>
  typeof file === "string" ? file : file?.url || file?.file_url || file?.fileUrl || file?.document_url || file?.documentUrl || file?.path || file?.location;

const documentFileUrl = (file) => {
  const rawUrl = documentRawUrl(file);
  return rawUrl ? api.getFileUrl(rawUrl) : "";
};

export function openDocumentFile(file) {
  if (!file) return;
  const finalUrl = documentFileUrl(file);
  if (!finalUrl) return;

  if (finalUrl.startsWith("data:")) {
    try {
      const parts = finalUrl.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : "application/pdf";
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, "_blank");
      if (!win) {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.target = "_blank";
        a.click();
      }
      return;
    } catch (err) {
      console.error("Error opening data URL blob:", err);
    }
  }

  const win = window.open(finalUrl, "_blank");
  if (!win) {
    const a = document.createElement("a");
    a.href = finalUrl;
    a.target = "_blank";
    a.click();
  }
}

export function downloadDocumentFile(file) {
  if (!file) return;
  let finalUrl = documentFileUrl(file);
  if (!finalUrl) return;

  if (finalUrl.startsWith("data:")) {
    try {
      const parts = finalUrl.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      finalUrl = URL.createObjectURL(blob);
    } catch (err) {
      console.error("Error creating download blob:", err);
    }
  }

  const a = document.createElement("a");
  a.href = finalUrl;
  a.download = (typeof file === "object" && file.name) ? file.name : "document";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function DocumentIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  );
}

/* eslint-disable no-unused-vars */
function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export const SECTION_GUIDELINES = {
  A1: {
    title: "A1. Course Delivery & Classroom Engagement (Max 40)",
    rules: [
      "10 marks per course (max 4 courses).",
      "Score = 10 for 100% classes conducted vs. LMS JUNO schedule",
      "9 marks for 91–99% classes conducted",
      "8 marks for 81–90% classes conducted",
      "7 marks for 70–80% classes conducted",
      "0 marks for below 70% classes conducted"
    ]
  },
  A2: {
    title: "A2. Course File & Curriculum Documentation (Max 20)",
    rules: [
      "As per IQAC-approved index. Score = 20 for 100% completion, scaled down per slab (90%→18, 80%→16, 70%→14, 60%→12, below 60%→0).",
      "Upload authentic IQAC index compliance document in Attachment column."
    ]
  },
  A3: {
    title: "A3. Innovative Teaching-Learning Methods (Max 20)",
    rules: [
      "4 marks per method used (max 5 methods, Max 20 marks total).",
      "Attach class photos, LMS records, or activity report as proof for each claimed method."
    ]
  },
  A4: {
    title: "A4. Student Feedback Score (Max 10)",
    rules: [
      "Feedback ≥ 4.60 → 10 | 4.30–4.59 → 9 | 4.00–4.29 → 7 | 3.70–3.99 → 5 | 3.40–3.69 → 3 | 3.00–3.39 → 1 | < 3.00 → 0 + mentoring plan required.",
      "Valid only if ≥ 50% of enrolled students respond."
    ]
  },
  A5: {
    title: "A5. Learning Outcomes Attainment & OBE Practice (Max 20)",
    rules: [
      "1. CO-PO mapping sheet: 5 marks",
      "2. Attainment calculation: 10 marks",
      "3. Corrective action plan taken: 5 marks"
    ]
  },
  A6: {
    title: "A6. Student Project Guidance (Max 20)",
    rules: [
      "Curriculum project guided — 5 marks/batch (max 4 batches).",
      "PG (M.Tech/MBA etc.) awarded: 5 marks/student (max 10).",
      "+3 bonus for industrial collaboration/sponsorship.",
      "+3 bonus for award/competition outcome.",
      "+3 bonus for student publication from project."
    ]
  },
  A7: {
    title: "A7. Student Mentoring & Counselling (Max 10)",
    rules: [
      "1. Mentoring meetings conducted (min 2/semester): 2 marks",
      "2. Mentoring register maintained: 3 marks",
      "3. Documented academic/career counselling outcomes: 3 marks"
    ]
  },
  A8: {
    title: "A8. Qualification Enhancement (Max 10)",
    rules: [
      "Higher qualification achieved during the AY — 10 marks.",
      "Add-on certification / MOOC — 5 marks each."
    ]
  },
  B1: {
    title: "B1. Journal Publications (Max 100)",
    rules: [
      "Indexing (SCOPUS/SCI/SCIE/WoS): Q1 → 25, Q2 → 20, Q3 → 15, Q4 → 10 marks.",
      "Impact Factor Bonus: IF ≤ 5 → +3, IF > 5 → +5.",
      "Under review (max 2): 5 marks.",
      "Multi-author DYPIU split: 70% first/corresponding author, 30% each co-author.",
      "DYPIU affiliation mandatory."
    ]
  },
  B2: {
    title: "B2. Books, Book Chapters & Edited Volumes (Max 30)",
    rules: [
      "Book — International: 20, National: 15, Local (ISBN): 10 marks.",
      "Chapter: 5 marks (70/30 split for DYPIU co-authors).",
      "Editor — Intl: 10, National: 8, Local: 5 marks.",
      "Translation — chapter/paper: 5, book: 10 marks."
    ]
  },
  B3: {
    title: "B3. Patents, Copyrights, IP & Creative Product Development (Max: 40)",
    rules: [
      "Patent Granted — National: 30, International: 20.",
      "Patent Published — National: 8, International: 5.",
      "Design Patent Granted: 10.",
      "Copyright/Trademark Granted: 5 (Arts/Design: 10).",
      "Technology transfer: 15.",
      "Product used in lab/university: 10/product."
    ]
  },
  B4: {
    title: "B4. External Funded Research Projects (Max 40)",
    rules: [
      "Completed (external): >₹10L → 15, ₹5–10L → 10, <₹5L → 6 marks.",
      "Ongoing (external): >₹10L → 10, ₹5–10L → 8, <₹5L → 5 marks.",
      "Submitted proposal (external): >₹20L → 10, <₹20L → 5 marks.",
      "Internal project: Completed → 10, Ongoing → 5 marks."
    ]
  },
  B5: {
    title: "B5. Research Guidance (Max 20)",
    rules: [
      "PhD awarded (supervisor): 10 marks/scholar.",
      "PhD ongoing: 5 marks/scholar."
    ]
  },
  B6: {
    title: "B6. Consultancy, Testing & Training (Max 20)",
    rules: [
      "Revenue per engagement: up to ₹50K → 3, ₹50K–1.99L → 5, ₹2L–4.99L → 10, ₹5L–9.99L → 15, >₹10L → 20 marks."
    ]
  },
  B7: {
    title: "B7. Conference / FDP Contributions — As Resource Person (Max 20)",
    rules: [
      "Conference / FDP contribution as Resource Person: 5 marks/event.",
      "FDP as Resource Person (≥ 1 week, max 2): 5 marks/FDP."
    ]
  },
  B8: {
    title: "B8. Conference / FDP / Industry Training — Attended (Max 20)",
    rules: [
      "SCOPUS-indexed conference paper: 10 marks/paper.",
      "Non-indexed: International → 5, National → 3, Poster → 2 marks.",
      "Invited lecture / Resource person: 5 marks/session.",
      "FDP / STTP / Conference attended: 5 marks/event (max 2).",
      "Industrial training (min 3 days): 10 marks."
    ]
  },
  B9: {
    title: "B9. Research Awards, Fellowships & Citations (Max 20)",
    rules: [
      "Fellowship: International → 10, National/State → 5 marks.",
      "Research excellence award: External → 10, Internal → 5 marks.",
      "Best paper award: 5 marks.",
      "H-index: 1–2 → 1 | 3–4 → 2 | 5–7 → 3 | 8–10 → 4 | >10 → 5 marks.",
      "Cumulative citations > 100: 5 marks.",
      "Journal Reviewer: 5 marks per paper reviewed."
    ]
  },
  B10: {
    title: "B10. Innovation, Start-ups & Technology Transfer (Max 20)",
    rules: [
      "Start-up incubated at university TBI: 15 marks.",
      "Start-up mentored / co-founded: 10 marks.",
      "Prototype demonstrated at national event: 8 marks.",
      "Technology transfer agreement: 10 marks.",
      "Innovation recognised by govt/external body: 7 marks."
    ]
  },
  B11: {
    title: "B11. ICT Content, MOOCs & E-Learning (Max 20)",
    rules: [
      "MOOC / Coursera / SWAYAM course developed: 5 marks/course.",
      "E-content on course (publicly available): 5 marks/item."
    ]
  },
  B12: {
    title: "B12. Exhibitions — Photography, Design & Applied Arts, Documentaries, Films & Audio-Visual Productions (Max 30)",
    rules: [
      "Solo exhibition — International: 15; National: 10; Institutional: 5.",
      "Group/curated exhibition participation — International: 8; National: 5; Institutional: 3.",
      "Exhibition curated/organised (curator role): 8/exhibition.",
      "Design/art work showcased at a national trade fair, biennale, or design week: 8/showcase.",
      "Evidence: exhibition catalogue/invitation, curator's note, photographs of the work on display."
    ]
  },
  C1: {
    title: "C1. Administration at University Level (Max 50)",
    rules: [
      "Short-term (one-time activity): 10 marks/activity.",
      "Semester / Term (3–6 months): 20 marks/activity.",
      "Academic Year (> 6 months): 30 marks/activity."
    ]
  },
  C2: {
    title: "C2. Administration at School Level (Max 30)",
    rules: [
      "Short-term: 5 marks/activity.",
      "Semester / Term: 10 marks/activity.",
      "Academic Year: 20 marks/activity."
    ]
  },
  C3: {
    title: "C3. Event Organisation & Institutional Visibility (Max 20)",
    rules: [
      "Conference / Seminar / FDP organised: 5 marks/event.",
      "Dept symposium / hackathon / workshop: 5 marks/event.",
      "Cultural / Sports / Fest: 5 marks/event.",
      "Industry-Academia Conclave: 5 marks/event.",
      "Media / PR contribution: 5 marks/contribution."
    ]
  },
  C4: {
    title: "C4. Mentoring Student Clubs, Outreach & Extension (Max 10)",
    rules: [
      "NSS PO / Unnat Bharat Abhiyan coordinator: 10 marks.",
      "UGC-mandated programme: 5 marks/programme.",
      "Health / Blood / Environmental drive: 5 marks/activity.",
      "Community development project: 5 marks/project.",
      "Mentoring club activity: 3 marks per activity."
    ]
  },
  C5: {
    title: "C5. Industry Interaction & Linkages (Max 10)",
    rules: [
      "MOU signed/renewed: 5 marks/MOU (max 2).",
      "Center of Excellence (CoE) established: 10 marks.",
      "Campus recruitment drive facilitated: 5 marks/company.",
      "Industrial training programme coordinated: 5 marks/programme.",
      "Expert lecture organized: 3 marks/session."
    ]
  },
  C6: {
    title: "C6. Alumni Engagement & Networking (Max 10)",
    rules: [
      "Alumni meet / reunion organised: 5 marks/event.",
      "Alumni guest lecture / webinar coordinated: 3 marks/session.",
      "Any other alumni activity: 3 marks/activity."
    ]
  },
  C7: {
    title: "C7. Student Placement Mentoring & Career Development (Max 20)",
    rules: [
      "Students placed under direct mentoring: 2 marks/student.",
      "Pre-placement training conducted: 5 marks.",
      "New company facilitated: 5 marks/company (max 2).",
      "Internship converted to PPO: 5 marks/student (max 2).",
      "Competitive-exam mentoring (GATE/GRE/CAT/UPSC): 2 marks/student.",
      "Mock interview / GD / resume session: 5 marks/session (max 2)."
    ]
  },
  D: {
    title: "Part D. Annual Confidential Report (ACR) (Max 50)",
    rules: [],
    rubricScale: {
      title: "Suggested Rubric Scale (5-point, used per parameter):",
      rows: [
        { rating: "10 – Outstanding", descriptor: "Consistently exceeds expectations; sets benchmark for others" },
        { rating: "8 – Very Good", descriptor: "Regularly meets and often exceeds expectations" },
        { rating: "6 – Good/Satisfactory", descriptor: "Meets expectations reliably" },
        { rating: "4 – Needs Improvement", descriptor: "Inconsistent; falls short in some areas, needs monitoring" },
        { rating: "0 – Unsatisfactory", descriptor: "Consistently below expectations; requires intervention" }
      ]
    }
  },
  PART_A: {
    title: "Part A - Teaching & Academic Activities (Max 250)",
    rules: [
      "A1. Course Delivery & Lectures: Max 50 marks",
      "A2. Course File & LMS: Max 20 marks",
      "A3. Innovative Teaching Methods: Max 30 marks",
      "A4. Student Feedback: Max 30 marks",
      "A5. OBE Attainment & Assessment: Max 30 marks",
      "A6. Project Guidance & Capstone: Max 30 marks",
      "A7. Mentoring & Student Support: Max 30 marks",
      "A8. Academic Qualification Enhancement: Max 20 marks"
    ]
  },
  PART_B: {
    title: "Part B - Research & Innovation / Academic Contributions (Max 350)",
    rules: [
      "B1. Research Papers & Publications: Max 60 marks",
      "B2. Books & Book Chapters: Max 30 marks",
      "B3. Patents, IP & Copyrights: Max 40 marks",
      "B4. External Funded Research Projects: Max 40 marks",
      "B5. Research Guidance (PhD): Max 20 marks",
      "B6. Consultancy, Testing & Training: Max 20 marks",
      "B7. Conferences / FDPs as Resource Person: Max 20 marks",
      "B8. Conferences / FDPs Attended: Max 20 marks",
      "B9. Research Awards & Fellowships: Max 20 marks",
      "B10. Innovation, Start-ups & Tech Transfer: Max 20 marks",
      "B11. ICT & MOOCs: Max 20 marks",
      "B12. Exhibitions & Creative Work: Max 30 marks"
    ]
  },
  PART_C: {
    title: "Part C - Governance, Institutional Development & Extension (Max 150)",
    rules: [
      "C1. University Level Governance: Max 50 marks",
      "C2. School / Dept Level Governance: Max 30 marks",
      "C3. Event Organisation & Visibility: Max 20 marks",
      "C4. Student Clubs, Outreach & Extension: Max 10 marks",
      "C5. Industry Linkages & MOUs: Max 10 marks",
      "C6. Alumni Engagement: Max 10 marks",
      "C7. Placement Mentoring: Max 20 marks"
    ]
  }
};

export function getGuidelineForTitle(titleText) {
  if (!titleText) return null;
  const str = typeof titleText === "string" ? titleText : String(titleText);

  // Check section overviews first
  if (/^part b\b/i.test(str)) return SECTION_GUIDELINES.PART_B;
  if (/^part a\b/i.test(str)) return SECTION_GUIDELINES.PART_A;
  if (/^part c\b/i.test(str)) return SECTION_GUIDELINES.PART_C;
  if (/^part d\b/i.test(str)) return SECTION_GUIDELINES.D;

  const match = str.match(/\b([A-D]\d{1,2})\b/i);
  if (match) {
    const key = match[1].toUpperCase();
    if (SECTION_GUIDELINES[key]) return SECTION_GUIDELINES[key];
  }
  if (/course delivery|lectures/i.test(str)) return SECTION_GUIDELINES.A1;
  if (/course file/i.test(str)) return SECTION_GUIDELINES.A2;
  if (/innovative/i.test(str)) return SECTION_GUIDELINES.A3;
  if (/feedback/i.test(str)) return SECTION_GUIDELINES.A4;
  if (/obe|outcomes/i.test(str)) return SECTION_GUIDELINES.A5;
  if (/project guidance|guided student/i.test(str)) return SECTION_GUIDELINES.A6;
  if (/mentor/i.test(str)) return SECTION_GUIDELINES.A7;
  if (/qualification/i.test(str)) return SECTION_GUIDELINES.A8;
  if (/journal|publication/i.test(str)) return SECTION_GUIDELINES.B1;
  if (/book/i.test(str)) return SECTION_GUIDELINES.B2;
  if (/patent/i.test(str)) return SECTION_GUIDELINES.B3;
  if (/funded|research project/i.test(str)) return SECTION_GUIDELINES.B4;
  if (/guidance|phd/i.test(str)) return SECTION_GUIDELINES.B5;
  if (/consultancy|testing/i.test(str)) return SECTION_GUIDELINES.B6;
  if (/resource person|organised|organized/i.test(str)) return SECTION_GUIDELINES.B7;
  if (/attended/i.test(str)) return SECTION_GUIDELINES.B8;
  if (/award|citation|fellowship/i.test(str)) return SECTION_GUIDELINES.B9;
  if (/startup|start-up|\binnovation\b|technology transfer/i.test(str)) return SECTION_GUIDELINES.B10;
  if (/ict|mooc|e-learning/i.test(str)) return SECTION_GUIDELINES.B11;
  if (/exhibition|photography|audio-visual/i.test(str)) return SECTION_GUIDELINES.B12;
  if (/part d|acr|annual confidential/i.test(str)) return SECTION_GUIDELINES.D;
  return null;
}

export function SectionInfoButton({ titleText, customGuideline, popoverPlacement = "right", popoverWidth = 380, popoverClassName }) {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef(null);
  const closeTimer = useRef(null);
  const keepOpen = () => { clearTimeout(closeTimer.current); setIsOpen(true); };
  const scheduleClose = () => { clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setIsOpen(false), 200); };
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const data = customGuideline || getGuidelineForTitle(titleText);
  const opensLeft = popoverPlacement === "left";
  if (!data) return null;

  return (
    <div
      style={{ display: "inline-flex", position: "relative", marginLeft: 8, verticalAlign: "middle" }}
      onMouseEnter={keepOpen}
      onMouseLeave={scheduleClose}
      onKeyDown={(event) => { if (event.key === 'Escape') { anchorRef.current?.focus(); setIsOpen(false); } }}
      onFocus={() => setIsOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && !event.relatedTarget?.closest('[data-guideline-popover]')) setIsOpen(false);
      }}
    >
      <button
        ref={anchorRef}
        type="button"
        className="appraisal-info-btn"
        onClick={(e) => { e.stopPropagation(); keepOpen(); }}
        aria-label="Guidelines info"
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: isOpen ? "#4338ca" : "#e0e7ff",
          color: isOpen ? "#fff" : "#4338ca",
          border: "1.5px solid #a5b4fc",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 900,
          fontStyle: "normal",
          cursor: "pointer",
          transition: "all 0.15s ease",
          boxShadow: "0 2px 5px rgba(0,0,0,0.08)",
          lineHeight: 1,
        }}
      >
        i
      </button>

      {isOpen && (
        <GuidelinePopover
          data-guideline-popover="true"
          anchorRef={anchorRef}
          onMouseEnter={keepOpen}
          onMouseLeave={scheduleClose}
          className={popoverClassName}
          style={{
            position: "absolute",
            top: 28,
            ...(opensLeft ? { right: 0 } : { left: 0 }),
            zIndex: 9999,
            width: popoverWidth,
            maxWidth: `min(${popoverWidth}px, calc(100vw - 32px))`,
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: 12,
            padding: "14px 16px",
            boxShadow: "0 16px 40px rgba(15, 23, 42, 0.22)",
            color: "#1e293b",
            textAlign: "left",
            lineHeight: 1.4,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #e2e8f0" }}>
            <span style={{ fontWeight: 800, fontSize: 12.5, color: "#3730a3", display: "flex", alignItems: "center", gap: 6 }}>
              ℹ️ Guidelines & Criteria
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{ background: "none", border: "none", color: "#64748b", fontSize: 14, fontWeight: 800, cursor: "pointer", padding: "0 4px" }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: "#334155", fontWeight: 600 }}>
            {data.title && <div style={{ fontWeight: 800, marginBottom: 6, color: "#1e1b4b", fontSize: 11.5 }}>{data.title}</div>}
            {data.rules && data.rules.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
                {data.rules.map((rule, idx) => (
                  <li key={idx}>{rule}</li>
                ))}
              </ul>
            )}
            {data.rubricScale && (
              <div style={{ marginTop: data.rules && data.rules.length > 0 ? 10 : 4, paddingTop: data.rules && data.rules.length > 0 ? 8 : 0, borderTop: data.rules && data.rules.length > 0 ? "1px solid #e2e8f0" : "none" }}>
                <div style={{ fontWeight: 800, marginBottom: 6, color: "#1e3a8a", fontSize: 11 }}>
                  {data.rubricScale.title}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5, border: "1px solid #cbd5e1" }}>
                  <thead>
                    <tr style={{ background: "#1e3a8a", color: "#ffffff" }}>
                      <th style={{ padding: "4px 6px", textAlign: "left", border: "1px solid #cbd5e1" }}>Rating</th>
                      <th style={{ padding: "4px 6px", textAlign: "left", border: "1px solid #cbd5e1" }}>Descriptor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rubricScale.rows.map((r, i) => (
                      <tr key={i} style={i % 2 === 1 ? { background: "#f8fafc" } : {}}>
                        <td style={{ padding: "4px 6px", fontWeight: 700, border: "1px solid #cbd5e1", whiteSpace: "nowrap" }}>{r.rating}</td>
                        <td style={{ padding: "4px 6px", border: "1px solid #cbd5e1" }}>{r.descriptor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </GuidelinePopover>
      )}
    </div>
  );
}

export function SectionCard({ title, subtitle, accent = "#4f46e5", scoreBadge, guideline, children }) {
  const displayTitle = stripMaxMarksFromTitle(title);

  return (
    <div className="fa-section-card appraisal-section-card" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.03)", marginBottom: 20, overflow: "hidden", border: "1px solid #e2e8f0" }}>
      <div className="appraisal-part-header" style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "#fbfcfd" }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 14 }}>
          <span className="appraisal-part-icon" style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}1A`, color: accent, border: `1px solid ${accent}2A`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3 3 7l9 4 9-4-9-4Z" />
              <path d="M5 10v5c2 2 12 2 14 0v-5" />
              <path d="M12 11v8" />
            </svg>
          </span>
          <div>
            <div className="appraisal-part-title" style={{ fontWeight: 800, fontSize: 18, color: "#4f46e5", letterSpacing: 0, display: "flex", alignItems: "center" }}>
              <span>{displayTitle}</span>
              {/* `guideline` is only ever passed by the dynamic-form part card
                  (AssignedSchemaPreview.jsx) — every Standard/Creative caller
                  omits it, so customGuideline stays undefined for them and
                  SectionInfoButton keeps falling back to its existing
                  getGuidelineForTitle() title-matching exactly as before. */}
              <SectionInfoButton titleText={title} customGuideline={guideline ? { title: `${title} Guideline`, rules: guideline.split(/\r?\n/).filter(Boolean) } : undefined} />
            </div>
            {subtitle && <div style={{ color: "#64748b", fontSize: 13, marginTop: 4, lineHeight: 1.45, fontWeight: 500 }}>{subtitle}</div>}
          </div>
        </div>
        {scoreBadge && (
          <div className="appraisal-part-score" style={{ display: "inline-flex", alignItems: "center", gap: 10, flexShrink: 0, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "6px 14px" }}>
            <span style={{ color: "#475569", fontSize: 12, fontWeight: 700 }}>Total Score</span>
            <span style={{ background: "#eef2ff", color: "#4f46e5", borderRadius: 999, padding: "4px 12px", fontSize: 14, fontWeight: 800, whiteSpace: "nowrap" }}>{scoreBadge}</span>
          </div>
        )}
      </div>
      <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 18 }}>{children}</div>
    </div>
  );
}

export function EmptySectionRow({ colSpan, message = "User did not fill anything in this section." }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        style={{
          padding: "22px 16px",
          textAlign: "center",
          color: "#64748b",
          background: "#f8fafc",
          borderBottom: "1px solid #edf0f7",
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        {message}
      </td>
    </tr>
  );
}

export function RowButtons({ onAdd, onDel, canDel = true, canAdd = true, addLabel = "+ Add Row", deleteLabel = "- Delete Last" }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
      <button type="button" className="appraisal-add-row-button" disabled={!canAdd} title={canAdd ? undefined : "Maximum rows reached"} style={{ minHeight: 38, padding: "8px 18px", background: canAdd ? "#fff" : "#f1f5f9", color: canAdd ? "#4f46e5" : "#94a3b8", border: canAdd ? "1.5px solid #6366f1" : "1.5px solid #cbd5e1", borderRadius: 8, cursor: canAdd ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, boxShadow: "none" }} onClick={onAdd}>{addLabel}</button>
      {canDel && <button type="button" className="appraisal-danger-button" style={{ minHeight: 38, padding: "8px 18px", background: "#fff", color: "#ef4444", border: "1.5px solid #fecaca", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={onDel}>{deleteLabel}</button>}
    </div>
  );
}

export function SectionSaveFooter({ label = "section", saved, saving, locked, onSave, onSaveDraft, onSaveNext, variant = "inline" }) {
  const isCard = variant === "card";
  const handleDraft = onSaveDraft || (() => onSave?.(false));
  const handleNext = onSaveNext || (() => onSave?.(true));

  return (
    <div style={isCard ? { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", boxShadow: "0 10px 24px rgba(17,24,39,0.06)" } : { marginTop: 22, paddingTop: 18, borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
      <span style={{ color: saved ? "#047857" : "#6b7280", fontSize: 14, fontWeight: isCard ? 800 : 700 }}>
        {locked ? "Submitted and locked" : saved ? `${label} saved.` : `Save ${label} and proceed.`}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleDraft}
          disabled={locked || saving}
          style={{ minHeight: 40, padding: isCard ? "9px 16px" : "10px 20px", background: "#fff", color: locked ? "#9ca3af" : "#2563eb", border: `1.5px solid ${locked ? "#d1d5db" : "#2563eb"}`, borderRadius: 10, cursor: locked || saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit", opacity: saving ? 0.75 : 1 }}
        >
          {saving ? "Saving..." : "Save as Draft"}
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={locked || saving}
          style={{ minHeight: 40, padding: isCard ? "9px 16px" : "10px 24px", background: locked ? "#9ca3af" : "#2563eb", color: "#fff", border: "none", borderRadius: 10, cursor: locked || saving ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 14, fontFamily: "inherit", opacity: saving ? 0.75 : 1, boxShadow: locked ? "none" : "0 10px 20px rgba(37,99,235,0.22)" }}
        >
          {saving ? "Saving..." : "Save & Next"}
        </button>
      </div>
    </div>
  );
}

export function DocCell({ id, docs, setDocs, readOnly = false, compact = false }) {
  const ref = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const files = filesForDocValue(docs?.[id]);

  const handleFiles = async (fileList) => {
    if (readOnly) return;
    const selectedFiles = Array.from(fileList || []);
    if (!selectedFiles.length) return;

    setUploading(true);
    setUploadError("");

    try {
      const uploadedFiles = [];
      for (const file of selectedFiles) {
        let uploaded = null;
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("folder", `faculty-appraisal/${id}`);
          const res = await api.post("/upload", formData, { suppressAuthRedirect: true });
          if (res) {
            uploaded = typeof res === "string" ? { url: res, name: file.name, type: file.type } : {
              url: res.url || res.fileUrl || res.path || res.location || res.data?.url,
              name: res.name || file.name,
              type: res.type || file.type,
              size: file.size,
            };
          }
        } catch (err) {
          console.warn("Backend upload warning, attaching file locally:", err);
        }

        if (!uploaded || !uploaded.url) {
          const localUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => resolve(URL.createObjectURL(file));
            reader.readAsDataURL(file);
          });
          uploaded = { name: file.name, url: localUrl, type: file.type || "application/pdf", size: file.size };
        }

        uploadedFiles.push(uploaded);
      }

      setDocs((prev) => ({
        ...prev,
        [id]: filesForDocValue([...filesForDocValue(prev[id]), ...uploadedFiles]),
      }));
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err.message || "Failed to process attachment");
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  };

  const removeFile = (idx) => {
    setDocs((prev) => {
      const updated = [...filesForDocValue(prev[id])];
      updated.splice(idx, 1);
      return { ...prev, [id]: updated };
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: compact ? "row" : "column", ...(compact ? { flexWrap: "wrap", justifyContent: "center" } : {}), alignItems: "center", gap: 6, width: "100%", minWidth: 0 }}>
      {files.map((file, idx) => (
        <div key={idx} style={{ display: "grid", gridTemplateColumns: readOnly ? "1fr" : "minmax(0, 1fr) 18px", alignItems: "center", gap: 4, width: "100%", maxWidth: 88, background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 999, padding: "4px 6px" }}>
          <span style={{ minWidth: 0, fontSize: 10, color: "#14532d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 800 }}>{file.name}</span>
          {!readOnly && <button type="button" aria-label={`Remove ${file.name || "attachment"}`} onClick={() => removeFile(idx)} style={{ width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "1px solid #fecaca", borderRadius: "50%", color: "#dc2626", fontSize: 12, lineHeight: 1, cursor: "pointer", fontWeight: 900, padding: 0 }}>×</button>}
        </div>
      ))}
      <div className="appraisal-doc-upload-btn" role="button" tabIndex={readOnly ? -1 : 0} aria-label="Attach supporting document" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: uploading || readOnly ? "not-allowed" : "pointer", width: 36, height: 36, padding: 0, border: "1px dashed #cbd5e1", borderRadius: 8, background: "#fff", opacity: uploading || readOnly ? 0.7 : 1, color: "#475569", fontWeight: 800, boxShadow: "none" }} onClick={() => !uploading && !readOnly && ref.current?.click()} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !uploading && !readOnly) ref.current?.click(); }}>
        <DocumentIcon />
        <input ref={ref} type="file" multiple style={{ display: "none" }} disabled={uploading || readOnly} onChange={(event) => handleFiles(event.target.files)} />
      </div>
      {uploadError && <span role="alert" style={{ color: "#dc2626", fontSize: 11, fontWeight: 700 }}>{uploadError}</span>}
    </div>
  );
}

export function ViewCell({ id, docs }) {
  return <ViewDocsCell docKey={id} docs={docs} emptyText="" compact />;
}

// Compact, in-page replacement for the browser's blocking confirm()/alert()
// dialogs used during appraisal submission.
export function AppraisalSubmitDialog({ type = "confirm", message, onConfirm, onClose, lightBackdrop = false }) {
  const isConfirm = type === "confirm";
  const isSuccess = type === "success";
  const isError = type === "error";
  const accent = isSuccess ? "#16a34a" : isError ? "#dc2626" : "#4f46e5";
  const accentSoft = isSuccess ? "#dcfce7" : isError ? "#fee2e2" : "#eef2ff";
  const title = isSuccess ? "Appraisal submitted" : isError ? "Submission failed" : "Submit appraisal?";
  const actionLabel = isConfirm ? "Yes, submit" : "Close";

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="appraisal-submit-dialog" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }} style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", padding: "24px 16px", background: lightBackdrop ? "rgba(15, 23, 42, 0.36)" : "rgba(15, 23, 42, 0.56)", backdropFilter: lightBackdrop ? "blur(2px)" : "blur(5px)", animation: "appraisal-dialog-fade-in 160ms ease-out" }}>
      <section className="appraisal-submit-dialog__card" role="dialog" aria-modal="true" aria-labelledby="appraisal-submit-dialog-title" aria-describedby="appraisal-submit-dialog-message" onMouseDown={(event) => event.stopPropagation()} style={{ position: "relative", width: "min(480px, 100%)", overflow: "hidden", border: "1px solid rgba(226, 232, 240, 0.95)", borderRadius: 22, background: "#fff", boxShadow: "0 30px 90px rgba(15, 23, 42, 0.34)", animation: "appraisal-dialog-rise-in 220ms cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ height: 5, background: `linear-gradient(90deg, ${accent}, ${isConfirm ? "#818cf8" : accent})` }} />
        <button type="button" onClick={onClose} aria-label="Close dialog" style={{ position: "absolute", top: 18, right: 18, display: "grid", placeItems: "center", width: 34, height: 34, border: "1px solid #e2e8f0", borderRadius: "50%", background: "#fff", color: "#64748b", fontSize: 21, lineHeight: 1, cursor: "pointer" }}>{"\u00d7"}</button>
        <div style={{ padding: "30px 32px 28px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, paddingRight: 34 }}>
            <div aria-hidden="true" style={{ flex: "0 0 auto", display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: 15, background: accentSoft, color: accent }}>
              {isSuccess ? <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg> : isError ? <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg> : <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v4M12 17h.01" /></svg>}
            </div>
            <div>
              <h2 id="appraisal-submit-dialog-title" style={{ margin: "1px 0 7px", color: "#0f172a", fontSize: 21, lineHeight: 1.25, letterSpacing: "-0.02em", fontWeight: 800 }}>{title}</h2>
              <p id="appraisal-submit-dialog-message" style={{ margin: 0, color: "#64748b", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-line" }}>{message}</p>
            </div>
          </div>
          {isConfirm && <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 22, padding: "11px 13px", border: "1px solid #e0e7ff", borderRadius: 11, background: "#f8faff", color: "#596780", fontSize: 12, lineHeight: 1.45 }}><span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: "50%", background: "#e0e7ff", color: "#4f46e5", fontWeight: 800 }}>i</span><span>Your information will be sent for review and the form will be locked after submission.</span></div>}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 32px 22px", borderTop: "1px solid #f1f5f9", background: "#fcfdff" }}>
          {isConfirm && <button type="button" onClick={onClose} style={{ minWidth: 92, border: "1px solid #d8e0eb", borderRadius: 10, padding: "10px 16px", background: "#fff", color: "#475569", cursor: "pointer", fontSize: 13, fontWeight: 750 }}>Cancel</button>}
          <button type="button" autoFocus onClick={isConfirm ? onConfirm : onClose} style={{ minWidth: isConfirm ? 126 : 92, border: `1px solid ${accent}`, borderRadius: 10, padding: "10px 16px", background: accent, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 750, boxShadow: `0 7px 16px ${accent}35` }}>{actionLabel}</button>
        </div>
      </section>
    </div>
  );
}

export function ViewDocsCell({ docKey, docs, emptyText = "No docs", compact = false }) {
  const docKeys = Array.isArray(docKey) ? docKey : [docKey];
  const files = filesForDocValue(docKeys.flatMap((key) => filesForDocValue(docs?.[key])));

  if (!files.length) {
    return emptyText ? <span style={{ color: "#cbd5e1", fontSize: 10 }}>{emptyText}</span> : null;
  }

  return (
    <div style={{ display: "flex", flexDirection: compact ? "row" : "column", gap: compact ? 5 : 6, alignItems: "center", justifyContent: "center", flexWrap: "wrap", width: "100%", maxWidth: "100%", minWidth: 0, overflow: "hidden" }}>
      {files.map((file, idx) => (
        <div key={`${file.url || file.name || "doc"}-${idx}`} style={{ display: "flex", flexDirection: compact ? "row" : "column", alignItems: "center", justifyContent: "center", gap: 5, width: "100%", maxWidth: "100%", minWidth: 0, overflow: "hidden" }}>
          <a
            className="appraisal-view-docs-btn"
            href={documentFileUrl(file) || "#"}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              e.preventDefault();
              openDocumentFile(file);
            }}
            aria-label={`View ${file.name || "document"}`}
            title={file.name || "Document"}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, color: "#4f46e5", fontSize: compact ? 0 : 12, textDecoration: "none", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: compact ? "50%" : 10, padding: compact ? 0 : "8px 11px", width: compact ? 34 : "auto", maxWidth: compact ? 34 : 142, minWidth: compact ? 34 : 118, height: compact ? 34 : 34, whiteSpace: "nowrap", fontWeight: 900, cursor: "pointer", overflow: "hidden", boxShadow: "0 8px 18px rgba(79,70,229,0.08)", transition: "background 180ms ease, border-color 180ms ease, box-shadow 180ms ease" }}
          >
            {file.type?.startsWith("image/") && file.url && <img src={file.url} alt="" style={{ width: 22, height: 22, objectFit: "cover", borderRadius: 3 }} />}
            <DocumentIcon />
            {!compact && <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>View Docs</span>}
          </a>
        </div>
      ))}
    </div>
  );
}
