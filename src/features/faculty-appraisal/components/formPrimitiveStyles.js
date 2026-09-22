export const tableStyles = {
  T: {
    width: "100%",
    minWidth: 1080,
    tableLayout: "fixed",
    borderCollapse: "separate",
    borderSpacing: 0,
    fontSize: 13,
    color: "#111827",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    overflow: "hidden",
    boxShadow: "none",
  },
  TH: {
    border: "none",
    borderBottom: "1px solid #e2e8f0",
    borderRight: "1px solid #f1f5f9",
    padding: "12px 10px",
    background: "#f8fafc",
    color: "#1e1b4b",
    fontWeight: 800,
    textAlign: "center",
    fontSize: 12,
    letterSpacing: 0,
    lineHeight: 1.25,
    height: 46,
    whiteSpace: "normal",
    wordBreak: "normal",
  },
  TH_HOD: {
    border: "none",
    borderBottom: "1px solid #ddd6fe",
    borderRight: "1px solid #f1f5f9",
    padding: "12px 10px",
    background: "linear-gradient(180deg, #f5f3ff 0%, #eef2ff 100%)",
    color: "#4c1d95",
    fontWeight: 800,
    textAlign: "center",
    fontSize: 12,
    letterSpacing: 0,
    lineHeight: 1.25,
    height: 46,
    whiteSpace: "normal",
    wordBreak: "normal",
  },
  TD: {
    border: "none",
    borderBottom: "1px solid #f1f5f9",
    borderRight: "1px solid #f8fafc",
    padding: "8px 10px",
    verticalAlign: "middle",
    height: 52,
    lineHeight: 1.35,
    background: "#fff",
    color: "#111827",
    overflowWrap: "anywhere",
    wordBreak: "normal",
  },
};

tableStyles.TDC = { ...tableStyles.TD, textAlign: "center", overflowWrap: "normal" };
tableStyles.TDS = { ...tableStyles.TD, textAlign: "center", background: "#f8fafc", minWidth: 78, fontWeight: 800, color: "#334155" };
tableStyles.TDS_HOD = { ...tableStyles.TDS, background: "#f4f6ff", color: "#4f46e5" };
tableStyles.TH_DIR = { ...tableStyles.TH, background: "#ecfdf5", color: "#047857" };
tableStyles.TDS_DIR = { ...tableStyles.TDS, background: "#f0fdf4", minWidth: 82, color: "#047857" };
tableStyles.TH_DEAN = { ...tableStyles.TH, background: "#f5f3ff", color: "#6d28d9" };
tableStyles.TDS_DEAN = { ...tableStyles.TDS, background: "#faf5ff", minWidth: 82, color: "#6d28d9" };
tableStyles.TH_VC = { ...tableStyles.TH, background: "#fffbeb", color: "#92400e" };
tableStyles.TDS_VC = { ...tableStyles.TDS, background: "#fffbeb", minWidth: 82, color: "#92400e" };
tableStyles.TDV = { ...tableStyles.TD, background: "#fbfcff", width: 150, minWidth: 150, maxWidth: 176, padding: "10px 12px", textAlign: "center", overflowWrap: "normal", overflow: "hidden" };

export const { T, TH, TH_HOD, TH_DIR, TH_DEAN, TH_VC, TD, TDC, TDS, TDS_HOD, TDS_DIR, TDS_DEAN, TDS_VC, TDV } = tableStyles;
