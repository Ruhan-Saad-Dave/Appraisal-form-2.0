const percent = (score, max) => Math.min(100, Math.round(((parseFloat(score) || 0) / (parseFloat(max) || 1)) * 100)) || 0;

export function Avatar({ initials, src, alt = "Profile picture", color = "#6366f1", size = 40 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,${color},${color}99)`, color: "#fff", fontWeight: 800, fontSize: size * 0.32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, letterSpacing: 0.5, overflow: "hidden" }}>
      {src ? (
        <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        initials
      )}
    </div>
  );
}

export function ScoreBar({ score, max, color = "#6366f1" }) {
  return (
    <div style={{ width: "100%", background: "#f1f5f9", borderRadius: 4, height: 5, overflow: "hidden" }}>
      <div style={{ width: `${percent(score, max)}%`, height: "100%", background: color, borderRadius: 4, transition: "width .5s" }} />
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const uploadedDocCount = (docs = {}, item = {}) => {
  const countKeys = new Set([
    "doc_count",
    "docCount",
    "docs_count",
    "docsCount",
    "document_count",
    "documentCount",
    "documents_count",
    "documentsCount",
    "uploaded_docs_count",
    "uploadedDocsCount",
    "supporting_documents_count",
    "supportingDocumentsCount",
  ]);
  const fileLocatorKeys = [
    "url",
    "file_url",
    "fileUrl",
    "document_url",
    "documentUrl",
    "path",
    "location",
    "storage_path",
    "storagePath",
    "public_id",
    "publicId",
  ];
  const fileNameKeys = [
    "file_name",
    "fileName",
    "filename",
    "original_name",
    "originalName",
    "name",
  ];

  const isFileReference = (src) => {
    const value = String(src ?? "").trim();
    return /^(https?:|blob:|data:)/i.test(value) || /[\\/]/.test(value) || /\.[a-z0-9]{2,8}($|[?#])/i.test(value);
  };
  const hasFileMimeType = (src) =>
    ["type", "file_type", "fileType", "mime_type", "mimeType"].some((key) =>
      /^(image|application|text|video|audio)\//i.test(String(src?.[key] ?? "").trim())
    );
  const hasFileIdentity = (src) => {
    if (!src || typeof src !== "object") return false;
    const hasLocator = fileLocatorKeys.some((key) => String(src?.[key] ?? "").trim() !== "");
    const hasFileName = fileNameKeys.some((key) => String(src?.[key] ?? "").trim() !== "");
    return hasLocator || fileNameKeys.some((key) => isFileReference(src?.[key])) || (hasFileName && hasFileMimeType(src));
  };
  const ignoredFileMetaKeys = new Set([...fileLocatorKeys, ...fileNameKeys, "type", "file_type", "fileType", "mime_type", "mimeType", "size", "file_size", "fileSize", "lastModified"]);

  const countFromSource = (src) => {
    if (typeof src === "number") return 0;
    if (typeof src === "string") return isFileReference(src) ? 1 : 0;
    if (Array.isArray(src)) return src.reduce((total, entry) => total + countFromSource(entry), 0);
    if (!src || typeof src !== "object") return 0;
    const nestedCount = Object.entries(src).reduce((total, [key, value]) => {
      if (countKeys.has(key) || ignoredFileMetaKeys.has(key)) return total;
      return total + countFromSource(value);
    }, 0);
    return Math.max(hasFileIdentity(src) ? 1 : 0, nestedCount);
  };

  const parseNum = (v) => {
    if (v === undefined || v === null || v === "") return 0;
    const parsed = parseFloat(v);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const explicit = Math.max(
    parseNum(item?.docCount),
    parseNum(item?.doc_count),
    parseNum(item?.docsCount),
    parseNum(item?.docs_count),
    parseNum(item?.documentCount),
    parseNum(item?.document_count),
    parseNum(item?.documentsCount),
    parseNum(item?.documents_count),
    parseNum(item?.uploadedDocsCount),
    parseNum(item?.uploaded_docs_count),
    parseNum(item?.payload?.docCount),
    parseNum(item?.payload?.doc_count),
    parseNum(docs?.docCount),
    parseNum(docs?.doc_count),
    parseNum(docs?.docsCount),
    parseNum(docs?.docs_count)
  );

  const c1 = countFromSource(docs);
  const c2 = countFromSource(item?.docs);
  const c3 = countFromSource(item?.documents);
  const c4 = countFromSource(item?.appraisal_documents);
  const c5 = countFromSource(item?.appraisalDocuments);
  const c6 = countFromSource(item?.payload?.docs);
  const c7 = countFromSource(item?.payload?.documents);
  const c8 = countFromSource(item?.payload?.appraisal_documents);
  const actual = Math.max(c1, c2, c3, c4, c5, c6, c7, c8);

  return actual > 0 ? actual : explicit;
};

const metricText = (value) => {
  const score = parseFloat(value) || 0;
  return Number.isFinite(score) ? score.toFixed(1) : "0.0";
};

const METRIC_ICON_PATHS = {
  docs: <><path d="M14.5 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" fill="currentColor" fillOpacity={0.16} /><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
  total: <><circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity={0.16} /><circle cx="12" cy="12" r="9" /><path d="m8.5 12.3 2.3 2.3 4.7-4.9" /></>,
  partA: <><path d="M3 4.5A1.5 1.5 0 0 1 4.5 3H11a1 1 0 0 1 1 1v16.5a.5.5 0 0 1-.77.42L8 18.9l-3.23 2.02a.5.5 0 0 1-.77-.42V4.5Z" fill="currentColor" fillOpacity={0.18} /><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
  partB: <><path d="M5 4a1.5 1.5 0 0 1 1.5-1.5H19v17H6.5a1.5 1.5 0 0 1 0-3H18" fill="currentColor" fillOpacity={0.14} /><path d="M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5a2.5 2.5 0 0 0 0 5H20" /><path d="M8 7h8M8 11h8" opacity={0.7} /></>,
  partC: <><circle cx="9" cy="7" r="4" fill="currentColor" fillOpacity={0.18} /><circle cx="9" cy="7" r="4" /><path d="M17 11a4 4 0 1 0 0-8" /><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>,
  partDE: <><rect x="3" y="4" width="18" height="18" rx="3" fill="currentColor" fillOpacity={0.16} /><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /><circle cx="8" cy="15" r="1.1" fill="currentColor" stroke="none" /><circle cx="12" cy="15" r="1.1" fill="currentColor" stroke="none" /></>,
  default: <><circle cx="12" cy="12" r="8" fill="currentColor" fillOpacity={0.16} /><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /></>,
};

const METRIC_ICON_THEME = {
  docs: { bg: "#f1f5f9", color: "#64748b" },
  total: { bg: "#ede9fe", color: "#7c3aed" },
  partA: { bg: "#e0e7ff", color: "#4338ca" },
  partB: { bg: "#dbeafe", color: "#0369a1" },
  partC: { bg: "#d1fae5", color: "#047857" },
  partDE: { bg: "#fef3c7", color: "#b45309" },
  default: { bg: "#f1f5f9", color: "#64748b" },
};

function metricIconKey(label) {
  const l = String(label || "").toLowerCase();
  if (l.includes("doc")) return "docs";
  if (l.includes("total")) return "total";
  if (l.includes("part a")) return "partA";
  if (l.includes("part b")) return "partB";
  if (l.includes("part c")) return "partC";
  if (l.includes("part d") || l.includes("part e")) return "partDE";
  return "default";
}

function MetricIcon({ label, size = 12, badgeSize = 20 }) {
  const key = metricIconKey(label);
  const theme = METRIC_ICON_THEME[key];
  return (
    <span style={{ width: badgeSize, height: badgeSize, borderRadius: 7, background: theme.bg, color: theme.color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {METRIC_ICON_PATHS[key]}
      </svg>
    </span>
  );
}

export function ReviewMetricsStrip({
  metrics = [],
  docs,
  item,
  includeDocs = true,
  columns,
  style = {},
  compact = false,
}) {
  const docCount = uploadedDocCount(docs, item || (typeof docs === "object" ? docs : {}));
  const allMetrics = [
    ...metrics,
    ...(includeDocs ? [{ label: "Docs", val: docCount, helper: "files uploaded" }] : []),
  ];

  return (
    <div className="review-metrics"
      style={{
        display: "grid",
        // Keep the configured metric columns consistent across review queues.
        gridTemplateColumns: columns || `repeat(${Math.max(allMetrics.length, 1)}, minmax(0, 1fr))`,
        "--metric-count": Math.max(allMetrics.length, 1),
        gap: compact ? 6 : 8,
        ...style,
      }}
    >
      {/* A different color per tile used to be passed by each caller here (blue/green/orange/
          purple...), competing for attention against the person's name/role above this strip.
          One neutral color throughout now - the label icon + text is what distinguishes each
          tile, not its color - callers no longer need to (and can stop) passing a `color` per metric. */}
      {allMetrics.map(({ label, val, max, helper, displayValue, showProgress = true }) => {
        const hasMax = max !== undefined && max !== null;
        return (
          <div key={label} style={{ minWidth: 0, background: "#fff", borderRadius: 10, padding: compact ? "7px 8px" : "9px 10px", boxShadow: "0 1px 4px rgba(15,23,42,0.05), 0 1px 2px rgba(15,23,42,0.04)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
              <MetricIcon label={label} size={compact ? 10 : 11.5} badgeSize={compact ? 18 : 20} />
              <span style={{ fontSize: compact ? 7 : 7.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "normal", lineHeight: 1.2, minWidth: 0 }}>{label}</span>
            </div>
            <div style={{ fontSize: compact ? 11.5 : 13.5, fontWeight: 900, color: "#1e293b", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {displayValue ?? (hasMax ? metricText(val) : parseFloat(val) || 0)}
              {hasMax && <span style={{ fontSize: compact ? 7 : 8, color: "#94a3b8", fontWeight: 700 }}>/{max}</span>}
            </div>
            {hasMax ? showProgress && <div style={{ marginTop: 5 }}><ScoreBar score={val} max={max} color="#94a3b8" /></div> : <div style={{ fontSize: 8, color: "#94a3b8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{helper || "files uploaded"}</div>}
          </div>
        );
      })}
    </div>
  );
}

const PART_COLORS = {
  partA: "#6d5dfc",
  partB: "#0f9f9a",
  partC: "#ef6f61",
  partD: "#f59e0b",
};

const scoreValue = (value) => (parseFloat(value) || 0).toFixed(1);

export function ScoreCard({
  title,
  subtitle = "",
  totals = {},
  maxScores = {},
  remarksTitle,
  remarksContent,
  extraContent,
  sideContent,
  partsLayout = "vertical",
  cardStyle = {},
  isFinal = false,
  compact = false,
  accent = "#0ea5e9",
}) {
  const parts = [
    ["partA", "Part A"],
    ["partB", "Part B"],
    ...(maxScores.partC !== undefined ? [["partC", "Part C"]] : []),
    ...(maxScores.partD !== undefined ? [["partD", "Part D"]] : []),
  ];
  const totalMax = maxScores.grand ?? maxScores.total ?? 0;
  const hasRemarks = remarksContent !== undefined && remarksContent !== null;
  const horizontalParts = partsLayout === "horizontal";
  const rowPadding = compact ? "7px 10px" : "8px 12px";
  const rowMargin = compact ? 4 : 5;
  const barHeight = compact ? 4 : 5;
  const marksPanel = (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: compact ? 8 : 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ width: compact ? 32 : 36, height: compact ? 32 : 36, borderRadius: 9, background: `${accent}16`, border: `1px solid ${accent}30`, color: accent, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900, flexShrink: 0 }}>{title.slice(0, 1)}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: compact ? 13 : 14, fontWeight: 900, color: "#0f172a" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, lineHeight: 1.25 }}>{subtitle}</div>}
          </div>
        </div>
        <div style={{ border: `1px solid ${accent}35`, background: `${accent}10`, borderRadius: 10, padding: compact ? "5px 9px" : "6px 10px", fontSize: compact ? 13 : 14, fontWeight: 900, color: accent, whiteSpace: "nowrap" }}>
          {scoreValue(totals.total)}<span style={{ fontSize: 11, color: "#94a3b8" }}> /{totalMax}</span>
        </div>
      </div>

      <div style={{ border: "1px solid #dbe3ef", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 18px rgba(15,23,42,0.03)", display: horizontalParts ? "grid" : "block", gridTemplateColumns: horizontalParts ? "repeat(auto-fit, minmax(135px, 1fr))" : undefined }}>
        {parts.map(([key, label]) => {
          const color = PART_COLORS[key];
          const value = totals[key];
          const max = maxScores[key] ?? 0;
          return (
            <div key={key} style={{ padding: rowPadding, borderBottom: horizontalParts ? "none" : "1px solid #edf2f7", borderRight: horizontalParts ? "1px solid #edf2f7" : "none", background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: rowMargin }}>
                <span style={{ color: "#475569", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
                <span style={{ color, fontSize: compact ? 13 : 14, fontWeight: 900, whiteSpace: "nowrap" }}>{scoreValue(value)}<span style={{ fontSize: 10, color: "#94a3b8" }}> /{max}</span></span>
              </div>
              <div style={{ height: barHeight, background: "#eef2f7", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${percent(value, max)}%`, background: color, borderRadius: 999 }} />
              </div>
            </div>
          );
        })}
        <div style={{ padding: rowPadding, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: rowMargin }}>
            <span style={{ color: "#475569", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.4 }}>Total</span>
            <span style={{ color: "#059669", fontSize: compact ? 14 : 15, fontWeight: 900, whiteSpace: "nowrap" }}>{scoreValue(totals.total)}<span style={{ fontSize: 10, color: "#94a3b8" }}> /{totalMax}</span></span>
          </div>
          <div style={{ height: barHeight, background: "#eef2f7", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${percent(totals.total, totalMax)}%`, background: "#059669", borderRadius: 999 }} />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div
      style={{
        background: "#fff",
        border: isFinal ? "1.5px solid #7c3aed" : "1px solid #dbe3ef",
        borderLeft: `4px solid ${isFinal ? "#7c3aed" : accent}`,
        borderRadius: 12,
        padding: compact ? 10 : 12,
        display: "flex",
        flexDirection: "column",
        gap: compact ? 8 : 10,
        boxShadow: isFinal ? "0 14px 34px rgba(124,58,237,0.12)" : "0 10px 26px rgba(15,23,42,0.06)",
        minHeight: 0,
        ...cardStyle,
      }}
    >
      {sideContent ? (
        <div className="score-card-side-layout" style={{ display: "grid", gridTemplateColumns: "minmax(320px, 0.9fr) minmax(320px, 1.1fr)", gap: compact ? 10 : 12, alignItems: "start", minHeight: 0 }}>
          <div style={{ display: "grid", gap: compact ? 8 : 10, alignContent: "start" }}>
            {marksPanel}
            {extraContent}
          </div>
          {sideContent}
        </div>
      ) : (
        <>
          {marksPanel}
          {extraContent && <div className="score-card-extra-slot">{extraContent}</div>}
        </>
      )}

      {hasRemarks && (
        <div className="score-card-remarks-slot" style={{ background: isFinal ? "#fff" : "#f8fafc", border: isFinal ? "1px solid #e9d5ff" : "1px solid #e2e8f0", borderRadius: 10, padding: compact ? "8px 10px" : "9px 11px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: isFinal ? "#5b21b6" : "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>{remarksTitle || `${title} Remarks`}</div>
          <div className="score-card-remarks-content">{remarksContent}</div>
        </div>
      )}
    </div>
  );
}

export function CompactSummaryCard({ title, subtitle, totals, maxScores, accent = "#312e81", remarksTitle, remarksContent }) {
  const rows = [
    ["Part A", totals.partA, maxScores.partA, "#6366f1"],
    ["Part B", totals.partB, maxScores.partB, "#0ea5e9"],
    ...(maxScores.partC !== undefined ? [["Part C", totals.partC, maxScores.partC, "#0f766e"]] : []),
    ...(maxScores.partD !== undefined ? [["Part D", totals.partD, maxScores.partD, "#f59e0b"]] : []),
    ["Total", totals.total, maxScores.grand, "#059669"],
  ];
  const hasRemarks = Boolean(remarksContent);

  return (
    <div style={{ background: "rgba(255,255,255,0.96)", border: "1px solid #e7eaf3", borderRadius: 16, padding: 14, display: "grid", gridTemplateColumns: hasRemarks ? "minmax(300px, 0.95fr) minmax(280px, 1.05fr)" : "1fr", gap: 12, alignItems: "stretch", boxShadow: "0 16px 38px rgba(15,23,42,0.07)" }}>
      <div style={{ display: "grid", gap: 9, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{title}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{subtitle}</div>
          </div>
          <div style={{ background: `${accent}14`, color: accent, border: `1px solid ${accent}33`, borderRadius: 12, padding: "7px 12px", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap", boxShadow: "0 8px 18px rgba(15,23,42,0.05)" }}>
            {(parseFloat(totals.total) || 0).toFixed(1)} / {maxScores.grand}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`, gap: 8 }}>
          {rows.map(([label, value, max, color]) => (
            <div key={label} style={{ background: "linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)", border: "1px solid #eef2f7", borderRadius: 10, padding: "9px 10px", minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline", marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>{label}</span>
                <span style={{ fontSize: 11, color, fontWeight: 900, whiteSpace: "nowrap" }}>{(parseFloat(value) || 0).toFixed(1)} / {max}</span>
              </div>
              <ScoreBar score={value} max={max} color={color} />
            </div>
          ))}
        </div>
      </div>
      {hasRemarks && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "11px 12px", minWidth: 0 }}>
          <div style={{ fontWeight: 900, color: accent, fontSize: 12, marginBottom: 5 }}>{remarksTitle}</div>
          {remarksContent}
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status = "Pending Review" }) {
  const map = {
    Submitted: { bg: "#dbeafe", color: "#1e40af", dot: "#3b82f6" },
    "Pending Review": { bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
    "Pending HOD Review": { bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
    "Pending Director Review": { bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
    "Pending Dean Review": { bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
    "Pending VC Review": { bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
    Reviewed: { bg: "#d1fae5", color: "#065f46", dot: "#10b981" },
    "HOD Reviewed": { bg: "#dbeafe", color: "#1e40af", dot: "#3b82f6" },
    "Director Reviewed": { bg: "#d1fae5", color: "#065f46", dot: "#10b981" },
    "Director Approved": { bg: "#cffafe", color: "#164e63", dot: "#06b6d4" },
    "Dean Reviewed": { bg: "#ede9fe", color: "#5b21b6", dot: "#7c3aed" },
    "VC Reviewed": { bg: "#d1fae5", color: "#065f46", dot: "#10b981" },
    Rejected: { bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
    "HOD Rejected": { bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
    "Director Rejected": { bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
    "Dean Rejected": { bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
    "VC Rejected": { bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
  };
  const resolved = status || "Pending Review";
  const s = map[resolved] || map["Pending Review"];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
      {resolved}
    </span>
  );
}

export function LogoutConfirmModal({ onCancel, onConfirm, portalName = "the portal", confirmLabel = "Yes, Logout" }) {
  const logoutConfirmButtonStyle = {
    flex: 1,
    minHeight: 44,
    border: "1px solid #b91c1c",
    borderRadius: 10,
    background: "#dc2626",
    color: "#ffffff",
    padding: "10px",
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000, display: "grid", placeItems: "center" }} onClick={onCancel}>
      <div style={{ width: "min(380px, 92vw)", background: "#fff", borderRadius: 12, padding: "26px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", fontFamily: "inherit" }} onClick={(event) => event.stopPropagation()}>
        <div style={{ color: "#0f172a", fontWeight: 900, fontSize: 17, marginBottom: 8 }}>Confirm Logout</div>
        <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6, marginBottom: 18 }}>You are about to leave {portalName}. Any unsaved edits will be lost.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onCancel} style={{ flex: 1, border: "none", borderRadius: 8, background: "#f1f5f9", color: "#475569", padding: "10px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button type="button" onClick={onConfirm} style={logoutConfirmButtonStyle}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
